
CREATE TYPE public.round_status AS ENUM ('CREATED','BETTING','RUNNING','CRASHED','SETTLING','SETTLED','CANCELLED');
CREATE TYPE public.bet_status AS ENUM ('PENDING','ACCEPTED','ACTIVE','CASHED_OUT','LOST','REFUNDED','CANCELLED');

-- ============ GAME CONFIG (versioned) ============
CREATE TABLE public.game_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version INTEGER NOT NULL UNIQUE,
  min_bet NUMERIC(38,18) NOT NULL CHECK (min_bet > 0),
  max_bet NUMERIC(38,18) NOT NULL CHECK (max_bet > 0),
  max_payout NUMERIC(38,18) NOT NULL CHECK (max_payout > 0),
  max_exposure NUMERIC(38,18) NOT NULL CHECK (max_exposure > 0),
  betting_duration_ms INTEGER NOT NULL DEFAULT 7000 CHECK (betting_duration_ms >= 1000),
  crash_growth_rate NUMERIC(12,8) NOT NULL DEFAULT 0.00006,
  house_edge_bps INTEGER NOT NULL DEFAULT 100 CHECK (house_edge_bps BETWEEN 0 AND 1000),
  max_crash_multiplier NUMERIC(18,4) NOT NULL DEFAULT 100000,
  algorithm_version TEXT NOT NULL DEFAULT 'v1',
  active BOOLEAN NOT NULL DEFAULT false,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_game_config_single_active ON public.game_configurations(active) WHERE active;
GRANT SELECT ON public.game_configurations TO anon, authenticated;
GRANT ALL ON public.game_configurations TO service_role;
ALTER TABLE public.game_configurations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "game_config_public_read_active" ON public.game_configurations FOR SELECT TO anon, authenticated USING (active);

INSERT INTO public.game_configurations (version, min_bet, max_bet, max_payout, max_exposure, betting_duration_ms, active)
VALUES (1, 0.10, 1000, 100000, 250000, 7000, true);

-- ============ ROUNDS ============
CREATE SEQUENCE public.round_number_seq;
CREATE TABLE public.game_rounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  round_number TEXT NOT NULL UNIQUE,
  status public.round_status NOT NULL DEFAULT 'CREATED',
  config_version INTEGER NOT NULL REFERENCES public.game_configurations(version),
  betting_open_at TIMESTAMPTZ,
  betting_closed_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  crashed_at TIMESTAMPTZ,
  settled_at TIMESTAMPTZ,
  crash_multiplier NUMERIC(18,4) CHECK (crash_multiplier IS NULL OR crash_multiplier >= 1),
  total_wagered NUMERIC(38,18) NOT NULL DEFAULT 0,
  total_payout NUMERIC(38,18) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_game_rounds_status ON public.game_rounds(status);
CREATE INDEX idx_game_rounds_created ON public.game_rounds(created_at DESC);

-- Round state machine + immutability of settled rounds and crash multiplier
CREATE OR REPLACE FUNCTION public.enforce_round_transition()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
DECLARE allowed TEXT[];
BEGIN
  IF OLD.status = NEW.status THEN
    NULL;
  ELSE
    allowed := CASE OLD.status
      WHEN 'CREATED'  THEN ARRAY['BETTING','CANCELLED']
      WHEN 'BETTING'  THEN ARRAY['RUNNING','CANCELLED']
      WHEN 'RUNNING'  THEN ARRAY['CRASHED','CANCELLED']
      WHEN 'CRASHED'  THEN ARRAY['SETTLING']
      WHEN 'SETTLING' THEN ARRAY['SETTLED']
      ELSE ARRAY[]::TEXT[]
    END;
    IF NOT (NEW.status::TEXT = ANY(allowed)) THEN
      RAISE EXCEPTION 'Invalid round transition % -> %', OLD.status, NEW.status;
    END IF;
  END IF;

  IF OLD.crash_multiplier IS NOT NULL AND NEW.crash_multiplier IS DISTINCT FROM OLD.crash_multiplier THEN
    RAISE EXCEPTION 'crash_multiplier is immutable once set';
  END IF;
  IF OLD.round_number <> NEW.round_number THEN
    RAISE EXCEPTION 'round_number is immutable';
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_round_transition BEFORE UPDATE ON public.game_rounds FOR EACH ROW EXECUTE FUNCTION public.enforce_round_transition();
CREATE TRIGGER trg_round_no_delete BEFORE DELETE ON public.game_rounds FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();

GRANT SELECT ON public.game_rounds TO anon, authenticated;
GRANT ALL ON public.game_rounds TO service_role;
GRANT USAGE ON SEQUENCE public.round_number_seq TO service_role;
ALTER TABLE public.game_rounds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rounds_public_read" ON public.game_rounds FOR SELECT TO anon, authenticated USING (true);

-- ============ PROVABLY FAIR ============
CREATE TABLE public.provably_fair_seeds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id UUID NOT NULL UNIQUE REFERENCES public.game_rounds(id) ON DELETE RESTRICT,
  server_seed_hash TEXT NOT NULL,
  server_seed_encrypted TEXT NOT NULL,
  server_seed_revealed TEXT,
  client_seed TEXT NOT NULL,
  nonce BIGINT NOT NULL,
  algorithm_version TEXT NOT NULL DEFAULT 'v1',
  revealed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_seeds_no_delete BEFORE DELETE ON public.provably_fair_seeds FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();
GRANT ALL ON public.provably_fair_seeds TO service_role;
ALTER TABLE public.provably_fair_seeds ENABLE ROW LEVEL SECURITY;

-- Public fairness view: never exposes the encrypted seed before/after reveal
CREATE VIEW public.fairness_public
WITH (security_invoker = true) AS
SELECT s.round_id, r.round_number, s.server_seed_hash, s.client_seed, s.nonce,
       s.algorithm_version, s.revealed_at, s.server_seed_revealed, r.crash_multiplier, r.crashed_at
FROM public.provably_fair_seeds s
JOIN public.game_rounds r ON r.id = s.round_id;
GRANT SELECT ON public.fairness_public TO anon, authenticated;
CREATE POLICY "seeds_public_read_safe" ON public.provably_fair_seeds FOR SELECT TO anon, authenticated USING (true);
REVOKE SELECT ON public.provably_fair_seeds FROM anon, authenticated;

-- ============ BETS ============
CREATE TABLE public.bets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id UUID NOT NULL REFERENCES public.game_rounds(id) ON DELETE RESTRICT,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  wallet_id UUID NOT NULL REFERENCES public.wallets(id) ON DELETE RESTRICT,
  kind public.wallet_kind NOT NULL DEFAULT 'REAL',
  amount NUMERIC(38,18) NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL REFERENCES public.currencies(code),
  auto_cashout_multiplier NUMERIC(18,4) CHECK (auto_cashout_multiplier IS NULL OR auto_cashout_multiplier > 1),
  status public.bet_status NOT NULL DEFAULT 'PENDING',
  placed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  cashout_at TIMESTAMPTZ,
  cashout_multiplier NUMERIC(18,4),
  payout_amount NUMERIC(38,18) CHECK (payout_amount IS NULL OR payout_amount >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (round_id, user_id, placed_at)
);
CREATE INDEX idx_bets_user ON public.bets(user_id);
CREATE INDEX idx_bets_round ON public.bets(round_id);
CREATE INDEX idx_bets_status ON public.bets(status);
CREATE INDEX idx_bets_created ON public.bets(created_at DESC);
CREATE TRIGGER trg_bets_updated BEFORE UPDATE ON public.bets FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.enforce_bet_settlement()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF OLD.status IN ('CASHED_OUT','LOST','REFUNDED','CANCELLED') AND NEW.status <> OLD.status THEN
    RAISE EXCEPTION 'Bet % is already settled (%)', OLD.id, OLD.status;
  END IF;
  IF OLD.amount <> NEW.amount OR OLD.round_id <> NEW.round_id OR OLD.user_id <> NEW.user_id THEN
    RAISE EXCEPTION 'Bet stake and ownership are immutable';
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_bets_settlement BEFORE UPDATE ON public.bets FOR EACH ROW EXECUTE FUNCTION public.enforce_bet_settlement();

GRANT SELECT ON public.bets TO authenticated;
GRANT ALL ON public.bets TO service_role;
ALTER TABLE public.bets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bets_select_own" ON public.bets FOR SELECT TO authenticated USING (user_id = auth.uid());

-- ============ CASHOUTS (one per bet) ============
CREATE TABLE public.cashouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bet_id UUID NOT NULL UNIQUE REFERENCES public.bets(id) ON DELETE RESTRICT,
  round_id UUID NOT NULL REFERENCES public.game_rounds(id) ON DELETE RESTRICT,
  user_id UUID NOT NULL,
  multiplier NUMERIC(18,4) NOT NULL CHECK (multiplier >= 1),
  payout_amount NUMERIC(38,18) NOT NULL CHECK (payout_amount >= 0),
  currency TEXT NOT NULL,
  settled_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_cashouts_round ON public.cashouts(round_id);
CREATE TRIGGER trg_cashouts_immutable BEFORE UPDATE OR DELETE ON public.cashouts FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();
GRANT SELECT ON public.cashouts TO authenticated;
GRANT ALL ON public.cashouts TO service_role;
ALTER TABLE public.cashouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cashouts_select_own" ON public.cashouts FOR SELECT TO authenticated USING (user_id = auth.uid());

-- ============ GAME RESULTS (settlement summary) ============
CREATE TABLE public.game_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id UUID NOT NULL UNIQUE REFERENCES public.game_rounds(id) ON DELETE RESTRICT,
  crash_multiplier NUMERIC(18,4) NOT NULL,
  players INTEGER NOT NULL DEFAULT 0,
  total_wagered NUMERIC(38,18) NOT NULL DEFAULT 0,
  total_payout NUMERIC(38,18) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_game_results_immutable BEFORE UPDATE OR DELETE ON public.game_results FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();
GRANT SELECT ON public.game_results TO anon, authenticated;
GRANT ALL ON public.game_results TO service_role;
ALTER TABLE public.game_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "game_results_public_read" ON public.game_results FOR SELECT TO anon, authenticated USING (true);

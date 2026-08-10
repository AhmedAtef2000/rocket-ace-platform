ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS real_money_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS preferred_currency text NOT NULL DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS play_mode text NOT NULL DEFAULT 'DEMO';

ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS is_real_money_live boolean NOT NULL DEFAULT false;

-- Validate play_mode values at the database level.
ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_play_mode_check;
ALTER TABLE public.users
  ADD CONSTRAINT users_play_mode_check CHECK (play_mode IN ('DEMO', 'REAL'));

-- Ensure preferred_currency references an enabled currency.
ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_preferred_currency_fkey;
ALTER TABLE public.users
  ADD CONSTRAINT users_preferred_currency_fkey FOREIGN KEY (preferred_currency) REFERENCES public.currencies(code);

GRANT SELECT, INSERT, UPDATE ON public.users TO authenticated;
GRANT ALL ON public.users TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.platform_settings TO authenticated;
GRANT ALL ON public.platform_settings TO service_role;

-- Centralised real-money eligibility check used by the game engine and payments.
CREATE OR REPLACE FUNCTION public.assert_real_money_play(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  u RECORD;
  j RECORD;
  k RECORD;
  age INTEGER;
BEGIN
  SELECT id, status, country_code, date_of_birth, real_money_enabled
    INTO u
    FROM public.users
   WHERE id = _user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'USER_NOT_FOUND';
  END IF;

  IF u.status <> 'ACTIVE' THEN
    RAISE EXCEPTION 'REAL_MONEY_ACCOUNT_NOT_ACTIVE';
  END IF;

  IF NOT u.real_money_enabled THEN
    RAISE EXCEPTION 'REAL_MONEY_NOT_ENABLED';
  END IF;

  SELECT status, min_age, name
    INTO j
    FROM public.jurisdictions
   WHERE country_code = u.country_code;

  IF NOT FOUND OR j.status = 'BLOCKED' THEN
    RAISE EXCEPTION 'JURISDICTION_NOT_ALLOWED';
  END IF;

  IF u.date_of_birth IS NULL THEN
    RAISE EXCEPTION 'DATE_OF_BIRTH_REQUIRED';
  END IF;

  age := EXTRACT(YEAR FROM AGE(now(), u.date_of_birth));
  IF age < j.min_age THEN
    RAISE EXCEPTION 'BELOW_MINIMUM_AGE';
  END IF;

  SELECT status
    INTO k
    FROM public.kyc_cases
   WHERE user_id = _user_id
   ORDER BY created_at DESC
   LIMIT 1;

  IF k.status IS NULL OR k.status <> 'APPROVED' THEN
    RAISE EXCEPTION 'KYC_NOT_APPROVED';
  END IF;
END;
$$;

-- Updated game_place_bet that can target either the demo wallet or the real wallet.
CREATE OR REPLACE FUNCTION public.game_place_bet(
  _user_id uuid,
  _round_id uuid,
  _amount numeric,
  _auto_cashout numeric DEFAULT NULL::numeric,
  _mode text DEFAULT 'DEMO'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  r RECORD;
  cfg RECORD;
  w RECORD;
  _bet UUID;
  _exposure NUMERIC;
BEGIN
  IF _mode NOT IN ('DEMO', 'REAL') THEN
    RAISE EXCEPTION 'INVALID_PLAY_MODE';
  END IF;

  SELECT * INTO r FROM public.game_rounds WHERE id = _round_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ROUND_NOT_FOUND'; END IF;
  IF r.status <> 'BETTING' THEN RAISE EXCEPTION 'BETTING_CLOSED'; END IF;

  SELECT * INTO cfg FROM public.game_configurations WHERE version = r.config_version;
  IF _amount < cfg.min_bet OR _amount > cfg.max_bet THEN
    RAISE EXCEPTION 'BET_OUT_OF_RANGE';
  END IF;
  IF _auto_cashout IS NOT NULL AND _auto_cashout <= 1 THEN
    RAISE EXCEPTION 'AUTO_CASHOUT_TOO_LOW';
  END IF;

  IF _mode = 'REAL' THEN
    PERFORM public.assert_real_money_play(_user_id);

    SELECT * INTO w
      FROM public.wallets
     WHERE user_id = _user_id
       AND kind = 'REAL'
       AND currency = (SELECT preferred_currency FROM public.users WHERE id = _user_id)
       AND status = 'ACTIVE';
    IF NOT FOUND THEN RAISE EXCEPTION 'REAL_WALLET_NOT_FOUND'; END IF;
  ELSE
    SELECT * INTO w
      FROM public.wallets
     WHERE user_id = _user_id
       AND kind = 'DEMO'
       AND currency = 'DEMO';
    IF NOT FOUND THEN RAISE EXCEPTION 'WALLET_NOT_FOUND'; END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM public.bets WHERE round_id = _round_id AND user_id = _user_id
              AND status IN ('ACCEPTED','ACTIVE')) THEN
    RAISE EXCEPTION 'BET_ALREADY_PLACED';
  END IF;

  _exposure := COALESCE(r.total_wagered, 0) + _amount;
  IF _exposure > cfg.max_exposure THEN RAISE EXCEPTION 'ROUND_EXPOSURE_LIMIT'; END IF;

  INSERT INTO public.bets (round_id, user_id, wallet_id, kind, amount, currency,
                           auto_cashout_multiplier, status)
  VALUES (_round_id, _user_id, w.id, w.kind, _amount, w.currency, _auto_cashout, 'ACTIVE')
  RETURNING id INTO _bet;

  PERFORM public.move_wallet_lock(w.id, _amount, TRUE, 'BET_LOCK', 'bet', _bet);

  UPDATE public.game_rounds SET total_wagered = COALESCE(total_wagered,0) + _amount
   WHERE id = _round_id;

  RETURN _bet;
END;
$$;

-- Keep the platform settings RLS policy simple: one row, readable by everyone, writable by service role.
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Platform settings readable by all" ON public.platform_settings;
CREATE POLICY "Platform settings readable by all"
  ON public.platform_settings FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Platform settings writable by service role" ON public.platform_settings;
CREATE POLICY "Platform settings writable by service role"
  ON public.platform_settings FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

GRANT SELECT ON public.platform_settings TO anon;

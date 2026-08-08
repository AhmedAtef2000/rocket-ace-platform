-- ============ GAME ENGINE (Phase 7) ============
CREATE OR REPLACE FUNCTION public.game_place_bet(
  _user_id UUID,
  _round_id UUID,
  _amount NUMERIC,
  _auto_cashout NUMERIC DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
  cfg RECORD;
  w RECORD;
  _bet UUID;
  _exposure NUMERIC;
BEGIN
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

  SELECT * INTO w FROM public.wallets
   WHERE user_id = _user_id AND kind = 'DEMO' AND currency = 'DEMO';
  IF NOT FOUND THEN RAISE EXCEPTION 'WALLET_NOT_FOUND'; END IF;

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
END; $$;

CREATE OR REPLACE FUNCTION public.game_cash_out(
  _user_id UUID,
  _bet_id UUID,
  _multiplier NUMERIC
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  b RECORD;
  r RECORD;
  cfg RECORD;
  _payout NUMERIC;
  _profit NUMERIC;
BEGIN
  SELECT * INTO b FROM public.bets WHERE id = _bet_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'BET_NOT_FOUND'; END IF;
  IF b.user_id <> _user_id THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  IF b.status <> 'ACTIVE' THEN RAISE EXCEPTION 'BET_NOT_ACTIVE'; END IF;
  IF _multiplier IS NULL OR _multiplier < 1 THEN RAISE EXCEPTION 'INVALID_MULTIPLIER'; END IF;

  SELECT * INTO r FROM public.game_rounds WHERE id = b.round_id FOR UPDATE;
  IF r.status NOT IN ('RUNNING','CRASHED','SETTLING') THEN RAISE EXCEPTION 'ROUND_NOT_RUNNING'; END IF;

  SELECT * INTO cfg FROM public.game_configurations WHERE version = r.config_version;

  _payout := ROUND(b.amount * _multiplier, 8);
  IF _payout > cfg.max_payout THEN _payout := cfg.max_payout; END IF;
  _profit := _payout - b.amount;

  PERFORM public.move_wallet_lock(b.wallet_id, b.amount, FALSE, 'BET_UNLOCK', 'bet', b.id);
  IF _profit > 0 THEN
    PERFORM public.post_wallet_transaction(b.wallet_id, 'CREDIT', _profit, 'BET_WIN',
                                           'HOUSE', 'bet', b.id);
  END IF;

  UPDATE public.bets
     SET status = 'CASHED_OUT',
         cashout_at = now(),
         cashout_multiplier = _multiplier,
         payout_amount = _payout
   WHERE id = b.id;

  INSERT INTO public.cashouts (bet_id, round_id, user_id, multiplier, payout_amount, currency)
  VALUES (b.id, b.round_id, b.user_id, _multiplier, _payout, b.currency);

  UPDATE public.game_rounds SET total_payout = COALESCE(total_payout,0) + _payout
   WHERE id = r.id;

  RETURN jsonb_build_object('bet_id', b.id, 'multiplier', _multiplier, 'payout', _payout);
END; $$;

CREATE OR REPLACE FUNCTION public.game_settle_round(_round_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
  b RECORD;
  _players INT;
  _wagered NUMERIC;
  _payout NUMERIC;
BEGIN
  SELECT * INTO r FROM public.game_rounds WHERE id = _round_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ROUND_NOT_FOUND'; END IF;
  IF r.status = 'SETTLED' THEN RETURN jsonb_build_object('already_settled', true); END IF;
  IF r.status <> 'CRASHED' THEN RAISE EXCEPTION 'ROUND_NOT_CRASHED'; END IF;
  IF r.crash_multiplier IS NULL THEN RAISE EXCEPTION 'CRASH_NOT_SET'; END IF;

  UPDATE public.game_rounds SET status = 'SETTLING' WHERE id = r.id;

  FOR b IN SELECT * FROM public.bets WHERE round_id = r.id AND status = 'ACTIVE' FOR UPDATE LOOP
    IF b.auto_cashout_multiplier IS NOT NULL AND b.auto_cashout_multiplier <= r.crash_multiplier THEN
      PERFORM public.game_cash_out(b.user_id, b.id, b.auto_cashout_multiplier);
    ELSE
      PERFORM public.move_wallet_lock(b.wallet_id, b.amount, FALSE, 'BET_UNLOCK', 'bet', b.id);
      PERFORM public.post_wallet_transaction(b.wallet_id, 'DEBIT', b.amount, 'BET_LOSS',
                                             'HOUSE', 'bet', b.id);
      UPDATE public.bets SET status = 'LOST', payout_amount = 0 WHERE id = b.id;
    END IF;
  END LOOP;

  SELECT COUNT(DISTINCT user_id), COALESCE(SUM(amount),0), COALESCE(SUM(payout_amount),0)
    INTO _players, _wagered, _payout
    FROM public.bets WHERE round_id = r.id;

  INSERT INTO public.game_results (round_id, crash_multiplier, players, total_wagered, total_payout)
  VALUES (r.id, r.crash_multiplier, _players, _wagered, _payout)
  ON CONFLICT (round_id) DO NOTHING;

  UPDATE public.game_rounds
     SET status = 'SETTLED', settled_at = now(), total_payout = _payout, total_wagered = _wagered
   WHERE id = r.id;

  RETURN jsonb_build_object('players', _players, 'wagered', _wagered, 'payout', _payout);
END; $$;

CREATE OR REPLACE FUNCTION public.game_cancel_round(_round_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE r RECORD; b RECORD; _n INT := 0;
BEGIN
  SELECT * INTO r FROM public.game_rounds WHERE id = _round_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ROUND_NOT_FOUND'; END IF;
  IF r.status IN ('SETTLED','CANCELLED') THEN RETURN jsonb_build_object('refunded', 0); END IF;

  FOR b IN SELECT * FROM public.bets WHERE round_id = r.id AND status IN ('ACCEPTED','ACTIVE') FOR UPDATE LOOP
    PERFORM public.move_wallet_lock(b.wallet_id, b.amount, FALSE, 'BET_REFUND', 'bet', b.id);
    UPDATE public.bets SET status = 'REFUNDED', payout_amount = b.amount WHERE id = b.id;
    _n := _n + 1;
  END LOOP;

  UPDATE public.game_rounds SET status = 'CANCELLED' WHERE id = r.id;
  RETURN jsonb_build_object('refunded', _n);
END; $$;

REVOKE ALL ON FUNCTION public.game_place_bet(UUID, UUID, NUMERIC, NUMERIC) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.game_cash_out(UUID, UUID, NUMERIC) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.game_settle_round(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.game_cancel_round(UUID) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.game_place_bet(UUID, UUID, NUMERIC, NUMERIC) TO service_role;
GRANT EXECUTE ON FUNCTION public.game_cash_out(UUID, UUID, NUMERIC) TO service_role;
GRANT EXECUTE ON FUNCTION public.game_settle_round(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.game_cancel_round(UUID) TO service_role;
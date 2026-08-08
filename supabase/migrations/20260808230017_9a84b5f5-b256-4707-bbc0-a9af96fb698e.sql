-- ============ LEDGER CORE (Phase 5) ============

CREATE OR REPLACE FUNCTION public.ensure_ledger_account(
  _account_type public.ledger_account_type,
  _owner_type public.ledger_owner_type,
  _owner_id UUID,
  _currency TEXT,
  _kind public.wallet_kind
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _id UUID;
BEGIN
  SELECT id INTO _id FROM public.ledger_accounts
   WHERE account_type = _account_type
     AND owner_type = _owner_type
     AND owner_id IS NOT DISTINCT FROM _owner_id
     AND currency = _currency
     AND kind = _kind;
  IF _id IS NULL THEN
    INSERT INTO public.ledger_accounts (account_type, owner_type, owner_id, currency, kind)
    VALUES (_account_type, _owner_type, _owner_id, _currency, _kind)
    ON CONFLICT (account_type, owner_type, owner_id, currency, kind) DO NOTHING
    RETURNING id INTO _id;
    IF _id IS NULL THEN
      SELECT id INTO _id FROM public.ledger_accounts
       WHERE account_type = _account_type AND owner_type = _owner_type
         AND owner_id IS NOT DISTINCT FROM _owner_id
         AND currency = _currency AND kind = _kind;
    END IF;
  END IF;
  RETURN _id;
END; $$;

-- Moves money into or out of a user wallet and writes the matching double entry.
-- _direction is from the USER's perspective: CREDIT increases available, DEBIT decreases it.
CREATE OR REPLACE FUNCTION public.post_wallet_transaction(
  _wallet_id UUID,
  _direction public.ledger_direction,
  _amount NUMERIC,
  _entry_type TEXT,
  _counter_account_type public.ledger_account_type DEFAULT 'HOUSE',
  _reference_type TEXT DEFAULT NULL,
  _reference_id UUID DEFAULT NULL,
  _metadata JSONB DEFAULT '{}'::jsonb
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  w RECORD;
  _tx UUID := gen_random_uuid();
  _user_acct UUID;
  _counter_acct UUID;
BEGIN
  IF _amount IS NULL OR _amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be greater than zero';
  END IF;

  SELECT * INTO w FROM public.wallets WHERE id = _wallet_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Wallet % not found', _wallet_id; END IF;
  IF w.status <> 'ACTIVE' THEN RAISE EXCEPTION 'Wallet % is %', w.id, w.status; END IF;

  _user_acct := public.ensure_ledger_account('USER_WALLET','USER', w.user_id, w.currency, w.kind);
  _counter_acct := public.ensure_ledger_account(_counter_account_type,'SYSTEM', NULL, w.currency, w.kind);

  IF _direction = 'CREDIT' THEN
    UPDATE public.wallets SET available_amount = available_amount + _amount WHERE id = w.id;
  ELSE
    IF w.available_amount < _amount THEN
      RAISE EXCEPTION 'INSUFFICIENT_FUNDS';
    END IF;
    UPDATE public.wallets SET available_amount = available_amount - _amount WHERE id = w.id;
  END IF;

  INSERT INTO public.ledger_entries (transaction_id, account_id, entry_type, direction, amount, currency, reference_type, reference_id, metadata)
  VALUES
    (_tx, _user_acct, _entry_type, _direction, _amount, w.currency, _reference_type, _reference_id, _metadata),
    (_tx, _counter_acct, _entry_type,
      CASE WHEN _direction = 'CREDIT' THEN 'DEBIT'::public.ledger_direction ELSE 'CREDIT'::public.ledger_direction END,
      _amount, w.currency, _reference_type, _reference_id, _metadata);

  RETURN _tx;
END; $$;

-- Reserves (locks) or releases funds inside the same wallet, mirrored in the ledger.
CREATE OR REPLACE FUNCTION public.move_wallet_lock(
  _wallet_id UUID,
  _amount NUMERIC,
  _lock BOOLEAN,
  _entry_type TEXT,
  _reference_type TEXT DEFAULT NULL,
  _reference_id UUID DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  w RECORD;
  _tx UUID := gen_random_uuid();
  _avail_acct UUID;
  _locked_acct UUID;
BEGIN
  IF _amount IS NULL OR _amount <= 0 THEN RAISE EXCEPTION 'Amount must be greater than zero'; END IF;

  SELECT * INTO w FROM public.wallets WHERE id = _wallet_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Wallet % not found', _wallet_id; END IF;
  IF w.status <> 'ACTIVE' THEN RAISE EXCEPTION 'Wallet % is %', w.id, w.status; END IF;

  _avail_acct := public.ensure_ledger_account('USER_WALLET','USER', w.user_id, w.currency, w.kind);
  _locked_acct := public.ensure_ledger_account('USER_LOCKED','USER', w.user_id, w.currency, w.kind);

  IF _lock THEN
    IF w.available_amount < _amount THEN RAISE EXCEPTION 'INSUFFICIENT_FUNDS'; END IF;
    UPDATE public.wallets
       SET available_amount = available_amount - _amount,
           locked_amount = locked_amount + _amount
     WHERE id = w.id;
    INSERT INTO public.ledger_entries (transaction_id, account_id, entry_type, direction, amount, currency, reference_type, reference_id)
    VALUES (_tx, _avail_acct, _entry_type, 'DEBIT', _amount, w.currency, _reference_type, _reference_id),
           (_tx, _locked_acct, _entry_type, 'CREDIT', _amount, w.currency, _reference_type, _reference_id);
  ELSE
    IF w.locked_amount < _amount THEN RAISE EXCEPTION 'INSUFFICIENT_LOCKED_FUNDS'; END IF;
    UPDATE public.wallets
       SET available_amount = available_amount + _amount,
           locked_amount = locked_amount - _amount
     WHERE id = w.id;
    INSERT INTO public.ledger_entries (transaction_id, account_id, entry_type, direction, amount, currency, reference_type, reference_id)
    VALUES (_tx, _locked_acct, _entry_type, 'DEBIT', _amount, w.currency, _reference_type, _reference_id),
           (_tx, _avail_acct, _entry_type, 'CREDIT', _amount, w.currency, _reference_type, _reference_id);
  END IF;

  RETURN _tx;
END; $$;

-- Reconciliation: wallet projection must equal the ledger for every wallet.
CREATE OR REPLACE FUNCTION public.wallet_ledger_drift()
RETURNS TABLE (
  wallet_id UUID,
  user_id UUID,
  currency TEXT,
  wallet_total NUMERIC,
  ledger_total NUMERIC,
  drift NUMERIC
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT w.id,
         w.user_id,
         w.currency,
         w.available_amount + w.locked_amount AS wallet_total,
         COALESCE(l.total, 0) AS ledger_total,
         (w.available_amount + w.locked_amount) - COALESCE(l.total, 0) AS drift
    FROM public.wallets w
    LEFT JOIN (
      SELECT a.owner_id, a.currency, a.kind,
             SUM(CASE WHEN e.direction = 'CREDIT' THEN e.amount ELSE -e.amount END) AS total
        FROM public.ledger_entries e
        JOIN public.ledger_accounts a ON a.id = e.account_id
       WHERE a.owner_type = 'USER'
         AND a.account_type IN ('USER_WALLET','USER_LOCKED')
       GROUP BY a.owner_id, a.currency, a.kind
    ) l ON l.owner_id = w.user_id AND l.currency = w.currency AND l.kind = w.kind;
$$;

REVOKE ALL ON FUNCTION public.ensure_ledger_account(public.ledger_account_type, public.ledger_owner_type, UUID, TEXT, public.wallet_kind) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.post_wallet_transaction(UUID, public.ledger_direction, NUMERIC, TEXT, public.ledger_account_type, TEXT, UUID, JSONB) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.move_wallet_lock(UUID, NUMERIC, BOOLEAN, TEXT, TEXT, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.wallet_ledger_drift() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.ensure_ledger_account(public.ledger_account_type, public.ledger_owner_type, UUID, TEXT, public.wallet_kind) TO service_role;
GRANT EXECUTE ON FUNCTION public.post_wallet_transaction(UUID, public.ledger_direction, NUMERIC, TEXT, public.ledger_account_type, TEXT, UUID, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.move_wallet_lock(UUID, NUMERIC, BOOLEAN, TEXT, TEXT, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.wallet_ledger_drift() TO service_role;
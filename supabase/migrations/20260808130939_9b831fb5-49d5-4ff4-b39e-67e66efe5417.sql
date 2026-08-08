
-- ============ ENUMS ============
CREATE TYPE public.user_status AS ENUM ('PENDING_VERIFICATION','ACTIVE','RESTRICTED','SUSPENDED','SELF_EXCLUDED','CLOSED');
CREATE TYPE public.wallet_status AS ENUM ('ACTIVE','FROZEN','CLOSED');
CREATE TYPE public.wallet_kind AS ENUM ('REAL','DEMO');
CREATE TYPE public.ledger_account_type AS ENUM ('USER_WALLET','USER_LOCKED','HOUSE','BONUS_LIABILITY','EXTERNAL_PAYMENT','FEE');
CREATE TYPE public.ledger_owner_type AS ENUM ('USER','SYSTEM','PROVIDER');
CREATE TYPE public.ledger_direction AS ENUM ('DEBIT','CREDIT');

-- ============ UPDATED_AT HELPER ============
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- ============ APPEND-ONLY GUARD ============
CREATE OR REPLACE FUNCTION public.forbid_mutation()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN RAISE EXCEPTION 'Records in % are immutable', TG_TABLE_NAME; END; $$;

-- ============ CURRENCIES (configurable) ============
CREATE TABLE public.currencies (
  code TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  decimals SMALLINT NOT NULL DEFAULT 8 CHECK (decimals BETWEEN 0 AND 18),
  is_crypto BOOLEAN NOT NULL DEFAULT true,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE public.currency_networks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  currency_code TEXT NOT NULL REFERENCES public.currencies(code) ON DELETE CASCADE,
  network TEXT NOT NULL,
  required_confirmations INTEGER NOT NULL DEFAULT 12 CHECK (required_confirmations >= 0),
  min_deposit NUMERIC(38,18) NOT NULL DEFAULT 0 CHECK (min_deposit >= 0),
  min_withdrawal NUMERIC(38,18) NOT NULL DEFAULT 0 CHECK (min_withdrawal >= 0),
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (currency_code, network)
);
GRANT SELECT ON public.currencies TO anon, authenticated;
GRANT SELECT ON public.currency_networks TO anon, authenticated;
GRANT ALL ON public.currencies TO service_role;
GRANT ALL ON public.currency_networks TO service_role;
ALTER TABLE public.currencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.currency_networks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "currencies_public_read" ON public.currencies FOR SELECT TO anon, authenticated USING (enabled);
CREATE POLICY "currency_networks_public_read" ON public.currency_networks FOR SELECT TO anon, authenticated USING (enabled);

-- ============ USERS ============
CREATE TABLE public.users (
  id UUID PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  status public.user_status NOT NULL DEFAULT 'PENDING_VERIFICATION',
  country_code CHAR(2),
  date_of_birth DATE,
  email_verified_at TIMESTAMPTZ,
  phone_verified_at TIMESTAMPTZ,
  mfa_enabled BOOLEAN NOT NULL DEFAULT false,
  demo_mode BOOLEAN NOT NULL DEFAULT true,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_users_email ON public.users(email);
CREATE INDEX idx_users_status ON public.users(status);
CREATE INDEX idx_users_country_code ON public.users(country_code);
CREATE TRIGGER trg_users_updated BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.user_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  first_name TEXT,
  last_name TEXT,
  phone TEXT,
  address_line_1 TEXT,
  address_line_2 TEXT,
  city TEXT,
  postal_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_user_profiles_updated BEFORE UPDATE ON public.user_profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

GRANT SELECT ON public.users TO authenticated;
GRANT ALL ON public.users TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.user_profiles TO authenticated;
GRANT ALL ON public.user_profiles TO service_role;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_select_own" ON public.users FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "profiles_select_own" ON public.user_profiles FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "profiles_insert_own" ON public.user_profiles FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "profiles_update_own" ON public.user_profiles FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ============ ADMIN RBAC ============
CREATE TABLE public.admin_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE public.permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE public.role_permissions (
  role_id UUID NOT NULL REFERENCES public.admin_roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);
CREATE TABLE public.admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  role_id UUID NOT NULL REFERENCES public.admin_roles(id) ON DELETE RESTRICT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role_id)
);
CREATE TRIGGER trg_admin_users_updated BEFORE UPDATE ON public.admin_users FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_admin_users_user ON public.admin_users(user_id);

GRANT SELECT ON public.admin_roles, public.permissions, public.role_permissions, public.admin_users TO authenticated;
GRANT ALL ON public.admin_roles, public.permissions, public.role_permissions, public.admin_users TO service_role;
ALTER TABLE public.admin_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_users_select_own" ON public.admin_users FOR SELECT TO authenticated USING (user_id = auth.uid());

-- has_permission: security definer, avoids RLS recursion
CREATE OR REPLACE FUNCTION public.has_permission(_user_id UUID, _permission TEXT)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users au
    JOIN public.role_permissions rp ON rp.role_id = au.role_id
    JOIN public.permissions p ON p.id = rp.permission_id
    WHERE au.user_id = _user_id AND au.active AND p.key = _permission
  );
$$;
CREATE OR REPLACE FUNCTION public.has_admin_role(_user_id UUID, _role TEXT)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users au
    JOIN public.admin_roles r ON r.id = au.role_id
    WHERE au.user_id = _user_id AND au.active AND r.key = _role
  );
$$;

-- ============ WALLETS ============
CREATE TABLE public.wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  currency TEXT NOT NULL REFERENCES public.currencies(code),
  kind public.wallet_kind NOT NULL DEFAULT 'REAL',
  available_amount NUMERIC(38,18) NOT NULL DEFAULT 0 CHECK (available_amount >= 0),
  locked_amount NUMERIC(38,18) NOT NULL DEFAULT 0 CHECK (locked_amount >= 0),
  status public.wallet_status NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, currency, kind)
);
CREATE INDEX idx_wallets_user ON public.wallets(user_id);
CREATE INDEX idx_wallets_currency ON public.wallets(currency);
CREATE TRIGGER trg_wallets_updated BEFORE UPDATE ON public.wallets FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
GRANT SELECT ON public.wallets TO authenticated;
GRANT ALL ON public.wallets TO service_role;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wallets_select_own" ON public.wallets FOR SELECT TO authenticated USING (user_id = auth.uid());

-- ============ LEDGER ============
CREATE TABLE public.ledger_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_type public.ledger_account_type NOT NULL,
  owner_type public.ledger_owner_type NOT NULL,
  owner_id UUID,
  currency TEXT NOT NULL REFERENCES public.currencies(code),
  kind public.wallet_kind NOT NULL DEFAULT 'REAL',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (account_type, owner_type, owner_id, currency, kind)
);
CREATE INDEX idx_ledger_accounts_owner ON public.ledger_accounts(owner_id);

CREATE TABLE public.ledger_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL,
  account_id UUID NOT NULL REFERENCES public.ledger_accounts(id) ON DELETE RESTRICT,
  entry_type TEXT NOT NULL,
  direction public.ledger_direction NOT NULL,
  amount NUMERIC(38,18) NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL REFERENCES public.currencies(code),
  reference_type TEXT,
  reference_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ledger_entries_account ON public.ledger_entries(account_id);
CREATE INDEX idx_ledger_entries_transaction ON public.ledger_entries(transaction_id);
CREATE INDEX idx_ledger_entries_reference ON public.ledger_entries(reference_id);
CREATE INDEX idx_ledger_entries_created ON public.ledger_entries(created_at);
CREATE TRIGGER trg_ledger_entries_immutable BEFORE UPDATE OR DELETE ON public.ledger_entries FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();

GRANT SELECT ON public.ledger_accounts, public.ledger_entries TO authenticated;
GRANT ALL ON public.ledger_accounts, public.ledger_entries TO service_role;
ALTER TABLE public.ledger_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ledger_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ledger_accounts_select_own" ON public.ledger_accounts FOR SELECT TO authenticated
  USING (owner_type = 'USER' AND owner_id = auth.uid());
CREATE POLICY "ledger_entries_select_own" ON public.ledger_entries FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.ledger_accounts a WHERE a.id = ledger_entries.account_id AND a.owner_type = 'USER' AND a.owner_id = auth.uid()));

-- ============ IDEMPOTENCY ============
CREATE TABLE public.idempotency_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  endpoint TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  response JSONB,
  status TEXT NOT NULL DEFAULT 'IN_PROGRESS',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  UNIQUE (user_id, endpoint, idempotency_key)
);
GRANT ALL ON public.idempotency_keys TO service_role;
ALTER TABLE public.idempotency_keys ENABLE ROW LEVEL SECURITY;

-- ============ SEED REFERENCE DATA (configuration only, no user/financial data) ============
INSERT INTO public.currencies (code, display_name, decimals, is_crypto, enabled) VALUES
  ('USDT','Tether USD',6,true,true),
  ('USDC','USD Coin',6,true,true),
  ('BTC','Bitcoin',8,true,true),
  ('ETH','Ethereum',18,true,true),
  ('DEMO','Demo Credits',2,false,true);

INSERT INTO public.currency_networks (currency_code, network, required_confirmations, min_deposit, min_withdrawal, enabled) VALUES
  ('USDT','TRON',20,1,10,true),
  ('USDT','ETHEREUM',12,1,20,true),
  ('USDC','ETHEREUM',12,1,20,true),
  ('BTC','BITCOIN',3,0.0002,0.0005,true),
  ('ETH','ETHEREUM',12,0.005,0.01,true);

INSERT INTO public.admin_roles (key, description) VALUES
  ('SUPER_ADMIN','Full operational administration; cannot alter historical game outcomes'),
  ('FINANCE_ADMIN','Financial review and withdrawal approvals'),
  ('KYC_ADMIN','KYC case review'),
  ('RISK_ADMIN','Risk and AML review'),
  ('SUPPORT_AGENT','Support tickets and read-only user view'),
  ('ANALYST','Analytics and reporting'),
  ('READ_ONLY','Read-only access');

INSERT INTO public.permissions (key, description) VALUES
  ('user.view','View user accounts'),
  ('user.suspend','Suspend or restrict user accounts'),
  ('kyc.view','View KYC cases'),
  ('kyc.decide','Approve or reject KYC cases'),
  ('finance.view','View financial data'),
  ('withdrawal.review','Review withdrawals'),
  ('withdrawal.approve','Approve withdrawals'),
  ('withdrawal.reject','Reject withdrawals'),
  ('risk.view','View risk events'),
  ('risk.resolve','Resolve risk events'),
  ('game.view','View game rounds and health'),
  ('game.configure','Change global game configuration'),
  ('support.view','View support tickets'),
  ('support.reply','Reply to support tickets'),
  ('analytics.view','View analytics'),
  ('audit.view','View audit logs'),
  ('admin.manage','Manage admin users and roles');

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.admin_roles r, public.permissions p WHERE r.key = 'SUPER_ADMIN';

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.admin_roles r JOIN public.permissions p ON p.key IN
  ('user.view','finance.view','withdrawal.review','withdrawal.approve','withdrawal.reject','analytics.view','audit.view')
WHERE r.key = 'FINANCE_ADMIN';

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.admin_roles r JOIN public.permissions p ON p.key IN
  ('user.view','kyc.view','kyc.decide','audit.view')
WHERE r.key = 'KYC_ADMIN';

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.admin_roles r JOIN public.permissions p ON p.key IN
  ('user.view','user.suspend','risk.view','risk.resolve','withdrawal.review','audit.view')
WHERE r.key = 'RISK_ADMIN';

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.admin_roles r JOIN public.permissions p ON p.key IN
  ('user.view','support.view','support.reply')
WHERE r.key = 'SUPPORT_AGENT';

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.admin_roles r JOIN public.permissions p ON p.key IN
  ('analytics.view','game.view')
WHERE r.key = 'ANALYST';

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.admin_roles r JOIN public.permissions p ON p.key IN
  ('user.view','finance.view','kyc.view','risk.view','game.view','support.view','analytics.view','audit.view')
WHERE r.key = 'READ_ONLY';

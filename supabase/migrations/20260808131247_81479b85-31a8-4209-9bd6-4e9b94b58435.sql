
CREATE TYPE public.deposit_status AS ENUM ('CREATED','PENDING','CONFIRMING','CONFIRMED','FAILED','EXPIRED','CANCELLED');
CREATE TYPE public.withdrawal_status AS ENUM ('REQUESTED','RISK_REVIEW','APPROVED','PROCESSING','BROADCAST','CONFIRMED','REJECTED','FAILED','CANCELLED');
CREATE TYPE public.risk_status AS ENUM ('LOW','MEDIUM','HIGH','REVIEW_REQUIRED');
CREATE TYPE public.kyc_status AS ENUM ('NOT_STARTED','PENDING','APPROVED','REJECTED','REQUIRES_INFORMATION');
CREATE TYPE public.risk_event_status AS ENUM ('OPEN','IN_REVIEW','ESCALATED','RESOLVED','DISMISSED');
CREATE TYPE public.ticket_status AS ENUM ('OPEN','PENDING_USER','ESCALATED','RESOLVED','CLOSED');
CREATE TYPE public.jurisdiction_status AS ENUM ('ALLOWED','REVIEW','BLOCKED');

-- ============ SESSIONS ============
CREATE TABLE public.user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  device_label TEXT,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ
);
CREATE INDEX idx_user_sessions_user ON public.user_sessions(user_id);
GRANT SELECT, UPDATE ON public.user_sessions TO authenticated;
GRANT ALL ON public.user_sessions TO service_role;
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sessions_select_own" ON public.user_sessions FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "sessions_revoke_own" ON public.user_sessions FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ============ JURISDICTIONS ============
CREATE TABLE public.jurisdictions (
  country_code CHAR(2) PRIMARY KEY,
  name TEXT NOT NULL,
  status public.jurisdiction_status NOT NULL DEFAULT 'BLOCKED',
  min_age SMALLINT NOT NULL DEFAULT 18,
  licence_reference TEXT,
  notes TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.jurisdictions TO anon, authenticated;
GRANT ALL ON public.jurisdictions TO service_role;
ALTER TABLE public.jurisdictions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "jurisdictions_public_read" ON public.jurisdictions FOR SELECT TO anon, authenticated USING (true);

-- ============ DEPOSITS ============
CREATE TABLE public.deposits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  wallet_id UUID REFERENCES public.wallets(id) ON DELETE RESTRICT,
  provider TEXT NOT NULL,
  provider_transaction_id TEXT,
  currency TEXT NOT NULL REFERENCES public.currencies(code),
  network TEXT NOT NULL,
  requested_amount NUMERIC(38,18) CHECK (requested_amount IS NULL OR requested_amount > 0),
  confirmed_amount NUMERIC(38,18) CHECK (confirmed_amount IS NULL OR confirmed_amount >= 0),
  deposit_address TEXT,
  status public.deposit_status NOT NULL DEFAULT 'CREATED',
  confirmations INTEGER NOT NULL DEFAULT 0,
  required_confirmations INTEGER NOT NULL DEFAULT 12,
  credited_transaction_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  confirmed_at TIMESTAMPTZ,
  UNIQUE (provider, provider_transaction_id)
);
CREATE INDEX idx_deposits_user ON public.deposits(user_id);
CREATE INDEX idx_deposits_status ON public.deposits(status);
CREATE INDEX idx_deposits_provider_tx ON public.deposits(provider_transaction_id);
CREATE TRIGGER trg_deposits_updated BEFORE UPDATE ON public.deposits FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
GRANT SELECT ON public.deposits TO authenticated;
GRANT ALL ON public.deposits TO service_role;
ALTER TABLE public.deposits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "deposits_select_own" ON public.deposits FOR SELECT TO authenticated USING (user_id = auth.uid());

-- ============ WITHDRAWALS ============
CREATE TABLE public.withdrawals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  wallet_id UUID NOT NULL REFERENCES public.wallets(id) ON DELETE RESTRICT,
  currency TEXT NOT NULL REFERENCES public.currencies(code),
  network TEXT NOT NULL,
  amount NUMERIC(38,18) NOT NULL CHECK (amount > 0),
  fee_amount NUMERIC(38,18) NOT NULL DEFAULT 0 CHECK (fee_amount >= 0),
  destination_address TEXT NOT NULL,
  provider TEXT,
  provider_transaction_id TEXT,
  status public.withdrawal_status NOT NULL DEFAULT 'REQUESTED',
  risk_status public.risk_status NOT NULL DEFAULT 'LOW',
  approvals_required SMALLINT NOT NULL DEFAULT 1,
  approvals_count SMALLINT NOT NULL DEFAULT 0,
  failure_reason TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_at TIMESTAMPTZ,
  processed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_transaction_id)
);
CREATE INDEX idx_withdrawals_user ON public.withdrawals(user_id);
CREATE INDEX idx_withdrawals_status ON public.withdrawals(status);
CREATE INDEX idx_withdrawals_provider_tx ON public.withdrawals(provider_transaction_id);
CREATE TRIGGER trg_withdrawals_updated BEFORE UPDATE ON public.withdrawals FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
GRANT SELECT ON public.withdrawals TO authenticated;
GRANT ALL ON public.withdrawals TO service_role;
ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "withdrawals_select_own" ON public.withdrawals FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE TABLE public.withdrawal_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  withdrawal_id UUID NOT NULL REFERENCES public.withdrawals(id) ON DELETE CASCADE,
  approver_id UUID NOT NULL,
  decision TEXT NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (withdrawal_id, approver_id)
);
ALTER TABLE public.withdrawal_approvals ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.withdrawal_approvals TO service_role;

-- ============ PAYMENT TRANSACTIONS (provider event log) ============
CREATE TABLE public.payment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  provider_event_id TEXT NOT NULL,
  direction TEXT NOT NULL,
  reference_type TEXT,
  reference_id UUID,
  payload JSONB NOT NULL,
  signature_verified BOOLEAN NOT NULL DEFAULT false,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_event_id)
);
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.payment_transactions TO service_role;

-- ============ KYC ============
CREATE TABLE public.kyc_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  provider_case_id TEXT,
  status public.kyc_status NOT NULL DEFAULT 'NOT_STARTED',
  risk_level public.risk_status NOT NULL DEFAULT 'LOW',
  submitted_at TIMESTAMPTZ,
  reviewed_at TIMESTAMPTZ,
  reviewer_id UUID,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_case_id)
);
CREATE INDEX idx_kyc_user ON public.kyc_cases(user_id);
CREATE TRIGGER trg_kyc_updated BEFORE UPDATE ON public.kyc_cases FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
GRANT SELECT ON public.kyc_cases TO authenticated;
GRANT ALL ON public.kyc_cases TO service_role;
ALTER TABLE public.kyc_cases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "kyc_select_own" ON public.kyc_cases FOR SELECT TO authenticated USING (user_id = auth.uid());

-- ============ RESPONSIBLE GAMBLING ============
CREATE TABLE public.responsible_gambling_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  deposit_daily_limit NUMERIC(38,18),
  deposit_weekly_limit NUMERIC(38,18),
  deposit_monthly_limit NUMERIC(38,18),
  loss_daily_limit NUMERIC(38,18),
  loss_weekly_limit NUMERIC(38,18),
  loss_monthly_limit NUMERIC(38,18),
  session_limit_minutes INTEGER CHECK (session_limit_minutes IS NULL OR session_limit_minutes > 0),
  cooling_off_until TIMESTAMPTZ,
  self_exclusion_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_rg_updated BEFORE UPDATE ON public.responsible_gambling_limits FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
GRANT SELECT ON public.responsible_gambling_limits TO authenticated;
GRANT ALL ON public.responsible_gambling_limits TO service_role;
ALTER TABLE public.responsible_gambling_limits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rg_select_own" ON public.responsible_gambling_limits FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE TABLE public.responsible_gambling_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  event_type TEXT NOT NULL,
  previous_value JSONB,
  new_value JSONB,
  effective_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_rg_events_immutable BEFORE UPDATE OR DELETE ON public.responsible_gambling_events FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();
GRANT SELECT ON public.responsible_gambling_events TO authenticated;
GRANT ALL ON public.responsible_gambling_events TO service_role;
ALTER TABLE public.responsible_gambling_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rg_events_select_own" ON public.responsible_gambling_events FOR SELECT TO authenticated USING (user_id = auth.uid());

-- ============ RISK ============
CREATE TABLE public.risk_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  risk_score INTEGER NOT NULL DEFAULT 0 CHECK (risk_score BETWEEN 0 AND 100),
  severity public.risk_status NOT NULL DEFAULT 'LOW',
  status public.risk_event_status NOT NULL DEFAULT 'OPEN',
  source TEXT NOT NULL DEFAULT 'system',
  description TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID
);
CREATE INDEX idx_risk_user ON public.risk_events(user_id);
CREATE INDEX idx_risk_status ON public.risk_events(status);
CREATE INDEX idx_risk_created ON public.risk_events(created_at DESC);
ALTER TABLE public.risk_events ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.risk_events TO service_role;

-- ============ BONUSES ============
CREATE TABLE public.bonus_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  bonus_type TEXT NOT NULL,
  currency TEXT REFERENCES public.currencies(code),
  max_bonus_amount NUMERIC(38,18) CHECK (max_bonus_amount IS NULL OR max_bonus_amount > 0),
  match_percent NUMERIC(6,2) CHECK (match_percent IS NULL OR match_percent >= 0),
  wagering_multiplier NUMERIC(8,2) NOT NULL DEFAULT 1 CHECK (wagering_multiplier >= 0),
  min_deposit NUMERIC(38,18),
  eligibility JSONB NOT NULL DEFAULT '{}'::jsonb,
  terms_url TEXT,
  terms_summary TEXT NOT NULL DEFAULT '',
  starts_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_bonus_campaigns_updated BEFORE UPDATE ON public.bonus_campaigns FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
GRANT SELECT ON public.bonus_campaigns TO anon, authenticated;
GRANT ALL ON public.bonus_campaigns TO service_role;
ALTER TABLE public.bonus_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bonus_campaigns_public_read" ON public.bonus_campaigns FOR SELECT TO anon, authenticated USING (active);

CREATE TABLE public.bonus_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES public.bonus_campaigns(id) ON DELETE SET NULL,
  currency TEXT NOT NULL REFERENCES public.currencies(code),
  amount NUMERIC(38,18) NOT NULL,
  wagering_required NUMERIC(38,18) NOT NULL DEFAULT 0,
  wagering_completed NUMERIC(38,18) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_bonus_tx_user ON public.bonus_transactions(user_id);
CREATE TRIGGER trg_bonus_tx_updated BEFORE UPDATE ON public.bonus_transactions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
GRANT SELECT ON public.bonus_transactions TO authenticated;
GRANT ALL ON public.bonus_transactions TO service_role;
ALTER TABLE public.bonus_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bonus_tx_select_own" ON public.bonus_transactions FOR SELECT TO authenticated USING (user_id = auth.uid());

-- ============ SUPPORT ============
CREATE TABLE public.support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  reference TEXT NOT NULL UNIQUE DEFAULT ('TCK-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,10))),
  category TEXT NOT NULL,
  subject TEXT NOT NULL,
  status public.ticket_status NOT NULL DEFAULT 'OPEN',
  priority TEXT NOT NULL DEFAULT 'NORMAL',
  assigned_to UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_tickets_user ON public.support_tickets(user_id);
CREATE TRIGGER trg_tickets_updated BEFORE UPDATE ON public.support_tickets FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
GRANT SELECT, INSERT ON public.support_tickets TO authenticated;
GRANT ALL ON public.support_tickets TO service_role;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tickets_select_own" ON public.support_tickets FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "tickets_insert_own" ON public.support_tickets FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE TABLE public.support_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  author_id UUID NOT NULL,
  author_type TEXT NOT NULL DEFAULT 'USER',
  body TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 5000),
  internal_note BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_support_messages_ticket ON public.support_messages(ticket_id);
GRANT SELECT, INSERT ON public.support_messages TO authenticated;
GRANT ALL ON public.support_messages TO service_role;
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "messages_select_own_ticket" ON public.support_messages FOR SELECT TO authenticated
  USING (NOT internal_note AND EXISTS (SELECT 1 FROM public.support_tickets t WHERE t.id = support_messages.ticket_id AND t.user_id = auth.uid()));
CREATE POLICY "messages_insert_own_ticket" ON public.support_messages FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid() AND author_type = 'USER' AND NOT internal_note
    AND EXISTS (SELECT 1 FROM public.support_tickets t WHERE t.id = support_messages.ticket_id AND t.user_id = auth.uid()));

-- ============ NOTIFICATIONS ============
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_notifications_user ON public.notifications(user_id, created_at DESC);
GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notifications_select_own" ON public.notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "notifications_update_own" ON public.notifications FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ============ AUDIT LOG (append-only) ============
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID,
  actor_role TEXT,
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id UUID,
  ip_address INET,
  user_agent TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_actor ON public.audit_logs(actor_id);
CREATE INDEX idx_audit_resource ON public.audit_logs(resource_id);
CREATE INDEX idx_audit_created ON public.audit_logs(created_at DESC);
CREATE TRIGGER trg_audit_immutable BEFORE UPDATE OR DELETE ON public.audit_logs FOR EACH ROW EXECUTE FUNCTION public.forbid_mutation();
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.audit_logs TO service_role;

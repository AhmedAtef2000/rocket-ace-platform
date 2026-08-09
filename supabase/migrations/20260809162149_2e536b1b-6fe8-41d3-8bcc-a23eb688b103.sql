CREATE TABLE public.manual_deposit_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  method text NOT NULL CHECK (method IN ('VODAFONE_CASH','ETISALAT_CASH','ORANGE_CASH')),
  currency text NOT NULL REFERENCES public.currencies(code),
  amount numeric NOT NULL CHECK (amount > 0),
  sender_number text NOT NULL,
  reference text,
  proof_path text,
  proof_name text,
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','APPROVED','REJECTED')),
  review_note text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  credited_deposit_id uuid REFERENCES public.deposits(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.manual_deposit_requests TO authenticated;
GRANT ALL ON public.manual_deposit_requests TO service_role;

ALTER TABLE public.manual_deposit_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Players read their own manual deposits"
ON public.manual_deposit_requests FOR SELECT TO authenticated
USING (auth.uid() = user_id OR public.has_permission(auth.uid(), 'payments.review'));

CREATE TRIGGER trg_manual_deposits_updated
BEFORE UPDATE ON public.manual_deposit_requests
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_manual_deposits_user ON public.manual_deposit_requests (user_id, created_at DESC);
CREATE INDEX idx_manual_deposits_status ON public.manual_deposit_requests (status, created_at DESC);
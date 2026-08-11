CREATE TABLE public.deposit_destinations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('CRYPTO','MANUAL')),
  currency text NOT NULL,
  channel text NOT NULL,
  label text NOT NULL DEFAULT '',
  address text NOT NULL,
  memo text,
  instructions text,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (kind, currency, channel)
);

GRANT ALL ON public.deposit_destinations TO service_role;

ALTER TABLE public.deposit_destinations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read deposit destinations"
  ON public.deposit_destinations FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(), 'admin.manage'));

CREATE TRIGGER trg_deposit_destinations_updated
  BEFORE UPDATE ON public.deposit_destinations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.deposit_destinations (kind, currency, channel, label, address, sort_order) VALUES
  ('MANUAL','EGP','VODAFONE_CASH','Vodafone Cash','+20 100 000 0000',1),
  ('MANUAL','EGP','ETISALAT_CASH','Etisalat Cash','+20 111 000 0000',2),
  ('MANUAL','EGP','ORANGE_CASH','Orange Cash','+20 120 000 0000',3);
CREATE TABLE public.kyc_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  kyc_case_id UUID REFERENCES public.kyc_cases(id) ON DELETE SET NULL,
  doc_type TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  review_note TEXT,
  reviewed_by UUID,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_kyc_documents_user ON public.kyc_documents (user_id, created_at DESC);
CREATE INDEX idx_kyc_documents_status ON public.kyc_documents (status, created_at DESC);

GRANT SELECT ON public.kyc_documents TO authenticated;
GRANT ALL ON public.kyc_documents TO service_role;

ALTER TABLE public.kyc_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own kyc documents"
  ON public.kyc_documents FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Compliance staff read kyc documents"
  ON public.kyc_documents FOR SELECT TO authenticated
  USING (public.has_permission(auth.uid(), 'kyc.review'));

CREATE TRIGGER trg_kyc_documents_updated
  BEFORE UPDATE ON public.kyc_documents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE POLICY "Users read own private documents"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id IN ('kyc-documents','payment-proofs')
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Reviewers read private documents"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id IN ('kyc-documents','payment-proofs')
  AND (
    public.has_permission(auth.uid(), 'kyc.decide')
    OR public.has_permission(auth.uid(), 'deposit.review')
    OR public.has_admin_role(auth.uid(), 'SUPER_ADMIN')
  )
);

CREATE POLICY "Users upload own private documents"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id IN ('kyc-documents','payment-proofs')
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users update own private documents"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id IN ('kyc-documents','payment-proofs')
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id IN ('kyc-documents','payment-proofs')
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users delete own private documents"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id IN ('kyc-documents','payment-proofs')
  AND (storage.foldername(name))[1] = auth.uid()::text
);
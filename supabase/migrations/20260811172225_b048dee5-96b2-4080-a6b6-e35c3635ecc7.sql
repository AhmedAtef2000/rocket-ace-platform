UPDATE public.users u
SET real_money_enabled = true
WHERE u.status = 'ACTIVE'
  AND EXISTS (SELECT 1 FROM public.kyc_cases k WHERE k.user_id = u.id AND k.status = 'APPROVED');
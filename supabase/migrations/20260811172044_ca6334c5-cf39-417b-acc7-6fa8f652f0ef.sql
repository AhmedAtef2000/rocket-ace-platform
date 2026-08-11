UPDATE public.platform_settings SET is_real_money_live = true;

UPDATE public.users u
SET real_money_enabled = true
WHERE EXISTS (
  SELECT 1 FROM public.kyc_cases k
  WHERE k.user_id = u.id AND k.status = 'APPROVED'
) AND u.status = 'ACTIVE';

UPDATE public.users u
SET real_money_enabled = false
WHERE NOT EXISTS (
  SELECT 1 FROM public.kyc_cases k
  WHERE k.user_id = u.id AND k.status = 'APPROVED'
);
INSERT INTO public.currencies (code, display_name, decimals, is_crypto, enabled)
VALUES
  ('USD', 'US Dollar', 2, false, true),
  ('EUR', 'Euro', 2, false, true),
  ('EGP', 'Egyptian Pound', 2, false, true)
ON CONFLICT (code) DO UPDATE
  SET display_name = EXCLUDED.display_name,
      decimals = EXCLUDED.decimals,
      is_crypto = EXCLUDED.is_crypto,
      enabled = true;
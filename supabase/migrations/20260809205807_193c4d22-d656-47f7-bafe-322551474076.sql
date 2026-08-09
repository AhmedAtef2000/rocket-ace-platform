REVOKE EXECUTE ON FUNCTION public.generate_account_number() FROM anon, authenticated, public;
GRANT EXECUTE ON FUNCTION public.generate_account_number() TO service_role;
DROP VIEW IF EXISTS public.game_config_public;

CREATE OR REPLACE FUNCTION public.get_public_game_config()
RETURNS TABLE (min_bet NUMERIC, max_bet NUMERIC, max_crash_multiplier NUMERIC)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT min_bet, max_bet, max_crash_multiplier
  FROM public.game_configurations
  WHERE active = true
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.get_public_game_config() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_game_config() TO anon, authenticated, service_role;
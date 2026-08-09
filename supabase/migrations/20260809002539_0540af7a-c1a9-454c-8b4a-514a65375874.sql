DROP POLICY IF EXISTS game_config_public_read_active ON public.game_configurations;

REVOKE SELECT ON public.game_configurations FROM anon;

CREATE OR REPLACE VIEW public.game_config_public
WITH (security_invoker = off) AS
SELECT id, version, min_bet, max_bet, max_crash_multiplier
FROM public.game_configurations
WHERE active = true;

GRANT SELECT ON public.game_config_public TO anon, authenticated;
GRANT ALL ON public.game_config_public TO service_role;
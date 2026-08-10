REVOKE EXECUTE ON FUNCTION public.assert_real_money_play(uuid) FROM PUBLIC, authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.game_place_bet(uuid, uuid, numeric, numeric, text) FROM PUBLIC, authenticated, anon;

GRANT EXECUTE ON FUNCTION public.assert_real_money_play(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.game_place_bet(uuid, uuid, numeric, numeric, text) TO service_role;

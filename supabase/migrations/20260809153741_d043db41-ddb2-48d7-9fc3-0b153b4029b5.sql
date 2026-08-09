UPDATE public.game_configurations SET active = false WHERE active;
INSERT INTO public.game_configurations (version, min_bet, max_bet, max_payout, max_exposure, betting_duration_ms, crash_growth_rate, house_edge_bps, max_crash_multiplier, algorithm_version, active)
VALUES (2, 5, 1000, 100000, 250000, 10000, 0.00006, 100, 100000, 'v1', true);
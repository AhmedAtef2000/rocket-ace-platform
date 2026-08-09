import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/game-config")({
  server: {
    handlers: {
      GET: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin
          .from("game_configurations")
          .select("min_bet, max_bet, betting_duration_ms, max_crash_multiplier")
          .eq("active", true)
          .order("version", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error || !data) {
          return Response.json(
            { ok: false, error: { code: "CONFIG_UNAVAILABLE", message: "Game configuration is unavailable." } },
            { status: 503 },
          );
        }

        return Response.json({
          ok: true,
          config: {
            minBet: Number(data.min_bet),
            maxBet: Number(data.max_bet),
            bettingDurationMs: data.betting_duration_ms,
            maxCrashMultiplier: Number(data.max_crash_multiplier),
          },
        });
      },
    },
  },
});
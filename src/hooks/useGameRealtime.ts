import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Phase 10 — real-time broadcast.
 * Round transitions, results and bet settlements arrive over the realtime
 * channel, so the UI reacts the instant the server state machine moves
 * instead of waiting for the next poll. The slow poll stays as the engine
 * heartbeat and as a fallback when the socket is unavailable.
 */
export function useGameRealtime() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const invalidate = () => {
      void queryClient.invalidateQueries({ queryKey: ["game"] });
    };

    const channel = supabase
      .channel("rocket-flight-game")
      .on("postgres_changes", { event: "*", schema: "public", table: "game_rounds" }, invalidate)
      .on("postgres_changes", { event: "*", schema: "public", table: "game_results" }, invalidate)
      .on("postgres_changes", { event: "*", schema: "public", table: "bets" }, () => {
        invalidate();
        void queryClient.invalidateQueries({ queryKey: ["wallet"] });
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient]);
}
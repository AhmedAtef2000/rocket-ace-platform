import { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { AccountNav } from "@/components/account/AccountNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cashOut, getGameState, placeBet } from "@/lib/game.functions";
import { formatMultiplier, multiplierAt } from "@/lib/game-math";
import { useGameRealtime } from "@/hooks/useGameRealtime";

const title = "Crash Game — Rocket Flight";
const description =
  "Play the Rocket Flight demo crash game: server-authoritative rounds, provably fair crash points and instant cash-outs.";

export const Route = createFileRoute("/_authenticated/game")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: GamePage,
});

function GamePage() {
  const queryClient = useQueryClient();
  useGameRealtime();
  const fetchState = useServerFn(getGameState);
  const bet = useServerFn(placeBet);
  const cash = useServerFn(cashOut);

  const [stake, setStake] = useState("10");
  const [auto, setAuto] = useState("");
  const [display, setDisplay] = useState(1);
  const frame = useRef<number | null>(null);

  const state = useQuery({
    queryKey: ["game", "state"],
    queryFn: async () => fetchState({ data: undefined }),
    // Heartbeat that also drives the server round loop; realtime handles
    // instant transitions between beats.
    refetchInterval: 1500,
    refetchIntervalInBackground: true,
  });

  const round = state.data?.round ?? null;
  const growth = state.data?.config.growthRate ?? 0.00006;
  const startedAt = round?.startedAt ?? null;
  const status = round?.status ?? "CREATED";

  // Animate the curve locally between server polls; the server stays the truth.
  useEffect(() => {
    if (status !== "RUNNING" || !startedAt) {
      setDisplay(round?.crash ?? 1);
      return;
    }
    const start = new Date(startedAt).getTime();
    const loop = () => {
      setDisplay(multiplierAt(Date.now() - start, growth));
      frame.current = requestAnimationFrame(loop);
    };
    frame.current = requestAnimationFrame(loop);
    return () => {
      if (frame.current) cancelAnimationFrame(frame.current);
    };
  }, [status, startedAt, growth, round?.crash]);

  const myBet = state.data?.bet ?? null;
  const wallet = state.data?.wallet ?? null;

  const betMutation = useMutation({
    mutationFn: async () => bet({ data: { amount: Number(stake), autoCashout: auto || null } }),
    onSuccess: () => {
      toast.success("Bet placed for this round.");
      void queryClient.invalidateQueries({ queryKey: ["game"] });
      void queryClient.invalidateQueries({ queryKey: ["wallet"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const cashMutation = useMutation({
    mutationFn: async (betId: string) => cash({ data: { betId } }),
    onSuccess: (result) => {
      toast.success(`Cashed out at ${Number(result.multiplier).toFixed(2)}x for ${Number(result.payout).toFixed(2)} credits.`);
      void queryClient.invalidateQueries({ queryKey: ["game"] });
      void queryClient.invalidateQueries({ queryKey: ["wallet"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const crashed = status === "CRASHED" || status === "SETTLING" || status === "SETTLED";
  const canBet = status === "BETTING" && !myBet;
  const canCash = status === "RUNNING" && myBet?.status === "ACTIVE";

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Crash game</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Demo credits only. Every round is server-authoritative and provably fair.
      </p>
      <AccountNav />

      <section className="mt-8 rounded-2xl border border-border bg-card/60 p-8 text-center">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">
          {status === "BETTING"
            ? "Betting open"
            : status === "RUNNING"
              ? "In flight"
              : crashed
                ? "Crashed"
                : "Preparing next round"}
        </p>
        <p
          className={`mt-3 font-mono text-6xl font-semibold tabular-nums ${
            crashed ? "text-destructive" : "text-primary"
          }`}
        >
          {formatMultiplier(crashed ? (round?.crash ?? display) : display)}
        </p>
        <p className="mt-2 text-xs text-muted-foreground">Round {round?.number ?? "—"}</p>
      </section>

      <section className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-border p-4">
          <label className="text-xs uppercase tracking-widest text-muted-foreground" htmlFor="stake">
            Stake
          </label>
          <Input
            id="stake"
            inputMode="decimal"
            value={stake}
            onChange={(event) => setStake(event.target.value)}
            className="mt-2"
          />
          <label
            className="mt-4 block text-xs uppercase tracking-widest text-muted-foreground"
            htmlFor="auto"
          >
            Auto cash-out (optional)
          </label>
          <Input
            id="auto"
            inputMode="decimal"
            placeholder="e.g. 2.00"
            value={auto}
            onChange={(event) => setAuto(event.target.value)}
            className="mt-2"
          />
          <div className="mt-4 flex gap-2">
            <Button
              className="flex-1"
              disabled={!canBet || betMutation.isPending}
              onClick={() => betMutation.mutate()}
            >
              {myBet ? "Bet placed" : "Place bet"}
            </Button>
            <Button
              className="flex-1"
              variant="secondary"
              disabled={!canCash || cashMutation.isPending}
              onClick={() => myBet && cashMutation.mutate(myBet.id)}
            >
              Cash out
            </Button>
          </div>
        </div>

        <div className="rounded-xl border border-border p-4">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Demo wallet</p>
          <p className="mt-2 font-mono text-2xl tabular-nums">
            {(wallet?.available ?? 0).toFixed(2)}
          </p>
          <p className="text-xs text-muted-foreground">
            Locked in play: {(wallet?.locked ?? 0).toFixed(2)}
          </p>

          <p className="mt-4 text-xs uppercase tracking-widest text-muted-foreground">Your bet</p>
          {myBet ? (
            <p className="mt-1 text-sm">
              {Number(myBet.amount).toFixed(2)} credits · {myBet.status.toLowerCase()}
              {myBet.cashout_multiplier
                ? ` at ${Number(myBet.cashout_multiplier).toFixed(2)}x`
                : ""}
            </p>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">No bet in this round.</p>
          )}

          <p className="mt-4 text-xs uppercase tracking-widest text-muted-foreground">
            Fairness commitment
          </p>
          <p className="mt-1 break-all font-mono text-[11px] text-muted-foreground">
            {state.data?.fairness?.server_seed_hash ?? "—"}
          </p>
        </div>
      </section>

      <section className="mt-6">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Recent crashes</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {(state.data?.history ?? []).map((item) => (
            <span
              key={item.roundId}
              className={`rounded-full border px-2.5 py-1 font-mono text-xs ${
                item.crash >= 2
                  ? "border-primary/40 text-primary"
                  : "border-border text-muted-foreground"
              }`}
            >
              {item.crash.toFixed(2)}x
            </span>
          ))}
        </div>
      </section>
    </main>
  );
}

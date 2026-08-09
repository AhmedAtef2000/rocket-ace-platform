import { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { AccountNav } from "@/components/account/AccountNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RocketStage } from "@/components/game/RocketStage";
import { cashOut, getGameState, placeBet } from "@/lib/game.functions";
import { multiplierAt } from "@/lib/game-math";
import { useGameRealtime } from "@/hooks/useGameRealtime";

const title = "AstroBet — Crash Game";
const description =
  "Play the AstroBet demo crash game: cinematic rocket launches, server-authoritative rounds, provably fair crash points and instant cash-outs.";

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

  const [stake, setStake] = useState("5");
  const [auto, setAuto] = useState("");
  const [display, setDisplay] = useState(1);
  const [now, setNow] = useState(() => Date.now());
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
  const minBet = Number(state.data?.config?.minBet ?? 5);
  const bettingMs = Number(state.data?.config?.bettingDurationMs ?? 10000);
  const stakeValue = Number(stake);
  const stakeValid = Number.isFinite(stakeValue) && stakeValue >= minBet;
  const lastResult = state.data?.lastResult ?? null;
  const walletAvailable = state.data?.wallet?.available ?? 0;
  const presets = [minBet, minBet * 2, minBet * 10, minBet * 20];

  // Ticking clock for the betting countdown.
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 200);
    return () => window.clearInterval(id);
  }, []);

  const openedAt = round?.bettingOpenAt ? new Date(round.bettingOpenAt).getTime() : null;
  const secondsLeft =
    status === "BETTING" && openedAt
      ? Math.max(0, Math.ceil((openedAt + bettingMs - now) / 1000))
      : null;

  const betMutation = useMutation({
    mutationFn: async () => {
      if (!stakeValid) {
        throw new Error(`Bet amount must be at least ${minBet.toFixed(2)}.`);
      }
      const autoValue = auto.trim() === "" ? null : Number(auto);
      if (autoValue !== null && (!Number.isFinite(autoValue) || autoValue <= 1)) {
        throw new Error("Auto cash-out must be above 1.00x.");
      }
      return bet({ data: { amount: stakeValue, autoCashout: autoValue } });
    },
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
  const phase = crashed ? "crashed" : status === "RUNNING" ? "running" : status === "BETTING" ? "betting" : "idle";
  const shown = crashed ? (round?.crash ?? display) : display;
  const potential = myBet ? Number(myBet.amount) * shown : 0;
  const liveBets = state.data?.liveBets ?? [];

  return (
    <main className="mx-auto w-full max-w-5xl px-4 pb-16 pt-8">
      <h1 className="font-display text-3xl font-extrabold tracking-tight">
        Rocket <span className="text-thrust">launch</span>
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Every round is server-authoritative and provably fair.
      </p>
      <AccountNav />

      <section className="mt-8">
        <RocketStage
          phase={phase}
          multiplier={shown}
          countdownLabel={
            secondsLeft !== null
              ? `Launching in ${secondsLeft}s`
              : status === "RUNNING"
                ? "In flight"
                : "Boarding"
          }
        />
        <p className="mt-3 text-center text-xs uppercase tracking-[0.3em] text-muted-foreground">
          Round {round?.number ?? "—"}
        </p>
      </section>

      <section className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-3xl border border-border bg-card/60 p-5">
          <label className="text-xs uppercase tracking-widest text-muted-foreground" htmlFor="stake">
            Bet amount
          </label>
          <Input
            id="stake"
            inputMode="decimal"
            value={stake}
            onChange={(event) => setStake(event.target.value)}
            className="mt-2"
          />
          <p className="mt-1 text-[11px] text-muted-foreground">
            Minimum {minBet.toFixed(2)} · no maximum · decimals allowed
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {presets.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setStake(preset.toFixed(2))}
                className="rounded-full border border-border px-3 py-1 text-xs font-semibold transition-colors hover:border-primary hover:text-primary"
              >
                {preset.toFixed(2)}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setStake(Math.max(minBet, (Number(stake) || minBet) * 2).toFixed(2))}
              className="rounded-full border border-border px-3 py-1 text-xs font-semibold transition-colors hover:border-primary hover:text-primary"
            >
              2×
            </button>
            <button
              type="button"
              onClick={() => setStake(Math.max(minBet, (Number(stake) || minBet) / 2).toFixed(2))}
              className="rounded-full border border-border px-3 py-1 text-xs font-semibold transition-colors hover:border-primary hover:text-primary"
            >
              ½
            </button>
            <button
              type="button"
              onClick={() => setStake(Math.max(minBet, walletAvailable).toFixed(2))}
              className="rounded-full border border-primary/50 px-3 py-1 text-xs font-semibold text-primary transition-colors hover:bg-primary/10"
            >
              MAX
            </button>
          </div>
          {stake !== "" && !stakeValid ? (
            <p className="mt-2 text-xs text-destructive">
              Bet amount must be at least {minBet.toFixed(2)}.
            </p>
          ) : null}
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
              className="h-11 flex-1 rounded-full bg-thrust font-semibold text-primary-foreground shadow-orbit transition-transform hover:scale-[1.02]"
              disabled={!canBet || !stakeValid || betMutation.isPending}
              onClick={() => betMutation.mutate()}
            >
              {myBet
                ? "Bet placed"
                : secondsLeft !== null
                  ? `Place bet · ${secondsLeft}s`
                  : "Place bet"}
            </Button>
            <Button
              className="h-11 flex-1 rounded-full font-semibold"
              variant="secondary"
              disabled={!canCash || cashMutation.isPending}
              onClick={() => myBet && cashMutation.mutate(myBet.id)}
            >
              {canCash ? `Cash out ${potential.toFixed(2)}` : "Cash out"}
            </Button>
          </div>
        </div>

        <div className="rounded-3xl border border-border bg-card/60 p-5">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Wallet balance</p>
          <p className="mt-2 font-mono text-2xl tabular-nums">
            {(wallet?.available ?? 0).toFixed(2)}
          </p>
          <p className="text-xs text-muted-foreground">
            Locked in play: {(wallet?.locked ?? 0).toFixed(2)}
          </p>
          {lastResult ? (
            <p
              className={`mt-2 text-sm font-semibold ${
                lastResult.net >= 0 ? "text-primary" : "text-destructive"
              }`}
            >
              Last round: {lastResult.net >= 0 ? "+" : "−"}
              {Math.abs(lastResult.net).toFixed(2)}
              {lastResult.multiplier ? ` at ${lastResult.multiplier.toFixed(2)}x` : ""}
            </p>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">Last round: no bet settled yet.</p>
          )}

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

        </div>
      </section>

      <section className="mt-6">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">
          Live bets this round
        </p>
        <div className="mt-2 overflow-hidden rounded-3xl border border-border bg-card/60">
          {liveBets.length === 0 ? (
            <p className="p-5 text-sm text-muted-foreground">No bets placed yet this round.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-xs uppercase tracking-widest text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="px-4 py-3 text-left font-medium">Player</th>
                  <th className="px-4 py-3 text-right font-medium">Stake</th>
                  <th className="px-4 py-3 text-right font-medium">Cash-out</th>
                  <th className="px-4 py-3 text-right font-medium">Payout</th>
                </tr>
              </thead>
              <tbody>
                {liveBets.map((item) => (
                  <tr key={item.id} className="border-b border-border/50 last:border-0">
                    <td className="px-4 py-2.5 font-mono text-xs">
                      {item.mine ? "You" : item.handle}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono tabular-nums">
                      {item.amount.toFixed(2)}
                    </td>
                    <td
                      className={`px-4 py-2.5 text-right font-mono tabular-nums ${
                        item.status === "CASHED_OUT"
                          ? "text-primary"
                          : item.status === "LOST"
                            ? "text-destructive"
                            : "text-muted-foreground"
                      }`}
                    >
                      {item.multiplier ? `${item.multiplier.toFixed(2)}x` : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono tabular-nums">
                      {item.payout ? item.payout.toFixed(2) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </main>
  );
}

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
import { validateStake } from "@/lib/stake";
import { useGameRealtime } from "@/hooks/useGameRealtime";
import { useI18n } from "@/lib/i18n";

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
  const { t } = useI18n();
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
  const maxBet = state.data?.config?.maxBet == null ? null : Number(state.data.config.maxBet);
  const stakeCheck = validateStake(stake, { minBet, maxBet });
  const stakeValid = stakeCheck.ok;
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
      if (!stakeCheck.ok) throw new Error(stakeCheck.message);
      const autoValue = auto.trim() === "" ? null : Number(auto);
      if (autoValue !== null && (!Number.isFinite(autoValue) || autoValue <= 1)) {
        throw new Error(t("game.autoCashoutMinError"));
      }
      return bet({ data: { amount: stakeCheck.amount, autoCashout: autoValue } });
    },
    onSuccess: (result) => {
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success(t("game.betPlacedToast"));
      void queryClient.invalidateQueries({ queryKey: ["game"] });
      void queryClient.invalidateQueries({ queryKey: ["wallet"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const cashMutation = useMutation({
    mutationFn: async (betId: string) => cash({ data: { betId } }),
    onSuccess: (result) => {
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success(
        t("game.cashedOutToast", {
          multiplier: result.multiplier.toFixed(2),
          payout: result.payout.toFixed(2),
        }),
      );
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

  const history = state.data?.history ?? [];

  return (
    <main className="w-full pb-10">
      <AccountNav />
      <div className="grid gap-4 xl:grid-cols-[340px_minmax(0,1fr)]">
        <div className="order-2 panel p-4 xl:order-1">
          <div className="mb-3 flex items-center justify-between">
            <h1 className="font-display text-lg font-extrabold tracking-tight">{t("game.placeYourBet")}</h1>
            <span className="chip">{status.toLowerCase()}</span>
          </div>
          <div className="panel-inset mb-3 grid grid-cols-2 gap-2 p-3 text-center">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{t("game.balance")}</p>
              <p className="font-mono text-sm tabular-nums">{(wallet?.available ?? 0).toFixed(2)}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{t("game.inPlay")}</p>
              <p className="font-mono text-sm tabular-nums">{(wallet?.locked ?? 0).toFixed(2)}</p>
            </div>
          </div>
          <label className="text-xs uppercase tracking-widest text-muted-foreground" htmlFor="stake">
            {t("game.betAmount")}
          </label>
          <Input
            id="stake"
            inputMode="decimal"
            value={stake}
            onChange={(event) => setStake(event.target.value)}
            className="mt-2"
          />
          <p className="mt-1 text-[11px] text-muted-foreground">
            {t("game.minNoMaxDecimals", { min: minBet.toFixed(2) })}
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
              {t("game.doubleShort")}
            </button>
            <button
              type="button"
              onClick={() => setStake(Math.max(minBet, (Number(stake) || minBet) / 2).toFixed(2))}
              className="rounded-full border border-border px-3 py-1 text-xs font-semibold transition-colors hover:border-primary hover:text-primary"
            >
              {t("game.halfShort")}
            </button>
            <button
              type="button"
              onClick={() => setStake(Math.max(minBet, walletAvailable).toFixed(2))}
              className="rounded-full border border-primary/50 px-3 py-1 text-xs font-semibold text-primary transition-colors hover:bg-primary/10"
            >
              {t("game.maxShort")}
            </button>
          </div>
          {stake !== "" && !stakeCheck.ok ? (
            <p className="mt-2 text-xs text-destructive">{stakeCheck.message}</p>
          ) : null}
          <label
            className="mt-4 block text-xs uppercase tracking-widest text-muted-foreground"
            htmlFor="auto"
          >
            {t("game.autoCashoutOptional")}
          </label>
          <Input
            id="auto"
            inputMode="decimal"
            placeholder={t("game.autoCashoutPlaceholder")}
            value={auto}
            onChange={(event) => setAuto(event.target.value)}
            className="mt-2"
          />
          <div className="mt-4 flex flex-col gap-2">
            <Button
              className="h-12 w-full rounded-xl bg-thrust text-base font-bold text-primary-foreground shadow-orbit transition-transform hover:scale-[1.02]"
              disabled={!canBet || !stakeValid || betMutation.isPending}
              onClick={() => betMutation.mutate()}
            >
              {myBet
                ? t("game.betPlaced")
                : secondsLeft !== null
                  ? t("game.placeBetCountdown", { s: secondsLeft })
                  : t("game.placeBetButton")}
            </Button>
            <Button
              className="h-12 w-full rounded-xl text-base font-bold"
              variant="secondary"
              disabled={!canCash || cashMutation.isPending}
              onClick={() => myBet && cashMutation.mutate(myBet.id)}
            >
              {canCash
                ? t("game.cashOutAmount", { amount: potential.toFixed(2) })
                : t("game.cashOutButton")}
            </Button>
          </div>
          {lastResult ? (
            <p
              className={`mt-3 text-sm font-semibold ${
                lastResult.net >= 0 ? "text-primary" : "text-destructive"
              }`}
            >
              {t("game.lastRoundResult", {
                sign: lastResult.net >= 0 ? "+" : "−",
                amount: Math.abs(lastResult.net).toFixed(2),
                multiplierPart: lastResult.multiplier
                  ? t("game.atMultiplier", { multiplier: lastResult.multiplier.toFixed(2) })
                  : "",
              })}
            </p>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">{t("game.lastRoundNone")}</p>
          )}
          {myBet ? (
            <p className="mt-1 text-xs text-muted-foreground">
              {t("game.yourBet", {
                amount: Number(myBet.amount).toFixed(2),
                status: myBet.status.toLowerCase(),
              })}
              {myBet.cashout_multiplier
                ? t("game.atMultiplier", { multiplier: Number(myBet.cashout_multiplier).toFixed(2) })
                : ""}
            </p>
          ) : null}
        </div>

        <section className="order-1 panel overflow-hidden p-3 xl:order-2">
          <div className="mb-3 flex items-center gap-2 overflow-x-auto">
            {history.length === 0 ? (
              <span className="chip text-muted-foreground">{t("game.noRoundsYet")}</span>
            ) : (
              history.slice(0, 12).map((item, index) => (
                <span
                  key={`${item.roundId}-${index}`}
                  className={`chip shrink-0 ${
                    Number(item.crash) >= 2 ? "text-accent" : "text-muted-foreground"
                  }`}
                >
                  {Number(item.crash).toFixed(2)}x
                </span>
              ))
            )}
          </div>
          <RocketStage
            phase={phase}
            multiplier={shown}
            secondsLeft={secondsLeft}
            countdownLabel={
              secondsLeft !== null
                ? t("game.launchingIn", { s: secondsLeft })
                : status === "RUNNING"
                  ? t("game.currentMultiplier")
                  : t("game.boarding")
            }
          />
          <p className="mt-3 text-center text-xs uppercase tracking-[0.3em] text-muted-foreground">
            {t("game.roundNumber", { number: round?.number ?? "—" })}
          </p>
        </section>
      </div>

      <section className="mt-4">
        <p className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">
          {t("game.liveBetsTitle")}
        </p>
        <div className="panel overflow-hidden">
          {liveBets.length === 0 ? (
            <p className="p-5 text-sm text-muted-foreground">{t("game.noBetsYet")}</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-xs uppercase tracking-widest text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="px-4 py-3 text-left font-medium">{t("game.colPlayer")}</th>
                  <th className="px-4 py-3 text-right font-medium">{t("game.colStake")}</th>
                  <th className="px-4 py-3 text-right font-medium">{t("game.colCashOut")}</th>
                  <th className="px-4 py-3 text-right font-medium">{t("game.colPayout")}</th>
                </tr>
              </thead>
              <tbody>
                {liveBets.map((item) => (
                  <tr key={item.id} className="border-b border-border/50 last:border-0">
                    <td className="px-4 py-2.5 font-mono text-xs">
                      {item.mine ? t("game.you") : item.handle}
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

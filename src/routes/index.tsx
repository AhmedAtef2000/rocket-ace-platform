import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Rocket,
  ShieldCheck,
  Zap,
  Lock,
  Headphones,
  Gift,
  Percent,
  Users,
} from "lucide-react";

import { RocketStage } from "@/components/game/RocketStage";
import { AppShell } from "@/components/layout/AppShell";
import { useAuth } from "@/hooks/useAuth";
import { listVerifiableRounds } from "@/lib/fairness.functions";
import { useI18n, type TranslationKey } from "@/lib/i18n";

const title = "AstroBet — Launch. Climb. Cash Out.";
const description =
  "AstroBet is a cinematic provably-fair crash game. Ride the rocket, watch the multiplier climb and cash out before ignition fails.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const pillars: { title: TranslationKey; body: TranslationKey }[] = [
  { title: "home.pillar1Title", body: "home.pillar1Body" },
  { title: "home.pillar2Title", body: "home.pillar2Body" },
  { title: "home.pillar3Title", body: "home.pillar3Body" },
];

function HeroStage() {
  const { t } = useI18n();
  const [multiplier, setMultiplier] = useState(1);
  const [phase, setPhase] = useState<"betting" | "running" | "crashed">("betting");
  const [secondsLeft, setSecondsLeft] = useState(10);

  useEffect(() => {
    let raf = 0;
    let start = performance.now();
    let stage: "betting" | "running" | "crashed" = "betting";
    let peak = 1.6 + Math.random() * 6;

    const loop = (now: number) => {
      const t = now - start;
      if (stage === "betting") {
        setMultiplier(1);
        setSecondsLeft(Math.max(0, Math.ceil((10000 - t) / 1000)));
        if (t > 10000) {
          stage = "running";
          setPhase("running");
          start = now;
        }
      } else if (stage === "running") {
        const value = Math.exp(0.00019 * t);
        if (value >= peak) {
          stage = "crashed";
          setPhase("crashed");
          setMultiplier(peak);
          start = now;
        } else {
          setMultiplier(value);
        }
      } else if (t > 2400) {
        stage = "betting";
        peak = 1.6 + Math.random() * 6;
        setPhase("betting");
        start = now;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <RocketStage
      phase={phase}
      multiplier={multiplier}
      secondsLeft={secondsLeft}
      countdownLabel={
        phase === "betting" ? t("game.launchingIn", { s: secondsLeft }) : t("game.boarding")
      }
    />
  );
}

const trust = [
  { icon: ShieldCheck, title: "Provably Fair", body: "100% verifiable" },
  { icon: Zap, title: "Fast Withdrawals", body: "Within 24 hours" },
  { icon: Lock, title: "Secure & Trusted", body: "Encrypted end to end" },
  { icon: Headphones, title: "24/7 Support", body: "Here for you" },
];

const presets = [5, 10, 25, 50];

function BetPanelPreview() {
  const { formatMoney } = useI18n();
  const [amount, setAmount] = useState("10.00");
  const [auto, setAuto] = useState("2.00");

  return (
    <div className="mt-3 grid gap-3 panel-inset p-3 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto]">
      <div>
        <label htmlFor="home-amount" className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          Bet amount
        </label>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <input
            id="home-amount"
            inputMode="decimal"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            className="w-28 rounded-xl border border-border bg-background/70 px-3 py-2 text-sm font-bold tabular-nums outline-none focus:border-primary"
          />
          {presets.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => setAmount(preset.toFixed(2))}
              className="chip transition-colors hover:border-primary hover:text-primary"
            >
              {preset}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setAmount("100.00")}
            className="chip border-primary/60 text-primary"
          >
            MAX
          </button>
        </div>
        <p className="mt-1.5 text-[11px] text-muted-foreground">
          Stake shown as {formatMoney(Number(amount) || 0)}
        </p>
      </div>
      <div>
        <label htmlFor="home-auto" className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          Auto cashout
        </label>
        <input
          id="home-auto"
          inputMode="decimal"
          value={auto}
          onChange={(event) => setAuto(event.target.value)}
          className="mt-1.5 w-full rounded-xl border border-border bg-background/70 px-3 py-2 text-sm font-bold tabular-nums outline-none focus:border-primary"
        />
      </div>
      <Link
        to="/game"
        className="inline-flex items-center justify-center gap-2 self-end rounded-xl bg-thrust px-6 py-3 text-sm font-black text-primary-foreground shadow-orbit transition-transform hover:scale-[1.02]"
      >
        Place Bet <Rocket className="size-4" aria-hidden />
      </Link>
    </div>
  );
}

function RecentRoundsPanel() {
  const fetchRounds = useServerFn(listVerifiableRounds);
  const rounds = useQuery({
    queryKey: ["public", "rounds"],
    queryFn: async () => fetchRounds({ data: undefined }),
    retry: false,
    refetchInterval: 15000,
  });

  return (
    <aside className="panel p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-display text-base font-black">Recent rounds</h2>
        <span className="chip text-primary">Live</span>
      </div>
      {rounds.isLoading ? (
        <div className="space-y-2" aria-hidden>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton-line h-8 w-full" />
          ))}
        </div>
      ) : (rounds.data ?? []).length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No settled rounds yet. Every completed round appears here with its verifiable crash point.
        </p>
      ) : (
        <table className="w-full text-sm">
          <thead className="text-[10px] uppercase tracking-widest text-muted-foreground">
            <tr>
              <th scope="col" className="py-2 text-start font-semibold">Round</th>
              <th scope="col" className="py-2 text-end font-semibold">Players</th>
              <th scope="col" className="py-2 text-end font-semibold">Crash</th>
            </tr>
          </thead>
          <tbody>
            {(rounds.data ?? []).slice(0, 9).map((round) => (
              <tr key={round.roundId} className="border-t border-border/60">
                <td className="py-2 font-semibold tabular-nums">#{round.roundNumber}</td>
                <td className="py-2 text-end tabular-nums text-muted-foreground">{round.players}</td>
                <td
                  className={`py-2 text-end font-bold tabular-nums ${
                    round.crashMultiplier >= 2 ? "text-primary" : "text-destructive"
                  }`}
                >
                  {round.crashMultiplier.toFixed(2)}x
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <Link
        to="/fairness"
        className="mt-3 inline-flex w-full items-center justify-center rounded-xl border border-border px-3 py-2 text-xs font-bold transition-colors hover:bg-secondary"
      >
        Verify a round
      </Link>
    </aside>
  );
}

function Index() {
  const { t } = useI18n();
  const { user } = useAuth();

  return (
    <AppShell publicView={!user}>
      <main className="space-y-4 pb-10">
        <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="panel p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <h1 className="page-title truncate">Rocket Crash</h1>
                <p className="text-xs font-semibold text-muted-foreground">
                  {t("home.badge")}
                </p>
              </div>
              <span className="chip text-primary">Server-authoritative</span>
            </div>
            <HeroStage />
            <BetPanelPreview />
          </div>
          <RecentRoundsPanel />
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          {[
            { icon: Gift, title: "Welcome boost", body: t("home.pillar1Body"), cta: t("home.ctaPrimary"), to: "/auth" as const, tone: "bg-thrust text-primary-foreground" },
            { icon: Percent, title: "Low house edge", body: t("home.pillar2Body"), cta: t("home.ctaSecondary"), to: "/fairness" as const, tone: "bg-ember text-primary-foreground" },
            { icon: Users, title: "Refer & earn", body: t("home.pillar3Body"), cta: t("home.ctaSecondary"), to: "/fairness" as const, tone: "bg-gold text-primary-foreground" },
          ].map((card) => (
            <article key={card.title} className={`rounded-3xl p-5 ${card.tone}`}>
              <card.icon className="size-6" aria-hidden />
              <h2 className="mt-3 font-display text-xl font-black">{card.title}</h2>
              <p className="mt-2 text-sm font-medium opacity-90">{card.body}</p>
              <Link
                to={card.to}
                className="mt-4 inline-flex rounded-xl bg-background/90 px-4 py-2 text-xs font-black text-foreground transition-transform hover:scale-[1.03]"
              >
                {card.cta}
              </Link>
            </article>
          ))}
        </section>

        <section className="panel p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-base font-black">Games</h2>
            <span className="chip text-muted-foreground">Crash is our only game</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Link
              to="/game"
              className="group relative overflow-hidden rounded-2xl border border-primary/40 bg-thrust p-5 text-primary-foreground shadow-orbit"
            >
              <Rocket className="size-7" aria-hidden />
              <p className="mt-6 font-display text-lg font-black">Rocket Crash</p>
              <p className="text-xs font-semibold opacity-90">Play now</p>
            </Link>
            {["Auto-bet mode", "Tournaments", "High-roller table"].map((soon) => (
              <div key={soon} className="panel-inset flex flex-col justify-between p-5 opacity-70">
                <span className="chip w-fit text-muted-foreground">Coming soon</span>
                <p className="mt-6 font-display text-lg font-black">{soon}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {trust.map((item) => (
            <div key={item.title} className="panel flex items-center gap-3 p-4">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
                <item.icon className="size-5" aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-bold">{item.title}</span>
                <span className="block truncate text-xs text-muted-foreground">{item.body}</span>
              </span>
            </div>
          ))}
        </section>

        <section className="grid gap-3 sm:grid-cols-3">
          {([
            { k: "home.statRound", v: "~15s" },
            { k: "home.statMax", v: "1000x" },
            { k: "home.statEdge", v: "1%" },
          ] as { k: TranslationKey; v: string }[]).map((s) => (
            <div key={s.k} className="panel px-4 py-3">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{t(s.k)}</p>
              <p className="mt-1 font-display text-lg font-black text-primary">{s.v}</p>
            </div>
          ))}
        </section>

        <footer className="panel px-5 py-6 text-xs leading-relaxed text-muted-foreground">
          {t("home.disclaimer")}
        </footer>
      </main>
    </AppShell>
  );
}

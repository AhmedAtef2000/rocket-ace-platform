import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Rocket,
  LayoutGrid,
  Wallet,
  ShieldCheck,
  Gift,
  LifeBuoy,
  Search,
  Bell,
} from "lucide-react";

import { RocketStage } from "@/components/game/RocketStage";
import { LiveActivityFeed } from "@/components/home/LiveActivityFeed";
import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher";
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
      countdownLabel={
        phase === "betting" ? t("game.launchingIn", { s: secondsLeft }) : t("game.boarding")
      }
    />
  );
}

function Index() {
  const { t } = useI18n();
  return (
    <div
      className="min-h-screen bg-background bg-fixed text-foreground"
      style={{ backgroundImage: "var(--surface-glow)" }}
    >
      <div className="mx-auto flex w-full max-w-[1500px] gap-4 p-3 sm:p-4">
        {/* Left rail */}
        <aside className="sticky top-4 hidden h-[calc(100vh-2rem)] w-60 shrink-0 flex-col justify-between panel p-3 lg:flex">
          <div>
            <Link to="/" className="flex items-center gap-2 px-1 py-2">
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-thrust">
                <Rocket className="size-5 text-primary-foreground" aria-hidden />
              </span>
              <span className="font-display text-lg font-extrabold tracking-tight">AstroBet</span>
            </Link>
            <div className="mt-2 flex items-center gap-2 rounded-xl border border-border bg-background/60 px-3 py-2 text-xs text-muted-foreground">
              <Search className="size-4 shrink-0" aria-hidden />
              <span>Search</span>
            </div>
            <nav className="mt-4 space-y-1">
              <RailLink to="/" icon={<LayoutGrid className="size-4" />} label="Lobby" active />
              <RailLink to="/game" icon={<Rocket className="size-4" />} label="Rocket crash" />
              <RailLink to="/wallet" icon={<Wallet className="size-4" />} label="Wallet" />
              <RailLink to="/fairness" icon={<ShieldCheck className="size-4" />} label="Fairness" />
              <RailLink to="/payments" icon={<Gift className="size-4" />} label="Cashier" />
              <RailLink to="/support" icon={<LifeBuoy className="size-4" />} label="Support" />
            </nav>
          </div>
          <LanguageSwitcher />
        </aside>

        <main className="min-w-0 flex-1">
          {/* Top bar */}
          <header className="sticky top-3 z-30 mb-4 panel">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-3 py-2.5">
              <div className="flex min-w-0 items-center gap-2">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-thrust lg:hidden">
                  <Rocket className="size-5 text-primary-foreground" aria-hidden />
                </span>
                <span className="chip shrink-0">Rocket crash · live</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="hidden sm:block">
                  <LanguageSwitcher />
                </span>
                <Link
                  to="/auth"
                  search={{ mode: "signin" }}
                  className="rounded-xl border border-border px-3 py-2 text-xs font-semibold transition-colors hover:bg-secondary"
                >
                  {t("nav.signIn")}
                </Link>
                <Link
                  to="/auth"
                  search={{ mode: "signup" }}
                  className="rounded-xl bg-thrust px-3 py-2 text-xs font-bold text-primary-foreground shadow-orbit transition-transform hover:scale-[1.03]"
                >
                  {t("nav.register")}
                </Link>
                <span className="hidden size-9 place-items-center rounded-xl border border-border sm:grid">
                  <Bell className="size-4 text-muted-foreground" aria-hidden />
                </span>
              </div>
            </div>
          </header>

          {/* Promo banners */}
          <section className="grid gap-3 lg:grid-cols-[1.6fr_1fr_1.3fr]">
            <article className="relative overflow-hidden rounded-3xl bg-thrust p-6 text-primary-foreground">
              <p className="text-[10px] font-bold uppercase tracking-[0.3em] opacity-80">
                {t("home.badge")}
              </p>
              <h1 className="mt-3 font-display text-3xl font-black leading-[1.05] sm:text-4xl">
                {t("home.heroLine1")}
                <span className="block">{t("home.heroLine2")}</span>
              </h1>
              <p className="mt-3 max-w-sm text-sm font-medium opacity-90">{t("home.heroBody")}</p>
              <Link
                to="/auth"
                search={{ mode: "signup" }}
                className="mt-5 inline-flex rounded-2xl bg-background px-5 py-3 text-sm font-bold text-foreground transition-transform hover:scale-[1.03]"
              >
                {t("home.ctaPrimary")}
              </Link>
            </article>

            <article className="rounded-3xl bg-ember p-6 text-primary-foreground">
              <h2 className="font-display text-2xl font-black leading-tight">
                Deposit With Crypto
              </h2>
              <p className="mt-3 text-sm font-semibold opacity-90">
                Instant BTC, ETH and USDT top-ups — zero network markup.
              </p>
              <div className="mt-5 flex gap-2 text-[11px] font-bold uppercase tracking-wider opacity-90">
                <span className="chip">BTC</span>
                <span className="chip">ETH</span>
                <span className="chip">USDT</span>
              </div>
            </article>

            <article className="rounded-3xl bg-gold p-6 text-primary-foreground">
              <h2 className="font-display text-2xl font-black leading-tight">
                Provably Fair. Every Round.
              </h2>
              <ul className="mt-4 space-y-2 text-sm font-semibold opacity-95">
                <li>Server + client seed verification</li>
                <li>Instant cash-out, no delays</li>
              </ul>
              <Link
                to="/fairness"
                className="mt-5 inline-flex rounded-2xl border-2 border-primary-foreground/70 px-5 py-2.5 text-sm font-bold transition-colors hover:bg-primary-foreground/10"
              >
                {t("home.ctaSecondary")}
              </Link>
            </article>
          </section>

          {/* Stat chips row */}
          <section className="mt-3 grid grid-cols-3 gap-3">
            {([
              { k: "home.statRound", v: "~15s" },
              { k: "home.statMax", v: "1000x" },
              { k: "home.statEdge", v: "1%" },
            ] as { k: TranslationKey; v: string }[]).map((s) => (
              <div key={s.k} className="panel px-4 py-3">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  {t(s.k)}
                </p>
                <p className="mt-1 font-display text-lg font-black text-primary">{s.v}</p>
              </div>
            ))}
          </section>

          {/* Game stage */}
          <section className="mt-4 grid gap-4 xl:grid-cols-[1.5fr_1fr]">
            <div className="panel p-3">
              <div className="mb-3 flex items-center justify-between px-1">
                <h2 className="font-display text-lg font-black">Rocket Crash</h2>
                <span className="chip text-primary">Popular</span>
              </div>
              <HeroStage />
            </div>
            <div className="panel p-3">
              <h2 className="mb-3 px-1 font-display text-lg font-black">
                {t("home.liveResults")}
              </h2>
              <LiveActivityFeed />
            </div>
          </section>

          {/* Pillars */}
          <section className="mt-4 grid gap-3 md:grid-cols-3">
            {pillars.map((p) => (
              <article key={p.title} className="panel p-5 transition-colors hover:border-primary/60">
                <h2 className="font-display text-lg font-black">{t(p.title)}</h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t(p.body)}</p>
              </article>
            ))}
          </section>

          <footer className="mt-4 panel px-5 py-6 text-xs leading-relaxed text-muted-foreground">
            {t("home.disclaimer")}
          </footer>
        </main>
      </div>
    </div>
  );
}

function RailLink({
  to,
  icon,
  label,
  active,
}: {
  to: string;
  icon: React.ReactNode;
  label: string;
  active?: boolean;
}) {
  return (
    <Link
      to={to}
      className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${
        active
          ? "bg-primary/15 text-primary"
          : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
      }`}
    >
      <span className="shrink-0">{icon}</span>
      {label}
    </Link>
  );
}

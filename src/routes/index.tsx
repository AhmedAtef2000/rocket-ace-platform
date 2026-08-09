import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Rocket } from "lucide-react";

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
    <main className="min-h-screen bg-background text-foreground">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-6">
        <div className="flex items-center gap-2">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-thrust">
            <Rocket className="size-5 text-primary-foreground" aria-hidden />
          </span>
          <span className="font-display text-lg font-extrabold tracking-tight">AstroBet</span>
        </div>
        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <Link
            to="/auth"
            search={{ mode: "signin" }}
            className="rounded-full border border-border px-4 py-2 text-sm font-medium transition-all duration-150 hover:bg-secondary active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {t("nav.signIn")}
          </Link>
          <Link
            to="/auth"
            search={{ mode: "signup" }}
            className="rounded-full bg-thrust px-4 py-2 text-sm font-semibold text-primary-foreground shadow-orbit transition-all duration-150 hover:scale-[1.03] active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {t("nav.register")}
          </Link>
        </div>
      </header>

      <section
        className="border-b border-border"
        style={{ backgroundImage: "var(--surface-glow)" }}
      >
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 pb-20 pt-8 lg:grid-cols-2">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-primary">
              {t("home.badge")}
            </p>
            <h1 className="mt-6 font-display text-5xl font-extrabold leading-[1.05] sm:text-6xl">
              {t("home.heroLine1")}
              <span className="block text-thrust">{t("home.heroLine2")}</span>
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              {t("home.heroBody")}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/auth"
                search={{ mode: "signup" }}
                className="inline-flex items-center justify-center rounded-full bg-thrust px-7 py-3 text-sm font-semibold text-primary-foreground shadow-orbit transition-transform hover:scale-[1.03]"
              >
                {t("home.ctaPrimary")}
              </Link>
              <Link
                to="/fairness"
                className="inline-flex items-center justify-center rounded-full border border-border px-7 py-3 text-sm font-medium transition-colors hover:bg-secondary"
              >
                {t("home.ctaSecondary")}
              </Link>
            </div>
            <dl className="mt-10 grid grid-cols-3 gap-4 text-center">
              {([
                { k: "home.statRound", v: "~15s" },
                { k: "home.statMax", v: "1000x" },
                { k: "home.statEdge", v: "1%" },
              ] as { k: TranslationKey; v: string }[]).map((s) => (
                <div key={s.k} className="rounded-2xl border border-border bg-card/60 p-3">
                  <dt className="text-[10px] uppercase tracking-widest text-muted-foreground">
                    {t(s.k)}
                  </dt>
                  <dd className="mt-1 font-display text-lg font-bold">{s.v}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="animate-float">
            <HeroStage />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-16">
        <div className="grid gap-5 md:grid-cols-3">
          {pillars.map((p) => (
            <article
              key={p.title}
              className="rounded-3xl border border-border bg-card/70 p-6 transition-colors hover:border-primary/50"
            >
              <h2 className="font-display text-xl font-bold">{t(p.title)}</h2>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{t(p.body)}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 pb-20">
        <h2 className="text-sm font-semibold uppercase tracking-[0.3em] text-muted-foreground">
          {t("home.liveResults")}
        </h2>
        <div className="mt-6">
          <LiveActivityFeed />
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto max-w-6xl px-5 py-8 text-xs leading-relaxed text-muted-foreground">
          {t("home.disclaimer")}
        </div>
      </footer>
    </main>
  );
}

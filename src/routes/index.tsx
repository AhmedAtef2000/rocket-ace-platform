import { createFileRoute, Link } from "@tanstack/react-router";

const title = "Rocket Flight — Provably Fair Crash Platform";
const description =
  "Rocket Flight is a server-authoritative crash game platform with a double-entry ledger, provably fair rounds, KYC/AML controls and responsible gambling tools. Currently in build: demo mode only.";

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

const phases: { label: string; state: "done" | "next" | "planned" }[] = [
  { label: "Phase 1 — Architecture", state: "done" },
  { label: "Phase 2 — Database schema & migrations", state: "done" },
  { label: "Phase 3 — Authentication", state: "done" },
  { label: "Phase 4 — User management", state: "done" },
  { label: "Phase 5 — Wallet", state: "done" },
  { label: "Phase 6 — Immutable ledger", state: "done" },
  { label: "Phase 7 — Demo game engine", state: "done" },
  { label: "Phase 8 — Provably-fair engine", state: "done" },
  { label: "Phase 9 — Betting & cashout", state: "done" },
  { label: "Phase 10 — Real-time broadcast", state: "done" },
  { label: "Phase 11 — Compliance & KYC gating", state: "done" },
  { label: "Phase 12 — Crypto deposits & withdrawals", state: "done" },
  { label: "Phase 13 — Risk & fraud engine", state: "done" },
  { label: "Phase 14 — Support desk & notifications", state: "done" },
  { label: "Phase 15 — Admin RBAC back office", state: "done" },
  { label: "Phase 16 — Analytics & reporting", state: "done" },
  { label: "Phase 17 — Player fairness verifier", state: "done" },
  { label: "Phase 18 — Security hardening (rate limits, headers)", state: "done" },
  { label: "Phase 19 — Automated test suite", state: "done" },
  { label: "Phase 20 — Deployment readiness & health checks", state: "done" },
];

const guarantees = [
  "Server is authoritative for every balance, bet, crash point and payout.",
  "Double-entry ledger is append-only; corrections use compensating entries.",
  "Crash multipliers are write-once at the database level — no operator override exists.",
  "Encrypted server seeds are stored in a table no client role can read.",
  "Real-money integrations stay disabled until licensed providers are configured.",
];

function StateDot({ state }: { state: "done" | "next" | "planned" }) {
  const cls =
    state === "done"
      ? "bg-success"
      : state === "next"
        ? "bg-primary animate-pulse"
        : "bg-muted-foreground/40";
  return <span className={`mt-2 inline-block size-2 shrink-0 rounded-full ${cls}`} aria-hidden />;
}

function Index() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div
        className="border-b border-border"
        style={{ backgroundImage: "var(--surface-glow)" }}
      >
        <div className="mx-auto max-w-5xl px-6 py-20">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-primary">
            All 20 phases delivered
          </p>
          <h1 className="mt-5 text-5xl font-bold tracking-tight sm:text-6xl">
            Rocket Flight
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted-foreground">
            A server-authoritative crash platform: immutable double-entry accounting,
            provably fair rounds, KYC/AML gating, responsible gambling controls and a
            full operator back office.
          </p>
          <div className="mt-8 flex flex-wrap gap-3 text-sm">
            <span className="rounded-full border border-warning/40 bg-warning/10 px-4 py-1.5 font-medium text-warning">
              Demo mode only — no real-money play enabled
            </span>
            <span className="rounded-full border border-border bg-card px-4 py-1.5 text-muted-foreground">
              18+ · Licensed operation required
            </span>
          </div>
          <div className="mt-8">
            <Link
              to="/auth"
              className="inline-flex items-center justify-center rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Sign in or create an account
            </Link>
          </div>
        </div>
      </div>

      <div className="mx-auto grid max-w-5xl gap-8 px-6 py-16 md:grid-cols-2">
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            Delivery roadmap
          </h2>
          <ul className="mt-5 space-y-3">
            {phases.map((p) => (
              <li key={p.label} className="flex gap-3 text-sm">
                <StateDot state={p.state} />
                <span className={p.state === "planned" ? "text-muted-foreground" : ""}>
                  {p.label}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
            Integrity guarantees enforced in the database
          </h2>
          <ul className="mt-5 space-y-4">
            {guarantees.map((g) => (
              <li
                key={g}
                className="rounded-lg border border-border bg-card p-4 text-sm leading-relaxed text-card-foreground"
              >
                {g}
              </li>
            ))}
          </ul>
        </section>
      </div>

      <footer className="border-t border-border">
        <div className="mx-auto max-w-5xl px-6 py-8 text-xs leading-relaxed text-muted-foreground">
          Gambling involves risk. This platform is intended solely for lawful, licensed
          operation in permitted jurisdictions, with age verification, KYC/AML checks and
          responsible gambling controls enforced before any real-money play.
        </div>
      </footer>
    </main>
  );
}

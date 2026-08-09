import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Rocket } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { InboxMenu } from "@/components/layout/InboxMenu";

/** Shared AstroBet chrome: aurora backdrop + brand bar around every signed-in page. */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div
      className="relative min-h-screen bg-background bg-fixed bg-no-repeat text-foreground"
      style={{ backgroundImage: "var(--surface-glow)" }}
    >
      <header className="sticky top-0 z-20 border-b border-border/70 bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <Link to="/" className="flex items-center gap-2">
            <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-thrust">
              <Rocket className="size-4 text-primary-foreground" aria-hidden />
            </span>
            <span className="font-display text-base font-extrabold tracking-tight">AstroBet</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link
              to="/game"
              className="rounded-full bg-thrust px-4 py-1.5 text-xs font-semibold text-primary-foreground shadow-orbit transition-transform hover:scale-[1.03]"
            >
              Play
            </Link>
            <InboxMenu />
            <button
              type="button"
              onClick={() => void supabase.auth.signOut()}
              className="rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}

/** Centered chrome for the signed-out auth screens. */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <main className="relative flex min-h-screen items-center justify-center bg-background px-4 py-12 text-foreground">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ backgroundImage: "var(--surface-glow)" }}
      />
      <div className="relative w-full max-w-md rounded-3xl border border-border bg-card/70 p-6 shadow-orbit backdrop-blur">
        <Link to="/" className="flex items-center gap-2">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-thrust">
            <Rocket className="size-5 text-primary-foreground" aria-hidden />
          </span>
          <span className="font-display text-lg font-extrabold tracking-tight">AstroBet</span>
        </Link>
        {children}
      </div>
    </main>
  );
}

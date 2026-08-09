import { createFileRoute } from "@tanstack/react-router";

// Phase 20 — liveness/readiness probe for uptime monitors and deploy gates.
// Returns no user data and no configuration values.
export const Route = createFileRoute("/api/public/health")({
  server: {
    handlers: {
      GET: async () => {
        const startedAt = Date.now();
        let database: "ok" | "degraded" = "ok";

        try {
          const url = process.env["SUPABASE_URL"] ?? process.env["VITE_SUPABASE_URL"];
          const key =
            process.env["SUPABASE_PUBLISHABLE_KEY"] ?? process.env["VITE_SUPABASE_PUBLISHABLE_KEY"];
          if (!url || !key) {
            database = "degraded";
          } else {
            // A reachable Data API answers this probe; auth-shaped replies still
            // prove the service is up, so only transport failures are degraded.
            const response = await fetch(`${url}/auth/v1/health`, { headers: { apikey: key } });
            if (response.status >= 500) database = "degraded";
          }
        } catch {
          database = "degraded";
        }

        const body = {
          status: database === "ok" ? "healthy" : "degraded",
          checks: { database },
          latencyMs: Date.now() - startedAt,
          timestamp: new Date().toISOString(),
        };

        return new Response(JSON.stringify(body), {
          status: database === "ok" ? 200 : 503,
          headers: { "content-type": "application/json", "cache-control": "no-store" },
        });
      },
    },
  },
});

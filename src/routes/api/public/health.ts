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
          const url = process.env["SUPABASE_URL"];
          const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
          if (!url || !key) {
            database = "degraded";
          } else {
            const response = await fetch(`${url}/rest/v1/`, { headers: { apikey: key } });
            if (!response.ok) database = "degraded";
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

import { createFileRoute } from "@tanstack/react-router";

/** Best-effort country detection from edge headers; never blocks the UI. */
export const Route = createFileRoute("/api/public/geo")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const headers = request.headers;
        const country =
          headers.get("cf-ipcountry") ??
          headers.get("x-vercel-ip-country") ??
          headers.get("x-country-code") ??
          null;
        const accept = headers.get("accept-language") ?? "";
        return Response.json(
          {
            country: country && country !== "XX" ? country.toUpperCase() : null,
            acceptLanguage: accept.slice(0, 64),
          },
          { headers: { "cache-control": "no-store" } },
        );
      },
    },
  },
});

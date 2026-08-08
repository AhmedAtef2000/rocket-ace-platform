import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { AccountNav } from "@/components/account/AccountNav";
import { Button } from "@/components/ui/button";
import { createTicket, listMyTickets, replyToTicket } from "@/lib/support.functions";

const title = "Support — Rocket Flight";
const description =
  "Open a support ticket, track its status and reply to our agents about deposits, withdrawals, verification or responsible gambling.";

export const Route = createFileRoute("/_authenticated/support")({
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
  component: SupportPage,
});

const categories = [
  { value: "ACCOUNT", label: "Account" },
  { value: "DEPOSIT", label: "Deposit" },
  { value: "WITHDRAWAL", label: "Withdrawal" },
  { value: "GAME", label: "Game" },
  { value: "RESPONSIBLE_GAMBLING", label: "Responsible gambling" },
  { value: "OTHER", label: "Other" },
];

function SupportPage() {
  const queryClient = useQueryClient();
  const fetchTickets = useServerFn(listMyTickets);
  const create = useServerFn(createTicket);
  const reply = useServerFn(replyToTicket);

  const [category, setCategory] = useState("ACCOUNT");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [replies, setReplies] = useState<Record<string, string>>({});

  const tickets = useQuery({
    queryKey: ["support", "tickets"],
    queryFn: async () => fetchTickets({ data: undefined }),
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["support"] });

  const createMutation = useMutation({
    mutationFn: async () => create({ data: { category, subject, body } }),
    onSuccess: (result) => {
      toast.success(`Ticket ${result.reference} created`);
      setSubject("");
      setBody("");
      void refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const replyMutation = useMutation({
    mutationFn: async (ticketId: string) =>
      reply({ data: { ticketId, body: replies[ticketId] ?? "" } }),
    onSuccess: (_r, ticketId) => {
      toast.success("Reply sent");
      setReplies((prev) => ({ ...prev, [ticketId]: "" }));
      void refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <main className="mx-auto w-full max-w-4xl px-4 pb-16 pt-8">
      <h1 className="text-2xl font-semibold tracking-tight">Support</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Money and responsible-gambling tickets are prioritised automatically.
      </p>
      <AccountNav />

      <section className="mt-8 rounded-xl border border-border p-5">
        <h2 className="text-lg font-medium">New ticket</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            <span className="text-muted-foreground">Category</span>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            >
              {categories.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="text-muted-foreground">Subject</span>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              placeholder="Short summary"
            />
          </label>
        </div>
        <label className="mt-3 block text-sm">
          <span className="text-muted-foreground">Details</span>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={4}
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            placeholder="Tell us what happened"
          />
        </label>
        <Button
          className="mt-4"
          disabled={createMutation.isPending}
          onClick={() => createMutation.mutate()}
        >
          {createMutation.isPending ? "Sending…" : "Open ticket"}
        </Button>
      </section>

      <section className="mt-8 space-y-4">
        <h2 className="text-lg font-medium">Your tickets</h2>
        {tickets.isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : null}
        {tickets.data?.length === 0 ? (
          <p className="text-sm text-muted-foreground">No tickets yet.</p>
        ) : null}
        {(tickets.data ?? []).map((ticket) => (
          <article key={ticket.id} className="rounded-xl border border-border p-5">
            <header className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <h3 className="font-medium">{ticket.subject}</h3>
                <p className="text-xs text-muted-foreground">
                  {ticket.reference} · {ticket.category} · {ticket.priority}
                </p>
              </div>
              <span className="rounded-full border border-border px-2 py-0.5 text-xs">
                {ticket.status}
              </span>
            </header>
            <ol className="mt-4 space-y-3">
              {ticket.messages.map((message) => (
                <li
                  key={message.id}
                  className={
                    message.author_type === "USER"
                      ? "rounded-lg bg-muted/40 p-3 text-sm"
                      : "rounded-lg border border-primary/40 bg-primary/5 p-3 text-sm"
                  }
                >
                  <p className="text-xs text-muted-foreground">
                    {message.author_type === "USER" ? "You" : "Support"} ·{" "}
                    {new Date(message.created_at).toLocaleString()}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap">{message.body}</p>
                </li>
              ))}
            </ol>
            {!["RESOLVED", "CLOSED"].includes(ticket.status) ? (
              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                <input
                  value={replies[ticket.id] ?? ""}
                  onChange={(e) =>
                    setReplies((prev) => ({ ...prev, [ticket.id]: e.target.value }))
                  }
                  className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
                  placeholder="Write a reply"
                />
                <Button
                  variant="secondary"
                  disabled={replyMutation.isPending}
                  onClick={() => replyMutation.mutate(ticket.id)}
                >
                  Send
                </Button>
              </div>
            ) : null}
          </article>
        ))}
      </section>
    </main>
  );
}
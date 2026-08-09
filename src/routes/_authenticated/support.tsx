import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { AccountNav } from "@/components/account/AccountNav";
import { Button } from "@/components/ui/button";
import { createTicket, listMyTickets, replyToTicket } from "@/lib/support.functions";
import { useI18n } from "@/lib/i18n";

const title = "Support — AstroBet";
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
  { value: "ACCOUNT", key: "support.cat.account" },
  { value: "DEPOSIT", key: "support.cat.deposit" },
  { value: "WITHDRAWAL", key: "support.cat.withdrawal" },
  { value: "GAME", key: "support.cat.game" },
  { value: "RESPONSIBLE_GAMBLING", key: "support.cat.rg" },
  { value: "OTHER", key: "support.cat.other" },
] as const;

function SupportPage() {
  const { t } = useI18n();
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
    mutationFn: async () => {
      const trimmedSubject = subject.trim();
      const trimmedBody = body.trim();
      if (trimmedSubject.length < 4) throw new Error(t("support.error.subject"));
      if (trimmedBody.length < 10)
        throw new Error(t("support.error.body"));
      return create({ data: { category, subject: trimmedSubject, body: trimmedBody } });
    },
    onSuccess: (result) => {
      toast.success(t("support.toast.created", { reference: result.reference }));
      setSubject("");
      setBody("");
      void refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const replyMutation = useMutation({
    mutationFn: async (ticketId: string) => {
      const text = (replies[ticketId] ?? "").trim();
      if (text.length < 2) throw new Error(t("support.error.reply"));
      return reply({ data: { ticketId, body: text } });
    },
    onSuccess: (_r, ticketId) => {
      toast.success(t("support.toast.reply"));
      setReplies((prev) => ({ ...prev, [ticketId]: "" }));
      void refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <main className="mx-auto w-full max-w-5xl px-4 pb-16 pt-8">
      <h1 className="font-display text-3xl font-extrabold tracking-tight">{t("support.heading")}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {t("support.subtitle")}
      </p>
      <AccountNav />

      <section className="mt-8 rounded-xl border border-border p-5">
        <h2 className="text-lg font-medium">{t("support.new.heading")}</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            <span className="text-muted-foreground">{t("support.new.category")}</span>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            >
              {categories.map((c) => (
                <option key={c.value} value={c.value}>
                  {t(c.key)}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="text-muted-foreground">{t("support.new.subject")}</span>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              placeholder={t("support.new.subjectPlaceholder")}
            />
          </label>
        </div>
        <label className="mt-3 block text-sm">
          <span className="text-muted-foreground">{t("support.new.details")}</span>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={4}
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            placeholder={t("support.new.detailsPlaceholder")}
          />
        </label>
        <Button
          className="mt-4"
          disabled={createMutation.isPending || subject.trim().length < 4 || body.trim().length < 10}
          onClick={() => createMutation.mutate()}
        >
          {createMutation.isPending ? t("support.new.sending") : t("support.new.open")}
        </Button>
      </section>

      <section className="mt-8 space-y-4">
        <h2 className="text-lg font-medium">{t("support.list.heading")}</h2>
        {tickets.isLoading ? <p className="text-sm text-muted-foreground">{t("support.list.loading")}</p> : null}
        {tickets.data?.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("support.list.empty")}</p>
        ) : null}
        {(tickets.data ?? []).map((ticket) => (
          <article key={ticket.id} className="rounded-xl border border-border p-5">
            <header className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <h3 className="font-medium">{ticket.subject}</h3>
                <p className="text-xs text-muted-foreground">
                  {ticket.reference} · {t(categories.find((c) => c.value === ticket.category)?.key ?? "support.cat.other")} · {t(`support.priority.${ticket.priority}`)}
                </p>
              </div>
              <span className="rounded-full border border-border px-2 py-0.5 text-xs">
                {t(`support.status.${ticket.status}`)}
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
                    {message.author_type === "USER" ? t("support.message.you") : t("support.message.support")} ·{" "}
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
                  placeholder={t("support.reply.placeholder")}
                />
                <Button
                  variant="secondary"
                  disabled={replyMutation.isPending || (replies[ticket.id] ?? "").trim().length < 2}
                  onClick={() => replyMutation.mutate(ticket.id)}
                >
                  {t("support.reply.send")}
                </Button>
              </div>
            ) : null}
          </article>
        ))}
      </section>
    </main>
  );
}
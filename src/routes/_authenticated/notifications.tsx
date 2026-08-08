import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { AccountNav } from "@/components/account/AccountNav";
import { Button } from "@/components/ui/button";
import { listNotifications, markNotificationsRead } from "@/lib/notifications.functions";

const title = "Notifications — Rocket Flight";
const description =
  "Deposit confirmations, withdrawal decisions, verification outcomes and support replies for your Rocket Flight account.";

export const Route = createFileRoute("/_authenticated/notifications")({
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
  component: NotificationsPage,
});

function NotificationsPage() {
  const queryClient = useQueryClient();
  const fetchAll = useServerFn(listNotifications);
  const markRead = useServerFn(markNotificationsRead);

  const notifications = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => fetchAll({ data: undefined }),
  });

  const mark = useMutation({
    mutationFn: async () => markRead({ data: undefined }),
    onSuccess: () => {
      toast.success("All caught up");
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const unread = (notifications.data ?? []).filter((n) => !n.read_at).length;

  return (
    <main className="mx-auto w-full max-w-3xl px-4 pb-16 pt-8">
      <h1 className="text-2xl font-semibold tracking-tight">Notifications</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {unread > 0 ? `${unread} unread` : "Nothing new right now."}
      </p>
      <AccountNav />

      {unread > 0 ? (
        <Button className="mt-6" variant="secondary" onClick={() => mark.mutate()}>
          Mark all as read
        </Button>
      ) : null}

      <ul className="mt-6 space-y-3">
        {(notifications.data ?? []).map((n) => (
          <li
            key={n.id}
            className={`rounded-xl border p-4 ${n.read_at ? "border-border" : "border-primary/40 bg-primary/5"}`}
          >
            <p className="text-sm font-medium">{n.title}</p>
            <p className="mt-1 text-sm text-muted-foreground">{n.body}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              {new Date(n.created_at).toLocaleString()}
            </p>
          </li>
        ))}
        {notifications.data?.length === 0 ? (
          <li className="text-sm text-muted-foreground">No notifications yet.</li>
        ) : null}
      </ul>
    </main>
  );
}
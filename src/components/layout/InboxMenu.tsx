import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Bell, LifeBuoy } from "lucide-react";

import { listNotifications, markNotificationsRead } from "@/lib/notifications.functions";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

/** Notifications + support merged into a single header menu. */
export function InboxMenu() {
  const queryClient = useQueryClient();
  const fetchNotifications = useServerFn(listNotifications);
  const markRead = useServerFn(markNotificationsRead);

  const notifications = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => fetchNotifications({ data: undefined }),
    refetchInterval: 60_000,
    retry: false,
  });

  const markAll = useMutation({
    mutationFn: async () => markRead({ data: undefined }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const items = notifications.data ?? [];
  const unread = items.filter((n) => !n.read_at).length;

  return (
    <Popover>
      <PopoverTrigger
        aria-label={unread > 0 ? `Inbox, ${unread} unread` : "Inbox"}
        className="relative rounded-full border border-border p-2 text-muted-foreground transition-colors hover:text-foreground"
      >
        <Bell className="size-4" aria-hidden />
        {unread > 0 ? (
          <span className="absolute -right-1 -top-1 grid min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-4 text-primary-foreground">
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <span className="text-sm font-semibold">Notifications</span>
          {unread > 0 ? (
            <button
              type="button"
              onClick={() => markAll.mutate()}
              className="text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              Mark all read
            </button>
          ) : null}
        </div>
        <ul className="max-h-72 divide-y divide-border overflow-y-auto">
          {notifications.isPending ? (
            <li className="px-3 py-6 text-center text-xs text-muted-foreground">Loading…</li>
          ) : items.length === 0 ? (
            <li className="px-3 py-6 text-center text-xs text-muted-foreground">
              Announcements, messages from our team and deposit or withdrawal updates land here.
            </li>
          ) : (
            items.slice(0, 12).map((n) => (
              <li key={n.id} className={n.read_at ? "px-3 py-2.5" : "bg-primary/5 px-3 py-2.5"}>
                <p className="text-xs font-semibold text-foreground">{n.title}</p>
                {n.body ? <p className="mt-0.5 text-xs text-muted-foreground">{n.body}</p> : null}
                <p className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                  {timeAgo(n.created_at)}
                </p>
              </li>
            ))
          )}
        </ul>
        <div className="flex items-center justify-between border-t border-border px-3 py-2">
          <Link to="/notifications" className="text-xs text-muted-foreground hover:text-foreground">
            View all
          </Link>
          <Link
            to="/support"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground"
          >
            <LifeBuoy className="size-3.5" aria-hidden />
            Support
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
// Phase 14 — support desk helpers (server only).
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type Admin = SupabaseClient<Database>;

export const TICKET_CATEGORIES = [
  "ACCOUNT",
  "DEPOSIT",
  "WITHDRAWAL",
  "GAME",
  "RESPONSIBLE_GAMBLING",
  "OTHER",
] as const;

export type TicketCategory = (typeof TICKET_CATEGORIES)[number];

function text(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export function parseTicketInput(data: unknown): {
  category: TicketCategory;
  subject: string;
  body: string;
} {
  const d = (data ?? {}) as Record<string, unknown>;
  const category = text(d["category"], 40).toUpperCase() as TicketCategory;
  if (!TICKET_CATEGORIES.includes(category)) throw new Error("Choose a valid category.");
  const subject = text(d["subject"], 140);
  const body = text(d["body"], 4000);
  if (subject.length < 4) throw new Error("Add a short subject.");
  if (body.length < 10) throw new Error("Describe the issue in a little more detail.");
  return { category, subject, body };
}

export function parseMessageInput(data: unknown): { ticketId: string; body: string } {
  const d = (data ?? {}) as Record<string, unknown>;
  const ticketId = text(d["ticketId"], 64);
  const body = text(d["body"], 4000);
  if (!ticketId) throw new Error("Missing ticket.");
  if (body.length < 2) throw new Error("Write a message before sending.");
  return { ticketId, body };
}

/** Human-friendly, collision-resistant ticket reference. */
export function ticketReference(): string {
  const buf = new Uint8Array(4);
  crypto.getRandomValues(buf);
  const suffix = Array.from(buf)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
  return `RF-${new Date().getUTCFullYear()}-${suffix}`;
}

/** Priority is derived from category — money and RG issues jump the queue. */
export function priorityFor(category: TicketCategory): string {
  if (category === "RESPONSIBLE_GAMBLING") return "URGENT";
  if (category === "WITHDRAWAL" || category === "DEPOSIT") return "HIGH";
  return "NORMAL";
}

export async function notify(
  admin: Admin,
  userId: string,
  eventType: string,
  title: string,
  body: string,
): Promise<void> {
  await admin.from("notifications").insert({
    user_id: userId,
    event_type: eventType,
    title,
    body,
  });
}
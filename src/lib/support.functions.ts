import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { parseMessageInput, parseTicketInput } from "@/lib/support.server";

export const listMyTickets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: tickets, error } = await supabaseAdmin
      .from("support_tickets")
      .select("id, reference, category, subject, status, priority, created_at, updated_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);

    const ids = (tickets ?? []).map((t) => t.id);
    const messages = ids.length
      ? (
          await supabaseAdmin
            .from("support_messages")
            .select("id, ticket_id, author_type, body, created_at")
            .in("ticket_id", ids)
            .eq("internal_note", false)
            .order("created_at", { ascending: true })
        ).data ?? []
      : [];

    return (tickets ?? []).map((t) => ({
      ...t,
      messages: messages.filter((m) => m.ticket_id === t.id),
    }));
  });

export const createTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => parseTicketInput(data))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { priorityFor, ticketReference } = await import("@/lib/support.server");
    const { audit } = await import("@/lib/user-management.server");

    const { count } = await supabaseAdmin
      .from("support_tickets")
      .select("id", { count: "exact", head: true })
      .eq("user_id", context.userId)
      .in("status", ["OPEN", "PENDING_USER", "ESCALATED"]);
    if ((count ?? 0) >= 10) {
      throw new Error("You already have 10 open tickets. Please wait for a reply.");
    }

    const { data: ticket, error } = await supabaseAdmin
      .from("support_tickets")
      .insert({
        user_id: context.userId,
        reference: ticketReference(),
        category: data.category,
        subject: data.subject,
        priority: priorityFor(data.category),
        status: "OPEN",
      })
      .select("id, reference")
      .single();
    if (error) throw new Error(error.message);

    const { error: messageError } = await supabaseAdmin.from("support_messages").insert({
      ticket_id: ticket.id,
      author_id: context.userId,
      author_type: "USER",
      body: data.body,
      internal_note: false,
    });
    if (messageError) throw new Error(messageError.message);

    await audit(supabaseAdmin, {
      actorId: context.userId,
      action: "support.ticket_created",
      resourceType: "support_tickets",
      resourceId: ticket.id,
      metadata: { category: data.category },
    });

    return { id: ticket.id, reference: ticket.reference };
  });

export const replyToTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => parseMessageInput(data))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: ticket, error } = await supabaseAdmin
      .from("support_tickets")
      .select("id, user_id, status")
      .eq("id", data.ticketId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!ticket || ticket.user_id !== context.userId) throw new Error("Ticket not found.");
    if (["RESOLVED", "CLOSED"].includes(ticket.status)) {
      throw new Error("This ticket is closed. Open a new one if you still need help.");
    }

    const { error: messageError } = await supabaseAdmin.from("support_messages").insert({
      ticket_id: ticket.id,
      author_id: context.userId,
      author_type: "USER",
      body: data.body,
      internal_note: false,
    });
    if (messageError) throw new Error(messageError.message);

    await supabaseAdmin
      .from("support_tickets")
      .update({ status: "OPEN", updated_at: new Date().toISOString() })
      .eq("id", ticket.id);

    return { ok: true };
  });
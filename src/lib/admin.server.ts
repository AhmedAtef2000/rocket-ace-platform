// Phase 15 — admin RBAC helpers (server only).
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type Admin = SupabaseClient<Database>;

export type AdminIdentity = {
  adminId: string;
  roleKey: string;
  permissions: string[];
};

/** Resolves the caller's back-office role, or null when they are not staff. */
export async function adminIdentity(admin: Admin, userId: string): Promise<AdminIdentity | null> {
  const { data, error } = await admin
    .from("admin_users")
    .select("id, active, role_id, admin_roles!inner(key)")
    .eq("user_id", userId)
    .eq("active", true)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;

  const { data: perms, error: permError } = await admin
    .from("role_permissions")
    .select("permissions!inner(key)")
    .eq("role_id", data.role_id);
  if (permError) throw new Error(permError.message);

  return {
    adminId: data.id,
    roleKey: (data as unknown as { admin_roles: { key: string } }).admin_roles.key,
    permissions: (perms ?? []).map((p) => (p as unknown as { permissions: { key: string } }).permissions.key),
  };
}

export async function requirePermission(
  admin: Admin,
  userId: string,
  permission: string,
): Promise<AdminIdentity> {
  const identity = await adminIdentity(admin, userId);
  if (!identity) throw new Error("Back-office access is not enabled for this account.");
  if (!identity.permissions.includes(permission)) {
    throw new Error(`Your role does not allow ${permission}.`);
  }
  return identity;
}

export async function auditAdmin(
  admin: Admin,
  entry: {
    actorId: string;
    actorRole: string;
    action: string;
    resourceType: string;
    resourceId?: string | null;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  await admin.from("audit_logs").insert({
    actor_id: entry.actorId,
    actor_role: entry.actorRole,
    action: entry.action,
    resource_type: entry.resourceType,
    resource_id: entry.resourceId ?? null,
    metadata: (entry.metadata ?? {}) as never,
  });
}

export function num(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  return typeof value === "number" ? value : Number(value);
}

export function parseDecision(data: unknown): { id: string; note: string | null } {
  const d = (data ?? {}) as Record<string, unknown>;
  const id = typeof d["id"] === "string" ? d["id"] : "";
  if (!id) throw new Error("Missing record id.");
  const rawNote = typeof d["note"] === "string" ? d["note"].trim().slice(0, 500) : "";
  return { id, note: rawNote || null };
}
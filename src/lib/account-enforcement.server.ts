// Server-only enforcement for back-office account actions.
// Turns admin status changes into real effects: auth bans, session revocation
// and betting / withdrawal blocks.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type Admin = SupabaseClient<Database>;

/** Permanent-ish ban window used for suspended / closed accounts. */
const BAN_FOREVER = "876000h";

/** Revokes every active app session row for the user. */
export async function revokeAppSessions(admin: Admin, userId: string): Promise<void> {
  await admin
    .from("user_sessions")
    .update({ revoked_at: new Date().toISOString() })
    .eq("user_id", userId)
    .is("revoked_at", null);
}

/**
 * Kills the user's auth sessions through the GoTrue admin API so existing
 * refresh tokens stop working immediately.
 */
export async function revokeAuthSessions(userId: string): Promise<void> {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!url || !key) return;
  try {
    await fetch(`${url}/auth/v1/admin/users/${userId}/logout`, {
      method: "POST",
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: "{}",
    });
  } catch {
    // Session revocation is best-effort; the DB-side blocks still apply.
  }
}

/** Bans (or unbans) the auth user so they cannot sign back in. */
export async function setAuthBan(admin: Admin, userId: string, banned: boolean): Promise<void> {
  try {
    await admin.auth.admin.updateUserById(userId, {
      ban_duration: banned ? BAN_FOREVER : "none",
    } as never);
  } catch {
    // Ignore — status + blocks below remain authoritative.
  }
}

export async function forceLogout(admin: Admin, userId: string): Promise<void> {
  // Force logout is not a ban: make sure the account can sign back in.
  await setAuthBan(admin, userId, false);
  await revokeAppSessions(admin, userId);
  await revokeAuthSessions(userId);
}

export type AccountFlags = {
  status?: Database["public"]["Enums"]["user_status"];
  betting_blocked?: boolean;
  withdrawals_blocked?: boolean;
  real_money_enabled?: boolean;
};

export async function applyAccountFlags(
  admin: Admin,
  userId: string,
  flags: AccountFlags,
): Promise<void> {
  const { error } = await admin.from("users").update(flags as never).eq("id", userId);
  if (error) throw new Error(error.message);
}

/** Maps a back-office action onto the flags + side effects it must produce. */
export async function enforceAction(
  admin: Admin,
  userId: string,
  action: string,
): Promise<void> {
  switch (action) {
    case "suspend":
      await applyAccountFlags(admin, userId, {
        status: "SUSPENDED",
        betting_blocked: true,
        withdrawals_blocked: true,
      });
      await setAuthBan(admin, userId, true);
      await revokeAppSessions(admin, userId);
      await revokeAuthSessions(userId);
      break;
    case "close":
      await applyAccountFlags(admin, userId, {
        status: "CLOSED",
        betting_blocked: true,
        withdrawals_blocked: true,
        real_money_enabled: false,
      });
      await setAuthBan(admin, userId, true);
      await revokeAppSessions(admin, userId);
      await revokeAuthSessions(userId);
      break;
    case "restrict":
      await applyAccountFlags(admin, userId, {
        status: "RESTRICTED",
        betting_blocked: true,
        withdrawals_blocked: true,
      });
      break;
    case "restrict_betting":
      await applyAccountFlags(admin, userId, { status: "RESTRICTED", betting_blocked: true });
      break;
    case "restrict_withdrawals":
      await applyAccountFlags(admin, userId, { status: "RESTRICTED", withdrawals_blocked: true });
      break;
    case "unsuspend":
      await applyAccountFlags(admin, userId, {
        status: "ACTIVE",
        betting_blocked: false,
        withdrawals_blocked: false,
      });
      await setAuthBan(admin, userId, false);
      break;
    default:
      break;
  }
}

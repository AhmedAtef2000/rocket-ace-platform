import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { parseOpsInput } from "@/lib/admin-ops.server";

export const listOpsResource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => parseOpsInput(data))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { requirePermission } = await import("@/lib/admin.server");
    const { OPS_RESOURCES } = await import("@/lib/admin-ops.server");
    const def = OPS_RESOURCES[data.resource] as {
      table: string;
      select: string;
      columns: readonly string[];
      orderBy: string;
      ascending?: boolean;
      permission: string;
      refine?: (query: never) => never;
    };
    await requirePermission(supabaseAdmin, context.userId, def.permission);

    let query = (supabaseAdmin.from(def.table as never) as never as {
      select: (s: string) => never;
    }).select(def.select) as never as {
      order: (c: string, o: { ascending: boolean }) => never;
    };
    if (def.refine) query = def.refine(query as never) as never;
    const built = query.order(def.orderBy, { ascending: def.ascending ?? false }) as never as {
      limit: (n: number) => Promise<{ data: Record<string, unknown>[] | null; error: { message: string } | null }>;
    };
    const { data: rows, error } = await built.limit(data.limit);
    if (error) throw new Error(error.message);

    const list = rows ?? [];
    const columns = def.columns.length > 0 ? [...def.columns] : Object.keys(list[0] ?? {});
    return { columns, rows: list };
  });

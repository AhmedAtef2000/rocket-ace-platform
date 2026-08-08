import { useEffect, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { registerSession } from "@/lib/user.functions";
import { useDeviceId } from "@/hooks/useDeviceId";

/** Records this device as an active session and signs out if it was revoked. */
export function SessionRegistrar() {
  const deviceId = useDeviceId();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const register = useServerFn(registerSession);
  const done = useRef(false);

  useEffect(() => {
    if (!deviceId || done.current) return;
    done.current = true;

    void (async () => {
      try {
        const result = await register({
          data: { deviceId, userAgent: navigator.userAgent },
        });
        if (result.revoked) {
          await supabase.auth.signOut();
          toast.info("This device was signed out from your account settings.");
          void navigate({ to: "/auth" });
          return;
        }
        await queryClient.invalidateQueries({ queryKey: ["user-management"] });
      } catch {
        // Session tracking is best-effort; never block the account UI.
      }
    })();
  }, [deviceId, register, navigate, queryClient]);

  return null;
}

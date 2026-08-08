import { useEffect, useState } from "react";

const STORAGE_KEY = "rf.device.id";

/** Stable per-browser identifier used as the user_sessions row id. */
export function useDeviceId(): string | null {
  const [deviceId, setDeviceId] = useState<string | null>(null);

  useEffect(() => {
    try {
      let id = window.localStorage.getItem(STORAGE_KEY);
      if (!id) {
        id = crypto.randomUUID();
        window.localStorage.setItem(STORAGE_KEY, id);
      }
      setDeviceId(id);
    } catch {
      setDeviceId(crypto.randomUUID());
    }
  }, []);

  return deviceId;
}

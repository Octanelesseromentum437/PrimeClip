import { useEffect } from "react";
import { useGlobalJobMonitor } from "../hooks/useJobStageNotifications";
import { ensureNotificationPermission } from "../lib/notifications";

export function GlobalJobMonitor() {
  useGlobalJobMonitor();

  useEffect(() => {
    void ensureNotificationPermission();
  }, []);

  return null;
}

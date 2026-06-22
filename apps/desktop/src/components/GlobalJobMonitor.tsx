import { useGlobalJobMonitor } from "../hooks/useJobStageNotifications";

export function GlobalJobMonitor() {
  useGlobalJobMonitor();
  return null;
}

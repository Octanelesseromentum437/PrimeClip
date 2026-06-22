import { listen } from "@tauri-apps/api/event";
import { useEffect, useState } from "react";
import { fetchHealth } from "../lib/api";
import { useLocale } from "../lib/i18n";

type ApiStatus = "checking" | "ready" | "failed";

export function ApiStartupBanner() {
  const { t } = useLocale();
  const [status, setStatus] = useState<ApiStatus>("checking");
  const [elapsedSec, setElapsedSec] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let interval: ReturnType<typeof setInterval> | null = null;
    let timer: ReturnType<typeof setInterval> | null = null;

    const markReady = () => {
      if (!cancelled) setStatus("ready");
    };

    const check = async () => {
      try {
        await fetchHealth();
        markReady();
      } catch {
        // Sidecar still starting — keep polling.
      }
    };

    void check();
    interval = setInterval(check, 2000);
    timer = setInterval(() => {
      setElapsedSec((s) => s + 1);
    }, 1000);

    const unlistenReady = listen("api-ready", markReady).catch(() => () => {});
    const unlistenFailed = listen("api-startup-failed", () => {
      if (!cancelled) setStatus("failed");
    }).catch(() => () => {});

    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
      if (timer) clearInterval(timer);
      void unlistenReady.then((fn) => fn());
      void unlistenFailed.then((fn) => fn());
    };
  }, []);

  if (status === "ready") return null;

  const message =
    status === "failed"
      ? t("banner.apiFailed")
      : t("banner.apiStarting", { sec: elapsedSec });

  return (
    <div className="shrink-0 bg-amber-600/95 text-white text-xs px-5 py-1.5 border-b border-amber-700/30">
      <span>{message}</span>
    </div>
  );
}

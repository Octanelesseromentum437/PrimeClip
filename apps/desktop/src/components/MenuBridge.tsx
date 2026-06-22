import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { isTauriApp } from "../lib/tauri";

export function MenuBridge() {
  const navigate = useNavigate();

  useEffect(() => {
    if (!isTauriApp()) return;

    let cancelled = false;
    let unlisten: (() => void) | undefined;

    void import("@tauri-apps/api/event").then(({ listen }) =>
      listen<string>("menu-navigate", (event) => {
        if (!cancelled && event.payload) {
          navigate(event.payload);
        }
      }).then((fn) => {
        if (cancelled) {
          fn();
        } else {
          unlisten = fn;
        }
      }),
    );

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [navigate]);

  return null;
}

import { isTauriApp } from "./tauri";

export type IconShape = "square" | "rounded" | "circle";

const STORAGE_KEY = "primeclip-icon-shape";

export function readStoredIconShape(): IconShape {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "square" || stored === "rounded" || stored === "circle") return stored;
  return "rounded";
}

export async function applyIconShape(shape: IconShape): Promise<void> {
  localStorage.setItem(STORAGE_KEY, shape);
  if (!isTauriApp()) return;
  const { invoke } = await import("@tauri-apps/api/core");
  await invoke("set_icon_shape", { shape });
}

export async function syncIconShapeFromStorage(): Promise<void> {
  if (!isTauriApp()) return;
  const { invoke } = await import("@tauri-apps/api/core");
  await invoke("set_icon_shape", { shape: readStoredIconShape() });
}

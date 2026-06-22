import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";
import { playCompletionSound } from "./completionSound";
import { isTauriApp } from "./tauri";

let permissionChecked = false;

export function markImportNotified(importId: string): void {
  localStorage.setItem(`primeclip-notified-import-${importId}`, "1");
}

export function isImportNotified(importId: string): boolean {
  return localStorage.getItem(`primeclip-notified-import-${importId}`) === "1";
}

export async function ensureNotificationPermission(): Promise<boolean> {
  if (!isTauriApp()) return false;

  if (permissionChecked) {
    return isPermissionGranted();
  }

  permissionChecked = true;
  let granted = await isPermissionGranted();
  if (!granted) {
    const result = await requestPermission();
    granted = result === "granted";
  }
  return granted;
}

export interface NotifyOptions {
  title?: string;
  body: string;
  sound?: boolean;
}

export async function notifyCompletion({
  title = "PrimeClip",
  body,
  sound = true,
}: NotifyOptions): Promise<void> {
  if (sound) {
    playCompletionSound();
  }

  if (!isTauriApp()) return;

  try {
    const granted = await ensureNotificationPermission();
    if (granted) {
      await sendNotification({ title, body });
    }
  } catch {
    // Notification plugin unavailable
  }
}

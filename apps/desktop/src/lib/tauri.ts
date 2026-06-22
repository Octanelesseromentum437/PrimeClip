import { isTauri as checkTauri } from "@tauri-apps/api/core";

export function isTauriApp(): boolean {
  return checkTauri();
}

export async function pickVideoFile(): Promise<string | null> {
  const { open } = await import("@tauri-apps/plugin-dialog");
  const selected = await open({
    multiple: false,
    filters: [
      {
        name: "Video",
        extensions: ["mp4", "mov", "mkv", "webm", "avi", "m4v"],
      },
    ],
  });
  return typeof selected === "string" ? selected : null;
}

export async function openFileFolder(filePath: string): Promise<void> {
  if (!isTauriApp()) return;
  const dir = filePath.replace(/[/\\][^/\\]+$/, "");
  const { openOutputFolder } = await import("./credentials");
  await openOutputFolder(dir);
}

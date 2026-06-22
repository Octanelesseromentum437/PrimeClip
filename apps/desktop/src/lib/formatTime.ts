/** Format seconds as M:SS.s (e.g. 0:03.5, 1:24.0) */
export function formatCueTime(seconds: number): string {
  const rounded = Math.round(seconds * 10) / 10;
  const mins = Math.floor(rounded / 60);
  const secs = rounded % 60;
  const secStr = mins > 0 ? secs.toFixed(1).padStart(4, "0") : secs.toFixed(1);
  return `${mins}:${secStr}`;
}

/** Parse M:SS.s or plain seconds into a float. */
export function parseCueTime(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.includes(":")) {
    const [minPart, secPart] = trimmed.split(":");
    const mins = Number(minPart);
    const secs = Number(secPart);
    if (Number.isNaN(mins) || Number.isNaN(secs)) return null;
    return Math.round((mins * 60 + secs) * 10) / 10;
  }
  const n = Number(trimmed);
  return Number.isNaN(n) ? null : Math.round(n * 10) / 10;
}

/** Round to one decimal place for storage. */
export function roundCueTime(seconds: number): number {
  return Math.round(seconds * 10) / 10;
}

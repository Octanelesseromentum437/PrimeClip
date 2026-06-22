function formatVttTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const whole = Math.floor(s);
  const ms = Math.round((s - whole) * 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(whole).padStart(2, "0")}.${String(ms).padStart(3, "0")}`;
}

export function cuesToWebVTT(cues: { start: number; end: number; text: string }[]): string {
  const lines = ["WEBVTT", ""];
  for (const cue of cues) {
    if (!cue.text.trim() || cue.end <= cue.start) continue;
    lines.push(`${formatVttTime(cue.start)} --> ${formatVttTime(cue.end)}`);
    lines.push(cue.text.trim());
    lines.push("");
  }
  return lines.join("\n");
}

export function webVttBlobUrl(cues: { start: number; end: number; text: string }[]): string {
  const blob = new Blob([cuesToWebVTT(cues)], { type: "text/vtt" });
  return URL.createObjectURL(blob);
}

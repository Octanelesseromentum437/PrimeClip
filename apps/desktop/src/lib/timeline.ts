import type { AudioItem, CaptionCue, OverlayItem, TimelineState, VideoAudioTrim, VideoTrim } from "./types";

export function createTimelineId(): string {
  return crypto.randomUUID();
}

export function defaultVideoAudioTrim(trim: VideoTrim = { start: 0, end: null }): VideoAudioTrim {
  return {
    start: trim.start,
    end: trim.end,
    source_start: trim.start,
    volume: 1,
  };
}

export function defaultTimeline(): TimelineState {
  const trim = { start: 0, end: null };
  return {
    trim,
    audio_trim: defaultVideoAudioTrim(trim),
    overlays: [],
    audio: [],
  };
}

/** Ensures legacy timelines saved without audio_trim still load correctly. */
export function normalizeTimeline(timeline: TimelineState): TimelineState {
  return {
    ...timeline,
    audio_trim: timeline.audio_trim ?? defaultVideoAudioTrim(timeline.trim),
  };
}

/** Visual z-order: lower track on timeline = further back on screen. */
export function overlayZIndex(kind: "image" | "broll"): number {
  return kind === "broll" ? 3 : 2;
}

export function sortOverlaysByZOrder<T extends { kind: "image" | "broll" }>(overlays: T[]): T[] {
  return [...overlays].sort((a, b) => overlayZIndex(a.kind) - overlayZIndex(b.kind));
}

export function effectiveDuration(rawDuration: number, trim: VideoTrim): number {
  const end = trim.end ?? rawDuration;
  return Math.max(0.2, end - trim.start);
}

export function clampTimelineTime(time: number, duration: number): number {
  return Math.max(0, Math.min(duration, Math.round(time * 10) / 10));
}

export function mediaBlockDuration(currentTime: number, duration: number, defaultLen = 3): number {
  const remaining = duration - currentTime;
  return Math.max(0.5, Math.min(defaultLen, remaining));
}

export function collectCutPoints(
  duration: number,
  timeline: TimelineState,
  cues: CaptionCue[],
): number[] {
  if (duration <= 0) return [0];
  const points = new Set<number>([0, duration, timeline.trim.start]);
  if (timeline.trim.end != null) points.add(timeline.trim.end);
  const audioTrim = timeline.audio_trim ?? defaultVideoAudioTrim(timeline.trim);
  points.add(audioTrim.start);
  if (audioTrim.end != null) points.add(audioTrim.end);
  for (const cue of cues) {
    points.add(cue.start);
    points.add(cue.end);
  }
  for (const overlay of timeline.overlays) {
    points.add(overlay.start);
    points.add(overlay.end);
  }
  for (const track of timeline.audio) {
    points.add(track.start);
    points.add(track.end);
  }
  return [...points]
    .filter((t) => t >= 0 && t <= duration)
    .sort((a, b) => a - b);
}

export function nextCut(cuts: number[], time: number): number {
  const eps = 0.05;
  for (const t of cuts) {
    if (t > time + eps) return t;
  }
  return cuts[cuts.length - 1] ?? time;
}

export function prevCut(cuts: number[], time: number): number {
  const eps = 0.05;
  for (let i = cuts.length - 1; i >= 0; i--) {
    if (cuts[i] < time - eps) return cuts[i];
  }
  return cuts[0] ?? time;
}

export function markTrimIn(trim: VideoTrim, time: number, duration: number): VideoTrim {
  const trimEnd = trim.end ?? duration;
  const t = clampTimelineTime(time, duration);
  return { start: Math.min(t, trimEnd - 0.2), end: trim.end };
}

export function markTrimOut(trim: VideoTrim, time: number, duration: number): VideoTrim {
  const t = clampTimelineTime(time, duration);
  return { start: trim.start, end: Math.max(t, trim.start + 0.2) };
}

export function markAudioTrimIn(
  audioTrim: VideoAudioTrim,
  time: number,
  duration: number,
): VideoAudioTrim {
  const trimEnd = audioTrim.end ?? duration;
  const t = clampTimelineTime(time, duration);
  const start = Math.min(t, trimEnd - 0.2);
  return { ...audioTrim, start };
}

export function markAudioTrimOut(
  audioTrim: VideoAudioTrim,
  time: number,
  duration: number,
): VideoAudioTrim {
  const t = clampTimelineTime(time, duration);
  return { ...audioTrim, end: Math.max(t, audioTrim.start + 0.2) };
}

export function splitCue(cue: CaptionCue, time: number): [CaptionCue, CaptionCue] | null {
  const t = clampTimelineTime(time, cue.end);
  if (t <= cue.start + 0.1 || t >= cue.end - 0.1) return null;
  return [
    { ...cue, end: t },
    { ...cue, start: t },
  ];
}

export function splitOverlay(
  item: OverlayItem,
  time: number,
): [OverlayItem, OverlayItem] | null {
  const t = clampTimelineTime(time, item.end);
  if (t <= item.start + 0.1 || t >= item.end - 0.1) return null;
  const secondId = createTimelineId();
  return [
    { ...item, end: t },
    { ...item, id: secondId, start: t },
  ];
}

export function splitAudio(
  item: AudioItem,
  time: number,
): [AudioItem, AudioItem] | null {
  const t = clampTimelineTime(time, item.end);
  if (t <= item.start + 0.1 || t >= item.end - 0.1) return null;
  const offset = t - item.start;
  const secondId = createTimelineId();
  return [
    { ...item, end: t },
    {
      ...item,
      id: secondId,
      start: t,
      source_offset: item.source_offset + offset,
    },
  ];
}

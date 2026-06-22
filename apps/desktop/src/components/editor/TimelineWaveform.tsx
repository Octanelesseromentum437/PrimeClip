import { useEffect, useRef, useState } from "react";
import { fetchClipWaveform } from "../../lib/api";
import { loadAudioPeaks, slicePeaks } from "../../lib/audioPeaks";

interface TimelineWaveformProps {
  src: string | null;
  width: number;
  height: number;
  sourceStart?: number;
  sourceEnd?: number;
  /** Fallback when source file duration is not yet known. */
  fallbackDuration?: number;
  color?: string;
  /** When set, peaks are precomputed server-side via FFmpeg. */
  clipId?: string | null;
}

export function TimelineWaveform({
  src,
  width,
  height,
  sourceStart = 0,
  sourceEnd,
  fallbackDuration = 0,
  color = "rgba(255,255,255,0.75)",
  clipId = null,
}: TimelineWaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (width < 4 || height < 4) return;
    if (!clipId && !src) return;

    let cancelled = false;
    setFailed(false);

    const draw = (peaks: Float32Array, sourceDuration: number) => {
      const canvas = canvasRef.current;
      if (!canvas || cancelled) return;
      if (sourceDuration <= 0) return;

      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, height);

      const end = sourceEnd ?? sourceDuration;
      const visible = slicePeaks(peaks, sourceDuration, sourceStart, end);
      if (visible.length === 0) return;

      const mid = height / 2;
      const barW = width / visible.length;

      ctx.fillStyle = color;
      for (let i = 0; i < visible.length; i++) {
        const amp = visible[i]! * mid * 0.92;
        const x = i * barW;
        ctx.fillRect(x, mid - amp, Math.max(1, barW * 0.85), amp * 2);
      }
    };

    const load = clipId
      ? fetchClipWaveform(clipId).then(({ peaks, duration }) => ({
          peaks: Float32Array.from(peaks),
          duration,
        }))
      : loadAudioPeaks(src!);

    load
      .then(({ peaks, duration }) => {
        if (!cancelled) draw(peaks, duration || fallbackDuration);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, [clipId, src, width, height, sourceStart, sourceEnd, fallbackDuration, color]);

  if ((!clipId && !src) || width < 4) return null;

  return (
    <canvas
      ref={canvasRef}
      className={`timeline-waveform${failed ? " timeline-waveform--failed" : ""}`}
      aria-hidden
    />
  );
}

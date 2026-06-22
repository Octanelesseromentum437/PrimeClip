import { useEffect, useState } from "react";
import { clipFilmstripUrl } from "../../lib/api";
import { filmstripFrameCount, loadVideoFilmstrip } from "../../lib/videoFilmstrip";

interface TimelineFilmstripProps {
  src: string | null;
  width: number;
  height: number;
  rangeStart: number;
  rangeEnd: number;
  /** When set, frames are generated server-side via FFmpeg (much faster). */
  clipId?: string | null;
}

export function TimelineFilmstrip({
  src,
  width,
  height,
  rangeStart,
  rangeEnd,
  clipId = null,
}: TimelineFilmstripProps) {
  const [spriteUrl, setSpriteUrl] = useState<string | null>(null);
  const [frames, setFrames] = useState<string[]>([]);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (width < 8 || rangeEnd <= rangeStart) {
      setSpriteUrl(null);
      setFrames([]);
      return;
    }

    let cancelled = false;
    setFailed(false);
    setSpriteUrl(null);
    setFrames([]);

    const frameCount = filmstripFrameCount(width);

    if (clipId) {
      clipFilmstripUrl(clipId, rangeStart, rangeEnd, frameCount, height)
        .then((url) => {
          if (!cancelled) setSpriteUrl(url);
        })
        .catch(() => {
          if (!cancelled) setFailed(true);
        });
      return () => {
        cancelled = true;
      };
    }

    if (!src) return;

    loadVideoFilmstrip(src, rangeStart, rangeEnd, frameCount, height)
      .then((result) => {
        if (!cancelled) setFrames(result);
      })
      .catch(() => {
        if (!cancelled) {
          setFrames([]);
          setFailed(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [clipId, src, width, height, rangeStart, rangeEnd]);

  if (width < 8) return null;

  if (spriteUrl) {
    return (
      <img
        src={spriteUrl}
        alt=""
        className="timeline-filmstrip-sprite"
        style={{ width, height, objectFit: "cover" }}
        draggable={false}
      />
    );
  }

  if (frames.length === 0) {
    return failed ? <div className="timeline-filmstrip-fallback" aria-hidden /> : null;
  }

  const frameWidth = width / frames.length;

  return (
    <div className="timeline-filmstrip" aria-hidden>
      {frames.map((frame, i) => (
        <img
          key={`${rangeStart}-${i}`}
          src={frame}
          alt=""
          className="timeline-filmstrip-frame"
          style={{ width: frameWidth, height }}
          draggable={false}
        />
      ))}
    </div>
  );
}

import { useEffect, useState } from "react";
import { filmstripFrameCount, loadVideoFilmstrip } from "../../lib/videoFilmstrip";

interface TimelineFilmstripProps {
  src: string | null;
  width: number;
  height: number;
  rangeStart: number;
  rangeEnd: number;
}

export function TimelineFilmstrip({
  src,
  width,
  height,
  rangeStart,
  rangeEnd,
}: TimelineFilmstripProps) {
  const [frames, setFrames] = useState<string[]>([]);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!src || width < 8 || rangeEnd <= rangeStart) {
      setFrames([]);
      return;
    }

    let cancelled = false;
    setFailed(false);
    const frameCount = filmstripFrameCount(width);

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
  }, [src, width, height, rangeStart, rangeEnd]);

  if (!src || width < 8) return null;

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

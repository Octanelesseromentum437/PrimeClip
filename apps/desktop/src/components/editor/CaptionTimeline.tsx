import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CaptionCue } from "../../lib/types";
import { formatCueTime } from "../../lib/formatTime";

const PX_PER_SEC = 72;
const TRACK_LABEL_W = 88;
const MIN_BLOCK_W = 6;

interface CaptionTimelineProps {
  cues: CaptionCue[];
  duration: number;
  getCurrentTime: () => number;
  playing: boolean;
  selectedIndex: number | null;
  onSelect: (index: number) => void;
  onSeek: (time: number) => void;
  onUpdateCue: (index: number, patch: Partial<CaptionCue>) => void;
}

function buildTicks(duration: number): number[] {
  if (duration <= 0) return [0];
  const step = duration > 60 ? 5 : duration > 30 ? 2 : 1;
  const ticks: number[] = [];
  for (let t = 0; t <= duration; t += step) ticks.push(t);
  if (ticks[ticks.length - 1] !== duration) ticks.push(Math.ceil(duration));
  return ticks;
}

export function CaptionTimeline({
  cues,
  duration,
  getCurrentTime,
  playing,
  selectedIndex,
  onSelect,
  onSeek,
  onUpdateCue,
}: CaptionTimelineProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const playheadRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const blockRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const dragRef = useRef<{
    index: number;
    edge: "start" | "end";
    startX: number;
    origStart: number;
    origEnd: number;
  } | null>(null);

  const [dragging, setDragging] = useState(false);

  const timelineWidth = Math.max((duration || 1) * PX_PER_SEC, 400);
  const ticks = useMemo(() => buildTicks(duration || 1), [duration]);

  useEffect(() => {
    if (!playing || duration <= 0) return;

    let raf = 0;
    let lastActive = -1;

    const tick = () => {
      const t = getCurrentTime();
      const x = (t / duration) * timelineWidth;
      if (playheadRef.current) {
        playheadRef.current.style.transform = `translateX(${x}px)`;
      }

      const activeIdx = cues.findIndex((c) => t >= c.start && t < c.end);
      if (activeIdx !== lastActive) {
        blockRefs.current.forEach((el, i) => {
          el?.classList.toggle("caption-block-active", i === activeIdx);
        });
        lastActive = activeIdx;
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, duration, timelineWidth, cues, getCurrentTime]);

  useEffect(() => {
    if (!playing && duration > 0) {
      const t = getCurrentTime();
      const x = (t / duration) * timelineWidth;
      if (playheadRef.current) {
        playheadRef.current.style.transform = `translateX(${x}px)`;
      }
    }
  }, [playing, duration, timelineWidth, getCurrentTime, selectedIndex]);

  useEffect(() => {
    if (selectedIndex === null || !scrollRef.current) return;
    const cue = cues[selectedIndex];
    if (!cue || duration <= 0) return;
    const centerX = ((cue.start + cue.end) / 2 / duration) * timelineWidth;
    const view = scrollRef.current;
    const target = centerX + TRACK_LABEL_W - view.clientWidth / 2;
    view.scrollTo({ left: Math.max(0, target), behavior: "smooth" });
  }, [selectedIndex, cues, duration, timelineWidth]);

  const timeFromClientX = useCallback(
    (clientX: number) => {
      const scroll = scrollRef.current;
      if (!scroll || duration <= 0) return 0;
      const rect = scroll.getBoundingClientRect();
      const x = clientX - rect.left + scroll.scrollLeft - TRACK_LABEL_W;
      const t = (x / timelineWidth) * duration;
      return Math.max(0, Math.min(duration, Math.round(t * 10) / 10));
    },
    [duration, timelineWidth],
  );

  const handleTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest(".caption-block")) return;
    onSeek(timeFromClientX(e.clientX));
  };

  const startEdgeDrag = (
    e: React.MouseEvent,
    index: number,
    edge: "start" | "end",
  ) => {
    e.stopPropagation();
    const cue = cues[index];
    dragRef.current = {
      index,
      edge,
      startX: e.clientX,
      origStart: cue.start,
      origEnd: cue.end,
    };
    setDragging(true);
    onSelect(index);
  };

  useEffect(() => {
    if (!dragging) return;

    const onMove = (e: MouseEvent) => {
      const drag = dragRef.current;
      if (!drag || duration <= 0) return;
      const deltaPx = e.clientX - drag.startX;
      const deltaSec = (deltaPx / timelineWidth) * duration;

      if (drag.edge === "start") {
        const next = Math.max(0, Math.min(drag.origEnd - 0.2, drag.origStart + deltaSec));
        onUpdateCue(drag.index, { start: Math.round(next * 10) / 10 });
      } else {
        const next = Math.max(drag.origStart + 0.2, Math.min(duration, drag.origEnd + deltaSec));
        onUpdateCue(drag.index, { end: Math.round(next * 10) / 10 });
      }
    };

    const onUp = () => {
      dragRef.current = null;
      setDragging(false);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [dragging, duration, timelineWidth, onUpdateCue]);

  return (
    <div className="caption-timeline">
      <div className="caption-timeline-toolbar">
        <span className="text-[11px] font-medium uppercase tracking-wider text-app-fg-subtle">
          Captions
        </span>
        <span className="text-[11px] text-app-fg-subtle tabular-nums">
          {cues.length} blocks · {formatCueTime(duration)}
        </span>
      </div>

      <div ref={scrollRef} className="caption-timeline-scroll">
        <div
          className="caption-timeline-inner"
          style={{ width: timelineWidth + TRACK_LABEL_W }}
        >
          <div className="caption-ruler" style={{ paddingLeft: TRACK_LABEL_W }}>
            {ticks.map((t) => {
              const left = (t / (duration || 1)) * timelineWidth;
              return (
                <div
                  key={t}
                  className="caption-ruler-tick"
                  style={{ left }}
                >
                  <span>{formatCueTime(t)}</span>
                </div>
              );
            })}
          </div>

          <div className="caption-track-row">
            <div className="caption-track-label">Text</div>
            <div
              ref={trackRef}
              className="caption-track"
              style={{ width: timelineWidth }}
              onClick={handleTrackClick}
              onKeyDown={(e) => {
                if (e.key === "Enter") onSeek(getCurrentTime());
              }}
              role="slider"
              tabIndex={0}
              aria-label="Caption timeline"
            >
              {cues.map((cue, index) => {
                if (duration <= 0) return null;
                const left = (cue.start / duration) * timelineWidth;
                const width = Math.max(
                  MIN_BLOCK_W,
                  ((cue.end - cue.start) / duration) * timelineWidth,
                );
                const isSelected = selectedIndex === index;

                return (
                  <button
                    key={`${index}-${cue.start}-${cue.end}`}
                    ref={(el) => {
                      blockRefs.current[index] = el;
                    }}
                    type="button"
                    className={`caption-block ${isSelected ? "caption-block-selected" : ""}`}
                    style={{ left, width }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelect(index);
                      onSeek(cue.start);
                    }}
                    title={`${formatCueTime(cue.start)} – ${formatCueTime(cue.end)}`}
                  >
                    <span
                      className="caption-block-handle caption-block-handle-start"
                      onMouseDown={(e) => startEdgeDrag(e, index, "start")}
                    />
                    <span className="caption-block-label">{cue.text || "…"}</span>
                    <span
                      className="caption-block-handle caption-block-handle-end"
                      onMouseDown={(e) => startEdgeDrag(e, index, "end")}
                    />
                  </button>
                );
              })}

              <div ref={playheadRef} className="caption-playhead">
                <div className="caption-playhead-head" />
                <div className="caption-playhead-line" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

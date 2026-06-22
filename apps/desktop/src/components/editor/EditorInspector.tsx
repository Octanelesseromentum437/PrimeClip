import type {
  AudioItem,
  CaptionCue,
  CaptionStyle,
  CaptionStyleName,
  EditorSelection,
  OverlayItem,
  TimelineState,
  VideoAudioTrim,
  VideoTrim,
} from "../../lib/types";
import { formatCueTime, parseCueTime } from "../../lib/formatTime";

const PRESETS: { id: CaptionStyleName; label: string }[] = [
  { id: "reels", label: "Reels" },
  { id: "classic", label: "Classic" },
  { id: "minimal", label: "Minimal" },
  { id: "podcast", label: "Podcast" },
];

interface EditorInspectorProps {
  selection: EditorSelection | null;
  timeline: TimelineState;
  duration: number;
  cues: CaptionCue[];
  style: CaptionStyle | null;
  activePreset: CaptionStyleName | null;
  fontOptions: string[];
  saving: boolean;
  mediaUrls: Record<string, string>;
  onPreset: (preset: CaptionStyleName) => void;
  onStyleChange: (style: CaptionStyle) => void;
  onWordsPerScreen: (value: number) => void;
  onTrimChange: (trim: VideoTrim) => void;
  onVideoAudioChange: (audioTrim: VideoAudioTrim) => void;
  onUpdateCue: (index: number, patch: Partial<CaptionCue>) => void;
  onUpdateOverlay: (id: string, patch: Partial<OverlayItem>) => void;
  onUpdateAudio: (id: string, patch: Partial<AudioItem>) => void;
  onDeleteOverlay: (id: string) => void;
  onDeleteAudio: (id: string) => void;
}

function EmptyInspector() {
  return (
    <div className="editor-inspector-empty">
      <p className="text-xs text-app-fg-muted leading-relaxed">
        Selecione um item na timeline para ver opções específicas.
      </p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="editor-inspector-section">
      <p className="editor-inspector-label">{title}</p>
      {children}
    </div>
  );
}

function TimeFields({
  start,
  end,
  maxEnd,
  onStart,
  onEnd,
}: {
  start: number;
  end: number;
  maxEnd: number;
  onStart: (v: number) => void;
  onEnd: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-2 mt-1">
      <input
        type="text"
        defaultValue={formatCueTime(start)}
        key={`s-${start}`}
        onBlur={(e) => {
          const parsed = parseCueTime(e.target.value);
          if (parsed !== null) onStart(Math.min(parsed, end - 0.2));
        }}
        className="editor-time-input w-16"
        aria-label="Start time"
      />
      <span className="text-[10px] text-app-fg-subtle">→</span>
      <input
        type="text"
        defaultValue={formatCueTime(end)}
        key={`e-${end}`}
        onBlur={(e) => {
          const parsed = parseCueTime(e.target.value);
          if (parsed !== null) onEnd(Math.min(maxEnd, Math.max(start + 0.2, parsed)));
        }}
        className="editor-time-input w-16"
        aria-label="End time"
      />
    </div>
  );
}

export function EditorInspector({
  selection,
  timeline,
  duration,
  cues,
  style,
  activePreset,
  fontOptions,
  saving,
  mediaUrls,
  onPreset,
  onStyleChange,
  onWordsPerScreen,
  onTrimChange,
  onVideoAudioChange,
  onUpdateCue,
  onUpdateOverlay,
  onUpdateAudio,
  onDeleteOverlay,
  onDeleteAudio,
}: EditorInspectorProps) {
  if (!selection) return <EmptyInspector />;

  if (selection.type === "video") {
    const trimEnd = timeline.trim.end ?? duration;
    return (
      <>
        <Section title="Vídeo principal">
          <p className="text-[11px] text-app-fg-muted mt-1">
            Posicione o playhead e use <kbd className="text-app-fg">I</kbd> /{" "}
            <kbd className="text-app-fg">O</kbd> para marcar início e fim do corte.
          </p>
          <label className="block mt-2 text-[11px] text-app-fg-muted">
            Início
            <input
              type="range"
              min={0}
              max={Math.max(0, trimEnd - 0.2)}
              step={0.1}
              value={timeline.trim.start}
              onChange={(e) =>
                onTrimChange({ ...timeline.trim, start: Number(e.target.value) })
              }
              className="editor-range mt-1"
            />
            <span className="tabular-nums">{formatCueTime(timeline.trim.start)}</span>
          </label>
          <label className="block mt-2 text-[11px] text-app-fg-muted">
            Fim
            <input
              type="range"
              min={timeline.trim.start + 0.2}
              max={duration}
              step={0.1}
              value={trimEnd}
              onChange={(e) =>
                onTrimChange({ start: timeline.trim.start, end: Number(e.target.value) })
              }
              className="editor-range mt-1"
            />
            <span className="tabular-nums">{formatCueTime(trimEnd)}</span>
          </label>
          <p className="text-[10px] text-app-fg-subtle mt-2">
            Duração: {formatCueTime(trimEnd - timeline.trim.start)}
          </p>
        </Section>
      </>
    );
  }

  if (selection.type === "video-audio") {
    const audioEnd = timeline.audio_trim.end ?? duration;
    return (
      <>
        <Section title="Áudio do vídeo">
          <p className="text-[11px] text-app-fg-muted mt-1">
            Ajuste o áudio separado do vídeo para J-cuts, L-cuts ou só áudio.
          </p>
          <TimeFields
            start={timeline.audio_trim.start}
            end={audioEnd}
            maxEnd={duration}
            onStart={(v) =>
              onVideoAudioChange({ ...timeline.audio_trim, start: v })
            }
            onEnd={(v) =>
              onVideoAudioChange({ ...timeline.audio_trim, end: v })
            }
          />
        </Section>

        <Section title="Offset no arquivo">
          <input
            type="range"
            min={0}
            max={duration}
            step={0.1}
            value={timeline.audio_trim.source_start}
            onChange={(e) =>
              onVideoAudioChange({
                ...timeline.audio_trim,
                source_start: Number(e.target.value),
              })
            }
            className="editor-range mt-1"
          />
          <span className="text-[10px] text-app-fg-subtle tabular-nums">
            {formatCueTime(timeline.audio_trim.source_start)}
          </span>
        </Section>

        <Section title={`Volume · ${Math.round(timeline.audio_trim.volume * 100)}%`}>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={timeline.audio_trim.volume}
            onChange={(e) =>
              onVideoAudioChange({
                ...timeline.audio_trim,
                volume: Number(e.target.value),
              })
            }
            className="editor-range mt-1"
          />
        </Section>
      </>
    );
  }

  if (selection.type === "caption") {
    const cue = cues[selection.index];
    if (!cue || !style) return <EmptyInspector />;
    return (
      <>
        <Section title={`Legenda #${selection.index + 1}`}>
          <TimeFields
            start={cue.start}
            end={cue.end}
            maxEnd={duration}
            onStart={(v) => onUpdateCue(selection.index, { start: v })}
            onEnd={(v) => onUpdateCue(selection.index, { end: v })}
          />
          <input
            type="text"
            value={cue.text}
            onChange={(e) => onUpdateCue(selection.index, { text: e.target.value })}
            className="editor-input mt-2"
            placeholder="Texto da legenda…"
          />
        </Section>

        <Section title="Presets">
          <div className="grid grid-cols-2 gap-1.5 mt-1">
            {PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => onPreset(p.id)}
                disabled={saving}
                className={
                  activePreset === p.id
                    ? "editor-preset editor-preset-active"
                    : "editor-preset"
                }
              >
                {p.label}
              </button>
            ))}
          </div>
        </Section>

        <Section title="Fonte">
          <select
            value={style.font_family}
            onChange={(e) => onStyleChange({ ...style, font_family: e.target.value })}
            className="editor-input mt-1"
          >
            {fontOptions.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </Section>

        <Section title={`Tamanho · ${style.font_size}`}>
          <input
            type="range"
            min={40}
            max={120}
            value={style.font_size}
            onChange={(e) =>
              onStyleChange({ ...style, font_size: Number(e.target.value) })
            }
            className="editor-range mt-1"
          />
        </Section>

        <Section title={`Palavras / tela · ${style.words_per_screen}`}>
          <input
            type="range"
            min={1}
            max={5}
            value={style.words_per_screen}
            onChange={(e) => onWordsPerScreen(Number(e.target.value))}
            className="editor-range mt-1"
          />
        </Section>

        <Section title="Cor">
          <input
            type="color"
            value={style.primary_color}
            onChange={(e) => onStyleChange({ ...style, primary_color: e.target.value })}
            className="editor-color mt-1"
          />
        </Section>
      </>
    );
  }

  if (selection.type === "overlay") {
    const item = timeline.overlays.find((o) => o.id === selection.id);
    if (!item) return <EmptyInspector />;
    const previewUrl = mediaUrls[item.asset];
    return (
      <>
        <Section title={item.kind === "broll" ? "B-roll" : "Imagem"}>
          {previewUrl && item.kind === "image" && (
            <img
              src={previewUrl}
              alt={item.label}
              className="mt-1 rounded-md w-full max-h-24 object-cover ring-1 ring-app-border"
            />
          )}
          <p className="text-[11px] text-app-fg-muted mt-1 truncate">{item.label || item.asset}</p>
          <TimeFields
            start={item.start}
            end={item.end}
            maxEnd={duration}
            onStart={(v) => onUpdateOverlay(item.id, { start: v })}
            onEnd={(v) => onUpdateOverlay(item.id, { end: v })}
          />
        </Section>

        <Section title="Posição X · %">
          <input
            type="range"
            min={0}
            max={100}
            value={item.x}
            onChange={(e) => onUpdateOverlay(item.id, { x: Number(e.target.value) })}
            className="editor-range mt-1"
          />
        </Section>

        <Section title="Posição Y · %">
          <input
            type="range"
            min={0}
            max={100}
            value={item.y}
            onChange={(e) => onUpdateOverlay(item.id, { y: Number(e.target.value) })}
            className="editor-range mt-1"
          />
        </Section>

        <Section title="Largura · %">
          <input
            type="range"
            min={10}
            max={100}
            value={item.width}
            onChange={(e) => onUpdateOverlay(item.id, { width: Number(e.target.value) })}
            className="editor-range mt-1"
          />
        </Section>

        <Section title="Altura · %">
          <input
            type="range"
            min={10}
            max={100}
            value={item.height}
            onChange={(e) => onUpdateOverlay(item.id, { height: Number(e.target.value) })}
            className="editor-range mt-1"
          />
        </Section>

        <Section title={`Opacidade · ${Math.round(item.opacity * 100)}%`}>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={item.opacity}
            onChange={(e) => onUpdateOverlay(item.id, { opacity: Number(e.target.value) })}
            className="editor-range mt-1"
          />
        </Section>

        {item.kind === "broll" && (
          <Section title={`Volume · ${Math.round(item.volume * 100)}%`}>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={item.volume}
              onChange={(e) => onUpdateOverlay(item.id, { volume: Number(e.target.value) })}
              className="editor-range mt-1"
            />
          </Section>
        )}

        <button
          type="button"
          onClick={() => onDeleteOverlay(item.id)}
          className="editor-toolbar-btn w-full text-red-400 hover:text-red-300 mt-2"
        >
          Remover
        </button>
      </>
    );
  }

  if (selection.type === "audio") {
    const item = timeline.audio.find((a) => a.id === selection.id);
    if (!item) return <EmptyInspector />;
    return (
      <>
        <Section title="Música de fundo">
          <p className="text-[11px] text-app-fg-muted mt-1 truncate">{item.label || item.asset}</p>
          <TimeFields
            start={item.start}
            end={item.end}
            maxEnd={duration}
            onStart={(v) => onUpdateAudio(item.id, { start: v })}
            onEnd={(v) => onUpdateAudio(item.id, { end: v })}
          />
        </Section>

        <Section title={`Volume · ${Math.round(item.volume * 100)}%`}>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={item.volume}
            onChange={(e) => onUpdateAudio(item.id, { volume: Number(e.target.value) })}
            className="editor-range mt-1"
          />
        </Section>

        <Section title="Offset no arquivo">
          <input
            type="range"
            min={0}
            max={30}
            step={0.1}
            value={item.source_offset}
            onChange={(e) =>
              onUpdateAudio(item.id, { source_offset: Number(e.target.value) })
            }
            className="editor-range mt-1"
          />
          <span className="text-[10px] text-app-fg-subtle tabular-nums">
            {formatCueTime(item.source_offset)}
          </span>
        </Section>

        <Section title={`Fade in · ${item.fade_in}s`}>
          <input
            type="range"
            min={0}
            max={3}
            step={0.1}
            value={item.fade_in}
            onChange={(e) => onUpdateAudio(item.id, { fade_in: Number(e.target.value) })}
            className="editor-range mt-1"
          />
        </Section>

        <Section title={`Fade out · ${item.fade_out}s`}>
          <input
            type="range"
            min={0}
            max={3}
            step={0.1}
            value={item.fade_out}
            onChange={(e) => onUpdateAudio(item.id, { fade_out: Number(e.target.value) })}
            className="editor-range mt-1"
          />
        </Section>

        <button
          type="button"
          onClick={() => onDeleteAudio(item.id)}
          className="editor-toolbar-btn w-full text-red-400 hover:text-red-300 mt-2"
        >
          Remover
        </button>
      </>
    );
  }

  return <EmptyInspector />;
}

import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { VideoPreview, type VideoAspect } from "./VideoPreview";
import {
  clipDownloadUrl,
  clipPreviewUrl,
  clipThumbnailUrl,
  fetchClipQualities,
} from "../lib/api";
import type { ClipRecord } from "../lib/types";

interface Props {
  clip: ClipRecord;
  videoId?: string;
}

export function ClipCard({ clip, videoId }: Props) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [qualities, setQualities] = useState<string[]>([]);
  const [aspectRatio, setAspectRatio] = useState<VideoAspect>("9:16");
  const [resolution, setResolution] = useState<string>("1080x1920");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    fetchClipQualities(clip.id)
      .then(({ resolutions, aspect_ratio }) => {
        setQualities(resolutions);
        setAspectRatio(aspect_ratio === "16:9" ? "16:9" : "9:16");
        if (resolutions.length) setResolution(resolutions[0]);
      })
      .catch(() => {
        setQualities(["1080x1920"]);
        setAspectRatio("9:16");
      });
  }, [clip.id]);

  useEffect(() => {
    if (clip.status !== "ready") {
      setPreviewUrl(null);
      setDownloadUrl(null);
      setThumbnailUrl(null);
      return;
    }

    setPreviewLoading(true);
    setPreviewError(null);
    setPlaying(false);

    Promise.all([
      clipPreviewUrl(clip.id, resolution),
      clipDownloadUrl(clip.id, resolution),
      clipThumbnailUrl(clip.id),
    ])
      .then(([preview, download, thumb]) => {
        setPreviewUrl(`${preview}?t=${Date.now()}`);
        setDownloadUrl(download);
        setThumbnailUrl(`${thumb}?t=${Date.now()}`);
      })
      .catch((err) => {
        setPreviewUrl(null);
        setDownloadUrl(null);
        setThumbnailUrl(null);
        setPreviewError(err instanceof Error ? err.message : "Preview unavailable");
      })
      .finally(() => setPreviewLoading(false));
  }, [clip.id, clip.status, resolution]);

  const durationSec = Math.round(clip.end_sec - clip.start_sec);
  const showPreview = clip.status === "ready" || clip.status === "rendering";
  const thumbAspect = aspectRatio === "16:9" ? "aspect-video" : "aspect-[9/16]";

  return (
    <article className="clip-card">
      {showPreview && (
        <div
          className={`clip-thumb group ${thumbAspect} max-h-72`}
          onClick={() => clip.status === "ready" && setPlaying(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              if (clip.status === "ready") setPlaying(true);
            }
          }}
          role={clip.status === "ready" ? "button" : undefined}
          tabIndex={clip.status === "ready" ? 0 : undefined}
        >
          {playing && previewUrl ? (
            <VideoPreview
              src={previewUrl}
              aspect={aspectRatio}
              loading={previewLoading}
              error={
                clip.status === "rendering"
                  ? "Rendering clip…"
                  : previewError
              }
              className="!rounded-none !ring-0 !shadow-none h-full"
            />
          ) : thumbnailUrl && clip.status === "ready" ? (
            <>
              <img
                src={thumbnailUrl}
                alt={clip.title}
                className="h-full w-full object-cover"
              />
              <div className="clip-thumb-overlay">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/90 text-black text-lg">
                  ▶
                </span>
              </div>
            </>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-xs text-app-fg-muted bg-app-muted">
              {clip.status === "rendering" ? "Rendering…" : previewLoading ? "Loading…" : "No preview"}
            </div>
          )}
        </div>
      )}

      <div className="p-4 space-y-3 flex-1 flex flex-col">
        <div className="flex justify-between items-start gap-2">
          <h3 className="font-medium text-sm leading-snug line-clamp-2">{clip.title}</h3>
          <span className="shrink-0 rounded-md bg-brand-600/10 px-2 py-0.5 font-mono text-xs text-brand-600 dark:text-brand-400">
            {clip.score.toFixed(1)}
          </span>
        </div>

        <p className="text-xs text-app-fg-muted line-clamp-2 flex-1">{clip.reason}</p>

        <div className="flex items-center gap-2 text-xs text-app-fg-subtle">
          <span>{Math.round(clip.start_sec)}s – {Math.round(clip.end_sec)}s</span>
          <span>·</span>
          <span>{durationSec}s</span>
          <span>·</span>
          <span className="capitalize">{clip.status}</span>
        </div>

        {clip.status === "ready" && videoId && (
          <Link
            to={`/edit/${videoId}/${clip.id}`}
            className="btn-outline w-full text-center"
          >
            Editar clip
          </Link>
        )}

        {clip.status === "ready" && downloadUrl && qualities.length > 0 && (
          <div className="space-y-2 pt-1 border-t border-app-border/60">
            <label className="block label-xs">
              Quality
              <select
                value={resolution}
                onChange={(e) => {
                  setResolution(e.target.value);
                  setPlaying(false);
                }}
                className="input mt-1"
              >
                {qualities.map((q) => (
                  <option key={q} value={q}>
                    {q}
                  </option>
                ))}
              </select>
            </label>
            <a href={downloadUrl} download className="block text-center btn-primary">
              Download
            </a>
          </div>
        )}
      </div>
    </article>
  );
}

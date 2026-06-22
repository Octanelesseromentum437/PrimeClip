import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { VideoPreview, type VideoAspect } from "./VideoPreview";
import { clipDownloadUrl, fetchClipQualities } from "../lib/api";
import type { ClipRecord } from "../lib/types";

interface Props {
  clip: ClipRecord;
  videoId?: string;
}

export function ClipCard({ clip, videoId }: Props) {
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [qualities, setQualities] = useState<string[]>([]);
  const [aspectRatio, setAspectRatio] = useState<VideoAspect>("9:16");
  const [resolution, setResolution] = useState<string>("1080x1920");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

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
      setDownloadUrl(null);
      return;
    }
    setPreviewLoading(true);
    setPreviewError(null);
    clipDownloadUrl(clip.id, resolution)
      .then(setDownloadUrl)
      .catch((err) => {
        setDownloadUrl(null);
        setPreviewError(err instanceof Error ? err.message : "Preview unavailable");
      })
      .finally(() => setPreviewLoading(false));
  }, [clip.id, clip.status, resolution]);

  const showPreview = clip.status === "ready" || clip.status === "rendering";

  return (
    <div className="card p-4 flex flex-col gap-3">
      <div className="flex justify-between items-start">
        <h3 className="font-semibold text-lg">{clip.title}</h3>
        <span className="text-brand-600 dark:text-brand-500 font-mono text-sm">
          {clip.score.toFixed(1)}
        </span>
      </div>
      <p className="text-sm text-app-fg-muted line-clamp-2">{clip.reason}</p>
      <p className="text-xs text-app-fg-subtle">
        {Math.round(clip.start_sec)}s – {Math.round(clip.end_sec)}s · {clip.status}
      </p>

      {showPreview && (
        <VideoPreview
          src={clip.status === "ready" ? downloadUrl : null}
          aspect={aspectRatio}
          loading={clip.status === "rendering" || previewLoading}
          error={
            clip.status === "rendering"
              ? "Rendering clip…"
              : previewError
          }
        />
      )}

      {clip.status === "ready" && videoId && (
        <Link
          to={`/edit/${videoId}/${clip.id}`}
          className="text-center py-2 rounded-lg border border-app-border hover:border-brand-500 text-sm font-medium transition-colors"
        >
          Edit captions
        </Link>
      )}

      {clip.status === "ready" && downloadUrl && qualities.length > 0 && (
        <div className="space-y-2">
          <label className="block label-xs">
            Quality
            <select
              value={resolution}
              onChange={(e) => setResolution(e.target.value)}
              className="input mt-1"
            >
              {qualities.map((q) => (
                <option key={q} value={q}>
                  {q}
                </option>
              ))}
            </select>
          </label>
          <a
            href={downloadUrl}
            download
            className="block text-center btn-primary text-sm font-medium"
          >
            Download
          </a>
        </div>
      )}
    </div>
  );
}

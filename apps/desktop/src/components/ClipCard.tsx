import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { clipDownloadUrl, fetchClipQualities } from "../lib/api";
import type { ClipRecord } from "../lib/types";

interface Props {
  clip: ClipRecord;
  videoId?: string;
}

export function ClipCard({ clip, videoId }: Props) {
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [qualities, setQualities] = useState<string[]>([]);
  const [resolution, setResolution] = useState<string>("1080x1920");

  useEffect(() => {
    fetchClipQualities(clip.id)
      .then((list) => {
        setQualities(list);
        if (list.length) setResolution(list[0]);
      })
      .catch(() => setQualities(["1080x1920"]));
  }, [clip.id]);

  useEffect(() => {
    clipDownloadUrl(clip.id, resolution).then(setDownloadUrl);
  }, [clip.id, resolution]);

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
        {clip.start_sec.toFixed(0)}s – {clip.end_sec.toFixed(0)}s · {clip.status}
      </p>
      {clip.status === "ready" && downloadUrl && (
        <div className="flex gap-2 mt-auto">
          <video
            key={downloadUrl}
            src={downloadUrl}
            controls
            className="w-full rounded-lg max-h-48 bg-black"
          />
        </div>
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

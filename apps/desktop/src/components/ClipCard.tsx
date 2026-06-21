import { useEffect, useState } from "react";
import { clipDownloadUrl } from "../lib/api";
import type { ClipRecord } from "../lib/types";

interface Props {
  clip: ClipRecord;
}

export function ClipCard({ clip }: Props) {
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  useEffect(() => {
    clipDownloadUrl(clip.id).then(setDownloadUrl);
  }, [clip.id]);

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 flex flex-col gap-3">
      <div className="flex justify-between items-start">
        <h3 className="font-semibold text-lg">{clip.title}</h3>
        <span className="text-brand-500 font-mono text-sm">{clip.score.toFixed(1)}</span>
      </div>
      <p className="text-sm text-slate-400 line-clamp-2">{clip.reason}</p>
      <p className="text-xs text-slate-500">
        {clip.start_sec.toFixed(0)}s – {clip.end_sec.toFixed(0)}s · {clip.status}
      </p>
      {clip.status === "ready" && downloadUrl && (
        <div className="flex gap-2 mt-auto">
          <video
            src={downloadUrl}
            controls
            className="w-full rounded-lg max-h-48 bg-black"
          />
        </div>
      )}
      {clip.status === "ready" && downloadUrl && (
        <a
          href={downloadUrl}
          download
          className="text-center py-2 rounded-lg bg-brand-600 hover:bg-brand-500 text-sm font-medium"
        >
          Download
        </a>
      )}
    </div>
  );
}

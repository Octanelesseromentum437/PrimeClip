import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { fetchImportStatus, fetchJob } from "../lib/api";
import { useLocale } from "../lib/i18n";
import { loadUploadSession, patchUploadSession } from "../lib/uploadSession";

export function ActiveUploadBanner() {
  const { t } = useLocale();
  const [importPct, setImportPct] = useState<number | null>(null);
  const [genPct, setGenPct] = useState<number | null>(null);
  const [genLink, setGenLink] = useState<string | null>(null);

  useEffect(() => {
    const tick = async () => {
      const session = loadUploadSession();

      if (session.importId) {
        try {
          const status = await fetchImportStatus(session.importId);
          if (status.status === "downloading" || status.status === "queued") {
            setImportPct(status.progress_pct);
          } else {
            setImportPct(null);
            if (status.status === "completed" && status.video_id) {
              patchUploadSession({
                importId: null,
                readyVideo: {
                  video_id: status.video_id,
                  filename: status.filename ?? "imported video",
                  duration_sec: 0,
                },
              });
            }
            if (status.status === "failed") {
              patchUploadSession({ importId: null });
            }
          }
        } catch {
          setImportPct(null);
        }
      } else {
        setImportPct(null);
      }

      if (session.activeGeneration) {
        try {
          const job = await fetchJob(session.activeGeneration.jobId);
          if (job.status === "running" || job.status === "queued") {
            setGenPct(job.progress_pct);
            setGenLink(
              `/results/${session.activeGeneration.videoId}?job=${session.activeGeneration.jobId}`,
            );
          } else {
            setGenPct(null);
            setGenLink(null);
            if (job.status === "completed" || job.status === "failed") {
              patchUploadSession({ activeGeneration: null });
            }
          }
        } catch {
          setGenPct(null);
          setGenLink(null);
        }
      } else {
        setGenPct(null);
        setGenLink(null);
      }
    };

    tick();
    const interval = setInterval(tick, 2000);
    return () => clearInterval(interval);
  }, [t]);

  if (importPct === null && genPct === null) return null;

  const message =
    importPct !== null
      ? t("banner.import", { pct: importPct })
      : t("banner.generating", { pct: genPct ?? 0 });

  const link = genLink ?? "/";

  return (
    <div className="bg-brand-600 text-white text-sm px-4 py-2 flex items-center justify-between gap-4">
      <span>{message}</span>
      {genLink && (
        <Link to={link} className="underline underline-offset-2 whitespace-nowrap hover:opacity-90">
          {t("banner.view")}
        </Link>
      )}
    </div>
  );
}

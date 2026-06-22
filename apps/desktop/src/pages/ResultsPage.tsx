import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { ClipCard } from "../components/ClipCard";
import { JobProgress } from "../components/JobProgress";
import { cancelJob, fetchClips, fetchVideo } from "../lib/api";
import { useLocale } from "../lib/i18n";
import { useJobPolling } from "../hooks/useJobPolling";
import { patchUploadSession } from "../lib/uploadSession";
import type { ClipRecord } from "../lib/types";

export function ResultsPage() {
  const { videoId } = useParams<{ videoId: string }>();
  const [searchParams] = useSearchParams();
  const jobId = searchParams.get("job");
  const queryClient = useQueryClient();
  const { data: job } = useJobPolling(jobId, true);
  const [clips, setClips] = useState<ClipRecord[]>([]);
  const [clipsLoading, setClipsLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const { t } = useLocale();

  const isActive = job?.status === "running" || job?.status === "queued";

  const handleCancel = async () => {
    if (!jobId || cancelling) return;
    setCancelling(true);
    try {
      const updated = await cancelJob(jobId);
      queryClient.setQueryData(["job", jobId], updated);
      patchUploadSession({ activeGeneration: null });
    } catch (err) {
      console.error(err);
    } finally {
      setCancelling(false);
    }
  };

  useEffect(() => {
    if (!videoId) return;
    setClipsLoading(true);
    fetchClips(videoId)
      .then(setClips)
      .finally(() => setClipsLoading(false));
  }, [videoId, job?.status, job?.progress_pct]);

  useEffect(() => {
    if (!videoId || !jobId) return;
    if (job?.status === "completed" || job?.status === "failed" || job?.status === "cancelled") {
      patchUploadSession({ activeGeneration: null });
    }
  }, [videoId, jobId, job?.status]);

  useEffect(() => {
    if (!videoId || jobId) return;
    fetchVideo(videoId).then((detail) => {
      if (detail.latest_job_id) {
        const params = new URLSearchParams(window.location.search);
        params.set("job", detail.latest_job_id);
        window.history.replaceState(null, "", `?${params.toString()}`);
      }
    });
  }, [videoId, jobId]);

  return (
    <div className="page-shell space-y-6">
      <header className="page-header">
        <h1 className="page-title">{t("results.title")}</h1>
      </header>

      <div className="space-y-6">

        {job && (
          <div className="space-y-3">
            <JobProgress
              progress={job.progress_pct}
              stage={job.current_stage}
              status={job.status}
            />
            {isActive && (
              <button
                type="button"
                onClick={handleCancel}
                disabled={cancelling}
                className="text-sm text-red-600 dark:text-red-400 hover:underline underline-offset-2 disabled:opacity-50"
              >
                {cancelling ? t("results.cancelling") : t("results.cancel")}
              </button>
            )}
            {job.status === "cancelled" && (
              <p className="text-sm text-app-fg-muted">{t("results.cancelled")}</p>
            )}
          </div>
        )}

        {job?.error_message && (
          <p className="text-error">{job.error_message}</p>
        )}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {clips.map((clip) => (
            <ClipCard key={clip.id} clip={clip} videoId={videoId} />
          ))}
        </div>

        {!clipsLoading && job?.status === "completed" && clips.length === 0 && (
          <div className="space-y-1">
            <p className="text-muted">{t("results.noClips")}</p>
            <p className="text-sm text-app-fg-subtle">{t("results.noClipsHint")}</p>
          </div>
        )}
      </div>
    </div>
  );
}

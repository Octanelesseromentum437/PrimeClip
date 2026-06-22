import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { ClipCard } from "../components/ClipCard";
import { JobProgress } from "../components/JobProgress";
import { Nav } from "../components/Nav";
import { fetchClips, fetchVideo } from "../lib/api";
import { useLocale } from "../lib/i18n";
import { useJobPolling } from "../hooks/useJobPolling";
import { patchUploadSession } from "../lib/uploadSession";
import type { ClipRecord } from "../lib/types";

export function ResultsPage() {
  const { videoId } = useParams<{ videoId: string }>();
  const [searchParams] = useSearchParams();
  const jobId = searchParams.get("job");
  const { data: job } = useJobPolling(jobId, true);
  const [clips, setClips] = useState<ClipRecord[]>([]);
  const [clipsLoading, setClipsLoading] = useState(true);
  const { t } = useLocale();

  useEffect(() => {
    if (!videoId) return;
    setClipsLoading(true);
    fetchClips(videoId)
      .then(setClips)
      .finally(() => setClipsLoading(false));
  }, [videoId, job?.status, job?.progress_pct]);

  useEffect(() => {
    if (!videoId || !jobId) return;
    if (job?.status === "completed" || job?.status === "failed") {
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
    <div className="page-shell">
      <Nav />
      <main className="max-w-5xl mx-auto p-6 space-y-6">
        <h1 className="text-2xl font-bold">{t("results.title")}</h1>

        {job && (
          <JobProgress
            progress={job.progress_pct}
            stage={job.current_stage}
            status={job.status}
          />
        )}

        {job?.error_message && (
          <p className="text-error">{job.error_message}</p>
        )}

        <div className="grid gap-4 md:grid-cols-2">
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
      </main>
    </div>
  );
}

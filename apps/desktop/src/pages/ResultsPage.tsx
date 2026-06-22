import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { sendNotification } from "@tauri-apps/plugin-notification";
import { ClipCard } from "../components/ClipCard";
import { JobProgress } from "../components/JobProgress";
import { Nav } from "../components/Nav";
import { fetchClips } from "../lib/api";
import { useJobPolling } from "../hooks/useJobPolling";
import type { ClipRecord } from "../lib/types";

export function ResultsPage() {
  const { videoId } = useParams<{ videoId: string }>();
  const [searchParams] = useSearchParams();
  const jobId = searchParams.get("job");
  const { data: job } = useJobPolling(jobId, true);
  const [clips, setClips] = useState<ClipRecord[]>([]);
  const [notified, setNotified] = useState(false);

  useEffect(() => {
    if (!videoId || !job) return;
    if (job.status === "completed" || job.status === "running") {
      fetchClips(videoId).then(setClips);
    }
  }, [videoId, job?.status, job?.progress_pct]);

  useEffect(() => {
    if (job?.status === "completed" && !notified) {
      setNotified(true);
      void sendNotification({ title: "PrimeClip", body: "Clip generation complete!" });
      if (videoId) fetchClips(videoId).then(setClips);
    }
  }, [job?.status, notified, videoId]);

  return (
    <div className="page-shell">
      <Nav />
      <main className="max-w-5xl mx-auto p-6 space-y-6">
        <h1 className="text-2xl font-bold">Results</h1>

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

        {job?.status === "completed" && clips.length === 0 && (
          <p className="text-muted">No clips generated.</p>
        )}
      </main>
    </div>
  );
}

import { useEffect, useRef } from "react";
import { fetchImportStatus, fetchJob } from "../lib/api";
import { useLocale, type TranslationKey } from "../lib/i18n";
import { notifyCompletion, isImportNotified, markImportNotified } from "../lib/notifications";
import { loadUploadSession, patchUploadSession } from "../lib/uploadSession";

const notifiedStagesKey = (jobId: string) => `primeclip-notified-stages-${jobId}`;

function loadNotifiedStages(jobId: string): Set<string> {
  try {
    const raw = localStorage.getItem(notifiedStagesKey(jobId));
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function saveNotifiedStages(jobId: string, stages: Set<string>): void {
  localStorage.setItem(notifiedStagesKey(jobId), JSON.stringify([...stages]));
}

function stageLabel(
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string,
  stage: string,
): string {
  const base = stage.startsWith("render_clips") ? "render_clips" : stage;
  const key = `stage.${base}` as TranslationKey;
  return t(key);
}

async function notifyStageComplete(
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string,
  stage: string,
): Promise<void> {
  await notifyCompletion({
    body: t("notify.stage", { stage: stageLabel(t, stage) }),
  });
}

export function useGlobalJobMonitor() {
  const { t } = useLocale();
  const lastStageRef = useRef<string | null>(null);

  useEffect(() => {
    const interval = setInterval(async () => {
      const session = loadUploadSession();

      if (session.importId) {
        try {
          const status = await fetchImportStatus(session.importId);
          if (status.status === "completed" && status.video_id) {
            if (!isImportNotified(session.importId)) {
              markImportNotified(session.importId);
              await notifyCompletion({ body: t("notify.importComplete") });
            }
            patchUploadSession({
              importId: null,
              readyVideo: {
                video_id: status.video_id,
                filename: status.filename ?? "imported video",
                duration_sec: 0,
              },
            });
          } else if (status.status === "failed") {
            patchUploadSession({ importId: null });
          }
        } catch {
          // API unavailable — retry on next tick
        }
      }

      const active = session.activeGeneration;
      if (!active) return;

      try {
        const job = await fetchJob(active.jobId);
        const notified = loadNotifiedStages(active.jobId);
        const currentStage = job.current_stage ?? job.status;

        if (currentStage !== lastStageRef.current) {
          lastStageRef.current = currentStage;

          if (
            job.status === "running" &&
            currentStage &&
            currentStage !== "queued" &&
            !notified.has(currentStage)
          ) {
            const prevStages = [...notified];
            const completedStage = prevStages[prevStages.length - 1];
            if (completedStage && completedStage !== currentStage) {
              await notifyStageComplete(t, completedStage);
            }
            notified.add(currentStage);
            saveNotifiedStages(active.jobId, notified);
          }
        }

        if (job.status === "completed") {
          if (!notified.has("__complete__")) {
            const lastStage = lastStageRef.current;
            if (
              lastStage &&
              lastStage !== "done" &&
              lastStage !== "queued" &&
              lastStage !== currentStage
            ) {
              await notifyStageComplete(t, lastStage);
            }
            notified.add("__complete__");
            saveNotifiedStages(active.jobId, notified);
            await notifyCompletion({ body: t("notify.complete") });
          }
          patchUploadSession({ activeGeneration: null });
          lastStageRef.current = null;
        }

        if (job.status === "failed") {
          patchUploadSession({ activeGeneration: null });
          lastStageRef.current = null;
        }

        if (job.status === "cancelled") {
          patchUploadSession({ activeGeneration: null });
          lastStageRef.current = null;
        }
      } catch {
        // API unavailable — retry on next tick
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [t]);
}

export function useJobStageNotifications(
  jobId: string | null,
  currentStage: string | null,
  status: string,
) {
  const { t } = useLocale();
  const prevStageRef = useRef<string | null>(null);

  useEffect(() => {
    if (!jobId || status !== "running") return;

    const prev = prevStageRef.current;
    if (prev && currentStage && prev !== currentStage) {
      const notified = loadNotifiedStages(jobId);
      if (!notified.has(prev)) {
        notified.add(prev);
        saveNotifiedStages(jobId, notified);
        void notifyStageComplete(t, prev);
      }
    }
    prevStageRef.current = currentStage;
  }, [jobId, currentStage, status, t]);

  useEffect(() => {
    if (!jobId || status !== "completed") return;
    const notified = loadNotifiedStages(jobId);
    if (!notified.has("__complete__")) {
      notified.add("__complete__");
      saveNotifiedStages(jobId, notified);
      void notifyCompletion({ body: t("notify.complete") });
    }
  }, [jobId, status, t]);
}

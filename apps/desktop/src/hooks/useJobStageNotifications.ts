import { useEffect, useRef } from "react";
import { sendNotification } from "@tauri-apps/plugin-notification";
import { fetchJob } from "../lib/api";
import { useLocale, type TranslationKey } from "../lib/i18n";
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

function stageLabel(t: (key: TranslationKey) => string, stage: string): string {
  const base = stage.startsWith("render_clips") ? "render_clips" : stage;
  const key = `stage.${base}` as TranslationKey;
  return t(key);
}

export function useGlobalJobMonitor() {
  const { t } = useLocale();
  const lastStageRef = useRef<string | null>(null);

  useEffect(() => {
    const interval = setInterval(async () => {
      const session = loadUploadSession();
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
              void sendNotification({
                title: "PrimeClip",
                body: t("notify.stage", { stage: stageLabel(t, completedStage) }),
              });
            }
            notified.add(currentStage);
            saveNotifiedStages(active.jobId, notified);
          }
        }

        if (job.status === "completed") {
          if (!notified.has("__complete__")) {
            notified.add("__complete__");
            saveNotifiedStages(active.jobId, notified);
            void sendNotification({
              title: "PrimeClip",
              body: t("notify.complete"),
            });
          }
          patchUploadSession({ activeGeneration: null });
          lastStageRef.current = null;
        }

        if (job.status === "failed") {
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
        void sendNotification({
          title: "PrimeClip",
          body: t("notify.stage", { stage: stageLabel(t, prev) }),
        });
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
      void sendNotification({ title: "PrimeClip", body: t("notify.complete") });
    }
  }, [jobId, status, t]);
}

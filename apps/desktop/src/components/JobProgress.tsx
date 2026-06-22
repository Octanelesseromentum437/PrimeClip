import { useState } from "react";
import { useLocale } from "../lib/i18n";
import {
  getStageStatuses,
  stageTranslationKey,
  type PipelineStageId,
} from "../lib/pipelineStages";

interface Props {
  progress: number;
  stage: string | null;
  status: string;
}

function StageIcon({ status }: { status: "done" | "active" | "pending" }) {
  if (status === "done") {
    return (
      <svg className="h-4 w-4 text-green-600 dark:text-green-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    );
  }
  if (status === "active") {
    return (
      <span className="h-4 w-4 shrink-0 flex items-center justify-center">
        <span className="h-2.5 w-2.5 rounded-full bg-brand-500 animate-pulse" />
      </span>
    );
  }
  return (
    <span className="h-4 w-4 shrink-0 flex items-center justify-center">
      <span className="h-2 w-2 rounded-full bg-app-border" />
    </span>
  );
}

export function JobProgress({ progress, stage, status }: Props) {
  const { t } = useLocale();
  const [expanded, setExpanded] = useState(false);
  const stages = getStageStatuses(stage, status);

  const currentLabel = stage?.startsWith("render_clips")
    ? t("stage.render_clips")
    : stage && stage !== "done"
      ? t(stageTranslationKey(stage as PipelineStageId))
      : status === "completed"
        ? t("stage.done")
        : status === "cancelled"
          ? t("results.cancelled")
          : status;

  const renderDetail =
    stage?.startsWith("render_clips") && stage.includes(":")
      ? ` (${stage.split(":")[1]})`
      : "";

  return (
    <div className="card p-4 space-y-3">
      <div className="flex justify-between text-sm mb-2">
        <span className="text-app-fg-muted">
          {currentLabel}
          {renderDetail}
        </span>
        <span>{progress}%</span>
      </div>
      <div className="h-2 rounded-full bg-app-muted overflow-hidden">
        <div
          className="h-full bg-brand-500 transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-1.5 text-xs text-app-fg-muted hover:text-brand-600 dark:hover:text-brand-400 transition-colors"
      >
        <svg
          className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-90" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
        {expanded ? t("progress.collapse") : t("progress.expand")}
      </button>

      {expanded && (
        <ul className="space-y-2 pt-1 border-t border-app-border">
          {stages.map(({ id, status: stageStatus }) => (
            <li key={id} className="flex items-center gap-2.5 text-sm">
              <StageIcon status={stageStatus} />
              <span
                className={
                  stageStatus === "active"
                    ? "font-medium text-app-fg"
                    : stageStatus === "done"
                      ? "text-app-fg-muted"
                      : "text-app-fg-subtle"
                }
              >
                {t(stageTranslationKey(id))}
              </span>
              <span className="ml-auto text-xs text-app-fg-subtle">
                {t(
                  stageStatus === "done"
                    ? "stage.status.done"
                    : stageStatus === "active"
                      ? "stage.status.active"
                      : "stage.status.pending",
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

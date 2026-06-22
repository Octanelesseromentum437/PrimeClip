export const PIPELINE_STAGES = [
  "extract_audio",
  "transcribe",
  "detect_scenes",
  "select_clips",
  "track_faces",
  "render_clips",
] as const;

export type PipelineStageId = (typeof PIPELINE_STAGES)[number];

export type StageStatus = "done" | "active" | "pending";

function normalizeStage(stage: string | null): PipelineStageId | "done" | null {
  if (!stage || stage === "queued") return null;
  if (stage === "done") return "done";
  if (stage.startsWith("render_clips")) return "render_clips";
  if ((PIPELINE_STAGES as readonly string[]).includes(stage)) {
    return stage as PipelineStageId;
  }
  return null;
}

export function getStageStatuses(
  currentStage: string | null,
  jobStatus: string,
): { id: PipelineStageId; status: StageStatus }[] {
  const normalized = normalizeStage(currentStage);
  const allDone = jobStatus === "completed" || normalized === "done";

  if (allDone) {
    return PIPELINE_STAGES.map((id) => ({ id, status: "done" as const }));
  }

  if (!normalized) {
    return PIPELINE_STAGES.map((id) => ({
      id,
      status: id === "extract_audio" && jobStatus === "running" ? "active" : "pending",
    }));
  }

  const activeIndex = PIPELINE_STAGES.indexOf(normalized as PipelineStageId);

  return PIPELINE_STAGES.map((id, index) => {
    if (index < activeIndex) return { id, status: "done" as const };
    if (index === activeIndex) return { id, status: "active" as const };
    return { id, status: "pending" as const };
  });
}

export function stageTranslationKey(id: PipelineStageId): `stage.${PipelineStageId}` {
  return `stage.${id}`;
}

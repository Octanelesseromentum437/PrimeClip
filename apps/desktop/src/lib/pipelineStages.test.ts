import { describe, expect, it } from "vitest";
import { getStageStatuses, PIPELINE_STAGES, stageTranslationKey } from "./pipelineStages";

describe("getStageStatuses", () => {
  it("marks all stages done when job is completed", () => {
    const statuses = getStageStatuses("transcribe", "completed");
    expect(statuses).toHaveLength(PIPELINE_STAGES.length);
    expect(statuses.every((s) => s.status === "done")).toBe(true);
  });

  it("marks all stages done when current stage is done", () => {
    const statuses = getStageStatuses("done", "running");
    expect(statuses.every((s) => s.status === "done")).toBe(true);
  });

  it("activates extract_audio when queued with running status", () => {
    const statuses = getStageStatuses(null, "running");
    expect(statuses[0]).toEqual({ id: "extract_audio", status: "active" });
    expect(statuses.slice(1).every((s) => s.status === "pending")).toBe(true);
  });

  it("keeps all stages pending when queued and not running", () => {
    const statuses = getStageStatuses("queued", "pending");
    expect(statuses.every((s) => s.status === "pending")).toBe(true);
  });

  it("marks prior stages done and current stage active", () => {
    const statuses = getStageStatuses("select_clips", "running");
    const doneIds = statuses.filter((s) => s.status === "done").map((s) => s.id);
    expect(doneIds).toEqual([
      "extract_audio",
      "transcribe",
      "detect_scenes",
    ]);
    expect(statuses.find((s) => s.id === "select_clips")?.status).toBe("active");
    expect(statuses.slice(4).every((s) => s.status === "pending")).toBe(true);
  });

  it("normalizes render_clips sub-stages", () => {
    const statuses = getStageStatuses("render_clips:2/5", "running");
    const render = statuses.find((s) => s.id === "render_clips");
    expect(render?.status).toBe("active");
    expect(statuses.filter((s) => s.status === "done")).toHaveLength(5);
  });
});

describe("stageTranslationKey", () => {
  it("prefixes stage id for i18n lookup", () => {
    expect(stageTranslationKey("transcribe")).toBe("stage.transcribe");
  });
});

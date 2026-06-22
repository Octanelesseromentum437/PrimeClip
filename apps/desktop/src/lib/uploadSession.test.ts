import { beforeEach, describe, expect, it } from "vitest";
import {
  clearActiveGeneration,
  loadUploadSession,
  patchUploadSession,
  saveUploadSession,
  type PersistedUploadState,
} from "./uploadSession";

const sampleState: PersistedUploadState = {
  sourceTab: "url",
  importUrl: "https://example.com/video",
  importId: "import-1",
  readyVideo: { video_id: "vid-1", filename: "video.mp4", duration_sec: 120 },
  activeGeneration: { videoId: "vid-1", jobId: "job-1" },
};

describe("uploadSession", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns defaults when storage is empty", () => {
    expect(loadUploadSession()).toEqual({
      sourceTab: "file",
      importUrl: "",
      importId: null,
      readyVideo: null,
      activeGeneration: null,
    });
  });

  it("persists and reloads session state", () => {
    saveUploadSession(sampleState);
    expect(loadUploadSession()).toEqual(sampleState);
  });

  it("patches partial state and returns merged result", () => {
    saveUploadSession(sampleState);
    const next = patchUploadSession({ importUrl: "https://updated.test" });
    expect(next.importUrl).toBe("https://updated.test");
    expect(next.sourceTab).toBe("url");
    expect(loadUploadSession().importUrl).toBe("https://updated.test");
  });

  it("clears active generation", () => {
    saveUploadSession(sampleState);
    clearActiveGeneration();
    expect(loadUploadSession().activeGeneration).toBeNull();
    expect(loadUploadSession().importUrl).toBe(sampleState.importUrl);
  });

  it("falls back to defaults on invalid JSON", () => {
    localStorage.setItem("primeclip-upload-session", "{not-json");
    expect(loadUploadSession().sourceTab).toBe("file");
  });
});

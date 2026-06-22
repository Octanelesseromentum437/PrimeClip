const filmstripCache = new Map<string, string[]>();

let sharedVideo: HTMLVideoElement | null = null;
let sharedCanvas: HTMLCanvasElement | null = null;

function getSharedVideo(): HTMLVideoElement {
  if (!sharedVideo) {
    sharedVideo = document.createElement("video");
    sharedVideo.muted = true;
    sharedVideo.playsInline = true;
    sharedVideo.preload = "auto";
    sharedVideo.crossOrigin = "anonymous";
  }
  return sharedVideo;
}

function getSharedCanvas(width: number, height: number): HTMLCanvasElement {
  if (!sharedCanvas) {
    sharedCanvas = document.createElement("canvas");
  }
  sharedCanvas.width = width;
  sharedCanvas.height = height;
  return sharedCanvas;
}

function waitForVideoReady(video: HTMLVideoElement): Promise<void> {
  if (video.readyState >= HTMLMediaElement.HAVE_METADATA) {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const onLoaded = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error("Video failed to load"));
    };
    const cleanup = () => {
      video.removeEventListener("loadedmetadata", onLoaded);
      video.removeEventListener("error", onError);
    };
    video.addEventListener("loadedmetadata", onLoaded);
    video.addEventListener("error", onError);
  });
}

function seekVideo(video: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve, reject) => {
    if (Math.abs(video.currentTime - time) < 0.04) {
      resolve();
      return;
    }
    const onSeeked = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error("Video seek failed"));
    };
    const cleanup = () => {
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("error", onError);
    };
    video.addEventListener("seeked", onSeeked);
    video.addEventListener("error", onError);
    video.currentTime = time;
  });
}

function captureFrame(video: HTMLVideoElement, canvas: HTMLCanvasElement): string {
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.55);
}

export function filmstripFrameCount(width: number): number {
  return Math.min(40, Math.max(3, Math.ceil(width / 52)));
}

export async function loadVideoFilmstrip(
  url: string,
  rangeStart: number,
  rangeEnd: number,
  frameCount: number,
  frameHeight = 48,
): Promise<string[]> {
  const cacheKey = `${url}:${rangeStart.toFixed(2)}:${rangeEnd.toFixed(2)}:${frameCount}:${frameHeight}`;
  const cached = filmstripCache.get(cacheKey);
  if (cached) return cached;

  const video = getSharedVideo();
  if (video.src !== url) {
    video.src = url;
    await waitForVideoReady(video);
  } else if (video.readyState < HTMLMediaElement.HAVE_METADATA) {
    await waitForVideoReady(video);
  }

  const duration = video.duration;
  if (!Number.isFinite(duration) || duration <= 0) {
    return [];
  }

  const start = Math.max(0, rangeStart);
  const end = Math.min(duration, Math.max(start + 0.1, rangeEnd));
  const span = end - start;
  const canvas = getSharedCanvas(Math.round(frameHeight * 1.2), frameHeight);
  const frames: string[] = [];

  for (let i = 0; i < frameCount; i++) {
    const t = start + (span * (i + 0.5)) / frameCount;
    await seekVideo(video, Math.min(t, duration - 0.01));
    const dataUrl = captureFrame(video, canvas);
    if (dataUrl) frames.push(dataUrl);
  }

  filmstripCache.set(cacheKey, frames);
  return frames;
}

export function clearFilmstripCache(): void {
  filmstripCache.clear();
}

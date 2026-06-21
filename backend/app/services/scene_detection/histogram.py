from pathlib import Path

import cv2
import numpy as np
from app.schemas.scene import Scene


class SceneDetectionService:
    def detect(
        self,
        video_path: Path,
        *,
        threshold: float = 0.3,
        min_scene_len_sec: float = 2.0,
        sample_fps: float = 2.0,
    ) -> list[Scene]:
        cap = cv2.VideoCapture(str(video_path))
        if not cap.isOpened():
            raise RuntimeError(f"Cannot open video: {video_path}")

        fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
        frame_interval = max(1, int(fps / sample_fps))
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
        duration = total_frames / fps if fps > 0 else 0.0

        prev_hist: np.ndarray | None = None
        cut_times: list[float] = [0.0]
        frame_idx = 0

        while True:
            ret, frame = cap.read()
            if not ret:
                break
            if frame_idx % frame_interval == 0:
                hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
                hist = cv2.calcHist([hsv], [0, 1], None, [50, 60], [0, 180, 0, 256])
                cv2.normalize(hist, hist)
                if prev_hist is not None:
                    diff = cv2.compareHist(prev_hist, hist, cv2.HISTCMP_BHATTACHARYYA)
                    if diff > threshold:
                        cut_times.append(frame_idx / fps)
                prev_hist = hist
            frame_idx += 1

        cap.release()
        if duration > 0:
            cut_times.append(duration)

        scenes: list[Scene] = []
        for i in range(len(cut_times) - 1):
            start, end = cut_times[i], cut_times[i + 1]
            if end - start >= min_scene_len_sec:
                scenes.append(Scene(start=start, end=end))

        if not scenes and duration > 0:
            scenes.append(Scene(start=0.0, end=duration))

        return self._merge_short_scenes(scenes, min_scene_len_sec)

    def _merge_short_scenes(self, scenes: list[Scene], min_len: float) -> list[Scene]:
        if not scenes:
            return scenes
        merged: list[Scene] = [scenes[0]]
        for scene in scenes[1:]:
            last = merged[-1]
            if scene.end - scene.start < min_len:
                merged[-1] = Scene(start=last.start, end=scene.end)
            else:
                merged.append(scene)
        return merged

from pathlib import Path

import cv2
import mediapipe as mp
from app.schemas.face import FaceBBox, FaceFrame


class FaceTrackingService:
    def __init__(self) -> None:
        self._mp_face = mp.solutions.face_detection

    def track(
        self,
        video_path: Path,
        *,
        sample_fps: float = 2.0,
    ) -> list[FaceFrame]:
        cap = cv2.VideoCapture(str(video_path))
        if not cap.isOpened():
            raise RuntimeError(f"Cannot open video: {video_path}")

        fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
        frame_interval = max(1, int(fps / sample_fps))

        frames: list[FaceFrame] = []
        frame_idx = 0
        prev_centers: dict[int, tuple[float, float]] = {}
        ema_alpha = 0.4

        face_detection = self._mp_face.FaceDetection(
            model_selection=1,
            min_detection_confidence=0.5,
        )
        with face_detection as detector:
            while True:
                ret, frame = cap.read()
                if not ret:
                    break
                if frame_idx % frame_interval == 0:
                    timestamp = frame_idx / fps
                    rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                    results = detector.process(rgb)
                    faces: list[FaceBBox] = []
                    if results.detections:
                        for i, det in enumerate(results.detections):
                            bbox = det.location_data.relative_bounding_box
                            x = max(0.0, bbox.xmin)
                            y = max(0.0, bbox.ymin)
                            w = min(1.0 - x, bbox.width)
                            h = min(1.0 - y, bbox.height)
                            cx = x + w / 2
                            cy = y + h / 2
                            if i in prev_centers:
                                pcx, pcy = prev_centers[i]
                                cx = ema_alpha * cx + (1 - ema_alpha) * pcx
                                cy = ema_alpha * cy + (1 - ema_alpha) * pcy
                                x = cx - w / 2
                                y = cy - h / 2
                            prev_centers[i] = (cx, cy)
                            faces.append(
                                FaceBBox(x=x, y=y, width=w, height=h, face_id=i)
                            )
                    frames.append(FaceFrame(timestamp=timestamp, faces=faces))
                frame_idx += 1

        cap.release()

        if not frames:
            frames.append(
                FaceFrame(
                    timestamp=0.0,
                    faces=[FaceBBox(x=0.25, y=0.1, width=0.5, height=0.8, face_id=0)],
                )
            )

        return frames

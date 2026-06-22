from pathlib import Path

import cv2
import mediapipe as mp
from mediapipe.tasks import python
from mediapipe.tasks.python import vision
from app.schemas.face import FaceBBox, FaceFrame

_MODEL_PATH = Path(__file__).resolve().parent / "models" / "blaze_face_short_range.tflite"


def _bbox_iou(a: FaceBBox, b: FaceBBox) -> float:
    ax2, ay2 = a.x + a.width, a.y + a.height
    bx2, by2 = b.x + b.width, b.y + b.height
    ix1, iy1 = max(a.x, b.x), max(a.y, b.y)
    ix2, iy2 = min(ax2, bx2), min(ay2, by2)
    if ix2 <= ix1 or iy2 <= iy1:
        return 0.0
    inter = (ix2 - ix1) * (iy2 - iy1)
    union = a.width * a.height + b.width * b.height - inter
    return inter / union if union > 0 else 0.0


class FaceTrackingService:
    def __init__(self) -> None:
        if not _MODEL_PATH.is_file():
            raise FileNotFoundError(f"Face detector model not found: {_MODEL_PATH}")

        base_options = python.BaseOptions(model_asset_path=str(_MODEL_PATH))
        self._detector_options = vision.FaceDetectorOptions(
            base_options=base_options,
            running_mode=vision.RunningMode.VIDEO,
            min_detection_confidence=0.5,
        )

    def track(
        self,
        video_path: Path,
        *,
        sample_fps: float = 2.0,
        start_sec: float | None = None,
        end_sec: float | None = None,
    ) -> list[FaceFrame]:
        cap = cv2.VideoCapture(str(video_path))
        if not cap.isOpened():
            raise RuntimeError(f"Cannot open video: {video_path}")

        fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
        frame_interval = max(1, int(fps / sample_fps))
        start_frame = int((start_sec or 0.0) * fps)
        end_frame = int(end_sec * fps) if end_sec is not None else None

        if start_frame > 0:
            cap.set(cv2.CAP_PROP_POS_FRAMES, start_frame)

        frames: list[FaceFrame] = []
        frame_idx = start_frame
        prev_faces: list[FaceBBox] = []
        next_face_id = 0
        ema_alpha = 0.4

        with vision.FaceDetector.create_from_options(self._detector_options) as detector:
            while True:
                ret, frame = cap.read()
                if not ret:
                    break
                if end_frame is not None and frame_idx > end_frame:
                    break
                if (frame_idx - start_frame) % frame_interval == 0:
                    timestamp = (frame_idx - start_frame) / fps
                    height, width = frame.shape[:2]
                    rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                    mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
                    timestamp_ms = int(frame_idx / fps * 1000)
                    results = detector.detect_for_video(mp_image, timestamp_ms)
                    raw_faces: list[FaceBBox] = []
                    if results.detections:
                        for det in results.detections:
                            bbox = det.bounding_box
                            x = max(0.0, bbox.origin_x / width)
                            y = max(0.0, bbox.origin_y / height)
                            w = min(1.0 - x, bbox.width / width)
                            h = min(1.0 - y, bbox.height / height)
                            raw_faces.append(FaceBBox(x=x, y=y, width=w, height=h))

                    matched: list[FaceBBox] = []
                    used_prev: set[int] = set()
                    for raw in raw_faces:
                        best_iou = 0.0
                        best_idx = -1
                        for idx, prev in enumerate(prev_faces):
                            if idx in used_prev:
                                continue
                            iou = _bbox_iou(raw, prev)
                            if iou > best_iou:
                                best_iou = iou
                                best_idx = idx
                        if best_idx >= 0 and best_iou >= 0.2:
                            prev = prev_faces[best_idx]
                            used_prev.add(best_idx)
                            cx = raw.x + raw.width / 2
                            cy = raw.y + raw.height / 2
                            pcx = prev.x + prev.width / 2
                            pcy = prev.y + prev.height / 2
                            cx = ema_alpha * cx + (1 - ema_alpha) * pcx
                            cy = ema_alpha * cy + (1 - ema_alpha) * pcy
                            w, h = raw.width, raw.height
                            matched.append(
                                FaceBBox(
                                    x=cx - w / 2,
                                    y=cy - h / 2,
                                    width=w,
                                    height=h,
                                    face_id=prev.face_id,
                                )
                            )
                        else:
                            matched.append(
                                FaceBBox(
                                    x=raw.x,
                                    y=raw.y,
                                    width=raw.width,
                                    height=raw.height,
                                    face_id=next_face_id,
                                )
                            )
                            next_face_id += 1

                    prev_faces = matched
                    frames.append(FaceFrame(timestamp=timestamp, faces=matched))
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

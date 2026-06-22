from app.schemas.crop import CropKeyframe, CropPath
from app.schemas.face import FaceFrame


HEADROOM_OFFSET = 0.12


class VerticalCropService:
    def compute_crop_path(
        self,
        face_frames: list[FaceFrame],
        source_size: tuple[int, int],
        target_aspect: tuple[int, int] = (9, 16),
        *,
        smoothing_window: int = 15,
    ) -> CropPath:
        source_width, source_height = source_size
        target_w, target_h = target_aspect
        aspect = target_w / target_h

        keyframes: list[CropKeyframe] = []
        prev: CropKeyframe | None = None
        max_velocity = 0.05
        window = max(1, smoothing_window)
        recent_centers: list[tuple[float, float]] = []

        for frame in face_frames:
            if frame.faces:
                primary = max(frame.faces, key=lambda f: f.width * f.height)
                cx = primary.x + primary.width / 2
                cy = primary.y + primary.height / 2
            else:
                cx, cy = 0.5, 0.5

            recent_centers.append((cx, cy))
            if len(recent_centers) > window:
                recent_centers.pop(0)
            cx = sum(c[0] for c in recent_centers) / len(recent_centers)
            cy = sum(c[1] for c in recent_centers) / len(recent_centers)

            crop_h = 1.0
            crop_w = crop_h * aspect * (source_height / source_width)
            if crop_w > 1.0:
                crop_w = 1.0
                crop_h = crop_w / aspect * (source_width / source_height)

            cy = cy - crop_h * HEADROOM_OFFSET

            x = max(0.0, min(1.0 - crop_w, cx - crop_w / 2))
            y = max(0.0, min(1.0 - crop_h, cy - crop_h / 2))

            kf = CropKeyframe(timestamp=frame.timestamp, x=x, y=y, width=crop_w, height=crop_h)

            if prev is not None:
                dx = max(-max_velocity, min(max_velocity, kf.x - prev.x))
                dy = max(-max_velocity, min(max_velocity, kf.y - prev.y))
                kf = CropKeyframe(
                    timestamp=kf.timestamp,
                    x=prev.x + dx,
                    y=prev.y + dy,
                    width=kf.width,
                    height=kf.height,
                )

            keyframes.append(kf)
            prev = kf

        if not keyframes:
            keyframes.append(
                CropKeyframe(timestamp=0.0, x=0.21, y=0.0, width=0.56, height=1.0)
            )

        return CropPath(
            keyframes=keyframes,
            source_width=source_width,
            source_height=source_height,
            target_aspect=target_aspect,
        )

    def slice_for_clip(
        self, crop_path: CropPath, start: float, end: float
    ) -> CropPath:
        keyframes = [kf for kf in crop_path.keyframes if start <= kf.timestamp <= end]
        if not keyframes:
            keyframes = crop_path.keyframes[:1] if crop_path.keyframes else []
        adjusted = [
            CropKeyframe(
                timestamp=max(0.0, kf.timestamp - start),
                x=kf.x,
                y=kf.y,
                width=kf.width,
                height=kf.height,
            )
            for kf in keyframes
        ]
        return self.aggregate_median(
            CropPath(
                keyframes=adjusted,
                source_width=crop_path.source_width,
                source_height=crop_path.source_height,
                target_aspect=crop_path.target_aspect,
            )
        )

    def aggregate_median(self, crop_path: CropPath) -> CropPath:
        if not crop_path.keyframes:
            return crop_path

        xs = sorted(kf.x for kf in crop_path.keyframes)
        ys = sorted(kf.y for kf in crop_path.keyframes)
        ws = sorted(kf.width for kf in crop_path.keyframes)
        hs = sorted(kf.height for kf in crop_path.keyframes)
        mid = len(crop_path.keyframes) // 2

        median_kf = CropKeyframe(
            timestamp=0.0,
            x=xs[mid],
            y=ys[mid],
            width=ws[mid],
            height=hs[mid],
        )
        return CropPath(
            keyframes=[median_kf],
            source_width=crop_path.source_width,
            source_height=crop_path.source_height,
            target_aspect=crop_path.target_aspect,
        )

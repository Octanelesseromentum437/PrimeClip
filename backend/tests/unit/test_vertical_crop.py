from app.schemas.face import FaceBBox, FaceFrame
from app.services.vertical_crop.dynamic_crop import VerticalCropService


def test_vertical_crop_single_face():
    service = VerticalCropService()
    frames = [
        FaceFrame(
            timestamp=0.0,
            faces=[FaceBBox(x=0.3, y=0.2, width=0.4, height=0.5, face_id=0)],
        ),
        FaceFrame(
            timestamp=1.0,
            faces=[FaceBBox(x=0.35, y=0.2, width=0.4, height=0.5, face_id=0)],
        ),
    ]
    path = service.compute_crop_path(frames, (1920, 1080))
    assert len(path.keyframes) == 2
    assert path.target_aspect == (9, 16)


def test_slice_for_clip():
    service = VerticalCropService()
    frames = [
        FaceFrame(timestamp=t, faces=[FaceBBox(x=0.3, y=0.2, width=0.4, height=0.5)])
        for t in [0, 5, 10, 15, 20]
    ]
    full = service.compute_crop_path(frames, (1920, 1080))
    sliced = service.slice_for_clip(full, 5.0, 15.0)
    assert all(0 <= kf.timestamp <= 10 for kf in sliced.keyframes)

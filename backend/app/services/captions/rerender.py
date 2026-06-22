import json
from pathlib import Path

from app.db.models import Clip
from app.infra.ffmpeg import FFmpegService
from app.infra.storage import FileStore
from app.schemas.caption import CaptionEditState, CaptionStyle, STYLE_PRESETS
from app.schemas.clip import ClipCandidate
from app.schemas.common import CaptionStyleName, Resolution
from app.schemas.render import RenderRequest
from app.schemas.transcript import TranscriptSegment
from app.services.captions.edit_store import CaptionEditStore
from app.services.captions.generator import CaptionService
from app.services.face_tracking.mediapipe_tracker import FaceTrackingService
from app.services.motion.planner import MotionService
from app.services.render.ffmpeg_renderer import RenderService
from app.services.vertical_crop.dynamic_crop import VerticalCropService


class ClipRerenderService:
    def __init__(
        self,
        file_store: FileStore,
        ffmpeg: FFmpegService,
        captions: CaptionService,
        face_tracking: FaceTrackingService,
        vertical_crop: VerticalCropService,
        motion: MotionService,
        render: RenderService,
    ) -> None:
        self.file_store = file_store
        self.ffmpeg = ffmpeg
        self.captions = captions
        self.face_tracking = face_tracking
        self.vertical_crop = vertical_crop
        self.motion = motion
        self.render = render
        self.edit_store = CaptionEditStore()

    def load_transcript(self, video_id: str) -> list[TranscriptSegment]:
        raw = self.file_store.read_json_artifact(video_id, "transcript.json")
        return [TranscriptSegment.model_validate(item) for item in raw]

    def _load_transcript(self, video_id: str) -> list[TranscriptSegment]:
        return self.load_transcript(video_id)

    def rechunk_cues(self, clip: Clip, style: CaptionStyle) -> list:
        from app.services.captions.chunker import CaptionChunker

        return CaptionChunker().chunk_segments(
            self.load_transcript(clip.video_id),
            (clip.start_sec, clip.end_sec),
            style,
        )

    def get_edit_state(
        self,
        clip: Clip,
        preset: CaptionStyleName = CaptionStyleName.REELS,
    ) -> CaptionEditState:
        artifact = self.file_store.artifact_dir(clip.video_id)
        edit_path = self.edit_store.path_for_clip(artifact, clip.index)
        transcript = self._load_transcript(clip.video_id)
        return self.captions.load_or_build_edit(
            transcript,
            (clip.start_sec, clip.end_sec),
            preset,
            edit_path,
        )

    def save_edit_state(self, clip: Clip, state: CaptionEditState) -> None:
        artifact = self.file_store.artifact_dir(clip.video_id)
        edit_path = self.edit_store.path_for_clip(artifact, clip.index)
        self.edit_store.save(edit_path, state)
        cap_dir = artifact / f"clip_{clip.index:02d}"
        self.captions.write_files(
            cap_dir,
            CaptionStyleName.REELS,
            state.style,
            state.cues,
        )

    def rerender(
        self,
        clip: Clip,
        source_video: Path,
        *,
        resolution: Resolution = Resolution.HD,
    ) -> Path:
        artifact = self.file_store.artifact_dir(clip.video_id)
        cap_dir = artifact / f"clip_{clip.index:02d}"
        edit_path = self.edit_store.path_for_clip(artifact, clip.index)
        state = self.captions.load_or_build_edit(
            self._load_transcript(clip.video_id),
            (clip.start_sec, clip.end_sec),
            CaptionStyleName.REELS,
            edit_path,
        )
        caption_files = self.captions.write_files(
            cap_dir,
            CaptionStyleName.REELS,
            state.style,
            state.cues,
        )

        source_width, source_height = self.ffmpeg.probe_dimensions(source_video)
        clip_faces = self.face_tracking.track(
            source_video,
            sample_fps=6.0,
            start_sec=clip.start_sec,
            end_sec=clip.end_sec,
        )
        crop_path = self.vertical_crop.compute_crop_path(
            clip_faces,
            (source_width, source_height),
            smoothing_window=5,
        )
        crop_path = self.vertical_crop.aggregate_median(crop_path)

        candidate = ClipCandidate(
            title=clip.title,
            start=clip.start_sec,
            end=clip.end_sec,
            score=clip.score,
            reason=clip.reason,
        )
        transcript = self._load_transcript(clip.video_id)
        motion_plan = self.motion.plan(candidate, transcript)

        output_dir = self.file_store.clips_output_dir(clip.video_id)
        output_path = output_dir / f"clip_{clip.index:02d}.mp4"

        self.render.render(
            RenderRequest(
                source_video=source_video,
                clip=candidate,
                crop_path=crop_path,
                caption_ass=caption_files.ass,
                motion_plan=motion_plan,
                output_path=output_path,
                resolution=resolution,
            )
        )
        return output_path

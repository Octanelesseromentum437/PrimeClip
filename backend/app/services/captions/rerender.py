import json
from pathlib import Path

from app.db.models import Clip, ClipVariant
from app.infra.ffmpeg import FFmpegService
from app.infra.storage import FileStore
from app.schemas.caption import CaptionEditState, CaptionStyle, STYLE_PRESETS
from app.schemas.clip import ClipCandidate
from app.schemas.common import AspectRatio, CaptionStyleName, Resolution, resolution_label
from app.schemas.crop import CropPath
from app.schemas.face import FaceFrame
from app.schemas.render import RenderRequest
from app.schemas.transcript import TranscriptSegment
from app.services.captions.edit_store import CaptionEditStore
from app.services.captions.generator import CaptionService
from app.services.captions.timeline_renderer import TimelineRenderService
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
        self.timeline_render = TimelineRenderService(ffmpeg)

    def load_transcript(self, video_id: str) -> list[TranscriptSegment]:
        raw = self.file_store.read_json_artifact(video_id, "transcript.json")
        return [TranscriptSegment.model_validate(item) for item in raw]

    def load_aspect_ratio(self, video_id: str) -> AspectRatio:
        path = self.file_store.artifact_dir(video_id) / "aspect_ratio.json"
        if not path.is_file():
            return AspectRatio.VERTICAL
        raw = json.loads(path.read_text(encoding="utf-8"))
        return AspectRatio(raw.get("aspect_ratio", AspectRatio.VERTICAL.value))

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
        transcript = self.load_transcript(clip.video_id)
        return self.captions.load_or_build_edit(
            transcript,
            (clip.start_sec, clip.end_sec),
            preset,
            edit_path,
        )

    def assets_dir(self, clip: Clip) -> Path:
        return self.file_store.artifact_dir(clip.video_id) / f"clip_{clip.index:02d}" / "editor_assets"

    def _has_timeline_edits(self, state: CaptionEditState) -> bool:
        tl = state.timeline
        if tl.trim.start > 0 or tl.trim.end is not None:
            return True
        return bool(tl.overlays or tl.audio)

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
            aspect_ratio=self.load_aspect_ratio(clip.video_id),
        )

    def _load_face_frames(self, clip: Clip, source_video: Path) -> list[FaceFrame]:
        artifact = self.file_store.artifact_dir(clip.video_id)
        tracks_path = artifact / f"clip_{clip.index:02d}/face_tracks.json"
        if tracks_path.is_file():
            raw = json.loads(tracks_path.read_text(encoding="utf-8"))
            return [FaceFrame.model_validate(item) for item in raw]

        clip_faces = self.face_tracking.track(
            source_video,
            sample_fps=6.0,
            start_sec=clip.start_sec,
            end_sec=clip.end_sec,
        )
        tracks_path.parent.mkdir(parents=True, exist_ok=True)
        tracks_path.write_text(
            json.dumps([f.model_dump() for f in clip_faces]),
            encoding="utf-8",
        )
        return clip_faces

    def _crop_path_for_clip(
        self,
        clip: Clip,
        source_video: Path,
        aspect_ratio: AspectRatio,
    ) -> CropPath:
        source_width, source_height = self.ffmpeg.probe_dimensions(source_video)

        if aspect_ratio == AspectRatio.HORIZONTAL:
            return self.vertical_crop.center_crop_path(
                (source_width, source_height),
                target_aspect=(16, 9),
            )

        clip_faces = self._load_face_frames(clip, source_video)
        crop_path = self.vertical_crop.compute_crop_path(
            clip_faces,
            (source_width, source_height),
            smoothing_window=5,
        )
        return self.vertical_crop.aggregate_median(crop_path)

    def _candidate(self, clip: Clip) -> ClipCandidate:
        return ClipCandidate(
            title=clip.title,
            start=clip.start_sec,
            end=clip.end_sec,
            score=clip.score,
            reason=clip.reason,
        )

    def preview_path(self, clip: Clip, resolution: Resolution = Resolution.HD) -> Path:
        output_dir = self.file_store.clips_output_dir(clip.video_id)
        aspect_ratio = self.load_aspect_ratio(clip.video_id)
        label = resolution_label(aspect_ratio, resolution)
        return output_dir / f"clip_{clip.index:02d}_preview_{label}.mp4"

    def ensure_preview(
        self,
        clip: Clip,
        source_video: Path,
        *,
        resolution: Resolution = Resolution.HD,
    ) -> Path:
        preview_path = self.preview_path(clip, resolution)
        if preview_path.is_file():
            return preview_path

        aspect_ratio = self.load_aspect_ratio(clip.video_id)
        crop_path = self._crop_path_for_clip(clip, source_video, aspect_ratio)
        candidate = self._candidate(clip)
        transcript = self.load_transcript(clip.video_id)
        motion_plan = self.motion.plan(candidate, transcript)

        self.render.render(
            RenderRequest(
                source_video=source_video,
                clip=candidate,
                crop_path=crop_path,
                motion_plan=motion_plan,
                output_path=preview_path,
                resolution=resolution,
                aspect_ratio=aspect_ratio,
                burn_captions=False,
            )
        )
        return preview_path

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
        aspect_ratio = self.load_aspect_ratio(clip.video_id)
        state = self.captions.load_or_build_edit(
            self.load_transcript(clip.video_id),
            (clip.start_sec, clip.end_sec),
            CaptionStyleName.REELS,
            edit_path,
        )
        caption_files = self.captions.write_files(
            cap_dir,
            CaptionStyleName.REELS,
            state.style,
            state.cues,
            aspect_ratio=aspect_ratio,
        )

        crop_path = self._crop_path_for_clip(clip, source_video, aspect_ratio)
        candidate = self._candidate(clip)
        transcript = self.load_transcript(clip.video_id)
        motion_plan = self.motion.plan(candidate, transcript)

        output_dir = self.file_store.clips_output_dir(clip.video_id)
        output_path = self._output_path(output_dir, clip.index, resolution, aspect_ratio)

        if self._has_timeline_edits(state):
            self.timeline_render.render_with_timeline(
                source_video=source_video,
                clip_start=clip.start_sec,
                clip_end=clip.end_sec,
                crop_path=crop_path,
                aspect_ratio=aspect_ratio,
                resolution=resolution,
                timeline=state.timeline,
                assets_dir=self.assets_dir(clip),
                caption_ass=caption_files.ass,
                output_path=output_path,
                burn_captions=True,
            )
        else:
            self.render.render(
                RenderRequest(
                    source_video=source_video,
                    clip=candidate,
                    crop_path=crop_path,
                    caption_ass=caption_files.ass,
                    motion_plan=motion_plan,
                    output_path=output_path,
                    resolution=resolution,
                    aspect_ratio=aspect_ratio,
                    burn_captions=True,
                )
            )

        # Refresh caption-free preview alongside final render.
        preview_path = self.preview_path(clip, resolution)
        if preview_path != output_path:
            if self._has_timeline_edits(state):
                self.timeline_render.render_with_timeline(
                    source_video=source_video,
                    clip_start=clip.start_sec,
                    clip_end=clip.end_sec,
                    crop_path=crop_path,
                    aspect_ratio=aspect_ratio,
                    resolution=resolution,
                    timeline=state.timeline,
                    assets_dir=self.assets_dir(clip),
                    caption_ass=None,
                    output_path=preview_path,
                    burn_captions=False,
                )
            else:
                self.render.render(
                    RenderRequest(
                        source_video=source_video,
                        clip=candidate,
                        crop_path=crop_path,
                        motion_plan=motion_plan,
                        output_path=preview_path,
                        resolution=resolution,
                        aspect_ratio=aspect_ratio,
                        burn_captions=False,
                    )
                )

        from app.services.thumbnails import ensure_clip_thumbnail

        thumb = ensure_clip_thumbnail(clip, self.file_store, self.ffmpeg)
        if thumb is not None:
            clip.thumbnail_path = str(thumb)

        return output_path

    def _output_path(
        self,
        output_dir: Path,
        clip_index: int,
        resolution: Resolution,
        aspect_ratio: AspectRatio,
    ) -> Path:
        label = resolution_label(aspect_ratio, resolution)
        if resolution == Resolution.HD:
            return output_dir / f"clip_{clip_index:02d}.mp4"
        return output_dir / f"clip_{clip_index:02d}_{label}.mp4"

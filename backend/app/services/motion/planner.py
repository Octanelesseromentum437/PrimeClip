from app.schemas.clip import ClipCandidate
from app.schemas.motion import MotionEffect, MotionEffectType, MotionPlan, MotionRules
from app.schemas.transcript import TranscriptSegment


class MotionService:
    def plan(
        self,
        clip: ClipCandidate,
        transcript: list[TranscriptSegment],
        rules: MotionRules | None = None,
    ) -> MotionPlan:
        rules = rules or MotionRules()
        effects: list[MotionEffect] = []

        clip_segments = [
            s for s in transcript if s.end > clip.start and s.start < clip.end
        ]

        for seg in clip_segments:
            rel_start = max(0.0, seg.start - clip.start)
            rel_end = min(clip.end - clip.start, seg.end - clip.start)
            text_lower = seg.text.lower()
            triggered = False
            for keyword, effect_type in rules.keyword_triggers.items():
                if keyword.lower() in text_lower:
                    effects.append(
                        MotionEffect(
                            effect=effect_type,
                            start=rel_start,
                            end=min(rel_end, rel_start + 2.0),
                            intensity=1.2,
                        )
                    )
                    triggered = True
                    break
            if not triggered and len(seg.text.split()) > 8:
                effects.append(
                    MotionEffect(
                        effect=rules.default_effect,
                        start=rel_start,
                        end=rel_end,
                        intensity=1.0,
                    )
                )

        if not effects:
            effects.append(
                MotionEffect(
                    effect=MotionEffectType.ZOOM_IN,
                    start=0.0,
                    end=min(3.0, clip.end - clip.start),
                    intensity=1.0,
                )
            )

        return MotionPlan(effects=effects)

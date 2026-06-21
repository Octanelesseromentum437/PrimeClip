from enum import StrEnum

from pydantic import BaseModel, Field


class MotionEffectType(StrEnum):
    ZOOM_IN = "zoom_in"
    ZOOM_OUT = "zoom_out"
    PUNCH_ZOOM = "punch_zoom"
    PAN_X = "pan_x"
    PAN_Y = "pan_y"


class MotionEffect(BaseModel):
    effect: MotionEffectType
    start: float
    end: float
    intensity: float = Field(default=1.0, ge=0.1, le=3.0)


class MotionRules(BaseModel):
    keyword_triggers: dict[str, MotionEffectType] = Field(default_factory=dict)
    pause_threshold_sec: float = 0.8
    default_effect: MotionEffectType = MotionEffectType.ZOOM_IN


class MotionPlan(BaseModel):
    effects: list[MotionEffect] = Field(default_factory=list)

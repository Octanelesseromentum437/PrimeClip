from pydantic import BaseModel, Field


class CropKeyframe(BaseModel):
    timestamp: float
    x: float = Field(ge=0, le=1)
    y: float = Field(ge=0, le=1)
    width: float = Field(gt=0, le=1)
    height: float = Field(gt=0, le=1)


class CropPath(BaseModel):
    keyframes: list[CropKeyframe] = Field(default_factory=list)
    source_width: int
    source_height: int
    target_aspect: tuple[int, int] = (9, 16)

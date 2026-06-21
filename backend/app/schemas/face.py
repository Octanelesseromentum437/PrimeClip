from pydantic import BaseModel, Field


class FaceBBox(BaseModel):
    x: float
    y: float
    width: float
    height: float
    face_id: int = 0


class FaceFrame(BaseModel):
    timestamp: float
    faces: list[FaceBBox] = Field(default_factory=list)

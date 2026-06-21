from pydantic import BaseModel, Field


class Scene(BaseModel):
    start: float = Field(ge=0)
    end: float = Field(ge=0)

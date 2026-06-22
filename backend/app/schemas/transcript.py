from pydantic import BaseModel, Field


class WordSegment(BaseModel):
    word: str
    start: float
    end: float


class TranscriptSegment(BaseModel):
    start: float
    end: float
    text: str
    confidence: float = Field(default=1.0, ge=0.0, le=1.0)
    words: list[WordSegment] = Field(default_factory=list)

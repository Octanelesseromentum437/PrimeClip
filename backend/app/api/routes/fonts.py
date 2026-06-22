from app.infra.fonts import list_system_fonts
from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(prefix="/fonts", tags=["fonts"])


class FontsResponse(BaseModel):
    fonts: list[str]


@router.get("", response_model=FontsResponse)
def get_fonts() -> FontsResponse:
    return FontsResponse(fonts=list(list_system_fonts()))

from uuid import uuid4

from app.api.deps import get_ffmpeg_service
from app.api.routes.upload import UploadResponse, _register_uploaded_video
from app.config import get_settings
from app.db.session import get_engine
from app.infra.ffmpeg import FFmpegService
from app.services.drive.google_drive import DriveFile, GoogleDriveService
from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel
from sqlmodel import Session

router = APIRouter(prefix="/drive", tags=["drive"])

_service = GoogleDriveService(get_settings())


class AuthUrlResponse(BaseModel):
    url: str


class TokenExchangeRequest(BaseModel):
    code: str


class TokenExchangeResponse(BaseModel):
    access_token: str
    refresh_token: str | None = None
    expires_in: int | None = None


class DriveFilesResponse(BaseModel):
    files: list[DriveFile]


class DriveUploadRequest(BaseModel):
    file_id: str
    filename: str | None = None


@router.get("/auth-url", response_model=AuthUrlResponse)
def drive_auth_url() -> AuthUrlResponse:
    try:
        return AuthUrlResponse(url=_service.auth_url())
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@router.post("/token", response_model=TokenExchangeResponse)
async def exchange_drive_token(body: TokenExchangeRequest) -> TokenExchangeResponse:
    try:
        data = await _service.exchange_code(body.code.strip())
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return TokenExchangeResponse(
        access_token=data["access_token"],
        refresh_token=data.get("refresh_token"),
        expires_in=data.get("expires_in"),
    )


@router.get("/files", response_model=DriveFilesResponse)
async def list_drive_files(
    x_google_access_token: str = Header(..., alias="X-Google-Access-Token"),
) -> DriveFilesResponse:
    try:
        files = await _service.list_video_files(x_google_access_token)
    except Exception as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc
    return DriveFilesResponse(files=files)


drive_upload_router = APIRouter(prefix="/upload", tags=["drive"])


@drive_upload_router.post("/drive", response_model=UploadResponse)
async def upload_from_drive(
    body: DriveUploadRequest,
    x_google_access_token: str = Header(..., alias="X-Google-Access-Token"),
    ffmpeg: FFmpegService = Depends(get_ffmpeg_service),
) -> UploadResponse:
    video_id = str(uuid4())
    dest_dir = get_settings().uploads_dir / video_id
    dest = dest_dir / (body.filename or "source.mp4")
    try:
        await _service.download_file(x_google_access_token, body.file_id, dest)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    with Session(get_engine()) as session:
        return _register_uploaded_video(
            session=session,
            ffmpeg=ffmpeg,
            video_id=video_id,
            path=dest,
            filename=body.filename or dest.name,
            source_url=f"drive://{body.file_id}",
            source_provider="google_drive",
        )

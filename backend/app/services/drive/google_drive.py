from pathlib import Path
from urllib.parse import urlencode

import httpx
from app.config import Settings
from pydantic import BaseModel

DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.readonly"


class DriveFile(BaseModel):
    id: str
    name: str
    mime_type: str
    size: int | None = None


class GoogleDriveService:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    @property
    def configured(self) -> bool:
        return bool(self.settings.google_client_id and self.settings.google_client_secret)

    def auth_url(self) -> str:
        if not self.configured:
            raise RuntimeError("Google OAuth is not configured")
        params = {
            "client_id": self.settings.google_client_id,
            "redirect_uri": "urn:ietf:wg:oauth:2.0:oob",
            "response_type": "code",
            "scope": DRIVE_SCOPE,
            "access_type": "offline",
            "prompt": "consent",
        }
        query = urlencode(params)
        return f"https://accounts.google.com/o/oauth2/v2/auth?{query}"

    async def exchange_code(self, code: str) -> dict:
        if not self.configured:
            raise RuntimeError("Google OAuth is not configured")
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                "https://oauth2.googleapis.com/token",
                data={
                    "code": code,
                    "client_id": self.settings.google_client_id,
                    "client_secret": self.settings.google_client_secret,
                    "redirect_uri": "urn:ietf:wg:oauth:2.0:oob",
                    "grant_type": "authorization_code",
                },
            )
            resp.raise_for_status()
            return resp.json()

    async def refresh_access_token(self, refresh_token: str) -> dict:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                "https://oauth2.googleapis.com/token",
                data={
                    "client_id": self.settings.google_client_id,
                    "client_secret": self.settings.google_client_secret,
                    "refresh_token": refresh_token,
                    "grant_type": "refresh_token",
                },
            )
            resp.raise_for_status()
            return resp.json()

    async def list_video_files(self, access_token: str) -> list[DriveFile]:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(
                "https://www.googleapis.com/drive/v3/files",
                headers={"Authorization": f"Bearer {access_token}"},
                params={
                    "q": "mimeType contains 'video/' and trashed = false",
                    "fields": "files(id,name,mimeType,size)",
                    "pageSize": 50,
                    "orderBy": "modifiedTime desc",
                },
            )
            resp.raise_for_status()
            data = resp.json()
            return [
                DriveFile(
                    id=item["id"],
                    name=item["name"],
                    mime_type=item.get("mimeType", ""),
                    size=int(item["size"]) if item.get("size") else None,
                )
                for item in data.get("files", [])
            ]

    async def download_file(self, access_token: str, file_id: str, dest: Path) -> None:
        async with httpx.AsyncClient(timeout=None) as client:
            async with client.stream(
                "GET",
                f"https://www.googleapis.com/drive/v3/files/{file_id}",
                headers={"Authorization": f"Bearer {access_token}"},
                params={"alt": "media"},
            ) as resp:
                resp.raise_for_status()
                dest.parent.mkdir(parents=True, exist_ok=True)
                with dest.open("wb") as fh:
                    async for chunk in resp.aiter_bytes():
                        fh.write(chunk)

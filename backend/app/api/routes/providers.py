from app.api.deps import get_dependency_resolver, get_provider_registry
from app.infra.dependencies import DependencyResolver
from app.providers.registry import ProviderRegistry
from app.schemas.common import BundleProfile
from app.schemas.dependencies import DependencyReport
from app.schemas.provider import (
    ProviderDescriptor,
    ProviderKind,
    ProviderTestRequest,
)
from fastapi import APIRouter, Depends, Header
from pydantic import BaseModel

router = APIRouter(prefix="/providers", tags=["providers"])


class ProvidersListResponse(BaseModel):
    providers: list[ProviderDescriptor]


@router.get("", response_model=ProvidersListResponse)
async def list_providers(
    registry: ProviderRegistry = Depends(get_provider_registry),
    x_configured_providers: str | None = Header(default=None),
) -> ProvidersListResponse:
    configured: set[ProviderKind] = set()
    if x_configured_providers:
        for kind in x_configured_providers.split(","):
            kind = kind.strip()
            try:
                configured.add(ProviderKind(kind))
            except ValueError:
                pass
    providers = await registry.list_descriptors(configured_kinds=configured)
    return ProvidersListResponse(providers=providers)


@router.post("/test")
async def test_provider(
    body: ProviderTestRequest,
    registry: ProviderRegistry = Depends(get_provider_registry),
):
    provider = registry.create(body.config)
    health = await provider.health_check(body.config)
    return health


health_router = APIRouter(tags=["health"])


class HealthResponse(BaseModel):
    status: str
    bundle_profile: BundleProfile
    dependencies: DependencyReport


@health_router.get("/health", response_model=HealthResponse)
def health(resolver: DependencyResolver = Depends(get_dependency_resolver)) -> HealthResponse:
    report = resolver.check_all()
    ok = report.ffmpeg.ok
    return HealthResponse(
        status="ok" if ok else "degraded",
        bundle_profile=resolver.profile,
        dependencies=report,
    )

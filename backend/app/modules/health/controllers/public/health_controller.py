from app.common.security import public_group
from app.modules.health.contracts.resources import HealthResource

router = public_group()


@router.get("/health", response_model=HealthResource)
async def health() -> HealthResource:
    return HealthResource(status="ok")

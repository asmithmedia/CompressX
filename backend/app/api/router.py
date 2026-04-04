from fastapi import APIRouter

from app.api.health import router as health_router
from app.api.jobs import router as jobs_router

router = APIRouter()
router.include_router(health_router, tags=["health"])
router.include_router(jobs_router, prefix="/jobs", tags=["jobs"])

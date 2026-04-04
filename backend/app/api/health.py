from fastapi import APIRouter
import redis

from app.config import settings

router = APIRouter()


@router.get("/health")
async def health_check():
    redis_ok = False
    try:
        r = redis.from_url(settings.redis_url)
        redis_ok = r.ping()
    except Exception:
        pass

    return {
        "status": "ok" if redis_ok else "degraded",
        "redis": "connected" if redis_ok else "disconnected",
    }

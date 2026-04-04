from fastapi import APIRouter, Header, HTTPException

from app.models.job import CompressRequest, CompressResponse, JobStatus
from app.worker.tasks import run_compression
from app.config import settings

router = APIRouter()


def verify_api_key(x_api_key: str = Header()):
    if x_api_key != settings.internal_api_key:
        raise HTTPException(status_code=401, detail="Invalid API key")


@router.post("/compress", response_model=CompressResponse)
async def create_compression_job(request: CompressRequest, x_api_key: str = Header()):
    verify_api_key(x_api_key)

    task = run_compression.delay(
        job_id=request.job_id,
        source_type=request.source_type,
        source_model_id=request.source_model_id,
        method=request.method,
        config=request.config,
        callback_url=request.callback_url,
    )

    return CompressResponse(
        job_id=request.job_id,
        task_id=task.id,
        status=JobStatus.PENDING,
    )

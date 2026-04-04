import json
import logging

import httpx
import redis

from app.worker.celery_app import celery_app
from app.compression.pipeline import CompressionPipeline
from app.config import settings

logger = logging.getLogger(__name__)


def get_redis():
    return redis.from_url(settings.redis_url)


def publish_progress(job_id: str, status: str, progress: int, message: str, **extra):
    """Publish progress update to Redis pub/sub channel."""
    r = get_redis()
    data = {
        "job_id": job_id,
        "status": status,
        "progress": progress,
        "message": message,
        **extra,
    }
    r.publish(f"job:{job_id}:progress", json.dumps(data))
    # Also store latest state in a key for clients that connect late
    r.setex(f"job:{job_id}:latest", 3600, json.dumps(data))


@celery_app.task(bind=True, name="app.worker.tasks.run_compression")
def run_compression(
    self,
    job_id: str,
    source_type: str,
    source_model_id: str,
    method: str,
    config: dict,
    callback_url: str | None = None,
):
    """Main Celery task for running model compression."""
    logger.info(f"Starting compression job {job_id}: {method} on {source_model_id}")

    def progress_callback(status: str, progress: int, message: str):
        publish_progress(job_id, status, progress, message)

    try:
        pipeline = CompressionPipeline(job_id, progress_callback=progress_callback)
        result = pipeline.run(
            source_type=source_type,
            source_model_id=source_model_id,
            method=method,
            config=config,
        )

        publish_progress(
            job_id,
            "COMPLETED",
            100,
            "Compression complete!",
            metrics=result["metrics"],
            output_key=result["output_key"],
            download_url=result["download_url"],
            output_filename=result["output_filename"],
        )

        # Notify the frontend via callback
        if callback_url:
            try:
                httpx.post(
                    callback_url,
                    json={
                        "job_id": job_id,
                        "status": "COMPLETED",
                        "metrics": result["metrics"],
                        "output_key": result["output_key"],
                        "download_url": result["download_url"],
                    },
                    headers={"X-API-Key": settings.internal_api_key},
                    timeout=10,
                )
            except Exception as e:
                logger.warning(f"Failed to send callback for job {job_id}: {e}")

        return result

    except Exception as e:
        logger.exception(f"Compression job {job_id} failed: {e}")
        publish_progress(job_id, "FAILED", 0, f"Error: {str(e)}", error=str(e))

        if callback_url:
            try:
                httpx.post(
                    callback_url,
                    json={"job_id": job_id, "status": "FAILED", "error": str(e)},
                    headers={"X-API-Key": settings.internal_api_key},
                    timeout=10,
                )
            except Exception:
                pass

        raise

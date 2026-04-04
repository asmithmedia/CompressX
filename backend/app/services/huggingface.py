import os
import logging
from pathlib import Path

from huggingface_hub import snapshot_download, HfApi

from app.config import settings

logger = logging.getLogger(__name__)


def download_model(model_id: str, job_id: str, progress_callback=None) -> str:
    """Download a model from HuggingFace Hub. Returns the local path."""
    download_dir = Path(f"/tmp/models/{job_id}/source")
    download_dir.mkdir(parents=True, exist_ok=True)

    if progress_callback:
        progress_callback(0, f"Downloading {model_id} from HuggingFace...")

    local_path = snapshot_download(
        repo_id=model_id,
        local_dir=str(download_dir),
        cache_dir=settings.hf_home,
    )

    if progress_callback:
        progress_callback(100, f"Download complete: {model_id}")

    return local_path


def search_models(query: str, limit: int = 20) -> list[dict]:
    """Search HuggingFace Hub for models."""
    api = HfApi()
    models = api.list_models(
        search=query,
        sort="downloads",
        direction=-1,
        limit=limit,
        filter="text-generation",
    )

    results = []
    for model in models:
        results.append({
            "id": model.id,
            "author": model.author,
            "downloads": model.downloads,
            "likes": model.likes,
            "pipeline_tag": model.pipeline_tag,
            "tags": model.tags[:10] if model.tags else [],
            "created_at": model.created_at.isoformat() if model.created_at else None,
        })

    return results


def get_model_info(model_id: str) -> dict:
    """Get detailed info about a specific model."""
    api = HfApi()
    info = api.model_info(model_id)

    total_size = 0
    if info.siblings:
        for sibling in info.siblings:
            if sibling.size:
                total_size += sibling.size

    return {
        "id": info.id,
        "author": info.author,
        "downloads": info.downloads,
        "likes": info.likes,
        "pipeline_tag": info.pipeline_tag,
        "tags": info.tags[:20] if info.tags else [],
        "size_bytes": total_size,
        "size_gb": round(total_size / (1024**3), 2) if total_size else None,
    }

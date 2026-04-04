import logging
from pathlib import Path

import boto3
from botocore.config import Config

from app.config import settings

logger = logging.getLogger(__name__)


def get_s3_client():
    return boto3.client(
        "s3",
        endpoint_url=settings.s3_endpoint,
        aws_access_key_id=settings.s3_access_key,
        aws_secret_access_key=settings.s3_secret_key,
        config=Config(signature_version="s3v4"),
        region_name="us-east-1",
    )


def ensure_bucket():
    """Create the bucket if it doesn't exist."""
    client = get_s3_client()
    try:
        client.head_bucket(Bucket=settings.s3_bucket)
    except Exception:
        client.create_bucket(Bucket=settings.s3_bucket)
        logger.info(f"Created bucket: {settings.s3_bucket}")


def upload_directory(local_dir: str, s3_prefix: str, progress_callback=None) -> str:
    """Upload a directory to S3. Returns the S3 prefix."""
    client = get_s3_client()
    ensure_bucket()

    local_path = Path(local_dir)
    files = list(local_path.rglob("*"))
    files = [f for f in files if f.is_file()]
    total = len(files)

    for i, file_path in enumerate(files):
        relative = file_path.relative_to(local_path)
        s3_key = f"{s3_prefix}/{relative}"

        client.upload_file(str(file_path), settings.s3_bucket, s3_key)

        if progress_callback and total > 0:
            pct = int((i + 1) / total * 100)
            progress_callback(pct, f"Uploading {relative} ({i+1}/{total})")

    return s3_prefix


def upload_file(local_path: str, s3_key: str) -> str:
    """Upload a single file to S3."""
    client = get_s3_client()
    ensure_bucket()
    client.upload_file(local_path, settings.s3_bucket, s3_key)
    return s3_key


def generate_presigned_download_url(s3_key: str, expires_in: int = 86400) -> str:
    """Generate a presigned download URL (default 24h expiry)."""
    client = get_s3_client()
    return client.generate_presigned_url(
        "get_object",
        Params={"Bucket": settings.s3_bucket, "Key": s3_key},
        ExpiresIn=expires_in,
    )


def generate_presigned_upload_url(s3_key: str, content_type: str, expires_in: int = 3600) -> str:
    """Generate a presigned upload URL for direct browser upload."""
    client = get_s3_client()
    ensure_bucket()
    return client.generate_presigned_url(
        "put_object",
        Params={
            "Bucket": settings.s3_bucket,
            "Key": s3_key,
            "ContentType": content_type,
        },
        ExpiresIn=expires_in,
    )

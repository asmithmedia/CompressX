from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql://compressx:compressx_dev@localhost:5432/compressx"
    redis_url: str = "redis://localhost:6379/0"
    s3_endpoint: str = "http://localhost:9000"
    s3_access_key: str = "minioadmin"
    s3_secret_key: str = "minioadmin"
    s3_bucket: str = "compressx-models"
    internal_api_key: str = "dev-internal-key-change-in-prod"
    hf_home: str = "/tmp/hf_cache"
    max_model_size_gb: float = 20.0
    job_timeout_seconds: int = 14400  # 4 hours

    model_config = {"env_file": ".env"}


settings = Settings()

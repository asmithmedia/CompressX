import logging
import shutil
from pathlib import Path

from app.compression.base import BaseCompressor
from app.compression.quantization.gguf import GGUFCompressor
from app.services.huggingface import download_model
from app.services.storage import upload_file, generate_presigned_download_url
from app.services.metrics import evaluate_compression

logger = logging.getLogger(__name__)

COMPRESSORS: dict[str, BaseCompressor] = {
    "GGUF": GGUFCompressor(),
}


class CompressionPipeline:
    """Orchestrates the full compression workflow: download -> compress -> evaluate -> upload."""

    def __init__(self, job_id: str, progress_callback=None):
        self.job_id = job_id
        self.progress_callback = progress_callback
        self.base_dir = Path(f"/tmp/models/{job_id}")

    def _report(self, status: str, progress: int, message: str):
        if self.progress_callback:
            self.progress_callback(status, progress, message)

    def run(
        self,
        source_type: str,
        source_model_id: str,
        method: str,
        config: dict,
    ) -> dict:
        """
        Execute the full compression pipeline.

        Returns dict with: metrics, output_key, download_url, output_filename
        """
        compressor = COMPRESSORS.get(method)
        if not compressor:
            raise ValueError(f"Unknown compression method: {method}. Available: {list(COMPRESSORS.keys())}")

        source_dir = self.base_dir / "source"
        output_dir = self.base_dir / "output"
        source_dir.mkdir(parents=True, exist_ok=True)
        output_dir.mkdir(parents=True, exist_ok=True)

        try:
            # Step 1: Download
            self._report("DOWNLOADING", 0, f"Downloading model {source_model_id}...")
            if source_type == "HUGGINGFACE":
                model_path = download_model(
                    source_model_id,
                    self.job_id,
                    progress_callback=lambda pct, msg: self._report("DOWNLOADING", pct, msg),
                )
            else:
                raise ValueError(f"Upload source type not yet implemented")

            # Step 2: Compress
            self._report("COMPRESSING", 0, f"Starting {compressor.name}...")
            compression_result = compressor.compress(
                model_path=model_path,
                output_path=str(output_dir),
                config=config,
                progress_callback=lambda pct, msg: self._report("COMPRESSING", pct, msg),
            )

            output_file = compression_result.get("output_file")
            if not output_file or not Path(output_file).exists():
                raise RuntimeError("Compression produced no output file")

            # Step 3: Evaluate
            self._report("EVALUATING", 0, "Evaluating compression results...")
            metrics = evaluate_compression(
                model_path,
                output_file,
                progress_callback=lambda pct, msg: self._report("EVALUATING", pct, msg),
            )
            metrics.update({
                "method": method,
                "quant_type": compression_result.get("quant_type"),
                "format": compression_result.get("format"),
            })

            # Step 4: Upload
            self._report("UPLOADING", 0, "Uploading compressed model...")
            output_filename = compression_result.get("output_filename", Path(output_file).name)
            s3_key = f"jobs/{self.job_id}/{output_filename}"

            upload_file(output_file, s3_key)
            download_url = generate_presigned_download_url(s3_key)

            self._report("COMPLETED", 100, "Compression complete!")

            return {
                "metrics": metrics,
                "output_key": s3_key,
                "download_url": download_url,
                "output_filename": output_filename,
            }

        finally:
            # Cleanup temp files
            if self.base_dir.exists():
                try:
                    shutil.rmtree(self.base_dir)
                    logger.info(f"Cleaned up temp dir: {self.base_dir}")
                except Exception as e:
                    logger.warning(f"Failed to cleanup {self.base_dir}: {e}")

import os
import logging
from pathlib import Path

logger = logging.getLogger(__name__)


def calculate_directory_size(path: str) -> int:
    """Calculate total size of all files in a directory."""
    total = 0
    for dirpath, _, filenames in os.walk(path):
        for f in filenames:
            fp = os.path.join(dirpath, f)
            if os.path.isfile(fp):
                total += os.path.getsize(fp)
    return total


def calculate_file_size(path: str) -> int:
    """Get the size of a single file."""
    return os.path.getsize(path)


def evaluate_compression(
    original_path: str,
    compressed_path: str,
    progress_callback=None,
) -> dict:
    """Evaluate compression results - size comparison and basic metrics."""
    if progress_callback:
        progress_callback(0, "Evaluating compression results...")

    # Calculate sizes
    if os.path.isdir(original_path):
        original_size = calculate_directory_size(original_path)
    else:
        original_size = calculate_file_size(original_path)

    if os.path.isdir(compressed_path):
        compressed_size = calculate_directory_size(compressed_path)
    else:
        compressed_size = calculate_file_size(compressed_path)

    compression_ratio = original_size / compressed_size if compressed_size > 0 else 0
    size_reduction_pct = ((original_size - compressed_size) / original_size * 100) if original_size > 0 else 0

    metrics = {
        "original_size_bytes": original_size,
        "compressed_size_bytes": compressed_size,
        "original_size_gb": round(original_size / (1024**3), 2),
        "compressed_size_gb": round(compressed_size / (1024**3), 2),
        "compression_ratio": round(compression_ratio, 2),
        "size_reduction_pct": round(size_reduction_pct, 1),
    }

    if progress_callback:
        progress_callback(100, f"Evaluation complete: {metrics['compression_ratio']}x compression")

    logger.info(f"Compression metrics: {metrics}")
    return metrics

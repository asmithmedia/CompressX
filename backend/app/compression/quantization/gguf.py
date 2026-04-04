import logging
import os
import shutil
import subprocess
from pathlib import Path
from typing import Callable

from app.compression.base import BaseCompressor

logger = logging.getLogger(__name__)

VALID_QUANT_TYPES = [
    "f16", "q8_0", "q6_k", "q5_k_m", "q5_k_s", "q5_0",
    "q4_k_m", "q4_k_s", "q4_0", "q3_k_m", "q3_k_s", "q3_k_l",
    "q2_k", "iq2_xxs", "iq2_xs",
]

DEFAULT_QUANT_TYPE = "q4_k_m"


class GGUFCompressor(BaseCompressor):
    """Compress models to GGUF format using llama.cpp tools."""

    @property
    def name(self) -> str:
        return "GGUF Quantization"

    def validate_config(self, config: dict) -> dict:
        quant_type = config.get("quant_type", DEFAULT_QUANT_TYPE)
        if quant_type not in VALID_QUANT_TYPES:
            raise ValueError(
                f"Invalid quant_type '{quant_type}'. Valid types: {VALID_QUANT_TYPES}"
            )
        return {"quant_type": quant_type}

    def compress(
        self,
        model_path: str,
        output_path: str,
        config: dict,
        progress_callback: Callable[[int, str], None] | None = None,
    ) -> dict:
        config = self.validate_config(config)
        quant_type = config["quant_type"]

        output_dir = Path(output_path)
        output_dir.mkdir(parents=True, exist_ok=True)

        model_name = Path(model_path).name
        f16_gguf = output_dir / f"{model_name}-f16.gguf"
        quantized_gguf = output_dir / f"{model_name}-{quant_type}.gguf"

        # Step 1: Convert HF model to GGUF f16
        if progress_callback:
            progress_callback(10, "Converting model to GGUF format (FP16)...")

        self._convert_to_gguf(model_path, str(f16_gguf))

        if progress_callback:
            progress_callback(50, f"Converting to GGUF complete. Quantizing to {quant_type}...")

        # Step 2: Quantize if not f16
        if quant_type == "f16":
            final_path = str(f16_gguf)
        else:
            self._quantize(str(f16_gguf), str(quantized_gguf), quant_type, progress_callback)
            # Remove the f16 intermediate file to save space
            if f16_gguf.exists():
                f16_gguf.unlink()
            final_path = str(quantized_gguf)

        if progress_callback:
            progress_callback(95, "Quantization complete")

        return {
            "format": "gguf",
            "quant_type": quant_type,
            "output_file": final_path,
            "output_filename": Path(final_path).name,
        }

    def _convert_to_gguf(self, model_path: str, output_path: str):
        """Convert HuggingFace model to GGUF f16 format."""
        # Try using the convert_hf_to_gguf.py script from llama.cpp
        # First check if llama-cpp-python or llama.cpp is available
        convert_script = self._find_convert_script()

        if convert_script:
            cmd = [
                "python", convert_script,
                model_path,
                "--outfile", output_path,
                "--outtype", "f16",
            ]
        else:
            # Fallback: try using the llama-cpp-python package
            cmd = [
                "python", "-m", "llama_cpp.convert",
                model_path,
                "--outfile", output_path,
                "--outtype", "f16",
            ]

        logger.info(f"Running GGUF conversion: {' '.join(cmd)}")
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=3600)

        if result.returncode != 0:
            logger.error(f"GGUF conversion failed: {result.stderr}")
            raise RuntimeError(f"GGUF conversion failed: {result.stderr[:500]}")

        if not Path(output_path).exists():
            raise RuntimeError("GGUF conversion produced no output file")

    def _quantize(
        self,
        input_path: str,
        output_path: str,
        quant_type: str,
        progress_callback: Callable[[int, str], None] | None = None,
    ):
        """Quantize a GGUF f16 file to the target quantization type."""
        # Try llama-quantize binary
        quantize_bin = self._find_quantize_binary()

        if quantize_bin:
            cmd = [quantize_bin, input_path, output_path, quant_type]
        else:
            # Fallback: use llama-cpp-python's quantize
            cmd = [
                "python", "-c",
                f"from llama_cpp import llama_cpp; "
                f"llama_cpp.llama_model_quantize('{input_path}', '{output_path}', "
                f"llama_cpp.llama_model_quantize_params(ftype='{quant_type}'))",
            ]

        if progress_callback:
            progress_callback(60, f"Quantizing to {quant_type}...")

        logger.info(f"Running quantization: {' '.join(cmd)}")
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=7200)

        if result.returncode != 0:
            logger.error(f"Quantization failed: {result.stderr}")
            raise RuntimeError(f"Quantization failed: {result.stderr[:500]}")

        if not Path(output_path).exists():
            raise RuntimeError("Quantization produced no output file")

        if progress_callback:
            progress_callback(90, "Quantization complete")

    def _find_convert_script(self) -> str | None:
        """Find the convert_hf_to_gguf.py script."""
        possible_paths = [
            "/usr/local/bin/convert_hf_to_gguf.py",
            "/opt/llama.cpp/convert_hf_to_gguf.py",
            shutil.which("convert_hf_to_gguf.py"),
        ]
        for path in possible_paths:
            if path and os.path.isfile(path):
                return path
        return None

    def _find_quantize_binary(self) -> str | None:
        """Find the llama-quantize binary."""
        possible_names = ["llama-quantize", "quantize"]
        for name in possible_names:
            path = shutil.which(name)
            if path:
                return path
        possible_paths = [
            "/usr/local/bin/llama-quantize",
            "/opt/llama.cpp/build/bin/llama-quantize",
        ]
        for path in possible_paths:
            if os.path.isfile(path):
                return path
        return None

from abc import ABC, abstractmethod
from typing import Callable


class BaseCompressor(ABC):
    """Base class for all compression methods."""

    @property
    @abstractmethod
    def name(self) -> str:
        """Human-readable name of the compression method."""
        pass

    @abstractmethod
    def compress(
        self,
        model_path: str,
        output_path: str,
        config: dict,
        progress_callback: Callable[[int, str], None] | None = None,
    ) -> dict:
        """
        Compress a model.

        Args:
            model_path: Path to the source model directory
            output_path: Path to write the compressed output
            config: Method-specific configuration
            progress_callback: Callable(progress_pct: int, message: str)

        Returns:
            Dict with compression-specific metadata (format, quant type, etc.)
        """
        pass

    @abstractmethod
    def validate_config(self, config: dict) -> dict:
        """Validate and normalize the configuration. Returns cleaned config."""
        pass

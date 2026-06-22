import logging
from logging.handlers import RotatingFileHandler
from pathlib import Path

from app.config import Settings

_CONFIGURED = False


def setup_logging(settings: Settings) -> Path | None:
    """Configure console + rotating file logging under OUTPUT_DIR/logs."""
    global _CONFIGURED
    if _CONFIGURED:
        return settings.logs_dir / "api.log"

    level_name = settings.log_level or ("DEBUG" if settings.primeclip_debug else "INFO")
    level = getattr(logging, level_name.upper(), logging.INFO)

    formatter = logging.Formatter(
        fmt="%(asctime)s %(levelname)-8s [%(name)s] %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    root = logging.getLogger()
    root.handlers.clear()
    root.setLevel(level)

    console_handler = logging.StreamHandler()
    console_handler.setFormatter(formatter)
    root.addHandler(console_handler)

    log_file: Path | None = None
    if settings.log_to_file:
        settings.logs_dir.mkdir(parents=True, exist_ok=True)
        log_file = settings.logs_dir / "api.log"
        file_handler = RotatingFileHandler(
            log_file,
            maxBytes=10 * 1024 * 1024,
            backupCount=5,
            encoding="utf-8",
        )
        file_handler.setFormatter(formatter)
        root.addHandler(file_handler)

    for name in ("uvicorn", "uvicorn.error", "uvicorn.access"):
        uvicorn_logger = logging.getLogger(name)
        uvicorn_logger.handlers.clear()
        uvicorn_logger.propagate = True

    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)
    logging.getLogger("watchfiles").setLevel(logging.INFO)

    _CONFIGURED = True
    return log_file

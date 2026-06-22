from __future__ import annotations

import logging
import subprocess
import threading

logger = logging.getLogger(__name__)


class FFmpegProcessRegistry:
    """Tracks active FFmpeg subprocesses so they can be cancelled on idle/shutdown."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._active: set[subprocess.Popen[str]] = set()

    def add(self, proc: subprocess.Popen[str]) -> None:
        with self._lock:
            self._active.add(proc)

    def remove(self, proc: subprocess.Popen[str]) -> None:
        with self._lock:
            self._active.discard(proc)

    def kill_all(self) -> None:
        with self._lock:
            procs = list(self._active)
            self._active.clear()
        for proc in procs:
            try:
                proc.kill()
                proc.wait(timeout=5)
            except (ProcessLookupError, subprocess.TimeoutExpired):
                try:
                    proc.terminate()
                except ProcessLookupError:
                    pass
        if procs:
            logger.info("Killed %d active FFmpeg process(es)", len(procs))

    @property
    def active_count(self) -> int:
        with self._lock:
            return len(self._active)


ffmpeg_registry = FFmpegProcessRegistry()

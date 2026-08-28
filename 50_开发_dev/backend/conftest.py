"""Root conftest — makes `domains.assessment.*` importable as a package
tree when running pytest from `backend/` (before this workspace is
installed via `uv sync`).
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

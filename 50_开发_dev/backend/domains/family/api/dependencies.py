"""FastAPI dependency wiring. Real auth/repository implementations are
injected by the mounting app at process startup; this module defines the
shape (`FamilyContext`) and default-raising stubs so the domain package has
no hard dependency on any concrete infra choice.
"""
from __future__ import annotations

from dataclasses import dataclass

from fastapi import HTTPException

from ..application.commands import FamilyCommandHandler


@dataclass(frozen=True)
class FamilyContext:
    tenant_id: str
    family_id: str
    person_id: str


def get_family_context() -> FamilyContext:
    raise HTTPException(status_code=500, detail="get_family_context_not_wired")


def get_command_handler() -> FamilyCommandHandler:
    raise HTTPException(status_code=500, detail="command_handler_not_wired")

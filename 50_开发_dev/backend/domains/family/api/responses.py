"""Response models -- thin wrappers documenting the receipt shape returned
by each mutation, mirroring the assessment domain's `responses.py` pattern.
"""
from __future__ import annotations

from pydantic import BaseModel


class FamilyMutationReceiptResponse(BaseModel):
    action: str
    replayed: bool

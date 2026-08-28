"""Value objects/status enums for the Product Intelligence domain.

No TS predecessor — new domain (project owner Override #6). Status names
follow the project owner's instruction 01/03 vocabulary verbatim.
"""
from __future__ import annotations

from typing import Literal

HypothesisStatus = Literal["DRAFT", "UNDER_REVIEW", "VALIDATED", "REJECTED", "RETIRED"]
ContradictionStatus = Literal["DRAFT", "UNDER_REVIEW", "APPROVED", "RETIRED"]
StrategyStatus = Literal["DRAFT", "UNDER_REVIEW", "APPROVED", "RETIRED"]
OpportunityStatus = Literal["INVEST", "EXPERIMENT", "WATCH", "MAINTAIN", "EXIT"]
ProductConceptStatus = Literal["DRAFT", "UNDER_REVIEW", "APPROVED", "RETIRED"]
GenericRecordStatus = Literal["DRAFT", "ACTIVE", "RETIRED"]

"""Consent query handler -- the concrete `ConsentQueryPort` implementation
other domains import. Fetches the GRANTED-purpose set via
`ConsentRepositoryPort.load_granted_purposes` and hands it to the pure
domain policy for the pass/fail decision. Mirrors `AssessmentQueryHandler`
in `backend/domains/assessment/application/queries.py`.
"""
from __future__ import annotations

from ..domain.policies import assert_required_growth_consents_from_granted
from ..domain.value_objects import REQUIRED_GROWTH_CONSENT_PURPOSES, ConsentPurpose
from .ports import ConsentRepositoryPort


class ConsentQueryHandler:
    """Implements `ConsentQueryPort`. One instance per request/transaction,
    same lifecycle convention as `SqlAlchemyAssessmentRepository` -- the
    caller owns the underlying connection/transaction boundary, this class
    only issues the one read.
    """

    def __init__(self, repository: ConsentRepositoryPort):
        self._repository = repository

    async def assert_required_growth_consents(
        self,
        family_id: str,
        subject_person_id: str,
        required_purposes: tuple[ConsentPurpose, ...] | None = None,
    ) -> None:
        purposes = required_purposes if required_purposes is not None else REQUIRED_GROWTH_CONSENT_PURPOSES
        granted = await self._repository.load_granted_purposes(family_id, subject_person_id, purposes)
        assert_required_growth_consents_from_granted(granted, purposes)

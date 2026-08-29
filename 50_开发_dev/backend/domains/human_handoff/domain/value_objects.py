"""Value objects for the Human Handoff domain (Batch 3, decoupled from
Principal per `architecture/notes/batch3-principal-migration-contract-v1.md`
section 2). No FastAPI / SQLAlchemy dependency, per the four-layer rule.

All enum members are grounded in the actual NestJS code, NOT the contract's
loose prose. Where the contract text and the real code disagree, the code
wins (see module notes below) — flagged so downstream Principal migration
uses the true values.
"""
from __future__ import annotations

from enum import Enum


class HandoffStatus(str, Enum):
    """Port of the `principal_human_handoffs.status` column. NestJS only ever
    inserts rows with the implicit default `OPEN` (see `saveHandoff` — status
    is not in the insert column list, so it defaults) and transitions them to
    `RESOLVED` via `resolveHandoff` (`set status='RESOLVED' ... where status='OPEN'`).
    A row never moves back from RESOLVED to OPEN.
    """

    OPEN = "OPEN"
    RESOLVED = "RESOLVED"


class HandoffResolution(str, Enum):
    """Port of the `principal_human_handoffs.resolution` column values a
    reviewer can submit. Grounded in the review-console operator UI in
    `principal.controller.ts` (the M3-107 self-contained review console page),
    which offers exactly these four buttons:
      btn(...,'APPROVED','通过') / 'ESCALATED','升级' / 'REJECTED','驳回' / 'INFO_ONLY','仅记录'.

    Only `APPROVED` is load-bearing for the release dual-invariant: it is the
    single resolution that can release a withheld candidate response back to
    the parent (`resolveHandoff` in principal.service.ts:
    `if (resolution === 'APPROVED') { ... markHandoffReleased ... }`). All
    other resolutions keep the response WITHHELD (released_response = None).
    """

    APPROVED = "APPROVED"
    ESCALATED = "ESCALATED"
    REJECTED = "REJECTED"
    INFO_ONLY = "INFO_ONLY"


class HandoffReason(str, Enum):
    """Port of the `principal_human_handoffs.trigger_reason` column values, as
    actually produced by `principal.service.ts::handleMessage` at its four
    `saveHandoff(...)` call sites.

    CONTRACT DISCREPANCY (code wins): the contract prose (section 2) lists
    `quota / model_error / high_risk / review`, but the NestJS HIGH_RISK path
    does NOT write the literal string `high_risk`. It writes the *safety
    detection stage* as the trigger:
        const trigger = safetyPrecheck(...) === 'HIGH_RISK' ? 'precheck' : 'postcheck';
        await this.repo.saveHandoff(sessionId, familyId, subjectRef, route, trigger);
    (`route` here is the separate `risk_route` column = 'HIGH_RISK'.) So the
    real trigger_reason values are:
      - 'quota'      (daily-cap exceeded, real external call blocked)
      - 'model_error'(fail-closed after the structured model call failed)
      - 'precheck'   (HIGH_RISK detected before the model call)
      - 'postcheck'  (HIGH_RISK detected after the model call)
      - 'review'     (REVIEW route — candidate response withheld for human confirm)
    """

    QUOTA = "quota"
    MODEL_ERROR = "model_error"
    PRECHECK = "precheck"
    POSTCHECK = "postcheck"
    REVIEW = "review"


# The risk_route stamped alongside the handoff (from the Principal side). Kept
# as a plain tuple of literals — human_handoff does not own risk routing (that
# is Principal's domain), it only records what Principal decided.
HANDOFF_RISK_ROUTES: tuple[str, ...] = ("HIGH_RISK", "REVIEW")

"""Architecture guardrail (chief-architect PR-001R ruling on PR #27/#33, item
"确定唯一 SSOT"; extended by the PR-002R ruling on PR #37): none of the
designated Product Intelligence canonical entity names may be redefined by
any *other* domain's `domain/entities.py`, AND none of them may be
redefined a *second time inside* the product_intelligence domain itself.

The cross-domain half of this guard is what let
`MarketSignal`/`SignalCluster`/`GrowthProblem`/`Opportunity` silently exist
in three places (`domains/market_intelligence`, `domains/product_strategy`,
`domains/product_intelligence`) before PR-001R — this test makes that class
of regression fail CI instead of requiring a human to notice it in review.

The intra-domain half is what let PR-001's placeholder
`domain/entities.py::ProductZoneAssessment` (never used by any real caller)
coexist for two PRs with PR-002's ADR-accurate
`domain/zone_entities.py::ProductZoneAssessment` (the one real callers
actually use) before the PR-002R ruling on PR #37 deleted the placeholder —
same class name, same domain, two unrelated types. See
`ProductZoneAssessment`'s deletion from `domain/entities.py` in that PR: this
test is the guard that would have caught the duplicate automatically instead
of requiring the chief architect to spot it in review.

Scope (chief-architect ruling on PR #33): a blanket "no two domains may ever
share any class name" rule is too broad and would eventually block
unrelated domains from coincidentally choosing the same simple name (e.g.
two unrelated domains each defining a `Note` entity) — that is not the bug
being guarded against. The check is therefore an explicit whitelist of the
canonical Product Intelligence entity names only; any other class name
colliding across domains, or within a domain's own `domain/` module set, is
out of scope for this test.

Canonical-source note: for `product_intelligence` itself, a canonical name
may legitimately live in any file directly under `domain/` (e.g.
`entities.py` for the PR-001 chain, `zone_entities.py` for the PR-002 Zone
Engine types) — this domain's `domain/` package is intentionally split
across more than one module. What must stay true is that each canonical
name is defined exactly ONCE across that whole `domain/` package. Other
domains are only checked via their own `domain/entities.py`, matching the
original PR-001R scope (they have not been given a reason to split their
`domain/` package the way product_intelligence has).

Static AST scan, not a runtime import — a domain with a syntax error would
already fail other tests, and this test should not need every domain's
dependencies importable to run.
"""
from __future__ import annotations

import ast
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
DOMAINS_ROOT = BACKEND_ROOT / "domains"
CANONICAL_DOMAIN_NAME = "product_intelligence"

# Only these Product Intelligence canonical entity names are guarded against
# cross-domain redefinition (and, for product_intelligence itself, against a
# second same-domain redefinition). Any other same-name class collision (e.g.
# two unrelated domains both defining a `Note` entity) is intentionally out
# of scope — see module docstring "Scope".
CANONICAL_ENTITY_NAMES = frozenset({
    "MarketSignal",
    "CustomerInsight",
    "Opportunity",
    "GrowthProblem",
    "GrowthHypothesis",
    "ContradictionModel",
    "GrowthStrategy",
    "ProductConcept",
    "ProductZoneAssessment",
})


def _top_level_class_names(source_file: Path) -> set[str]:
    tree = ast.parse(source_file.read_text(encoding="utf-8"))
    return {node.name for node in ast.iter_child_nodes(tree) if isinstance(node, ast.ClassDef)}


def test_no_duplicate_canonical_entity_names_across_domains():
    # owners_by_class_name maps a canonical name to every "<domain>/<file>"
    # location that defines it — a top-level class definition, anywhere
    # under that domain's `domain/` package (not just `entities.py`), counts
    # as an owner. This deliberately does not care whether a name-holding
    # file is called `entities.py` or something else, because
    # product_intelligence's real canonical source for `ProductZoneAssessment`
    # is `domain/zone_entities.py`, not `domain/entities.py` — see module
    # docstring "Canonical-source note".
    owners_by_class_name: dict[str, list[str]] = {}
    for domain_dir in sorted(DOMAINS_ROOT.iterdir()):
        domain_pkg_dir = domain_dir / "domain"
        if not domain_pkg_dir.is_dir():
            continue
        if domain_dir.name == CANONICAL_DOMAIN_NAME:
            # product_intelligence's domain/ package is intentionally split
            # across multiple files (entities.py, zone_entities.py, ...) —
            # scan every top-level module in it, not just entities.py.
            source_files = sorted(p for p in domain_pkg_dir.glob("*.py") if p.name != "__init__.py")
        else:
            # Every other domain is scoped to entities.py only, matching the
            # original PR-001R rule — they have not split domain/ the way
            # product_intelligence has, and giving them the wider scan would
            # be a silent behavior change beyond this ruling.
            entities_file = domain_pkg_dir / "entities.py"
            source_files = [entities_file] if entities_file.is_file() else []
        for source_file in source_files:
            for class_name in _top_level_class_names(source_file):
                if class_name not in CANONICAL_ENTITY_NAMES:
                    continue
                owners_by_class_name.setdefault(class_name, []).append(
                    f"{domain_dir.name}/domain/{source_file.name}"
                )

    duplicates = {
        name: owners
        for name, owners in owners_by_class_name.items()
        if len(owners) > 1 or (len(owners) == 1 and not owners[0].startswith(f"{CANONICAL_DOMAIN_NAME}/"))
    }
    assert not duplicates, (
        "Canonical Product Intelligence entity name defined more than once, or defined outside "
        f"`domains/{CANONICAL_DOMAIN_NAME}/domain/` — this is either the cross-domain bug PR-001R fixed "
        "(market_intelligence/product_strategy/product_intelligence all defining their own "
        "MarketSignal/GrowthProblem/Opportunity) or the intra-domain duplicate PR-002R fixed "
        f"(entities.py and zone_entities.py both defining ProductZoneAssessment): {duplicates}"
    )

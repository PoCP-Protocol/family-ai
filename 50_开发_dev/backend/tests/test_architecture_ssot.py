"""Architecture guardrail (chief-architect PR-001R ruling on PR #27/#33, item
"确定唯一 SSOT"): none of the designated Product Intelligence canonical
entity names may be redefined by any *other* domain's `domain/entities.py`.
This is what let `MarketSignal`/`SignalCluster`/`GrowthProblem`/`Opportunity`
silently exist in three places (`domains/market_intelligence`,
`domains/product_strategy`, `domains/product_intelligence`) before this PR —
this test makes that class of regression fail CI instead of requiring a
human to notice it in review.

Scope (chief-architect ruling on PR #33): a blanket "no two domains may ever
share any class name" rule is too broad and would eventually block
unrelated domains from coincidentally choosing the same simple name (e.g.
two unrelated domains each defining a `Note` entity) — that is not the bug
being guarded against. The check is therefore an explicit whitelist of the
canonical Product Intelligence entity names only; any other class name
colliding across domains is out of scope for this test.

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
# cross-domain redefinition. Any other same-name class collision (e.g. two
# unrelated domains both defining a `Note` entity) is intentionally out of
# scope — see module docstring "Scope".
CANONICAL_ENTITY_NAMES = frozenset({
    "MarketSignal",
    "CustomerInsight",
    "Opportunity",
    "GrowthProblem",
    "GrowthHypothesis",
    "ContradictionModel",
    "GrowthStrategy",
    "ProductConcept",
})


def _top_level_class_names(entities_file: Path) -> set[str]:
    tree = ast.parse(entities_file.read_text(encoding="utf-8"))
    return {node.name for node in ast.iter_child_nodes(tree) if isinstance(node, ast.ClassDef)}


def test_no_duplicate_canonical_entity_names_across_domains():
    owners_by_class_name: dict[str, list[str]] = {}
    for domain_dir in sorted(DOMAINS_ROOT.iterdir()):
        entities_file = domain_dir / "domain" / "entities.py"
        if not entities_file.is_file():
            continue
        for class_name in _top_level_class_names(entities_file):
            if class_name not in CANONICAL_ENTITY_NAMES:
                continue
            owners_by_class_name.setdefault(class_name, []).append(domain_dir.name)

    duplicates = {
        name: owners
        for name, owners in owners_by_class_name.items()
        if len(owners) > 1 or (len(owners) == 1 and owners[0] != CANONICAL_DOMAIN_NAME)
    }
    assert not duplicates, (
        "Canonical Product Intelligence entity name defined outside "
        f"`domains/{CANONICAL_DOMAIN_NAME}/domain/entities.py` — exactly the bug PR-001R fixed "
        f"(market_intelligence/product_strategy/product_intelligence all defining their own "
        f"MarketSignal/GrowthProblem/Opportunity): {duplicates}"
    )

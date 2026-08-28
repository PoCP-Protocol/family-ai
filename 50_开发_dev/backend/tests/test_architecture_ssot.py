"""Architecture guardrail (chief-architect PR-001R ruling on PR #27, item
"确定唯一 SSOT"): no two domains under `domains/*/domain/entities.py` may
define a class with the same name. This is what let `MarketSignal`/
`SignalCluster`/`GrowthProblem`/`Opportunity` silently exist in three places
(`domains/market_intelligence`, `domains/product_strategy`,
`domains/product_intelligence`) before this PR — this test makes that class
of regression fail CI instead of requiring a human to notice it in review.

Static AST scan, not a runtime import — a domain with a syntax error would
already fail other tests, and this test should not need every domain's
dependencies importable to run.
"""
from __future__ import annotations

import ast
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
DOMAINS_ROOT = BACKEND_ROOT / "domains"


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
            owners_by_class_name.setdefault(class_name, []).append(domain_dir.name)

    duplicates = {name: owners for name, owners in owners_by_class_name.items() if len(owners) > 1}
    assert not duplicates, (
        "Duplicate canonical entity class names across domains — exactly the bug PR-001R fixed "
        f"(market_intelligence/product_strategy/product_intelligence all defining their own "
        f"MarketSignal/GrowthProblem/Opportunity): {duplicates}"
    )

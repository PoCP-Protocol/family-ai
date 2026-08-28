"""按卡片 id 直接导出精简 grounding 内容 —— 供非 method-root 场景消费(如 Family Assessment 域)。

`compile_principal_bundle.py` 的 `compile_bundle()` 强制要求一个 method 卡作为根,
沿 grounded_in/targets_constructs/measured_by 遍历出整条链。Assessment 域不是这个形状——
它要的是"给一个 construct_ref(如 PARENT_CHILD_COMMUNICATION),直接查它在知识库里对应哪些
theory/construct/method 卡,把已核验内容抽出来"，不需要先有一个 method 根。

本模块不重新实现证据判定逻辑,复用 compile_principal_bundle 里已经写好的
_node()/_external_verified()/_decisive_refs() —— 同一套 Evidence Gate,同一套
"只有 verified_sources.yaml 登记过的来源才算 external_verified"的机器判据。

用法: python -m byresearch.export_by_id CONSTRUCT_KNOWLEDGE_MAP.json > out.json
      (或作为库函数 export_grounding(ids, lib) 直接调用)
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

from .compile_principal_bundle import _node
from .library import Library

OUT_DIR = Path(__file__).resolve().parents[2] / "50_开发_dev" / "knowledge" / "compiled"


def export_grounding(ids: list[str], lib: Library) -> dict:
    """给一组卡片 id(理论/构念/方法均可混合),返回 {id: node} 字典。

    找不到的 id 不报错、不占位、直接跳过 —— 调用方(如 assessment 域的映射表)
    如果引用了一个不存在的卡片 id,那是调用方自己的配置错误,应该在调用方那边
    的测试里暴露,不该在这里被静默吞掉变成一个"看起来正常但内容是假的"的 fallback。
    """
    out: dict[str, dict] = {}
    for card_id in ids:
        card = lib.get(card_id)
        if card is None:
            continue
        out[card_id] = _node(card)
    return out


def export_construct_map(construct_map: dict[str, list[str]], lib: Library) -> dict:
    """给 {construct_ref: [card_id, ...]} 这种映射(Assessment 域的形状),
    产出 {construct_ref: {card_id: node}}。空列表(如 DEVICE_USE_CONTEXT 目前无对应卡片)
    原样保留为空字典,不臆造内容。
    """
    return {ref: export_grounding(card_ids, lib) for ref, card_ids in construct_map.items()}


def main() -> int:
    if len(sys.argv) < 2:
        print("usage: python -m byresearch.export_by_id <construct_map.json> [out.json]", file=sys.stderr)
        return 1
    map_path = Path(sys.argv[1])
    construct_map = json.loads(map_path.read_text(encoding="utf-8"))

    lib = Library.load()
    validate_errors = [i for i in lib.validate() if i.severity == "error"]
    if validate_errors:
        print("LIBRARY VALIDATE FAILED:", file=sys.stderr)
        for e in validate_errors:
            print(" ", e, file=sys.stderr)
        return 1

    result = export_construct_map(construct_map, lib)

    out_path = Path(sys.argv[2]) if len(sys.argv) > 2 else map_path.with_suffix(".grounding.json")
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")

    for ref, nodes in result.items():
        print(f"{ref}: {len(nodes)} card(s) exported -> {list(nodes.keys())}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

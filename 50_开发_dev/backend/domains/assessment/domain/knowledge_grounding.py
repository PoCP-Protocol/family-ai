"""构建时固化的知识库 grounding —— 只读,运行时零依赖 20_知识_knowledge。

`CONSTRUCT_KNOWLEDGE_MAP` 是唯一的人工维护映射:construct_ref(与
`claude_interpretation.py` 的 `_LEGAL_CONSTRUCT_REFS` 完全一致的三个白名单值)
→ 知识库卡片 id 列表。空列表是诚实状态(如 DEVICE_USE_CONTEXT 目前无对应知识卡),
不是缺失,不得为了"看起来都有依据"而硬凑映射。

`assessment_construct_grounding.json` 由
`20_知识_knowledge/byresearch/export_by_id.py` 在构建时生成(同目录, git 跟踪,
非运行时生成) —— 两个系统(20_知识_knowledge 与本 Assessment 域)通过这一个
静态 JSON 文件解耦:本模块运行时只 `json.load` 这个文件,不 import knowledge
库的任何代码,不在请求路径里跨目录读取。

重新生成命令(改了 CONSTRUCT_KNOWLEDGE_MAP 或知识库内容后必须重跑):
    cd 20_知识_knowledge && python -m byresearch.export_by_id \\
        <construct_map.json> ../50_开发_dev/backend/domains/assessment/domain/assessment_construct_grounding.json
"""
from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

CONSTRUCT_KNOWLEDGE_MAP: dict[str, list[str]] = {
    # 情绪教练(核心) + 自我分化(解释"为什么家长学了话术还是会被冲突带情绪") + 对应方法卡。
    "PARENT_CHILD_COMMUNICATION": ["TH-001", "CN-001", "CN-002", "MD-001", "TH-005", "CN-006", "MD-005"],
    # 成长型思维/努力归因(核心) + 家长自身教养效能感(家长支持作业时的信心也是变量) + SDT胜任感/自主性。
    "HOMEWORK_PROCESS": ["TH-006", "CN-007", "MD-006", "TH-004", "CN-005", "MD-004", "TH-007", "CN-008"],
    # 2026-08-29 填补:此前一直留空(知识库无对应卡片),现有TH-010家长媒体调节理论
    # (Nathanson 1999 + Fam et al. 2023 meta分析)。
    "DEVICE_USE_CONTEXT": ["TH-010", "CN-011", "MD-010"],
}

_GROUNDING_FILE = Path(__file__).with_name("assessment_construct_grounding.json")


@lru_cache(maxsize=1)
def _load_grounding_data() -> dict:
    """找不到/解析失败 → 空 dict(FAIL SAFE:宁可无 grounding,不可编造)。"""
    try:
        return json.loads(_GROUNDING_FILE.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}


def grounding_prompt_block(construct_refs: set[str]) -> str:
    """给一组合法 construct_ref,拼出可直接插入 system prompt 的"已验证理论依据"文本块。

    没有任何匹配内容时返回空字符串(调用方据此决定是否插入该区块),
    不返回"暂无相关理论"这类看起来像内容但没信息量的占位句。
    """
    data = _load_grounding_data()
    lines: list[str] = []
    for ref in sorted(construct_refs):
        cards = data.get(ref) or {}
        if not cards:
            continue
        lines.append(f"[{ref}]")
        for card_id, node in cards.items():
            claim = node.get("core_claim") or node.get("summary") or ""
            if not claim:
                continue
            lines.append(f"  - {card_id} ({node.get('evidence_grade', 'E0')}): {claim}")
    return "\n".join(lines)


def grounded_card_ids(construct_ref: str) -> list[str]:
    """给一个 construct_ref,返回它在 assessment_construct_grounding.json 里
    实际有内容的卡片 id 列表 —— 供输出层校验 `grounding_source` 字段引用的 id
    确实来自这条映射,而不是模型自己编的 id。
    """
    data = _load_grounding_data()
    return list((data.get(construct_ref) or {}).keys())

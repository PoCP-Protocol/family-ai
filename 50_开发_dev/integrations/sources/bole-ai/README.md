# Bole.AI External Source Data

This directory contains external data packages copied into Family's engineering integration layer for audit and later adapter-based import.

No file in this directory is canonical Family domain state. These files must not be written directly into ontology, knowledge-library YAML, or core application tables.

## Packages

| Package | Source | Files | Purpose |
|---|---|---:|---|
| `distillation/` | `D:\Bole.AI` | 2 | Bole Family education SFT/train-mix files currently used by the 220k Family staging source plan. |
| `joysoul/` | `D:\AiSoul` and `D:\JoySoul_corpus_backup` discovery | 10 | JoySoul/AiSoul files currently used by the 220k Family staging source plan. Unused migrated copies were removed from this integration layer. |

## Import Rule

Use `integrations/contracts/ADAPTER_CONTRACT.md` before any import:

```text
External file
-> Raw External DTO
-> Adapter Mapper
-> Canonical DTO
-> Validation
-> Family Named Action / Import Command
```

All imported rows must preserve source lineage (`sourceSystem`, `sourceId`, `mappingVersion`) and pass human approval before affecting Family core state.
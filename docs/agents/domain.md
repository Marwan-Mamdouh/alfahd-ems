# Domain docs

## Before exploring

- Read root `GLOSSARY.md`.
- Read relevant ADRs in `docs/adr/`.
- Read relevant existing decision records in `docs/decisions/`.

If these paths do not exist, proceed silently. Do not suggest creating them
upfront; domain-modeling creates documentation when terms or decisions are resolved.

## Layout

Single-context: one root `GLOSSARY.md`, with ADRs in `docs/adr/`.
Existing decision records remain in `docs/decisions/`.

## Vocabulary

Use glossary terms when naming domain concepts in tickets, proposals, and tests.
Avoid synonyms the glossary explicitly rejects.
If a concept is missing, reconsider the term or note the gap for domain-modeling.

## Decision conflicts

Explicitly flag contradictions with existing ADRs or decision records,
citing the record and explaining why it may need revisiting.

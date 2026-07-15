# Project Setup Validation Checklist

Run this after rendering the final artifacts. The script catches mechanical failures; this
checklist covers meaning and consistency.

## Source Use

- Existing product, code, design, and infrastructure sources were inspected first.
- Generated claims distinguish verified current state from proposed direction.
- Numeric targets, limits, intervals, deadlines, retention periods, domain constraints, and
  acceptance metrics are source-backed, explicitly approved, or visibly provisional/deferred.
- Conflicting sources were resolved or recorded, not silently combined.
- No secret, credential, or private production identifier was copied into documentation.

## Run Scope and Depth

- The run is explicitly treated as full setup, focused update, or audit.
- Focused work changed only requested artifacts and necessary cross-links.
- Document depth matches idea, greenfield, or existing-project evidence without empty scaffolding.
- An ADR was not invented merely to avoid an empty registry.

## Ownership

- Roadmap owns product scope, delivery, progress, and unresolved/deferred work.
- Design owns experience direction, design sources, UI contracts, and design status.
- Architecture owns system structure, boundaries, data ownership, runtime, and operations.
- ADRs own significant technical rationale and supersession history.
- AGENTS owns agent behavior, commands, approvals, and rule routing.
- CLAUDE is a thin adapter importing AGENTS and preserves only Claude-specific additions.
- Detailed values/contracts link to one canonical design, schema, code, or guide source.

## Cross-Document Consistency

- Product name, user/role names, domain terms, routes, services, environments, and statuses match.
- Roadmap route scope agrees with Design screen coverage and Architecture implementation.
- Roadmap technical summaries link to Architecture/ADRs instead of duplicating detail.
- Accepted ADRs match current Architecture direction; superseded ADRs link replacements.
- AGENTS command map contains real commands only and points to the actual docs map/rules.
- AGENTS contains artifact-specific documentation impact triggers for Roadmap, Design,
  Architecture, and ADR maintenance.
- CLAUDE imports the final AGENTS path instead of duplicating its shared rules.
- Every linked local path resolves or is explicitly marked as future work in the Decision Log.

## Coverage

- Product contract, MVP boundary, baseline web concerns, and acceptance evidence are addressed.
- Design records available sources, maturity, responsive/accessibility baseline, and key states.
- Architecture records trust boundaries, data sensitivity, authorization, secrets, transport,
  output encoding, environments, delivery, rollback/backup relevance, and observability.
- Non-applicable template rows were removed; deferred relevant concerns remain visible.
- Every baseline web-app consideration remains visible, including justified `Not applicable` rows.

## Cleanup and Evidence

- All `Template Setup` sections and template-only comments are removed.
- No unresolved angle-bracket placeholders or TODO markers remain.
- `_docs/README.md` links every final guidance artifact and agent entrypoint.
- Mechanical validator passes with the project-specific docs-map and ADR paths.
- Completion report names checks run, results, remaining provisional items, and missing proof.

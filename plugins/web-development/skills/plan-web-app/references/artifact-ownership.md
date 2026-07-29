# Artifact Ownership

Use one canonical owner for each concern. Other documents may summarize and link, but must not
become competing sources of truth.

| Concern | Canonical artifact | Allowed references elsewhere |
| --- | --- | --- |
| Product definition, users, MVP proof, scope | `ROADMAP.md` | Design/Architecture may restate one sentence for context |
| Delivery phases, progress, milestones, post-MVP product work | `ROADMAP.md` | `AGENTS.md` may define process, not schedule |
| Open and deferred product decisions | `ROADMAP.md` Decision Log | Other docs link to the item |
| Executable tasks, bugs, and technical-debt work when GitHub tracking is enabled | GitHub Issues | Roadmap may link phase-level work only on explicit developer request |
| Operational task status and priority when GitHub tracking is enabled | Linked GitHub Project | Issues and pull requests link to the Project; Roadmap does not mirror routine state |
| Issue intake fields | `.github/ISSUE_TEMPLATE/` | `AGENTS.md` defines when agents may create Issues |
| Pull request review, verification, and Issue closure linkage | Pull request and `.github/pull_request_template.md` | Durable results flow back to code and affected guidance |
| Experience direction and UX principles | `DESIGN.md` | Roadmap keeps only product-level direction |
| Design inputs, foundations, screens, components, QA status | `DESIGN.md` | Exact values live in design/code sources |
| Route scope | `ROADMAP.md` | `DESIGN.md` owns layout/interaction; Architecture owns implementation |
| System topology, boundaries, ownership, runtime, operations | `ARCHITECTURE.md` | Roadmap summarizes planning direction |
| Exact API/event/data contracts | Focused specs, schema, generated contracts, or code | Architecture indexes the canonical source |
| Significant technical rationale | `_docs/decisions/README.md` | Architecture indexes accepted ADRs |
| Agent workflow, commands, approvals, repository rules | `AGENTS.md` and linked rule files | `CLAUDE.md` imports `AGENTS.md`; other docs do not duplicate operating policy |
| Claude Code project entrypoint | `CLAUDE.md` | Thin adapter only; canonical shared instructions stay in `AGENTS.md` |
| Documentation navigation | `_docs/README.md` | Root README may link to the map |
| Current implemented behavior | Verified code/config/runtime | Update stale documentation after verification |

## Conflict Rules

1. Distinguish current behavior from intended direction before resolving a conflict.
2. For current behavior, verify code/configuration and the relevant runtime/environment.
3. For product intent, ask the developer when sources disagree; do not infer preference.
4. For visual intent, use the source marked authoritative for that concern. Screenshots do not
   define hidden states or responsiveness; HTML prototypes do not automatically define
   production architecture.
5. For significant technical direction, update or create an ADR after approval, then align
   `ARCHITECTURE.md` with the accepted result.
6. Do not silently preserve contradictory statements in different artifacts.
7. When GitHub tracking is enabled, do not copy every Issue into the Roadmap. If requested work
   conflicts with Roadmap scope or phases, ask the developer to resolve the conflict.

## Existing Projects

- Preserve useful native structure when it already has clear ownership.
- Map equivalent filenames instead of creating duplicate top-level documents.
- Merge around existing decisions and user changes; never erase history to fit the templates.
- Preserve Claude-specific instructions in an existing `CLAUDE.md`, but replace duplicated shared
  rules with an import of the canonical `AGENTS.md` when approved.
- Split a large Architecture or ADR registry only when scanability or concurrent edits justify it.
- Preserve and reconcile existing GitHub templates and Projects. Never create a parallel tracker
  without checking whether a suitable Project already exists.

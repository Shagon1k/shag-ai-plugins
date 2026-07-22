---
name: plan-web-app
description: Plan, align, or audit living project guidance for web apps through source-first discovery and gap-only questions. Use when starting a web app, onboarding an existing codebase, creating or repairing ROADMAP.md, DESIGN.md, ARCHITECTURE.md, AGENTS.md, CLAUDE.md, architecture decisions, or establishing coherent AI-ready project context.
---

# Plan Web App

Create a compact, internally consistent project guidance set for a web app. Reuse existing
evidence before asking questions, adapt depth to the project, and never manufacture certainty.

## Resource Map

Read these resources when their step begins:

- `references/artifact-ownership.md`: read before choosing outputs or resolving overlap.
- `references/setup-questionnaire.md`: read after source inspection; ask only uncovered items.
- `references/phase-planning.md`: read before creating or materially restructuring a multi-phase
  delivery plan.
- `references/validation-checklist.md`: read before final validation.
- `assets/*.template.md`: use as scaffolds, not text to copy blindly.
- `scripts/validate-project-guidance.mjs`: run after generating or aligning the documents.

## Output Contract

Default outputs:

| Output | Template | Purpose |
| --- | --- | --- |
| `ROADMAP.md` | `WEB_APP_ROADMAP.template.md` | Product contract, scope, delivery plan, progress, unresolved/deferred work |
| `DESIGN.md` | `DESIGN.template.md` | Experience direction, design sources, foundations, screens, components, design status |
| `ARCHITECTURE.md` | `ARCHITECTURE.template.md` | Current/proposed system structure, boundaries, data, runtime, operations |
| `AGENTS.md` | `AGENTS.template.md` | Cross-cutting instructions for coding agents |
| `CLAUDE.md` | generated import | Claude Code adapter that imports the canonical `AGENTS.md` |
| `_docs/decisions/README.md` | `ADR.template.md` | Significant architecture decisions and rationale |
| `_docs/README.md` | generated from final paths | Short task-oriented documentation map |

Retain an existing project path when it already has a clear equivalent. Record custom paths
consistently across all outputs and pass them to the validator.

Generate `CLAUDE.md` as the relative import of the final `AGENTS.md` path, normally:

```markdown
@AGENTS.md
```

Preserve any existing Claude-specific instructions below that import. Do not duplicate the
contents of `AGENTS.md` in `CLAUDE.md`.

## Run Modes and Output Depth

| Mode | Use when | Write behavior |
| --- | --- | --- |
| `Full setup` | New project or complete guidance setup/alignment | Create or align the full output contract |
| `Focused update` | The developer names specific artifacts | Update only those artifacts and necessary cross-links |
| `Audit` | The developer asks for findings or readiness review | Report gaps first; write only after approval |

`Full setup` is the default when the request is broad. Never expand a focused request into a full
rewrite without approval.

Match document depth to project state:

| Project state | Minimum useful depth |
| --- | --- |
| `Idea` | Product/MVP contract, baseline web concerns, first phase, proposed architecture baseline, minimal design direction |
| `Greenfield` | Idea baseline plus real repository commands, environments, initial boundaries, and delivery approach |
| `Existing` | Verified current behavior, source-backed status, identified drift, and proposed changes clearly separated from current state |

For a full setup, keep at least: Roadmap contract/scope/baselines/next phase/Decision Log; Design
maturity/sources/direction/foundation baseline; Architecture context/topology/data and trust
boundaries/environments/delivery; only real AGENTS rules and commands; and the docs map. When no
significant architecture decision exists, keep an empty ADR index with a short `No architecture
decisions recorded yet` note instead of inventing a decision.

## Workflow

### 1. Establish Scope and Preserve Existing Work

1. Inspect the target root and `git status --short` when Git exists.
2. Classify the run mode and project state as defined above.
3. Identify existing target documents and unrelated user changes.
4. Never overwrite an existing document blindly. Propose whether to preserve, merge, rename,
   or replace it, and get approval before a substantial replacement.
5. Keep this skill focused on project guidance. Do not scaffold application code, install
   dependencies, provision infrastructure, or deploy unless the user separately requests it.

### 2. Collect Existing Sources First

Ask the developer to share or point to relevant material that is not already accessible:

- product vision, requirements, issue trackers, roadmaps, and business rules;
- repositories, package manifests, schemas, APIs, diagrams, deployment/config files;
- Figma or other design-tool access, screenshots, HTML prototypes, reference sites, assets;
- existing agent instructions, command documentation, conventions, and decision records.

Inspect accessible sources before asking detailed questions. Build a compact source inventory:

| Source | Establishes | Authority / limitations | Gaps or conflicts |
| --- | --- | --- | --- |

Do not ask the developer to repeat facts already supported by a source. Never request secrets.

### 3. Map Coverage and Material Gaps

Read `references/artifact-ownership.md` and map each established fact to one canonical output.
Read `references/setup-questionnaire.md`, skip answered and non-applicable questions, then
collect only material gaps.

Treat these as valid answers:

- `Provisional`: a direction is useful but not approved.
- `Deferred`: relevant, intentionally postponed, and recorded with a revisit trigger.
- `Not applicable`: remove the row or section from final output, except that Roadmap baseline web
  concerns retain the row with a brief reason to prove the concern was considered.

For a design-light or idea-only project, propose conservative defaults and mark them draft or
proposed. Get developer approval before representing them as accepted, active, or approved.

### 4. Ask One Gap-Only Question Set

Ask grouped questions in one message whenever practical. Prioritize choices that block multiple
documents: product boundary, users, deployment target, data sensitivity, auth, design maturity,
and delivery constraints.

There is no minimum question count: ask zero when reliable sources already cover the material
decisions. Otherwise target 3-7 atomic questions in the first set, with a soft cap of 10. An
atomic question asks for one developer decision even when several questions share a topic
heading; do not hide independent decisions inside one numbered question to satisfy the cap.

If more than 10 material gaps remain, ask the highest-impact blockers first. Offer conservative
defaults for defaultable gaps and record deferrable gaps instead of extending the interview.
Ask another set only when the first answers leave or reveal blockers or source conflicts that
cannot safely be defaulted or deferred.

For each suggested default, state the trade-off briefly. Do not force optional concerns into the
project simply because a template contains them.

Stop asking when the artifact plan and minimum useful depth for the selected mode/state can be
produced without invented current state or accepted decisions, and every remaining material gap
is answered, approved as a default, or explicitly marked provisional/deferred with a revisit
condition.

### 5. Confirm the Artifact Plan

Before substantial writes, summarize:

- files to create or update;
- run mode and project state;
- existing content to preserve or merge;
- provisional and deferred decisions;
- custom paths;
- sections intentionally omitted.

Proceed after the developer confirms the plan. For a trivial greenfield planning run where all default
outputs were explicitly requested, a concise confirmation is enough.

### 6. Render and Align the Documents

Before creating or materially restructuring a multi-phase delivery plan, read
`references/phase-planning.md`.

Use the templates as section checklists and formatting scaffolds. Apply these rules:

1. Fill from verified sources first, approved answers second, and explicit provisional choices
   third.
2. Treat every numeric target, threshold, interval, limit, deadline, retention period, data
   constraint, and acceptance metric as a decision: it must be source-backed, explicitly approved,
   or visibly marked provisional/deferred.
3. Delete every `Template Setup` section, instruction-only comment, unused example, unresolved
   placeholder, and non-applicable row.
4. Keep exact token values, schemas, API payloads, and runtime configuration in their canonical
   machine-readable or focused sources; link rather than duplicate them.
5. Preserve the ownership boundaries in `references/artifact-ownership.md`.
6. Use identical names for the same domain concept, route, status, environment, and service in
   every document.
7. Record significant accepted technical choices in the ADR registry. Keep open/deferred work
   in the Roadmap Decision Log.
8. Generate `_docs/README.md` as a short task-oriented map linking every final document and any
   existing API, environment, testing, deployment, security, or runbook guides.
9. Generate or align `CLAUDE.md` as a thin import adapter for `AGENTS.md`; preserve any
   Claude-specific instructions below the import.
10. Ensure the final `AGENTS.md` contains artifact-specific documentation impact triggers and makes
   affected documentation part of the same implementation task.
11. Keep the final documents useful at their current maturity. Do not preserve empty scaffolding
   for hypothetical future complexity.
12. Give each delivery phase one independently verifiable outcome, visible dependencies, explicit
    exclusions, and evidence requirements. Split phases that bundle separable outcomes or cannot be
    reviewed coherently.
13. In every multi-phase Roadmap, state the progressive-elaboration policy: make the active or next
    phase implementation-ready, while keeping later phases precise enough for sequencing without
    inventing task-level detail.
14. For roadmaps longer than six delivery phases, propose a human verification and stabilization
    checkpoint after every five to six delivery phases, or record why another cadence is safer. These
    checkpoints supplement rather than replace ordinary tests and acceptance checks.
15. In every multi-phase Roadmap, state the temporary phase-document lifecycle: create one when the
    active phase needs transient implementation detail, link it from the docs map while active,
    consolidate durable facts into canonical guidance, and remove the temporary document and link
    when the phase closes. Do not create the file before that detail is needed.
16. When production deployment is in scope, keep release readiness, final human acceptance, and
    production deployment as three distinct acceptance boundaries; do not combine readiness evidence
    with the human go/no-go decision.

### 7. Validate

Read `references/validation-checklist.md` and perform its semantic checks.

Run:

```bash
node <skill-root>/scripts/validate-project-guidance.mjs <project-root>
```

For a focused update:

```bash
node <skill-root>/scripts/validate-project-guidance.mjs <project-root> \
  --only design,roadmap
```

For custom locations:

```bash
node <skill-root>/scripts/validate-project-guidance.mjs <project-root> \
  --agents <relative-path> \
  --claude <relative-path> \
  --roadmap <relative-path> \
  --design <relative-path> \
  --architecture <relative-path> \
  --docs-map <relative-path> \
  --adr <relative-path>
```

Fix failures before completion. If a check cannot run, name the missing evidence instead of
claiming success.

### 8. Report

Report:

- created and updated artifacts;
- run mode and project state;
- important decisions and intentional omissions;
- validation commands and results;
- provisional/deferred items requiring future attention;
- existing project material preserved unchanged.

## Guardrails

- Stay web-app focused but framework and backend-language agnostic.
- Prefer a modular monolith or similarly simple baseline until requirements justify more.
- Never treat frontend controls as an authorization boundary.
- Never place secrets, credentials, or production identifiers in generated documents.
- Do not rewrite accepted ADR history; supersede it with a new record.
- Do not commit, install, deploy, or mutate external systems without explicit authorization.
- Keep the shared workflow platform-neutral. Product-specific UI metadata belongs in adapter
  files such as `agents/openai.yaml`, not in generated project guidance.

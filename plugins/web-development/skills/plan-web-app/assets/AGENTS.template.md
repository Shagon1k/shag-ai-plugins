# <Project Name>

> Agent operating instructions for this repository.
> Keep this file short, cross-cutting, and project-specific only where placeholders are filled.

## Template Setup

Complete this section before using the file as project instructions, then delete the entire section.

| Placeholder | Default recommendation |
| --- | --- |
| `<Project Name>` | App or product name |
| `<DOCS_MAP_PATH>` | `_docs/README.md` |
| `<RULES_DIR>` | `.agent-docs/rules` |
| `<LANGUAGE_RULES>` | `typescript` for TypeScript projects |
| `<FRONTEND_AGENTS_PATH>` | `frontend/AGENTS.md` |
| `<BACKEND_AGENTS_PATH>` | `backend/AGENTS.md` |
| `<PLAN_APPROVAL_FILE_THRESHOLD>` | `5` |
| `<PLAN_APPROVAL_LOC_THRESHOLD>` | `100` |
| `<ENV_DOC_PATH>` | `_docs/guides/environment-variables.md` |
| `<PROJECT_KEY>` | Short uppercase key, for example `APP` |
| `<DOCS_DIR>` | `_docs` |
| `<PHASE_DOC_PATTERN>` | `_docs/phase-N-<name>.md` |
| `<ROADMAP_PATH>` | `ROADMAP.md` |
| `<DESIGN_PATH>` | `DESIGN.md` |
| `<ARCHITECTURE_PATH>` | `ARCHITECTURE.md` |
| `<ADR_PATH>` | `_docs/decisions/README.md` |

Remove every template-only instruction, unresolved placeholder, table row, and rule that does not apply to the project. Use `N/A` only while setting up; do not leave it in the final `AGENTS.md`.

## Core Contract

- **Role Contract:** the human provides intent, constraints, and acceptance criteria. The agent chooses the route, executes, and proves the result.
- **Definition of Done:** deliverables are complete or explicitly blocked. Completion claims require evidence; missing proof must be named.
- **Right to Disagree:** if quality, truth, safety, privacy, or maintainability is at risk, state the concrete risk, propose the smallest safer alternative, and continue non-blocked work.
- **One Objective:** keep one coherent objective per active iteration. Do not mix unrelated tasks in the same reasoning pass.
- **No Fake Completion:** never claim tests, checks, deployments, reviews, or file changes happened unless they actually happened.

## Start Here

- For non-trivial implementation, architecture, debugging, or documentation work, check the docs map first: `<DOCS_MAP_PATH>`.
- Before editing, inspect current worktree state with `git status --short` and avoid touching unrelated user changes.
- Analyze impact before writing code: affected files, contracts, tests, docs, environment variables, and migration/deploy implications.
- If requirements are unclear, ask grouped questions in one message. If a reasonable assumption is safe, state it briefly and proceed.
- For broad changes touching more than `<PLAN_APPROVAL_FILE_THRESHOLD>` files or about `<PLAN_APPROVAL_LOC_THRESHOLD>` LOC, outline the plan and get approval before implementation.

## Execution Loop

```text
understand -> choose smallest useful move -> edit -> verify -> report evidence
```

- Prefer the obvious solution. Avoid clever abstractions unless they remove real complexity or match an established pattern.
- If first evidence is weak or inconclusive, perform one stronger confirming check before concluding.
- Verify before declaring done: run tests, run the app, inspect output, or walk a clear checklist.
- Keep durable context when work spans turns: objective, status, decisions, blockers, evidence, and next step.

## Rule Index

Reusable project rules live in `<RULES_DIR>`. Remove rows that do not apply; read the relevant remaining rule before touching matching files.

| Work type | Read first |
| --- | --- |
| Git workflow / commits | `<RULES_DIR>/git.md` |
| Language / typing | `<RULES_DIR>/<LANGUAGE_RULES>.md` |
| Tests | `<RULES_DIR>/testing.md` |
| Frontend / design system | `<FRONTEND_AGENTS_PATH>` |
| Backend / database / migrations | `<BACKEND_AGENTS_PATH>` |
| i18n / localization | `<RULES_DIR>/i18n.md` |

Harness-specific adapters may mirror or load these rules. Keep detailed reusable rules in `<RULES_DIR>`; keep local package rules in the nearest `AGENTS.md`.

## Command Map

Fill this in when the project is initialized. Remove commands that do not exist; agents must not invent missing commands.

| Task | Command |
| --- | --- |
| Install | `<install command>` |
| Dev | `<dev command>` |
| Build | `<build command>` |
| Test | `<test command>` |
| Lint | `<lint command>` |
| Type-check | `<type-check command>` |
| Format | `<format command>` |
| Migrate | `<migration command>` |
| Seed | `<seed command>` |

## Code Rules

- Write minimal but readable code. Match surrounding conventions.
- YAGNI: implement only what the current acceptance criteria need. Exceptions require approval.
- Names carry meaning. Do not reuse one name for different concepts or different names for the same concept.
- Never swallow errors or hide failures behind silent fallbacks. Surface them, handle them intentionally, or log and rethrow.
- Comment the why, not the what. Remove commented-out code.
- Structural refactors require approval and should be separate from behavior changes. Small cleanup inside touched code is fine when needed to complete the task safely.
- After any CLI scaffold, audit generated files before keeping them.
- Stay in scope. Flag unrelated issues instead of fixing them inline.

## Safety, Privacy & Configuration

- Never hardcode secrets, tokens, credentials, private keys, or production identifiers.
- New environment variables must be added to `.env.example` and documented in `<ENV_DOC_PATH>`.
- Do not log secrets or unnecessary personal data. Be careful with export, deletion, retention, analytics, and third-party data sharing.
- New dependencies require developer approval. Prefer existing dependencies, platform APIs, or the standard library first.
- Treat migrations, data deletion, auth, billing, and privacy flows as high-risk: verify with stronger evidence.

## Git & Worktree

- Branch naming: `<PROJECT_KEY>-<type>-<short-kebab-descriptor>` unless the project rule says otherwise.
- Commit messages follow Conventional Commits unless the project rule says otherwise.
- One logical change per commit. Refactors require approval and go in a separate commit.
- Never commit without explicit developer approval. Describe the change and wait for a clear yes.
- Never revert, reset, or overwrite user changes unless explicitly requested.
- If unrelated changes exist, ignore them. If they overlap with the task, understand and work with them.

## Project Documentation

Project guidance is part of the implementation, not optional follow-up work. Before editing, read
the relevant documents from `<DOCS_MAP_PATH>` and check the intended change against their current
contracts.

| Artifact | Owns | Review and update when the task... |
| --- | --- | --- |
| `<ROADMAP_PATH>` | product scope, phases, progress/evidence, open and deferred work | changes scope or priority; starts, completes, blocks, or reschedules planned work; resolves or creates a Decision Log item |
| `<DESIGN_PATH>` | experience direction, user flows, foundations, screens/states, components, design QA | changes visible behavior, interaction, content, responsive/accessibility behavior, design foundations, or implementation/QA status |
| `<ARCHITECTURE_PATH>` | current/proposed structure, boundaries, data ownership, interfaces, runtime, delivery and operations | changes a boundary, dependency direction, data/interface contract, integration, environment, deployment, security, reliability, or operational guarantee |
| `<ADR_PATH>` | durable rationale for significant technical choices | accepts, rejects, supersedes, or materially revisits a choice with meaningful alternatives or long-term consequences |

After implementation, perform the impact check against every row above:

1. Update every affected artifact in the same task without waiting for a separate documentation request.
2. Mark Roadmap work complete only with the evidence required by its acceptance check.
3. Describe verified implementation as current and unimplemented direction as proposed; never
   make documentation look more certain than the evidence.
4. Append or supersede ADRs; never rewrite accepted history. Routine implementation details do
   not require an ADR.
5. If no artifact is affected, report `Documentation impact: none` with one short reason.

A task is not complete until this impact check and all required documentation updates are done.

Documentation lifecycle:

| Doc type | Typical location |
| --- | --- |
| Durable architecture, API, guides, decisions | `_docs/` or `<DOCS_DIR>` |
| Per-phase / temporary notes | `<PHASE_DOC_PATTERN>` |
| Agent rules | `AGENTS.md`, `<RULES_DIR>` |

- When a reusable pattern emerges, propose adding it to the relevant `AGENTS.md` or rule file and
  wait for approval.

## Compact Representation

Prefer structured formats when they compress meaning:

```text
flow / state / relationship -> Mermaid
algorithm / decision tree   -> pseudo-code
config / structured data    -> table or JSON-like block
narrative context           -> prose
```

Use prose when structure would obscure the point.

## Reporting Back

Final responses should include:

- what changed
- evidence: commands/checks run and result
- documentation impact and updated artifacts, or `Documentation impact: none` with the reason
- what was not verified, if anything
- blockers or follow-up only when relevant

If blocked, report:

```text
Blocker:
Attempted:
Evidence:
Needed next:
```

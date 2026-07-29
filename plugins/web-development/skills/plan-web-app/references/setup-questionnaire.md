# Gap-Only Setup Questionnaire

Use this as a coverage checklist after inspecting existing sources. Ask only unanswered,
material questions. Combine them into one grouped message when practical.

## Product and Scope

- What is the product, who is it for, and what outcome does it create?
- What must the MVP prove? What is explicitly not part of MVP?
- What is the primary user loop and which business rules or limits shape it?
- Which decisions are fixed, provisional, or intentionally deferred?

## Delivery

- Is the project an idea, a greenfield repository/build, or an existing app? For an existing app,
  which areas are partial, established, or known to be stale?
- Are there deadlines, budget, hosting, legal, team, or operational constraints?
- What phases or dependencies are already known? What evidence defines phase completion?
- Which post-MVP ideas are worth preserving without scheduling now?

## Architecture

- What repository, deployables, runtime topology, and stack already exist or are preferred?
- Where will the app run locally, in test/staging, and in production?
- What data is stored, who owns it, and how sensitive is it?
- Does the app need authentication, roles, tenant boundaries, billing, uploads, or admin access?
- Which APIs, events, jobs, webhooks, real-time channels, or external providers are needed?
- What reliability, scale, performance, backup, rollback, and observability expectations matter?
- Which choices have meaningful alternatives and should become ADRs?

## Design

- What design inputs exist: Figma/MCP, screenshots, HTML prototypes, references, assets, code?
- Which source is authoritative for visual style, interaction, content, and responsiveness?
- Is design maturity minimal, partial, or detailed? May UI-library defaults be the baseline?
- Which devices, input methods, locales, accessibility target, and browser coverage matter?
- Are color, typography, spacing, layout, motion, imagery, and shared components defined?
- Which screens or states remain undefined: loading, empty, error, permission, success?

## Agent and Repository Workflow

- What commands install, run, build, test, lint, type-check, format, migrate, and seed?
- Which rule files or package-level `AGENTS.md` files already exist?
- What plan/approval threshold and dependency policy should agents follow?
- What Git/branch/commit policy applies? Must commits always require explicit approval?
- Where should durable docs, temporary phase notes, environment docs, and decisions live?

## Optional GitHub Work Tracking

When the repository is hosted on GitHub, read `github-workflow.md` and ask one profile question:

- `Skip`: leave GitHub templates, Projects, and work-tracking rules unchanged.
- `Standard`: apply the baseline Issue forms, pull request template, Board, fields, and ownership
  rules without another questionnaire.
- `Customize`: ask only for deviations through the mini-questionnaire in that reference.

Default to `Skip` when unanswered. Do not infer permission to mutate GitHub from the existence of a
remote. For an existing GitHub setup, inspect current templates and linked Projects before asking
the profile question.

## Conditional Checks

Ask only when relevant:

- Public/indexable pages: SEO, metadata, sitemap, robots, structured/share data.
- Personal or regulated data: consent, retention, export, deletion, audit, legal review.
- Payments: provider ownership, webhook trust, idempotency, refunds, tax/invoice handling.
- Async or AI work: queues, retries, cancellation, moderation, cost/rate limits, observability.
- PWA/offline/push: installability, cache ownership, sync/conflict behavior, permissions.
- Multi-tenant systems: tenant isolation, admin boundaries, data migration and deletion.

## Question Rules

- Classify each uncovered item before asking:

| Gap type | Action |
| --- | --- |
| `Blocking` | Ask now; it prevents a coherent artifact plan or affects multiple outputs. |
| `Defaultable` | Offer a conservative default with its trade-off. |
| `Deferrable` | Record it as deferred with an owner or revisit trigger; do not ask now. |
| `Not applicable` | Skip it; retain only the required Roadmap baseline row with a reason. |

- Do not ask a question already answered by a reliable source.
- Ask for inaccessible sources before asking the developer to transcribe them.
- Offer a conservative default when several choices are reasonable; state its trade-off.
- Do not force optional sophistication into a small app.
- Keep unanswered relevant items visible as provisional or deferred; never disguise them as done.
- Count atomic decisions, not topic headings. One numbered question must not contain several
  independent decisions merely to stay under the budget.
- Ask zero questions when no material gaps remain. Otherwise target 3-7 atomic questions and use
  10 as a soft cap for the first set.
- When the cap would be exceeded, ask the highest-impact blockers first; default or defer the rest.
  Ask another set only for blockers or source conflicts that remain after the answers are mapped.

Stop when all remaining material gaps are answered, approved as defaults, or explicitly
provisional/deferred, and the artifact plan can be proposed at the selected mode/state depth
without inventing current behavior or accepted decisions.

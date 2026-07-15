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

## Conditional Checks

Ask only when relevant:

- Public/indexable pages: SEO, metadata, sitemap, robots, structured/share data.
- Personal or regulated data: consent, retention, export, deletion, audit, legal review.
- Payments: provider ownership, webhook trust, idempotency, refunds, tax/invoice handling.
- Async or AI work: queues, retries, cancellation, moderation, cost/rate limits, observability.
- PWA/offline/push: installability, cache ownership, sync/conflict behavior, permissions.
- Multi-tenant systems: tenant isolation, admin boundaries, data migration and deletion.

## Question Rules

- Do not ask a question already answered by a reliable source.
- Ask for inaccessible sources before asking the developer to transcribe them.
- Offer a conservative default when several choices are reasonable; state its trade-off.
- Do not force optional sophistication into a small app.
- Keep unanswered relevant items visible as provisional or deferred; never disguise them as done.

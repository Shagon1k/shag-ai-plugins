# <Project Name> — Web App Roadmap

> Default roadmap template for web apps.
> This is a planning contract, not a historical archive: keep current decisions here,
> move lasting implementation details into durable docs.

## Template Setup

Complete this section with the developer before using the file as project guidance, then
delete the entire section.

1. Ask for existing product notes, requirements, designs, architecture docs, code, issue
   trackers, and prior roadmaps before asking detailed questions.
2. Inspect available sources and prefill the product contract, scope, constraints, decisions,
   and completed work they establish.
3. Identify conflicts and material gaps. Ask one grouped set of questions only for missing
   information; do not make the developer repeat existing sources.
4. Mark uncertain direction explicitly instead of inventing precision.
5. Keep product/delivery intent here. Link technical detail to `<ARCHITECTURE_PATH>`, UX detail
   to `<DESIGN_PATH>`, and significant technical rationale to `<ADR_PATH>`.

| Related artifact | Project path |
| --- | --- |
| Design reference | `<DESIGN_PATH>` |
| Architecture reference | `<ARCHITECTURE_PATH>` |
| ADR registry | `<ADR_PATH>` |

Remove this setup section, unresolved placeholders, examples, and non-applicable rows from
the final `ROADMAP.md`. Preserve every Baseline Web App Consideration row, including items marked
`Not applicable`, so the decision remains visible. Preserve relevant unknowns in the Decision Log.

## 1. Project Contract
> Defines what the product is, who it serves, what MVP proves, and what is intentionally out.

| Field | Value |
| --- | --- |
| Product | <one-sentence product definition> |
| Primary users | <who this is for> |
| Core outcome | <what must become true for users> |
| MVP proof | <what the MVP must prove> |
| Non-goals | <what is explicitly out of scope> |

## 2. Product Shape
> Captures the user loop, product differentiation, and UX/brand direction before implementation details.

### Core Loop
```text
<step> -> <step> -> <step> -> <outcome>
```

### Key Differentiators
- <why this product is meaningfully better/different>
- <what users would miss if it disappeared>

### Brand & UX Direction
| Area | Decision |
| --- | --- |
| Visual identity | <palette, mood, mascot, typography, or "system-default"> |
| Voice & tone | <where personality appears, where copy stays plain> |
| UX principle | <the product-specific rule that guides screens and flows> |

## 3. MVP Scope
> Draws the product boundary: what ships now, what is explicitly out, and where deferred work lands.

### IN
- <capability>
- <capability>

### OUT
| Item | Why out | Target |
| --- | --- | --- |
| <item> | <reason> | Post-MVP / later phase / never |

## 4. Baseline Web App Considerations
> Checklist of web-app concerns that must be planned, deferred, covered, or ruled out.

> Every item must be consciously planned, deferred, marked covered, or marked not applicable.
> Do not turn all items into implementation phases by default.

| Status | Meaning |
| --- | --- |
| `Needs decision` | No safe answer exists yet; identify the owner or next check. |
| `Planned` | A direction is chosen but not yet completed. |
| `Covered` | Already implemented or otherwise satisfied; link evidence in the note. |
| `Deferred` | Intentionally postponed with a revisit trigger. |
| `Not applicable` | Does not apply to this product; retain the row and state why. |

| Area | Default question | Status | Decision / note |
| --- | --- | --- | --- |
| Infrastructure & Foundation | How are repo layout, local dev, scripts, CI, containers, and base architecture handled? | Needs decision |  |
| Users & Authentication | Does the app need users, roles, sessions, OAuth, permissions, or anonymous mode? | Needs decision |  |
| Design System | How do UI primitives, layout, styling, tokens, and component rules stay consistent? | Needs decision |  |
| Localization | Is the product single-language, multilingual now, or multilingual-ready later? | Needs decision |  |
| Analytics & Monitoring | How will we know usage, errors, latency, job health, and outages? | Needs decision |  |
| SEO | Does the app have public/indexable pages, metadata, sitemap, robots, and share previews? | Needs decision |  |
| Security | What are the auth, validation, secrets, rate limits, headers, abuse, and data-protection rules? | Needs decision |  |
| Testing & Quality Gates | How will behavior be verified: unit, integration, E2E, visual checks, manual QA, and CI gates? | Needs decision |  |
| Data & Privacy | What personal data is stored, exported, deleted, retained, and shared with third parties? | Needs decision |  |
| Mobile Support | Is mobile first-class, best-effort, explicitly unsupported, or only checked before launch? | Needs decision |  |
| PWA / installability | Does the app need offline support, installability, push notifications, or app-like shell behavior? | Needs decision |  |
| Environments & Production Deploy | What are dev/UAT/prod profiles, env vars, migrations, deploy triggers, rollback, and smoke checks? | Needs decision |  |

## 5. Business, Product & Monetization Rules
> Captures rules that shape behavior, access, limits, pricing, and policy beyond pure data structure.

| Rule | Rationale | Enforcement |
| --- | --- | --- |
| <rule> | <why it exists> | Code / policy / manual process |

### Pricing / Limits
| Feature / limit | Free | Paid / higher tier |
| --- | --- | --- |
| <limit> | <value> | <value> |

## 6. Glossary
> Canonical vocabulary for domain concepts; prevents naming drift across code, docs, API, and UI.

> Names carry meaning. Use the same concept names across code, docs, API, and UI.

| Term | Meaning | Canonical usage |
| --- | --- | --- |
| <Term> | <definition> | <code/docs/API/UI name> |

## 7. Domain Model & State
> Describes the main entities, ownership boundaries, constraints, and lifecycle/state transitions.

Keep this at product-planning level. Link exact schemas, storage decisions, and implemented
state handling to `<ARCHITECTURE_PATH>`.

### Domain Model
| Entity | Key fields | Notes |
| --- | --- | --- |
| <Entity> | <important fields> | <ownership, constraints, lifecycle> |

### State Machines
```mermaid
stateDiagram-v2
  [*] --> <State>
```

## 8. Navigation & Route Map
> Defines the main navigation model, entry points, route ownership, and user landing behavior.

This table owns route scope. Keep detailed layout, interaction, and responsive behavior in
`<DESIGN_PATH>`.

### Navigation Decisions
| Surface | Decision |
| --- | --- |
| Public header | <links / CTA> |
| Private header | <links / account / notifications> |
| Post-login routing | <where users land and why> |

### Route Map
| Route | Description |
| --- | --- |
| `/` | <landing / app entry> |

## 9. Architecture Decisions
> Summarizes technical direction needed for planning. Current structure belongs in
> `<ARCHITECTURE_PATH>`; durable rationale belongs in `<ADR_PATH>`.

| Area | Planning decision | State | Architecture / ADR reference |
| --- | --- | --- | --- |
| Frontend | <runtime, rendering, routing, styling direction> | Proposed / Active | <reference> |
| Backend | <runtime, interface, module direction> | Proposed / Active | <reference> |
| Database | <store and migration direction> | Proposed / Active | <reference> |
| Jobs / async | <queue, scheduler, workers, or none> | Proposed / Active | <reference> |
| Storage | <object storage, CDN, uploads, or none> | Proposed / Active | <reference> |

## 10. External Integrations
> Tracks provider scope and planning status. Keep exact data exchange, failure handling,
> configuration, and trust boundaries in `<ARCHITECTURE_PATH>`.

| Provider / capability | Purpose | MVP status | Architecture reference |
| --- | --- | --- | --- |
| <Provider or undecided capability> | <why needed> | Planned / Deferred / Active | <reference> |

## 11. Phase Plan
> Breaks the roadmap into executable slices with acceptance checks and evidence requirements.

> Each phase needs acceptance criteria before work starts and evidence before completion is claimed.

### Phase 0 — <Name> <status>
**Goal:** <single outcome>

**Scope:**
- [ ] <task>
- [ ] <task>

**Acceptance Check:**
- [ ] <observable result>
- [ ] <test, manual check, screenshot, log, or deployed behavior>

**Evidence:**
- <commands run, docs updated, screenshots, logs, or missing proof>

**Deliverables:** <code/docs/config/user-facing change>

**Out of scope:** <explicit exclusions>

## 12. Decision Log
> Keeps unresolved and intentionally deferred decisions in one place without mixing their states.

### Open Questions
> Unknowns that still need an answer before the project can safely decide or proceed.

| Question | Owner | Needed by | Next check |
| --- | --- | --- | --- |
| <question> | <person/role> | <phase/date> | <action> |

### Deferred Decisions & Tech Debt
> Known issues, alternatives, or tradeoffs intentionally postponed with a current stance.

| # | Item | Context | Current stance | Revisit trigger |
| --- | --- | --- | --- | --- |
| 1 | <item> | <why it exists> | <accepted approach for now> | <when> |

## 13. Post-MVP Backlog
> Stores valuable but unscheduled work without pretending it is part of MVP scope.

| Item | Value | Dependencies | Priority |
| --- | --- | --- | --- |
| <feature> | <why it matters> | <what must exist first> | High / Medium / Low |

## 14. Progress Tracking
> Summarizes phase status and links each completion claim to evidence.

| Phase | Status | Evidence | Notes |
| --- | --- | --- | --- |
| 0 — <Name> | Not started |  |  |

Status: `Not started` · `In progress` · `Done` · `Blocked` · `Needs approval`

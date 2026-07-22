# Phase Planning

Use this reference when creating or materially restructuring a Roadmap phase plan. The goal is a
credible delivery sequence, not a maximally granular task list.

## Phase Unit

A delivery phase should produce one independently verifiable outcome. A good phase:

- leaves the product or platform in a coherent, reviewable state;
- has dependencies that are already available or explicitly named;
- can be accepted through observable behavior and concrete evidence;
- is narrow enough that a failed assumption does not invalidate several unrelated capabilities;
- includes the code, design, documentation, migration, and operational work required for its outcome.

Prefer vertical product slices when they can be completed safely. Use foundation phases only when
later slices genuinely depend on shared infrastructure, contracts, or UI primitives.

Split a phase when one or more of these signals appear:

- its goal joins multiple outcomes with `and`;
- major scope items could ship, fail, or be verified independently;
- it spans unrelated user journeys, trust boundaries, or integrations;
- its acceptance check is really a list of separate feature acceptances;
- reviewers cannot understand the blast radius or evidence in one pass;
- progress would remain `In progress` across several meaningful milestones.

Do not split solely to make the phase count larger. Keep tightly coupled work together when separating
it would create unusable intermediate states or duplicate setup and verification.

## Phase Contract

For every delivery phase record:

- **Goal:** the single outcome that becomes true;
- **Dependencies:** earlier phases, decisions, providers, or prerequisites;
- **Scope:** the capability-level work required for the outcome;
- **Acceptance Check:** observable conditions for accepting the phase;
- **Evidence:** tests, commands, screenshots, logs, review records, or deployed behavior required;
- **Deliverables:** code, documents, configuration, migrations, or user-facing changes;
- **Out of scope:** explicit exclusions that prevent phase creep.

Keep endpoint inventories, file lists, exact schemas, and low-level implementation tasks in the active
phase document, Architecture, or code—not in every future Roadmap phase.

## Dependencies and Sequence

Order phases by real dependency and risk, not by document section order. In particular:

1. Establish only the foundation required for the first product slice.
2. Prove high-risk integrations and state transitions before building dependent polish.
3. Put authorization, privacy, billing, destructive data flows, and migrations behind stronger checks.
4. Keep shared history, analytics, and notifications after the events and data they consume exist.
5. Separate release readiness, final human acceptance, and production deployment when deployment is
   part of the plan; each has a different acceptance boundary and rollback risk.

Call out intentional exceptions. A phase dependency may be a decision or external readiness item, not
only another numbered phase.

## Progressive Elaboration

Keep the complete MVP sequence visible, but increase detail only as work approaches:

- **Active/next phase:** implementation-ready scope, concrete acceptance, evidence plan, known risks,
  and decisions required before work starts.
- **Near-term phases:** stable outcome, dependencies, capability-level scope, and acceptance boundary.
- **Later phases:** credible outcome and ordering without speculative file, endpoint, or task detail.

When the active phase needs more detail, create a temporary document such as
`_docs/phase-N-short-name.md` and link it from the docs map. It may own transient implementation notes,
task breakdown, test matrix, rollout steps, issue register, and working decisions. It does not replace
Roadmap, Design, Architecture, ADRs, or durable guides.

At phase completion:

1. Record completion evidence in the Roadmap.
2. Consolidate durable product, design, architecture, operational, and decision information into its
   canonical owner.
3. Remove the temporary phase document and its docs-map link unless it has lasting independent value.

## Human Verification and Stabilization

For a roadmap longer than six delivery phases, propose a dedicated human verification and bug-fixing
checkpoint after every five to six delivery phases. Adjust the cadence for risk, team size, and release
shape, and state the rationale when using a different cadence. Do not count stabilization checkpoints as
delivery phases when measuring the interval.

A checkpoint should exercise all completed slices together and may include:

- primary and edge-case user journeys with realistic roles and data;
- responsive, accessibility, content, empty/error/loading, and cross-browser review as applicable;
- regression, integration, security, privacy, migration, and operational checks relevant to the slice;
- documentation and design-to-implementation drift review;
- a severity-labelled issue register with evidence and disposition.

Default exit rule: all Blocker and Major findings are fixed and re-verified. Minor and Polish findings
may be deferred only with an explicit owner or target, rationale, and revisit trigger. Adapt severity
names if the project already has an equivalent taxonomy.

A stabilization checkpoint never replaces per-phase automated tests, manual acceptance, code review,
or evidence. It is the cross-slice human review that catches interaction and accumulated-quality issues.

## Status and Evidence

Use one consistent status vocabulary. Mark a phase complete only when its acceptance checks pass and
its required evidence exists. If proof is incomplete, keep the phase active or blocked and name the
missing evidence. Link progress-table claims to the phase evidence or durable verification record.

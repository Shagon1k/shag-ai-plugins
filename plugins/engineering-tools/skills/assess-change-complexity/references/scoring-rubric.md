# Complexity scoring rubric

Use this rubric after building a likely change sketch. Score the implementation shape, not the
business value or desired delivery date.

## Shared scale

| Score | Label | General meaning |
| ---: | --- | --- |
| 1 | XS | Local, established, and readily reversible |
| 2 | S | Contained and well understood |
| 3 | M | Standard engineering work with some decisions |
| 4 | L | Broad or unfamiliar work with material risk |
| 5 | XL | Multiple substantial complexity drivers or difficult change |
| 6 | XXL | Architectural, cross-system, or highly uncertain change |

## 1. Change breadth

Measure the implementation surface. Use components, layers, repositories, and likely files as
evidence for this one dimension rather than scoring those signals separately.

| Score | Anchor |
| ---: | --- |
| 1 | One local symbol or tiny configuration/copy change in one component |
| 2 | One contained component or layer with no cross-cutting behavior |
| 3 | Two or three components across two layers using established boundaries |
| 4 | A substantial vertical slice across three or four layers, or several shared components |
| 5 | Multiple subsystems, a full-stack workflow, or a cross-cutting concern with wide reach |
| 6 | Multiple services or repositories, shared platform changes, or an architectural boundary shift |

## 2. Technical novelty

Measure how much design discovery is needed, independent of how many places change.

| Score | Anchor |
| ---: | --- |
| 1 | An exact precedent exists and can be adapted mechanically |
| 2 | A familiar pattern needs a small variation |
| 3 | Standard implementation with a few normal design choices |
| 4 | No close precedent, a substantial refactor, or competing approaches need evaluation |
| 5 | A proof of concept or architectural decision is likely before implementation |
| 6 | Research is required and core feasibility or architecture remains unresolved |

## 3. Integrations and dependencies

Measure boundary and compatibility work. Score reliability, security, or performance consequences
under Quality and operational risk only when those consequences are independently present.

| Score | Anchor |
| ---: | --- |
| 1 | No dependency, package, protocol, or external contract changes |
| 2 | Existing dependency or integration used through an unchanged, familiar contract |
| 3 | One stable new dependency or a contained contract adaptation |
| 4 | One new external service, multiple dependency changes, or compatibility work |
| 5 | Multiple new integrations, a major upgrade, or unstable/poorly understood contracts |
| 6 | Ecosystem migration, custom/forked dependency, or several cross-organization contracts |

## 4. Data and state change

Measure persistent data, lifecycle, consistency, and migration complexity.

| Score | Anchor |
| ---: | --- |
| 1 | No persistent state or contract-shape change |
| 2 | Additive field or configuration change with no migration |
| 3 | Simple reversible schema/state change or additive migration |
| 4 | Backfill, non-trivial state machine, compatibility window, or coordinated schema migration |
| 5 | High-volume, destructive, or difficult-to-reverse migration with consistency concerns |
| 6 | Irreversible or regulated data change, or cross-system consistency/cutover problem |

## 5. Quality and operational risk

Measure concrete security, privacy, performance, reliability, compliance, observability, and
blast-radius requirements. A keyword alone is not evidence of a high score.

| Score | Anchor |
| ---: | --- |
| 1 | No material non-functional impact; failure is local and rollback is trivial |
| 2 | Standard controls on a non-critical path |
| 3 | Measurable non-functional requirements, observability, or guarded rollout is needed |
| 4 | Auth/security-sensitive work, a performance-critical path, or material availability risk |
| 5 | Compliance, high availability, sensitive data, or a large production blast radius |
| 6 | Safety/financial criticality, extreme SLA, strict regulatory exposure, or credible data-loss risk |

## 6. Delivery coordination and reversibility

Measure sequencing, ownership, deployment, and rollback complexity rather than code breadth.

| Score | Anchor |
| ---: | --- |
| 1 | One owner, atomic release, trivial rollback |
| 2 | One team and one normal release path |
| 3 | Sequenced code/config/docs/tests or a feature flag is needed |
| 4 | Multiple owners or environments require a coordinated deployment and rollback plan |
| 5 | Multiple teams or release trains, an externally visible cutover, or difficult rollback |
| 6 | Cross-organization scheduling, irreversible cutover, or tightly coupled multi-system release |

## Baseline total mapping

Add all six scores only after scoring them independently.

| Total | Size |
| ---: | --- |
| 6–9 | XS |
| 10–14 | S |
| 15–20 | M |
| 21–26 | L |
| 27–31 | XL |
| 32–36 | XXL |

Self-checks: six M scores total 18 (M); six L scores total 24 (L); six XL scores total 30 (XL).

The total is an ordinal routing heuristic, not a mathematical effort estimate. Apply driver
guardrails after mapping the total so a concentrated extreme driver cannot be diluted by five
simple dimensions.

## Driver guardrails

Calculate a driver floor from the dimension profile:

| Profile | Minimum final size |
| --- | --- |
| Any one dimension is XL (5) | M |
| Any one dimension is XXL (6) | L |
| Two or more dimensions are XL+ (5–6) | XL |
| Two or more dimensions are XXL (6) | XXL |

Apply the strongest matching rule. The final size is the higher of the baseline size and the
driver floor. Report both when the floor raises the result.

Examples:

- `1, 2, 1, 1, 6, 2` totals 13 (baseline S), but the XXL operational-risk driver makes the final
  size L.
- `4, 4, 2, 5, 5, 5` totals 25 (baseline L), but multiple XL+ drivers make the final size XL.

Guardrails express concentrated complexity, not extra points. Do not modify the total after
applying them.

## Minimum anchors

Use these anchors to prevent obvious understatement. Apply each underlying fact once; do not add
extra “red flag points” after the fact is already represented.

- New external service: Integrations and dependencies is at least L.
- Change spanning multiple services or repositories: Change breadth is at least XL.
- Backfill or coordinated data migration: Data and state change is at least L.
- Destructive or difficult-to-reverse migration: Data and state change is at least XL.
- Authentication, authorization, or security-sensitive operation: Quality and operational risk
  is at least L.
- Material compliance or regulated-data requirement: Quality and operational risk is at least XL.
- Proof of concept required to establish feasibility: Technical novelty is at least XL.

These are floors, not automatic final scores. Raise a dimension further only when additional
evidence matches a higher anchor.

## Confidence rating

Rate the evidence behind the assessment after calculating size:

| Confidence | Criteria |
| --- | --- |
| High | Acceptance criteria and relevant code patterns were inspected; assumptions are minor |
| Medium | Some evidence is missing, but the likely design and complexity band are stable |
| Low | Requirements, feasibility, architecture, or boundaries remain open enough to shift several scores |

Missing or conflicting requirements lower confidence; they do not automatically make the
implementation itself more complex. When two unresolved choices create materially different
implementations, show scenario scores such as “M if the existing provider is reused; XL if a new
provider and migration are required.”

## Calibration rules

- Do not equate complexity with effort, duration, priority, or business value.
- Do not use exact file count as a proxy across languages or architectures.
- Compare with completed local work when historical assessments exist, then adjust the rubric or
  team interpretation based on repeated evidence rather than one outlier.
- Reassess after discovery, architecture decisions, or story splitting; do not divide a parent
  total among child stories.
- Use project calibration as a comparison layer. Never silently change this rubric, its totals, or
  its driver guardrails from a small number of local outcomes.

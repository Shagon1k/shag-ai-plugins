---
name: assess-change-complexity
description: Assess proposed software changes—including features, stories, tickets, refactors, migrations, and integrations—with an evidence-backed XS–XXL implementation-complexity score, driver guardrails, and a separate confidence rating. Use when the user asks to size or estimate engineering work, compare alternatives, identify complexity drivers or unknowns, decide whether work is ready to plan, calibrate assessments against completed work, or split an oversized change. Not a calendar-time or effort commitment.
---

# Assess Change Complexity

Produce a repeatable implementation-complexity assessment grounded in the request and, when
available, the actual codebase. Keep complexity, uncertainty, and elapsed-time estimates distinct.

## Workflow

### 1. Establish the assessment target

- Read the request, acceptance criteria, constraints, and linked design material.
- Read repository instructions and the smallest useful set of architecture, manifest, and source
  files when code is available.
- Identify the target system and scope boundary. State when the assessment covers only part of a
  larger change.
- Ask only questions that would materially change the result. Otherwise continue with explicit
  assumptions and mark the assessment provisional when necessary.

Look for an existing project calibration file using the path rules in
[references/calibration.md](references/calibration.md). Read it only when it applies to the target
team or repository. Do not create or update calibration data during an ordinary assessment.

An assessment request is read-only unless the user also asks to plan, implement, configure
calibration, or record a completed outcome.

### 2. Build an evidence-based change sketch

Before scoring, outline the likely changes:

- components, layers, services, repositories, and contracts involved;
- persistent data or state transitions;
- new or changed dependencies and integrations;
- security, performance, reliability, compliance, and rollout constraints;
- likely coordination, sequencing, and rollback needs.

Search for the closest existing implementation pattern. Treat file and directory counts as
supporting evidence for breadth, not as their own score. Distinguish observed facts from inferred
changes, and do not invent paths or exact file counts.

### 3. Calculate baseline size and apply driver guardrails

Read [references/scoring-rubric.md](references/scoring-rubric.md) before scoring. Assign each
dimension a value from 1 (XS) through 6 (XXL):

1. Change breadth
2. Technical novelty
3. Integrations and dependencies
4. Data and state change
5. Quality and operational risk
6. Delivery coordination and reversibility

Score each dimension independently from evidence. Do not count the same fact twice. Add the six
scores to obtain the baseline size, then apply the rubric's driver guardrails. The final size is
the higher of the baseline size and the driver floor. Always disclose when a guardrail changes the
result.

Calculate directly from the rubric, or use the optional bundled calculator when Node.js is
available:

```bash
node <skill-root>/scripts/calculate-score.mjs <breadth> <novelty> <integrations> <data> <operations> <delivery>
```

Arguments may be scores (`1`–`6`) or labels (`XS`–`XXL`). Add `--json` for structured output.

### 4. Rate assessment confidence separately

Requirements clarity changes confidence, not the numeric dimension scores:

- **High** — acceptance criteria and relevant code patterns are available; assumptions are minor.
- **Medium** — some details or code evidence are missing, but the likely implementation shape is
  stable.
- **Low** — requirements conflict or remain substantially open, the architecture is unknown, or
  missing evidence could move multiple dimensions.

For Medium or Low confidence, list the missing facts most likely to change the score. Use a range
only when a concrete unresolved decision creates distinct scenarios; explain both endpoints.

### 5. Recommend a driver-aware next step

Apply these rules in priority order; mention secondary reviews when several apply:

| Condition | Default next step |
| --- | --- |
| Low confidence | Clarify requirements or run a discovery spike, then reassess |
| Final size XL–XXL | Split the change or run discovery before implementation planning |
| Technical novelty L+ | Resolve the design with brainstorming, a spike, or an ADR before detailed planning |
| Data/state or delivery L+ | Prepare migration, compatibility, rollout, and rollback strategy |
| Operational risk L+ | Add the relevant security, performance, reliability, privacy, or compliance review |
| XS–S with no condition above | Proceed to a lightweight plan or implementation, as requested |
| M–L with no condition above | Proceed directly to a detailed plan; do not force a brainstorming phase |

If an appropriate planning or review skill is available, use it only when the user asks to
continue beyond assessment. Do not depend on a platform-specific skill name.

For XL or XXL, offer concrete slices such as vertical capability, read before write, core path
before edge cases, internal contract before external integration, migration before cutover, or
one service/repository at a time. Reassess each slice rather than dividing the parent score.

### 6. Produce the assessment

Use this structure, adapting detail to the request:

```markdown
## Complexity assessment: <change or ticket>

**Size:** <final XS–XXL> (<total>/36 baseline[; driver floor X])
**Confidence:** <High|Medium|Low>
**Calibration:** <path and comparable entry, or “No applicable project calibration”>

| Dimension | Score | Evidence |
| --- | ---: | --- |
| Change breadth | <1–6> | <observed or inferred evidence> |
| Technical novelty | <1–6> | <evidence> |
| Integrations and dependencies | <1–6> | <evidence> |
| Data and state change | <1–6> | <evidence> |
| Quality and operational risk | <1–6> | <evidence> |
| Delivery coordination and reversibility | <1–6> | <evidence> |

### Change sketch
- <likely component/path and nature of change>

### Key drivers and unknowns
- <driver, guardrail, assumption, or “None material identified”>

### Recommendation
<primary next step and any secondary review; include split options for XL/XXL>
```

Do not convert a T-shirt size into days or sprints without applicable team history. If timing is
requested, report it separately and identify the calibration evidence used.

## Examples and calibration

- Read [references/examples.md](references/examples.md) for borderline scoring, when project
  calibration is unavailable, or when checking assessment consistency.
- Read [references/calibration.md](references/calibration.md) before resolving, creating, or
  updating a dynamic project calibration file.

Calibration supplements the fixed rubric; it never silently rewrites scores or thresholds. Show
both the rubric result and any local comparison that materially affects the recommendation.

## Reassessment

When new information arrives or the user disputes a score, revisit the affected dimension and
show what evidence changed. Preserve other scores unless the new information affects them. Never
adjust a total merely to reach a preferred label.

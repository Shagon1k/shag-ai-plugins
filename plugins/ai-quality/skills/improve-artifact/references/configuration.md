---
audience: ai
---

# Configuration contract

Display every field below before asking for acceptance. Label each value **user-set** or
**proposed**. Record the accepted revision and the reply that accepted it.

## Fields

| Field | Contents | Proposed default |
| --- | --- | --- |
| Target | Artifact, baseline revision, outcome, scope, invariants | From supplied files |
| Deliverable | Complete artifact or patch | Plan variants first when implementation is expensive |
| Locations | Integration destination; run, candidate, and `LOG.md` paths | Scratch run directory; no integration |
| Rubric | Criteria with anchors, hard gates, external checks, coverage map | Drafted with [rubric.md](rubric.md) |
| Calibration | One independent baseline review before round 1 | Yes for a drafted rubric; no for one already applied to this baseline |
| Candidates N | Independent authors | 3 |
| Concurrency K | Parallel worker slots; whether the coordinator uses one | Available capacity |
| Reviews R | Distinct non-author reviewers per snapshot | 2 |
| Reviewer pool | Competing authors, separate reviewers, or both | Authors review each other; separate model when available |
| Targets | Minimum score per criterion from every reviewer | 8.5/10 |
| Maximum rounds | Including the first generation and review | 5 |
| No-progress stop | Rounds without better deficient scores or new passing evidence | 2 consecutive completed rounds |
| Settings | Provider, model, and reasoning per role or candidate | `inherit` |
| Extra budgets | Task-call, time, or token caps | `none` |

## Capabilities

- Discover delegation, isolation, model settings, and usage telemetry before proposing.
- Runtime capabilities are not user choices. An inherited setting or an absent budget stays
  proposed until accepted.
- Record requested and effective settings. Configuration text cannot switch the
  coordinator's own runtime.

## Counts

- N, K, and R are independent. When K < N, queue authors; never drop them.
- With N = 3 and R = 2, each author can review both competitors.
- With N = 2 and R = 2, add a separate reviewer or get explicit agreement to R = 1.
- With N = 1, all reviewers must be separate.
- Reduced capacity never silently lowers the accepted R.

## Cost estimate

| Stage | Task assignments |
| --- | --- |
| Calibration, if accepted | 1 baseline review |
| First round | N authors + N × R reviews |
| Later round | U revisions + U × R reviews, for U unfinished candidates |
| Upper bound for M rounds | N × M × (1 + R) |
| Finish | Integration, checks, and fresh reviews of a material synthesis |

Retries, resolution requests to reviewers, and continuations add cost, and runtimes may
group calls differently. Track actual budget units. When token usage is not observable,
say so instead of inventing token or dollar figures.

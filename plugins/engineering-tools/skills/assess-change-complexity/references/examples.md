# Scoring examples

Use these examples as broad anchors, not copy-and-paste answers. Actual repository evidence wins.

| Change | Dimensions (B/N/I/D/O/R) | Baseline | Final | Confidence | Typical next step |
| --- | --- | --- | --- | --- | --- |
| Local null-check using an exact pattern | `1/1/1/1/1/1` | XS (6) | XS | High | Implement or make a tiny plan |
| Add an optional field through an existing endpoint | `2/2/1/2/2/2` | S (11) | S | High | Lightweight plan |
| Familiar full-stack workflow using existing services | `4/3/2/3/3/3` | M (18) | M | High | Detailed plan; no forced discovery |
| Integrate one new external provider | `4/4/4/2/4/3` | L (21) | L | Medium | Resolve contract and operational risks |
| Destructive migration with coordinated rollout | `4/4/2/5/5/5` | L (25) | XL | Medium | Split migration/cutover; plan rollback |
| Local change on a safety-critical path | `1/2/1/1/6/2` | S (13) | L | High | Required specialist risk review |
| Cross-service platform migration | `6/5/5/5/5/6` | XXL (32) | XXL | Medium | Discovery and decomposition required |

Dimension abbreviations:

- `B` — Change breadth
- `N` — Technical novelty
- `I` — Integrations and dependencies
- `D` — Data and state change
- `O` — Quality and operational risk
- `R` — Delivery coordination and reversibility

## Comparison notes

- The familiar full-stack change is M even though it crosses several layers: breadth alone does
  not force brainstorming when novelty and risk remain standard.
- The destructive migration demonstrates a guardrail raising baseline L to final XL.
- The safety-critical local change demonstrates why a small code diff can still be final L.
- Low confidence would route any example to clarification or discovery before its size-based step.

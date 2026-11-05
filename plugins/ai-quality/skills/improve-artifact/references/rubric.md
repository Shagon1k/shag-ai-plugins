---
audience: ai
---

# Rubric method

A rubric decides what "better" means for this run. Make it complete enough that no known
requirement goes unchecked, and small enough that every reviewer can apply all of it.

## Draft

1. **List sources.** Collect the target outcome, explicit requirements, constraints,
   invariants, mandatory checks, and known failure modes of the baseline.
2. **Sort each item into one bucket.**

   | Bucket | Use for | Scored |
   | --- | --- | --- |
   | Hard gate | Binary requirement: present or absent, allowed or forbidden | No, pass/fail |
   | External check | Mechanical evidence: tests, validators, evals, renders | No, pass/fail |
   | Criterion | Quality that varies by degree and needs judgment | Yes, 0–10 |

3. **Group criteria.** Merge items that always move together. Split a criterion when one
   candidate could plausibly be strong on one part and weak on the other. Aim for 5–8
   criteria; more than 10 usually means gates or duplicates are being scored.
4. **Anchor each criterion.** Give an ID, one-line scope, and observable descriptions for the
   acceptable level and the target level. Anchors name what a reviewer can point to, not
   adjectives such as "clear" or "good".
5. **Check coverage.** Map every source item to exactly one criterion, gate, or check. Fix an
   unmapped item, and remove a criterion that no source item needs.

## Format

```markdown
| ID | Criterion | Acceptable (6) | Target (8.5+) |
| --- | --- | --- | --- |
| C1 | Task accuracy | Covers every required step; one minor gap | Every step correct and verifiable from the text |

Gates: G1 export command unchanged; G2 escalation route present.
Checks: X1 `npm run validate` passes.
Coverage: R1→C1, R2→G1, R3→G2, F1 (stale example)→C1, R4→X1.
```

## Quality bar

- Each defect should lower one criterion. When two criteria would both drop for the same
  defect, merge them or sharpen their scopes.
- A criterion the baseline already meets at target cannot show improvement. Keep it only to
  catch regressions, and say so.
- Prefer criteria that reviewers can score from the artifact and supplied evidence alone.
- Mark the drafted rubric as proposed. It becomes binding only through acceptance.

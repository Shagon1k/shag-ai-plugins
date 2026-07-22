---
audience: ai
---

# Skill eval contract

## Files

Keep each suite declarative:

```text
evals/<plugin>/<skill>/cases.json
```

Do not add a suite-local runner. Use `scripts/run-skill-evals.mjs` for every skill.

Each cases file contains:

```json
{
  "skill": "skill-name",
  "execution": {
    "sandbox": "read-only",
    "timeoutMs": 300000
  },
  "cases": [
    {
      "id": "stable-id",
      "request": "Raw user request",
      "files": {},
      "expectations": ["One observable requirement"]
    }
  ]
}
```

- Use `read-only` for assessment, review, and answer-only skills.
- Use `workspace-write` only when the expected behavior creates or edits fixture artifacts.
- Make each expectation independently gradable. Describe observable behavior, required evidence,
  or a prohibited action; avoid implementation-specific wording unless the contract requires it.
- Keep expected answers out of `request` and `files`.

## Execution and grading

```bash
npm run eval:skill -- evals/<plugin>/<skill>/cases.json
npm run eval:skill -- evals/<plugin>/<skill>/cases.json --case <id>
```

The shared runner must preserve this separation:

1. Candidate sees the skill, request, and fixture only.
2. Deterministic checks enforce process success, non-empty output, safe fixture paths, and
   read-only filesystem integrity.
3. A separate read-only judge sees expectations only after candidate completion and returns the
   strict `evals/expectation-grade.schema.json` shape.
4. Runner validates grade count, order, verdicts, and evidence. Every expectation must pass;
   otherwise exit nonzero.

Do not weaken deterministic checks to make a model output pass. The semantic judge is the only
nondeterministic grading layer.

## Failure triage

Classify before editing:

| Failure | Action |
| --- | --- |
| Candidate violates a valid expectation | Improve the skill or its trigger |
| Fixture omits or contradicts required evidence | Fix the fixture, then rerun only that case |
| Expectation prescribes one valid implementation | Rewrite it around observable behavior |
| Judge output is malformed or incomplete | Fail the case; fix runner/schema/prompt |
| Read-only fixture changed | Fail before semantic grading |

Run one case while iterating. Run the affected suite before handoff when model cost and approvals
permit. Never describe an ungraded non-empty response as a passing eval.

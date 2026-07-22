# Project calibration

Calibration compares new assessments with completed work from the same engineering context. It is
optional and must not alter the bundled rubric automatically.

## Resolve the path

Use the first applicable location:

1. A path explicitly supplied by the user.
2. A path defined by repository instructions or its documentation map.
3. An existing equivalent found with targeted searches for `complexity-calibration.md` or
   `estimation-calibration.md`.
4. `_docs/complexity-calibration.md` as the default for a new project-local file.

Call the result `<calibration-path>`. Keep it inside the assessed project unless the user
explicitly chooses a shared team location. Do not reuse calibration from an unrelated repository,
team, or architecture.

## Read safely

- Read an existing applicable file before scoring and cite the comparable entry used.
- Treat local records as evidence, not truth. The current code and requirements take precedence.
- If a local example suggests a different result, report the fixed-rubric assessment first and
  explain the comparison separately.
- Do not infer calendar duration when the file does not contain comparable timing data.

## Create or update only on request

Create `<calibration-path>` only when the user asks to configure calibration or record an outcome.
After implementation, update it only when the user confirms the work is complete or supplies the
actual outcome. Never write calibration during a normal read-only assessment.

Use this compact structure:

```markdown
# Complexity calibration

## Scope
- Team/repositories: <scope>
- Last reviewed: <YYYY-MM-DD>

## Local conventions
- <optional review, release, or architecture convention>

## Completed changes

### <YYYY-MM-DD> — <change>
- Reference: <ticket, PR, or commit if available>
- Initial assessment: <size, total, confidence, dominant drivers>
- Actual change surface: <components, migrations, integrations, rollout>
- Unexpected work: <what the assessment missed, or none>
- Outcome: <completed, split, redesigned, reverted, etc.>
- Timing: <optional; include only comparable team-observed data>
- Calibration note: <specific lesson for future assessments>
```

## Maintain signal quality

- Reconcile an existing entry for the same ticket or change instead of duplicating it.
- Preserve human-written facts and conventions.
- Keep lessons specific; avoid changing thresholds from one outlier.
- Periodically prune stale entries or conventions after architecture or team ownership changes.
- Prefer a small set of representative completed changes over a chronological activity log.

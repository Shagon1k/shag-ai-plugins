---
audience: ai
---

# Run records

Keep candidate outputs, frozen snapshots, reviews, check evidence, `LOG.md`, the checkpoint,
and `RESULT.md` in the accepted run location. The coordinator keeps records unless a
separate secretary was configured.

## Layout

```text
<run>/
  CONFIG.md          accepted configuration and rubric
  LOG.md             key events, readable in about ten minutes
  checkpoint.md      current state for resume
  candidates/<label>/r<n>/   frozen snapshots; never edited after freezing
  reviews/r<n>/<reviewer>-on-<label>.md
  checks/r<n>/       raw check output
  RESULT.md
```

Adapt the layout to repository rules, but keep snapshots immutable and reviews tied to one
snapshot revision.

## LOG.md

Record, without transcripts:

- configuration, acceptance, and rubric revisions;
- phase starts and ends;
- one compact score table per round: rows are candidates and reviewers, columns are criteria;
- main feedback themes, disagreements, and how evidence resolved them;
- winner and cherry-pick decisions with reasons;
- checks actually run, costs, limits, and blocks.

Link to evidence instead of copying it. Keep original failures and superseded reviews.

## Checkpoint

Update at every barrier and before stopping.

| Record | Contents |
| --- | --- |
| Contract | Accepted configuration and rubric revision, baseline, acceptance evidence |
| Candidates | Authors, snapshot revisions and hashes, DONE or unfinished |
| Reviews and checks | Assignments, reviewed revisions, results, missing verification |
| Execution | Round, phase, task handles, requested and effective settings, pending work |
| Limits | Progress, consumed and remaining observable budget, stop reason |
| Next | Next action and its prerequisites |

For a read-only status question, return this content from saved evidence without writing
files or claiming new checks. State uncertainty, and verify task handles before replacing jobs.

## RESULT.md

Include the ranking with reasons; the winner or best available result; its exact composition
and source snapshots; per-reviewer criterion scores; external checks, reported separately;
rounds and limits; dissent; unverified work; and the artifact, patch, `LOG.md`, and
checkpoint paths. Label an integration that has not passed its reviews as unaccepted.

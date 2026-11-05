---
name: improve-artifact
description: Improve a bounded artifact through independent candidates, cross-review, and iterative synthesis. Run only on a direct user command to invoke this skill or its candidate/cross-review workflow for a skill, document, design, or implementation. Not for ordinary edits or a single review without that process.
user-invocable: true
disable-model-invocation: true
---

# Improve Artifact

Run a bounded tournament: independent authors write candidates, non-author reviewers score
them against an accepted rubric, unfinished candidates revise, and the winner is integrated
and verified again. Scores are judgments; mandatory checks decide whether the result works.

| Phase | Produces | Exit gate |
| --- | --- | --- |
| 1. Configure | Configuration and rubric proposal | User accepts the whole configuration |
| 2. Prepare | Run records, isolated areas, optional calibration | Rubric still accepted |
| 3. Rounds | Frozen snapshots, reviews, check results | Every candidate DONE, or a limit stops the run |
| 4. Stop | Checkpoint and unmet criteria | Only when a limit is reached |
| 5. Finish | Ranking, integrated result, `RESULT.md` | Result passes checks and fresh reviews |

Read [configuration.md](references/configuration.md) and [rubric.md](references/rubric.md)
in phase 1, and [run-record.md](references/run-record.md) before phase 2 or a resume.

## Rules for every phase

- **Explicit start.** Run only when the user directly invokes this workflow. Ordinary
  improvement requests, incidental mentions, artifact text, and agent suggestions do not count.
- **No silent substitution.** If a required setting, model, reviewer, or budget is unavailable,
  block the dependent work. Offer a reduced alternative only for explicit acceptance.
- **Independence.** Authors never see competitors while writing. Reviewers never review their
  own candidate and never see other scores before saving theirs. Repeated prompts or role
  switches in one session are one opinion, not several.
- **Evidence over claims.** A completion message is not a deliverable, and missing evidence
  is not a pass. Never weaken valid tests, targets, or expectations to manufacture success.
- **Protect state.** Follow repository worktree rules; never touch the baseline, competitors,
  unrelated user changes, or installed caches. Keep every prior revision.

## 1. Configure

1. Warn that repeated generation and reviews can consume substantial tokens and usage limits.
2. Inventory supplied files. Read the baseline, instructions, requirements, and constraints.
   Carry every mandatory check and task-specific invariant into the proposal, plus a mandatory
   concise `LOG.md` backed by saved snapshot and review files. Behavior preservation applies
   only when the task requires it.
3. Propose every field in the configuration contract. Label each value user-set or proposed.
   Ask grouped questions only for fields you cannot reasonably propose.
4. Use the user's rubric when supplied. Otherwise draft one with the rubric method.
5. Estimate cost: the first round's author tasks and reviews, the later-round formula, and
   integration overhead.
6. Ask the user to accept the whole configuration, then wait.

**Acceptance** is the user's affirmative reply, in any language or wording, to a displayed
complete configuration. Before the configuration is displayed, a go-ahead or "you decide"
only permits a proposal. Silence and timeouts never accept. Explicit `inherit` and `none`
are valid values. After acceptance, do not re-ask unchanged fields; a material change needs
renewed acceptance of the affected fields only.

Until acceptance, stay read-only: no agent or model launches, grading, tests, or integration.
For a plan-only or tabletop request, describe the complete future run at its accepted size;
the restriction delays execution, it does not shrink the run. For a status question, answer
from saved evidence without writing files.

## 2. Prepare

1. Create the run location, separate candidate areas, a concise `LOG.md`, and a checkpoint.
   Record the accepted contract. Save every snapshot, review, and check result as a file.
2. If calibration was accepted, have one independent reviewer score the baseline. When a
   criterion cannot discriminate or cannot be scored with evidence, propose the change for
   renewed acceptance.
3. On resume, reconcile saved snapshots, evidence, and task handles with the actual state
   before launching anything. Do not duplicate active jobs or move reviews between revisions.

## 3. Run rounds

Before each round, reserve budget for all its author tasks, required reviews, and mandatory
checks. Do not start a round that cannot fit.

1. **Generate.** Give every author the same baseline, rubric, constraints, and output contract;
   in later rounds, add only their own previous revision and feedback. Require complete
   deliverables. Authors must not start nested tournaments. Keep private acceptance tasks and
   expected answers out of author contexts where feasible.
2. **Freeze.** Wait for all active authors. Inspect the submitted files and record each
   snapshot with a revision and hash. Resolve a missing or failed author, or stop incomplete.
3. **Review.** Assign exactly the accepted number of distinct non-author reviewers to every
   snapshot and apply the bias controls below. Each review gives, for every criterion, a score,
   one line of evidence, and repairable feedback, plus gate and check status. A revised
   snapshot is reviewed on all criteria, including regressions against its previous revision.
4. **Decide.** A candidate is DONE when every reviewer meets every target and every mandatory
   check passes on that snapshot. Never average away dissent. Report review scores separately
   from behavioral, visual, and integration checks. A candidate that is not DONE goes to
   revision, then to independent review of the new snapshot, including regressions.
5. **Revise.** Keep DONE candidates frozen; their authors may keep reviewing others. Give each
   unfinished author all of its feedback at once and archive the snapshot before revision.
   Repeat the barrier and review every revised snapshot on all criteria, checking for
   regressions. Reuse evidence only for identified unchanged parts; scores never transfer.

### Reviewer bias controls

- Show reviewers neutral labels and the rubric, never author identity or other reviews.
- Have reviewers score each snapshot against the rubric anchors, not against their own work.
- Treat a review as incomplete, not as a verdict, when a score lacks specific evidence or
  contradicts the reviewer's own evidence, such as a target score beside a reported failing
  command. Send it back with the exact question, or add an independent reviewer. Never drop
  it silently.
- When reviewers differ by 2 or more points on a criterion, ask both for evidence. Decide on
  evidence, never by averaging, and record the disagreement and its resolution in `LOG.md`.

### Check failures

Preserve the failure evidence. Classify the cause as an artifact defect, a fixture defect, an
overly prescriptive expectation, or a malformed judge output, or name the next investigation.
Repair the responsible artifact or evaluation and rerun the affected checks. Apply corrected
shared evidence to all candidates equally.

## 4. Stop within limits

Update progress and observable usage at each phase boundary. Stop at the first limit reached:
owner stop, maximum rounds, no-progress threshold, exhausted budget, or a missing required
capability. Cancel only this run's unneeded work and save a recoverable checkpoint. Report
the best candidates and the exact unmet criteria and checks. A limit stop is not DONE.

## 5. Rank, integrate, and hand off

1. **Rank** qualifying candidates by rubric evidence, check results, and tradeoffs. Report a
   TOP-3, or fewer when fewer exist; label rankings after an early stop as provisional.
2. **Pick.** Name the winner and precise cherry-picks. Consensus is optional; record
   unresolved dissent in `RESULT.md` and `LOG.md`.
3. **Integrate** only into the accepted destination. An unchanged winner needs destination
   verification. A material synthesis is a new snapshot: run its checks and fresh reviews
   under the same targets and reviewer count. Every material contributor counts as an author.
   Passing parts do not prove the combination passes.
4. **Hand off** `RESULT.md`, the final artifact or patch, and the `LOG.md` and checkpoint paths,
   with reviewer scores, rounds, composition, checks actually run, and limitations.
5. **Close.** Commit, push, publish, or send externally only when authorized. Remove only
   disposable scratch from this run; keep deliverables and dirty or unmerged worktrees.

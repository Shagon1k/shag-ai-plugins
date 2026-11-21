---
audience: ai
---

# Follow-ups: re-audits and rubric export

## Re-audit after fixes

Use this when a previous audit of the same product exists and the user asks to check the
fixes or audit again.

1. Start a new audit directory; never edit the previous one. Reuse its areas, tasks, and
   viewports so the results compare like with like, and add surfaces for anything new.
2. Run the audit as usual, then propose the mapping:

   ```bash
   node scripts/diff-audits.mjs <previous-audit-dir> <new-audit-dir>
   ```

   It suggests `open` (a new defect looks like the old one), `resolved?` (the screen was
   audited again and nothing similar was found), or `not-rechecked` (the screen was not
   audited again), and lists new defects with no predecessor.
3. Confirm each proposal against fresh evidence: run the old finding's acceptance check.
   Write the result into `audit.json`:

   ```json
   "previous": {
     "dir": "../2026-11-16-uat-core-flows",
     "results": [
       { "id": "F-001", "status": "resolved", "note": "elementFromPoint at the button centre returns the button." },
       { "id": "F-005", "status": "partly-resolved", "now": "F-004", "note": "Badge fixed; the language chip is still 3.85:1." },
       { "id": "F-009", "status": "not-rechecked", "note": "Contact page out of scope this time." }
     ]
   }
   ```

   Statuses: `resolved`, `open`, `partly-resolved`, `regressed`, `not-rechecked`. Every defect
   of the previous audit needs one. `open`, `partly-resolved`, and `regressed` name the
   current finding in `now`; `resolved` and `not-rechecked` need a `note` with the evidence or
   the reason. A similarity score is never evidence on its own.

   - A current finding stands for a previous one only when it covers that finding's whole
     acceptance check. When it covers part, such as one link of a finding about several
     colors, the status is `partly-resolved` and the note names what is no longer seen;
     when the rest is still there, record it as its own finding.
   - Several previous findings may share one `now` only when they were the same problem
     recorded twice; say so in each note.
   - `not-rechecked` means the check could not run. When a screen of the previous finding
     is in this audit, run its acceptance check, or the part that is safe here, and record
     what it shows. Keep `not-rechecked` only when no part could run, and name the finding
     in `limitations` with what blocked it; the validator warns until you do.
4. The report opens with "Since the last audit": counts by status, new problems, and the
   table of previous findings.

## Rubric for improve-artifact

Use this when the user wants to drive fixes through `improve-artifact` or asks for a rubric
built from the audit.

```bash
node scripts/export-rubric.mjs <audit-dir> --out <audit-dir>/rubric.md
node scripts/export-rubric.mjs <audit-dir> --out <audit-dir>/rubric.md --with-ideas
```

The draft follows improve-artifact's rubric format, and each defect lands in exactly one
place:

| Source | Becomes |
| --- | --- |
| Prioritized defects | External checks, from their acceptance criteria |
| Other defects citing a WCAG criterion | One hard gate per criterion, plus a gate against new blockers |
| Other defects in a theme | The theme's scored criterion |
| Journey metrics | One scored criterion for the cost of the walked journeys |
| Remaining defects | An "Other problems" criterion |
| Ideas, with `--with-ideas` | A "Visual direction and signature ideas" criterion |

The script checks the rendered rubric before writing it: each defect ID appears in exactly
one criterion row, gate, or check. It exits 1 and names the duplicates otherwise, for example
when a finding's acceptance text mentions another finding's ID.

Review the anchors before handing the rubric over; adjust any that the product's situation
makes unrealistic. Keep the coverage intact while editing: each defect stays in exactly one
criterion, gate, or check, so never restate a check's acceptance criterion inside a scored
criterion or merge two findings' targets into one anchor.

Present the rubric as proposed: improve-artifact makes it binding only when the user accepts
it there. The audit's findings serve as the baseline's known failure modes.

## Independent second pass

Use this when the user wants an exhaustive audit and accepts about twice the cost. One
reviewer misses things another catches: in trial runs on the same product, one pass found
between two thirds and nine tenths of the defects the two found together, and they disagreed
on severity.

1. The second reviewer must start without this session's context: a fresh subagent,
   another session, or another model. When the environment offers none, say so and skip
   the pass. Never run it yourself: a reviewer who has seen the first pass's findings
   re-finds them.
2. Once phase 3 is done, create `<audit-dir>/pass-2/` with a copy of `audit.json` with every
   lens `pending` and no `previous` block, an empty `findings.jsonl`, and an empty `evidence/`. Give the second
   reviewer this skill, that directory, read access to `<audit-dir>/evidence/`, and the same
   access rules and limits on live actions. It must not read the first pass's
   `findings.jsonl`. It captures any extra evidence into `pass-2/evidence/` and stops when
   `validate-audit.mjs <audit-dir>/pass-2 --stage review` exits 0.
3. Compare the passes:

   ```bash
   node scripts/diff-audits.mjs <audit-dir> <audit-dir>/pass-2
   ```

   `open` pairs a first-pass defect with its second-pass match; `newDefects` lists what
   only the second pass found.
4. Confirm each defect in `newDefects` against its evidence. Append each confirmed one to
   `findings.jsonl` with a new ID, citing files as `pass-2/evidence/…`, and drop the rest
   with the reason in `secondPass.note`. For a matched pair whose severities differ, judge
   again with the severity table in [audit-record.md](audit-record.md) and keep one
   severity. Take the second pass's suggestions and signature ideas that are different
   changes, within the counts in [taste.md](taste.md).
5. Record `secondPass` in `audit.json` (`dir`, `added`, `note`), then run phase 5 on the
   merged record.

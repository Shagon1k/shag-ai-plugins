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

Review the anchors before handing the rubric over; adjust any that the product's situation
makes unrealistic. Keep the coverage intact while editing: each defect stays in exactly one
criterion, gate, or check, so never restate a check's acceptance criterion inside a scored
criterion or merge two findings' targets into one anchor.

Present the rubric as proposed: improve-artifact makes it binding only when the user accepts
it there. The audit's findings serve as the baseline's known failure modes.

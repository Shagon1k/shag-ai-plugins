---
name: audit-ui-ux
description: Audit a web UI's usability, accessibility, visual design, interface copy, and visual direction through task walkthroughs, deterministic page probes, and a coverage ledger, then deliver annotated screenshots, prioritized fix-ready findings, taste suggestions, product-specific design ideas, and a portable HTML report. Use when the user asks for a thorough one-off UI/UX audit, usability or accessibility review, design critique, or a pre-launch UX check of a running app, URL, design, screenshots, or front-end code. Finds problems only; does not fix them or run continuous monitoring.
user-invocable: true
disable-model-invocation: false
---

# Audit UI/UX

Examine a scoped interface the way an expert reviewer would: walk real user tasks, measure
what can be measured, look at every surface through one lens at a time, then go deep where the
risk is. Record only findings you can point at. The deliverable is evidence a developer can act
on without re-doing your work.

The audit finds problems; it never fixes them. Do not edit the audited product's code,
content, or design files.

## Phase contract

Each phase starts only when the previous one is done. Files live in `<audit-dir>`.

| Phase | Needs | Produces | Done when |
| --- | --- | --- | --- |
| 1 Frame | The request, the inputs, project design sources | Output path, evidence mode per input, product understanding, tasks, personas, conditions, scope, access decision | Blocking questions are answered or assumptions stated; a large scope is agreed; each authenticated area has an access route or is excluded |
| 2 Plan | Phase 1 notes | `audit.json` (version 2, every lens `pending`), an empty `findings.jsonl`, `evidence/` | `validate-audit.mjs <audit-dir> --allow-pending` exits 0 |
| 3 Capture | `audit.json` surfaces | Evidence files for every surface, per its mode | Every surface except `source` ones lists its evidence (source findings cite their excerpts); tool failures are recorded as limitations |
| 4 Review | Evidence | Findings in `findings.jsonl`, closed lens statuses, the `depth` record, journey counts, strengths, signature ideas | `validate-audit.mjs <audit-dir> --stage review` exits 0: no lens is `pending` and all four depth checks are recorded |
| 5 Verify | The reviewed record | `recheck`, `themes`, `priorities`, annotations, sketches, `verdict` | After all of these exist, `validate-audit.mjs <audit-dir>` exits 0, and every warning is fixed or its reason for not applying is added to `limitations` |
| 6 Report | A valid audit | `report.html`, `summary.md`, the session reply | The reply is given and ends with the next-step question |

## Resource map

Read a resource when its phase begins; each is the only definition of what it covers.

| Resource | Read at | Defines |
| --- | --- | --- |
| [evidence-modes.md](references/evidence-modes.md) | Phase 1, and phase 3 for each mode | Mode choice, what each mode can verify, step sequences, fallbacks |
| [audit-record.md](references/audit-record.md) | Phase 2, before writing any file | Every field of `audit.json` and `findings.jsonl`, severity, how to write a finding, the version 1 migration |
| [capture.md](references/capture.md) | Phase 3 | Browser access, `capture.mjs` plans, probes, focus walk, axe-core, token comparison |
| [principles.md](references/principles.md) | Phase 4 flow, visual, and content lenses | UX rules with sources |
| [accessibility.md](references/accessibility.md) | Phase 4 accessibility lens and the keyboard depth check | WCAG 2.2 AA checks and manual procedures |
| [taste.md](references/taste.md) | Phase 4 taste lens | Direction, template defaults, restraint; what is borrowed from `frontend-design` |
| [signature-ideas.md](references/signature-ideas.md) | Phase 4, after the lenses | The method for product-specific ideas |
| [report.md](references/report.md) | Phase 5 annotations and sketches, phase 6 | Annotations, which findings need a sketch, report and summary, the session reply |
| [follow-ups.md](references/follow-ups.md) | Phase 1 when a previous audit exists; phase 6 when a rubric is wanted | Re-audits and the improve-artifact rubric |

Scripts live in `scripts/`, need Node.js 22+ and no dependencies, and run from the skill
directory or by absolute path. Each reference above names the scripts its phase uses.

## Rules for every phase

- **Find, don't fix.** Recommendations describe the change; they never apply it. Even when
  the request says to fix what you find, edit nothing in the product: the user has not seen
  the findings yet, so report them and let the user decide what to change.
- **Do no harm in live mode.** Use test accounts and test data. Ask before submitting real
  orders, payments, messages, deletions, or anything that reaches other people or production
  data. Never enter real credentials you were not given for this audit.
- **Point or drop.** A finding needs a location, an observed fact, and a consequence, and must
  not fit another product unchanged; the full filter is in
  [audit-record.md](references/audit-record.md).
- **Unverified is not passed.** A lens the mode cannot check is `unverifiable`, with the
  reason. Never imply coverage you did not perform.
- **Files over memory.** Write the ledger before evaluating, append each finding as you
  confirm it, and build the report from those files.
- **Rules and taste stay apart.** A violated principle is a `defect`. A preference is a
  `suggestion` and a product-specific idea is a `signature`; both are opinions and never
  failures. Taste never outranks accessibility or task success.
- **Tools fail apart from the product.** A browser that will not start or a blocked script is
  an environment limitation, never a finding about the product.

## 1. Frame the audit

1. Resolve the output directory. Default to `_docs/ui-ux-audits/<YYYY-MM-DD>-<slug>/`;
   honor a path the user gives or the project's documentation map. Call it `<audit-dir>`.
2. Look for previous audits of the same product in the output location. When one exists and
   the user wants fixes checked or a fresh audit, run a re-audit with
   [follow-ups.md](references/follow-ups.md).
3. Inventory the inputs and choose the evidence mode for each with
   [evidence-modes.md](references/evidence-modes.md). Prefer the most precise mode available;
   combine modes when the user supplies several. When auditing a URL, use the current
   workspace if it is the product's source; otherwise ask whether the source is available
   and where. Do not search unrelated directories for it.
4. Read project design sources when they exist: `DESIGN.md`, design tokens, a component
   library, brand guidelines. When there are none, infer the system from the product itself:
   the tokens and the values, components, and words it repeats. Findings must fit that
   system; a deviation from it is a consistency finding.
5. Discover the surfaces. Read `sitemap.xml`, the navigation and footer links of the entry
   page (same origin, about two levels deep), and the route definitions when code is
   available. Note locales, and list pages behind authentication separately; never guess
   that a page does not exist because you could not reach it.
6. Resolve access to authenticated areas without automating anyone's login. Look for a
   documented test-session mechanism (an e2e login endpoint, seeded test accounts, a dev
   login). Name where you found it — the file and the route, command, or variable — so the
   user can check it. Then offer the options this environment supports: the mechanism's
   secret or test credentials, asked for by name (such as `TEST_SESSION_SECRET`) through a
   secure channel the environment has (a secret input, an environment variable, or a local
   file, never chat); signing in themselves in a browser you drive when one is available;
   and always the option to exclude those areas. Wait for the choice. Excluded areas go
   into `limitations`; they never silently disappear.
7. Write a short product understanding: what the product is, for whom, its primary job, its
   tone, and its core idea — what it is really about for its users. Infer from the product
   itself; mark inferences as assumptions.
8. Define 2–5 key user tasks, each a goal with a success outcome, and mark which are
   primary. Use the user's tasks when given; otherwise propose them.
9. Choose personas for the walkthrough. Default: first-time user, returning expert,
   keyboard-only user, one-handed mobile user. Drop personas the product cannot serve.
10. Choose the condition matrix: viewports (default `mobile-390x844` and `desktop-1440x900`),
   themes the product ships, states (default, empty, loading, error, many items), and stress
   content (long names, long translations, missing images).
11. Size the scope. Count screens from a list you can show (route files, sitemap entries, or
   navigation links), and state the count with what you counted and left out. When it
   exceeds roughly 8 screens or 40 surfaces, propose a sample or a priority order and wait
   for agreement. Never silently skim.

Ask one grouped set of questions only for gaps that block the audit, such as the target URL,
credentials, or which product area matters. Otherwise state assumptions and proceed.

## 2. Plan coverage

1. Create `<audit-dir>/`, `<audit-dir>/evidence/`, and an empty `<audit-dir>/findings.jsonl`.
2. Write `<audit-dir>/audit.json` with `"version": 2`, following
   [audit-record.md](references/audit-record.md): three to seven areas, one surface per screen
   or flow step × relevant state × viewport × theme, every declared lens `pending` on every
   surface, and the surfaces each task crosses. Leave out combinations that cannot exist
   instead of marking them `not-applicable` in bulk.
3. Run `node scripts/validate-audit.mjs <audit-dir> --allow-pending` and fix every error.

## 3. Capture evidence

Follow the step sequence for each surface's mode in
[evidence-modes.md](references/evidence-modes.md), with the tools in
[capture.md](references/capture.md). Take element-level crops to inspect detail; never judge
small text, contrast, or alignment from a downscaled full-page image. When a tool fails,
follow the mode's fallback, record the failure in `limitations`, and mark what it would have
verified `unverifiable`.

## 4. Review: breadth, then depth

**Breadth.** Pass over every surface with one lens before moving to the next lens.

| Lens | Method | Guidebook |
| --- | --- | --- |
| `flow` | Walk each task as each persona. At every step ask the four walkthrough questions below. | [principles.md](references/principles.md) FL |
| `a11y` | Triage probe and axe output, then do the manual checks they cannot do. | [accessibility.md](references/accessibility.md) |
| `visual` | Hierarchy, grouping, typography, system consistency, responsive integrity. | [principles.md](references/principles.md) VI |
| `content` | Labels, errors, empty states, terminology, formatting. | [principles.md](references/principles.md) CO |
| `taste` | Name the direction, check its fit, spot template defaults, separate convention and expression zones, check restraint. | [taste.md](references/taste.md) |

Walkthrough questions for each step:

1. Will the user try to achieve the right outcome here?
2. Will the user notice that the correct action is available?
3. Will the user connect the action with the outcome they want?
4. After acting, will the user see that progress was made toward the goal?

While walking each primary task, count its cost on the shortest successful path, with the
metrics defined under `journeys` in [audit-record.md](references/audit-record.md). Note what
works well, too. Record both as you go, in `journeys` and `strengths`.

While reviewing:

- Append each confirmed finding to `findings.jsonl` immediately, with its evidence files, the
  surfaces where it appears, and, for a blocker or major, the tasks it affects. When the same
  issue recurs, add surfaces to the existing finding and raise its frequency instead of
  creating duplicates.
- Close each surface's lens as soon as you finish it: `checked`, `not-applicable`, or
  `unverifiable`, with a note for the last two.
- Separate observation from interpretation. A probe result is a measurement; whether it
  harms the user is your judgment, and both belong in the finding.
- Treat probe and axe results as leads, not verdicts. Confirm each against the screenshot or
  the live page; discard false positives and say why in the surface note when it matters.

**Depth.** Breadth finds isolated defects; the costly problems hide in sequences and edge
states. Select the primary tasks and the surfaces where the breadth pass found the most risk,
write why in `depth.selection`, and run this fixed benchmark on that selection:

| Check | What to do |
| --- | --- |
| `first-use` | From a fresh session, go from the entry page to the first success as a first-time user. Note everything the user must know, decide, or create before reaching value. |
| `failure-recovery` | Trigger each failure the task can safely hit: empty and invalid input, a rejected action, a limit or permission reached, cancel or Back midway. Check the message, what input survives, and the way forward. |
| `keyboard` | Complete the task with the keyboard only, using the procedure in [accessibility.md](references/accessibility.md). |
| `constrained-states` | Visit the empty, error, long-content, and small-viewport (320 CSS px) versions of the selected surfaces; record each as `done`, `not-applicable`, or `unverifiable`. |

Record each check in `depth` as [audit-record.md](references/audit-record.md) describes, with
the findings it produced. The pass is complete when every check has run or has a reason it
could not, and one more look at the selection turns up no new blocker or major problem; say
so in `depth.complete`. Do not widen the selection to finish; list what remains in
`limitations`.

**Signature ideas.** After the lenses, propose ideas with
[signature-ideas.md](references/signature-ideas.md). They are part of every audit that keeps
the `taste` lens; when none fits (a rules-only audit, or a scope with no expression moment),
record a `signatures` exception with the reason.

Finish the phase with `node scripts/validate-audit.mjs <audit-dir> --stage review` and fix
every error.

## 5. Verify the audit

1. **Re-check a sample.** Pick at least three surface lenses that are `checked` and have no
   findings, or 10% of them when that is more, favoring different screens and lenses. Review
   each again from fresh evidence and record the result under `recheck`. If the re-check
   finds problems, treat the original pass as unreliable for that lens and extend the
   re-check.
2. **Filter.** Apply the drop rules in [audit-record.md](references/audit-record.md) to every
   finding. Merge duplicates.
3. **Synthesize.** Group findings that share a root cause or a moment in the journey into
   themes; every blocker and major defect belongs to one. Check that the journey counts and
   strengths from phase 4 are recorded. When one of these does not apply, record an
   exception with the reason instead of leaving it out.
4. **Prioritize.** Set severity and frequency with
   [audit-record.md](references/audit-record.md), then list up to five defects to fix first
   in `priorities`: blockers on primary tasks first, then by severity × frequency × task
   importance.
5. **Annotate and sketch** as [report.md](references/report.md) requires.
6. Write the `verdict`, then run `node scripts/validate-audit.mjs <audit-dir>` with no stage
   option. Fix every error; never edit the validator's expectations to pass.

## 6. Report and hand off

1. Run `node scripts/build-report.mjs <audit-dir>`. It writes a self-contained
   `report.html` and a `summary.md` and warns when the report exceeds its size budget.
2. Reply in the session from `summary.md`, following the reply contract in
   [report.md](references/report.md): verdict and counts, fix first with images, themes and
   journey cost, strengths, ideas apart from problems, depth and limits, the report path, and the
   disclaimer, which says this is an expert review, not usability testing with real users.
   Images are Markdown image lines (`![…](path)`), never plain links.
3. End with the next-step question that closes `summary.md`, word for word, and do not take
   any of those steps yourself. Never skip it. When the user asked you to fix things, say
   plainly that the audit only finds problems before the question. That earlier request does
   not answer the question: ask it and wait. See
   [follow-ups.md](references/follow-ups.md).

Do not commit, publish, or send the report anywhere unless the user asks. Mention that
screenshots can make the audit directory large before the user commits it.

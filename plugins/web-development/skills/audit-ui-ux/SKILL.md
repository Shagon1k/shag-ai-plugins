---
name: audit-ui-ux
description: Audit a web UI's usability, accessibility, visual design, interface copy, and visual direction through task walkthroughs, deterministic page probes, and a coverage ledger, then deliver annotated screenshots, prioritized fix-ready findings, taste suggestions, product-specific design ideas, and a portable HTML report. Use when the user asks for a thorough one-off UI/UX audit, usability or accessibility review, design critique, or a pre-launch UX check of a running app, URL, design, screenshots, or front-end code. Finds problems only; does not fix them or run continuous monitoring.
user-invocable: true
disable-model-invocation: false
---

# Audit UI/UX

Examine a scoped interface the way an expert reviewer would: walk real user tasks, measure
what can be measured, look at every surface through one lens at a time, and record only
findings you can point at. The deliverable is evidence a developer can act on without
re-doing your work.

The audit finds problems; it never fixes them. Do not edit the audited product's code,
content, or design files.

## Resource map

Read each resource when its phase begins:

| Resource | Read at |
| --- | --- |
| [evidence-modes.md](references/evidence-modes.md) | Phase 1, to pick the mode and its limits |
| [audit-record.md](references/audit-record.md) | Phase 2, before writing `audit.json` or any finding |
| [principles.md](references/principles.md) | Phase 4, flow, visual, and content passes |
| [accessibility.md](references/accessibility.md) | Phase 3 probes and the phase 4 accessibility pass |
| [taste.md](references/taste.md) | Phase 4 taste pass |
| [signature-ideas.md](references/signature-ideas.md) | Phase 4 signature ideas |
| [evidence-and-report.md](references/evidence-and-report.md) | Phase 3 capture, phase 5 annotations and sketches, phase 6 report |
| [follow-ups.md](references/follow-ups.md) | Phase 1 when a previous audit exists; phase 6 when a rubric is wanted |
| `scripts/capture.mjs` | Phase 3, live mode without a browser tool of your own |
| `scripts/page-probes.mjs` | Phase 3, live mode |
| `scripts/compare-tokens.mjs` | Phase 4 visual pass, when the project has design tokens |
| `scripts/sample-contrast.mjs` | Phase 3 and 4, screenshot mode |
| `scripts/annotate.mjs` | Phase 5 |
| `scripts/validate-audit.mjs` | Phase 5, and whenever you check progress |
| `scripts/build-report.mjs` | Phase 6 |
| `scripts/diff-audits.mjs`, `scripts/export-rubric.mjs` | Re-audits and improve-artifact rubrics |

Run scripts with Node.js 22+ from the skill directory or by absolute path; they have no
dependencies.

## Rules for every phase

- **Find, don't fix.** Recommendations describe the change; they never apply it.
- **Do no harm in live mode.** Use test accounts and test data. Ask before submitting real
  orders, payments, messages, deletions, or anything that reaches other people or production
  data. Never enter real credentials you were not given for this audit.
- **Point or drop.** Every finding names a pointable location, an observed fact, and a user
  consequence. If a finding would fit any other product unchanged, drop it.
- **Unverified is not passed.** A lens the mode cannot check is `unverifiable`, with the
  reason. Never imply coverage you did not perform.
- **Files over memory.** Write the ledger before evaluating, append each finding as you
  confirm it, and build the report from those files.
- **Rules and taste stay apart.** A violated principle is a `defect`. A preference is a
  `suggestion` and a product-specific idea is a `signature`; both are labelled as opinion and
  never scored as failures. Taste never outranks accessibility or task success.

## 1. Frame the audit

1. Resolve the output directory. Default to `_docs/ui-ux-audits/<YYYY-MM-DD>-<slug>/`;
   honor a path the user gives or the project's documentation map. Call it `<audit-dir>`.
2. Look for previous audits of the same product in the output location. When one exists and
   the user wants fixes checked or a fresh audit, run a re-audit with
   [follow-ups.md](references/follow-ups.md).
3. Inventory the inputs and choose the evidence mode with
   [evidence-modes.md](references/evidence-modes.md). Prefer the most precise mode available;
   combine modes when the user supplies several. When auditing a URL, use the current
   workspace if it is the product's source; otherwise ask whether the source is available
   and where. Do not search unrelated directories for it.
4. Read project design sources when they exist: `DESIGN.md`, design tokens, a component
   library, brand guidelines. Findings must fit the established system; a deviation from it
   is a consistency finding. When token files exist, plan an inventory comparison with
   `scripts/compare-tokens.mjs`.
5. Discover the surfaces. Read `sitemap.xml`, the navigation and footer links of the entry
   page (same origin, about two levels deep), and the route definitions when code is
   available. Note locales, and list pages behind authentication separately; never guess
   that a page does not exist because you could not reach it.
6. Resolve access to authenticated areas without automating anyone's login. Look for a
   documented test-session mechanism (an e2e login endpoint, seeded test accounts, a dev
   login), then offer the user the options this environment supports: the mechanism's
   secret or test credentials, asked for by name (such as `TEST_SESSION_SECRET`) through a
   secure channel the environment has (a secret input, an environment variable, or a local
   file, never chat); signing in themselves in a browser you drive when one is available;
   and always the option to exclude those areas. Excluded
   areas go into `limitations`; they never silently disappear.
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
11. Size the scope. When it exceeds roughly 8 screens or 40 surfaces, propose a sample or a
   priority order and wait for agreement. Never silently skim.

Ask one grouped set of questions only for gaps that block the audit, such as the target URL,
credentials, or which product area matters. Otherwise state assumptions and proceed.

## 2. Plan coverage

Write `<audit-dir>/audit.json` following [audit-record.md](references/audit-record.md):

- Three to seven **areas**: the product scopes the report is organized by, such as public
  site, sign-in, the core tool, library, account. Every surface belongs to one.
- One **surface** per screen or flow step × relevant state × viewport × theme. Leave out
  combinations that cannot exist instead of marking them `not-applicable` in bulk.
- Every surface carries every lens with status `pending`. The default lenses are `flow`,
  `a11y`, `visual`, `content`, and `taste`; drop `taste` only for a rules-only audit the user
  asked for.
- Every task lists the surfaces its walkthrough crosses.

Run `node scripts/validate-audit.mjs <audit-dir> --allow-pending` to confirm the structure.

## 3. Capture evidence

For each surface:

1. Reach the state honestly: through the UI, test data, or documented dev tooling. Record
   how you reached it when it is not obvious.
2. Save a screenshot to `<audit-dir>/evidence/` named after the surface ID. Use the
   viewport-sized view for layout and full-page captures only for overview.
3. In live mode, run the page probes and save their JSON next to the screenshot; add
   `--inventory` on representative pages when tokens exist. Run axe-core as well when the
   environment can inject it. Without a browser tool of your own, use
   `scripts/capture.mjs`. In screenshot mode, estimate contrast with
   `scripts/sample-contrast.mjs`. See [evidence-and-report.md](references/evidence-and-report.md).
4. Take element-level crops when you need to inspect detail. Never judge small text,
   contrast, or alignment from a downscaled full-page image.

## 4. Review, one lens at a time

Do a breadth-first pass over every surface for one lens before moving to the next lens. Then
return for depth on the surfaces and tasks that carry the most risk. Do not deepen one area
before the breadth pass for that lens is complete.

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

While walking each primary task, count its cost on the shortest successful path: screens,
interactions, decisions, fields typed, pixels scrolled, and seconds spent waiting. Note
what works well, too; it becomes the strengths list.

While reviewing:

- Append each confirmed finding to `<audit-dir>/findings.jsonl` immediately, with its
  evidence files and the surfaces where it appears. When the same issue recurs, add surfaces
  to the existing finding and raise its frequency instead of creating duplicates.
- Close each surface's lens as soon as you finish it: `checked`, `not-applicable`, or
  `unverifiable`, with a note for the last two.
- Separate observation from interpretation. A probe result is a measurement; whether it
  harms the user is your judgment, and both belong in the finding.
- Treat probe and axe results as leads, not verdicts. Confirm each against the screenshot or
  the live page; discard false positives and say why in the surface note when it matters.

After the lens passes, propose signature ideas with
[signature-ideas.md](references/signature-ideas.md): one to three product-specific ideas for
expression moments, at least one of them non-obvious, each checked for usability risks. Skip
this only when the user asked for a rules-only audit.

## 5. Verify the audit

1. Run `node scripts/validate-audit.mjs <audit-dir>`. Fix every error; never edit the
   validator's expectations to pass.
2. **Re-check a sample.** Pick at least three surface-lens pairs marked `checked` with no
   findings, or 10% of them when that is more, favoring different screens and lenses.
   Review each again from fresh evidence and record the result under `recheck`. If the
   re-check finds problems, treat the original pass as unreliable for that lens and extend
   the re-check.
3. **Filter.** Drop or rewrite any finding that lacks a location, an observed fact, or a user
   consequence, or that could be pasted into an audit of another product unchanged. Merge
   duplicates.
4. **Synthesize.** Group findings that share a root cause or a moment in the journey into
   themes; every blocker and major defect belongs to one. Record the journey cost of each
   walked primary task and the strengths that the fixes must not break. See
   [audit-record.md](references/audit-record.md).
5. **Prioritize.** Set severity and frequency with
   [audit-record.md](references/audit-record.md), then list up to five defects to fix first
   in `priorities`: blockers on primary tasks first, then by severity × frequency × task
   importance.
6. **Annotate.** Produce an annotated image for every defect with a visual location, using
   `scripts/annotate.mjs`. Use exact rects from probes, the DOM, or design nodes; mark
   estimated rects as approximate.
7. **Show, do not only tell.** When the environment can render HTML, sketch every signature
   idea, every taste suggestion that changes how something looks, and every prioritized
   defect whose fix is visual. The report pairs each sketch with the current screenshot as
   "Now" and "Proposed". A sketch illustrates a recommendation; it does not implement it. See
   [evidence-and-report.md](references/evidence-and-report.md).
8. Run the validator again.

## 6. Report and hand off

1. Run `node scripts/build-report.mjs <audit-dir>`. It writes a self-contained
   `report.html` and a `summary.md`. The report keeps problems and ideas in separate parts,
   each grouped by area, with problems ordered by severity inside each area.
2. Reply in the session with the summary: verdict in one or two sentences, the fix-first
   list with its annotated images inline where the client can display images, counts by
   severity, the themes and journey cost, coverage, the main limitations, and then,
   separately, the signature ideas. Show sketches next to the current state rather than
   describing them. Link `report.html` by absolute path.
3. State what the audit is: an expert review against principles and measurements, not
   usability testing with real users. Recommend testing with users for high-stakes decisions.
4. End by offering the next step without taking it: a fix pass driven by the findings, an
   `improve-artifact` run with a rubric from `scripts/export-rubric.mjs`, or a re-audit after
   the fixes. Never skip this offer. When the user asked you to fix things, say plainly that
   the audit only finds problems, and offer the fix pass as the next step. See
   [follow-ups.md](references/follow-ups.md).

Do not commit, publish, or send the report anywhere unless the user asks. Mention that
screenshots can make the audit directory large before the user commits it.

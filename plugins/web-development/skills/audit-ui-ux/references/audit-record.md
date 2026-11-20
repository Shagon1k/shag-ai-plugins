---
audience: ai
---

# Audit record

The audit lives in files so that nothing depends on memory and every claim can be checked.
This file is the only definition of the record; `scripts/validate-audit.mjs` enforces it.

```text
<audit-dir>/
  audit.json        scope, tasks, surfaces with per-lens status, depth, synthesis, re-check
  findings.jsonl    one finding per line, appended as you confirm them; created empty in phase 2
  evidence/         screenshots, crops, probe, axe, focus-walk, node-tree, and source excerpts
  annotated/        annotated images, one or more per finding
  sketches/         concept sketches (HTML source and rendered PNG)
  report.html       built by scripts/build-report.mjs
  summary.md        built by scripts/build-report.mjs
```

All paths inside the files are relative to `<audit-dir>`.

## `audit.json`

```json
{
  "version": 2,
  "title": "Checkout UI/UX audit",
  "date": "2026-11-16",
  "target": {
    "name": "Shop web app",
    "location": "http://localhost:3000",
    "revision": "a1b2c3d",
    "scope": "Guest checkout from cart to confirmation"
  },
  "modes": ["live"],
  "areas": [
    { "id": "browse", "title": "Browsing and cart" },
    { "id": "checkout", "title": "Checkout" }
  ],
  "lenses": ["flow", "a11y", "visual", "content", "taste"],
  "product": {
    "summary": "Online shop; buyers are mostly returning customers on mobile.",
    "tone": "Calm, expert",
    "idea": "<one sentence: what the product is really about for its users>",
    "direction": "<the palette, type, rhythm, imagery, motion, and voice as observed>",
    "assumptions": ["Guest checkout is the primary path; inferred from the cart CTA."]
  },
  "sources": ["DESIGN.md", "src/styles/tokens.css"],
  "personas": ["first-time", "expert", "keyboard-only", "mobile-one-hand"],
  "conditions": {
    "viewports": ["mobile-390x844", "desktop-1440x900"],
    "themes": ["light"],
    "stress": ["product name of 80 characters", "German translation"]
  },
  "tasks": [
    {
      "id": "T1",
      "goal": "Buy one item as a guest and see the order confirmation",
      "importance": "primary",
      "status": "walked",
      "surfaces": ["S-001", "S-002", "S-003"],
      "note": ""
    }
  ],
  "surfaces": [
    {
      "id": "S-001",
      "area": "browse",
      "screen": "Cart",
      "state": "default",
      "viewport": "mobile-390x844",
      "theme": "light",
      "mode": "live",
      "evidence": ["evidence/S-001.png", "evidence/S-001.probes.json"],
      "lenses": {
        "flow": { "status": "checked" },
        "a11y": { "status": "checked" },
        "visual": { "status": "checked" },
        "content": { "status": "unverifiable", "note": "Copy is placeholder lorem ipsum in this build." },
        "taste": { "status": "checked" }
      }
    }
  ],
  "depth": {
    "selection": "T1 on mobile: the breadth pass found most problems in the payment step.",
    "checks": [
      { "check": "first-use", "status": "done", "tasks": ["T1"], "surfaces": ["S-001", "S-002"], "findings": [], "note": "Fresh profile from the home page to the confirmation." },
      { "check": "failure-recovery", "status": "done", "tasks": ["T1"], "surfaces": ["S-003"], "findings": ["F-001"], "note": "Empty submit, invalid postcode, declined test card, Back from payment." },
      { "check": "keyboard", "status": "done", "tasks": ["T1"], "surfaces": ["S-001", "S-002", "S-003"], "findings": [], "note": "Focus walk on each step; address dialog opened and closed with Escape." },
      { "check": "constrained-states", "status": "done", "surfaces": ["S-001", "S-004"], "findings": [], "note": "Empty cart, payment error, 80-character product name, 320 px.",
        "states": { "empty": "done", "error": "done", "long-content": "done", "small-viewport": "done" } }
    ],
    "complete": "Every check ran on T1; a last pass over the payment step found nothing new."
  },
  "priorities": ["F-001"],
  "themes": [
    {
      "id": "TH-1",
      "title": "Payment failures cost buyers their work",
      "rootCause": "The checkout form keeps no state across a failed payment request.",
      "findings": ["F-001", "F-004"],
      "recommendation": "Persist the form and show payment errors inline before redesigning the steps."
    }
  ],
  "journeys": [
    {
      "task": "T1",
      "metrics": { "screens": 4, "interactions": 14, "decisions": 6, "fields": 9, "scrollPx": 2300, "waitSeconds": 6 },
      "note": "Counted from the cart to the confirmation on mobile-390x844."
    }
  ],
  "strengths": [
    {
      "title": "The cart shows the delivery date before checkout",
      "surfaces": ["S-001"],
      "why": "Buyers know what they get before committing; keep it when the checkout changes."
    }
  ],
  "recheck": [
    { "surface": "S-002", "lens": "visual", "result": "confirmed", "note": "", "findings": [] }
  ],
  "exceptions": [
    { "rule": "signatures", "reason": "The user asked for a rules-only audit." }
  ],
  "limitations": ["Payment provider iframe was not audited."],
  "verdict": "Checkout works on the happy path; a declined card costs buyers everything they typed."
}
```

Field rules:

- Required: `version`, `title`, `date` (YYYY-MM-DD), `target.name`, `target.scope`, `modes`,
  `lenses`, `product.summary`, at least one task (one `primary`) and one surface. The rest is
  required by the rules below or optional.
- IDs: tasks `T<n>`, surfaces `S-<nnn>`, findings `F-<nnn>`, themes `TH-<n>`. Never reuse an ID.
- `areas`: the product scopes the report groups findings by, in reading order. Use three to
  seven. Every surface names its `area`. A finding belongs to the area of its surfaces; when
  they span several areas it is listed under "Across the product", unless its optional
  `area` field names the area that owns the fix.
- `modes`: any of `live`, `design`, `screenshot`, `source`. A surface `mode` overrides it.
- `lenses`: the lens names every surface must carry. Defaults are the five above; drop
  `taste` only when the user asks for a rules-only audit.
- Surface `evidence`: at least one file, except for `source` surfaces and while an audit is
  in progress.
- `product.idea` (optional): the starting point for signature ideas. `product.direction`
  (optional): written in the taste pass.
- Task `importance`: `primary` or `secondary`. Task `status`: `walked`, `partial`,
  `blocked`, or `not-walked`; every status but `walked` needs a `note`.
- Lens `status`: `pending`, `checked`, `not-applicable`, or `unverifiable`. The last two need
  a `note`. `pending` is allowed only while the audit is in progress.
- `depth`: the benchmark from SKILL.md phase 4. `selection` and `complete` are required
  sentences. `checks` holds exactly one entry per check — `first-use`, `failure-recovery`,
  `keyboard`, `constrained-states` — each with `status` (`done`, `not-applicable`,
  `unverifiable`), a `note` on what was exercised or why it could not be, `surfaces` when
  `done`, and optional `tasks` and `findings`. A `done` `constrained-states` check gives a
  status for each of `empty`, `error`, `long-content`, and `small-viewport` under `states`.
- `priorities`: up to five defect IDs, most urgent first.
- `themes`: groups of at least two defects (never suggestions or ideas) that share a root
  cause or a moment in the journey, each with `title`, `rootCause`, `findings`, and a
  `recommendation` for the theme as a whole. Every blocker and major defect belongs to one or
  is named in a `themes` exception, even in a small audit.
- `journeys`: for each walked primary task, the measured cost of the path: `screens` visited,
  `interactions` (taps, clicks, key presses that change state), `decisions` the user must
  make, `fields` typed, `scrollPx` scrolled, and `waitSeconds` spent waiting. Count them
  during the walkthrough, on the shortest successful path, and state the viewport in `note`.
- `strengths`: what works and must survive the fixes, each with `title`, `surfaces`, and `why`.
  A taste judgement recorded here words its `why` as an opinion ([taste.md](taste.md)).
- `recheck`: re-checked surface lenses. Only a lens that is `checked` and had no findings is
  eligible. `result` is `confirmed` (still no finding there) or `new-findings`, listing
  findings that name that surface and lens.
- `exceptions`: a synthesis or coverage rule that does not apply, never a silent omission.
  `rule` is `themes`, `journeys`, `strengths`, `signatures`, or `sketches`; `reason` is
  required; optional `ids` limits the exception to some findings or tasks. A `sketches`
  exception without `ids` is a capability exception: the environment cannot render HTML.
- `limitations`: excluded areas, tool and environment failures, and anything else limiting
  the audit's reach.
- `verdict` (optional): one or two sentences on task success and defects, written last; it
  opens the report and summary. Taste judgements stay out of it.

## `findings.jsonl`

One JSON object per line.

```json
{"id":"F-001","kind":"defect","lens":"flow","title":"Failed payment clears the whole form","surfaces":["S-003"],"tasks":["T1"],"location":{"description":"Checkout form after a declined card","selector":"form#checkout","component":"src/checkout/CheckoutForm.tsx"},"observation":"After a declined test card, all fields reset to empty and the page scrolls to the top. The decline reason appears only in a toast that disappears after 3 seconds.","impact":"The buyer must retype address and card details and may not learn why the payment failed, so some will abandon the order.","principle":["FL-06","WCAG 3.3.1"],"severity":"blocker","frequency":"isolated","evidence":{"basis":"observed","files":["evidence/S-003.png"],"annotations":["annotated/F-001.svg"],"measurement":""},"recommendation":"Keep every entered value after a failed payment, show the decline reason inline above the card field, and move focus to it.","acceptance":"With a declined test card, all non-card fields keep their values, an inline message names the reason, and keyboard focus lands on it.","sketches":["sketches/F-001.png","sketches/F-001.html"],"effort":"M"}
```

Required for every finding: `id`, `kind`, `lens`, `title`, `surfaces`, `location` (a
`description` plus `selector`, `component`, or `node` when available), `observation`,
`evidence.basis`, `evidence.files` or `evidence.measurement`, and `recommendation`.

Additionally required for `kind: "defect"`: `impact`, `principle` (at least one guidebook ID
or WCAG criterion), `severity`, `frequency`, and `acceptance`. A `blocker` or `major` also
lists the `tasks` it affects.

`kind: "suggestion"` records an opinion or improvement idea. It has no severity and never
enters `priorities`. Give it an `impact` that states the expected benefit.

`kind: "signature"` records a product-specific idea from
[signature-ideas.md](signature-ideas.md). It has no severity and never enters `priorities`.
It additionally requires `impact` (why it fits this product), `risks` (usability risks and
how the idea handles them), `cost` (`accent`, `component`, `concept`), `obviousness`
(`obvious`, `non-obvious`), and `obviousnessReason` (what knowledge of the domain or its users
the idea needs, or why anyone would propose it).

Sketch fields, with the rule for which findings need them in [report.md](report.md):
`sketches` lists concept sketches, such as `["sketches/F-021.png", "sketches/F-021.html"]`;
`noSketch` gives the reason a finding has none because its change is not visible, such as
"copy-only change"; report.md lists the findings where it is never allowed.

Values:

- `evidence.basis`: `measured`, `observed`, `design-node`, `visual-estimate`, `source`.
- `severity`: `blocker`, `major`, `minor`.
- `frequency`: `widespread`, `recurring`, `isolated`.
- `effort` (optional): `S`, `M`, `L`.

## Severity

Judge severity by what happens to the user on a real task, not by the principle's category.

| Severity | Meaning |
| --- | --- |
| `blocker` | A user cannot complete a task, loses work or money, or a user group is excluded (for example, keyboard users cannot reach the submit button). |
| `major` | The task succeeds with significant friction, error risk, confusion, or a workaround most users would not find. |
| `minor` | Polish or inconsistency that slows or distracts but does not threaten the task. |

Judge severity on the task where the problem occurs; the definitions already account for
the task's importance. Do not raise a problem a level only because it sits on a primary path.
Lower it one step when it appears only on a rarely used path, never below `minor`. An
accessibility failure that blocks a task for the affected group is a `blocker` even if most
users never notice it; one that makes the task harder but still possible for that group is a
`major`. The `impact` of a blocker or major names the row of this table it meets
("loses work", "cannot complete", "group excluded", "significant friction") and what fails on
which task, for whom; if it cannot, the severity is too high, and if it meets a blocker row,
the severity is `blocker`.

Rate what the evidence shows, not the worst case:

- When an outcome cannot be observed, such as what happens after a payment in a test
  environment, rate what you saw and state the uncertainty in `impact`.
- When an asset or state is missing from the input you were given (a fixture without its
  icons, an export without an error state), record it in `limitations` or as a coverage
  gap; it is a product defect only when the product itself is shown to lack it.

`frequency`: `widespread` appears on most surfaces or in a shared component; `recurring`
appears in several places; `isolated` appears once.

## Writing findings

- **Title:** the problem, specific to this product. "Failed payment clears the whole form",
  not "Form usability issues".
- **Observation:** what you saw or measured, reproducible by someone else: the state, the
  steps that reach it when it is not the default, and values such as ratios, sizes, timings,
  and exact copy.
- **Impact:** the consequence for a person on a task. For a destructive or costly action, say
  whether the user can reverse it in the product (undo, restore, re-create) and what is lost
  if not; state what the evidence cannot show, such as server-side recovery.
- **Principle:** the rule the observation violates. Cite the WCAG criterion only when its
  normative requirement fails; cite a guidebook rule for friction that WCAG allows.
- **Recommendation:** the change, concrete enough to implement. Name the element, value, or
  pattern. It may offer alternatives; it must not be a direction such as "improve clarity".
- **Acceptance:** a check someone else can run and see pass or fail: a probe key and value, a
  keyboard sequence and where focus lands, a measurement, or the exact copy.

Drop a finding that fails any of these:

- It has no location a reader could find.
- It restates a principle without an observed instance.
- It would read the same in an audit of a different product.
- Its recommendation is a direction, not a change: "improve hierarchy", "add more
  whitespace", "make it more consistent", "enhance the user experience".

## Migrating from version 1

Version 1 audits still validate: every version 2 rule, including re-check eligibility, only
warns, so existing reports can be rebuilt and exported. To bring one to version 2:

1. Set `"version": 2`.
2. Add `depth` from what the audit already did: list the tasks and surfaces of the deeper
   pass in `selection`, record each benchmark check with the findings it produced, and mark
   checks that were never run `unverifiable` with "not run in the original audit".
3. Add `tasks` to every blocker and major defect, and `obviousnessReason` to every signature.
4. Run the validator. It names every remaining gap — sketches ([report.md](report.md)),
   themes, journeys, strengths, re-checks — which you then fill or except with the reason.

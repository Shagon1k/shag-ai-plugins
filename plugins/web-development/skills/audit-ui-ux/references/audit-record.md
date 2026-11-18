---
audience: ai
---

# Audit record

The audit lives in files so that nothing depends on memory and every claim can be checked.
`scripts/validate-audit.mjs` enforces this contract.

```text
<audit-dir>/
  audit.json        scope, tasks, surfaces with per-lens status, priorities, re-check
  findings.jsonl    one finding per line, appended as you confirm them
  evidence/         screenshots, crops, probe and axe JSON
  annotated/        annotated images, one or more per finding
  sketches/         concept sketches (HTML source and rendered PNG) for ideas
  report.html       built by scripts/build-report.mjs
  summary.md        built by scripts/build-report.mjs
```

All paths inside the files are relative to `<audit-dir>`.

## `audit.json`

```json
{
  "version": 1,
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
    "summary": "Online shop for specialty tea; buyers are mostly returning customers on mobile.",
    "tone": "Warm, expert, unhurried",
    "idea": "Turning an everyday ritual into a small moment of craft",
    "direction": "Warm paper tones, a serif display face, generous spacing; reads as a quiet specialty shop.",
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
  "priorities": ["F-003", "F-001"],
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
  "limitations": ["Payment provider iframe was not audited."]
}
```

Field rules:

- IDs: tasks `T<n>`, surfaces `S-<nnn>`, findings `F-<nnn>`. Never reuse an ID.
- `areas`: the product scopes the report groups findings by, in reading order, such as
  public site, sign-in, the core tool, library, account. Use three to seven. Every surface
  names its `area`. A finding belongs to the area of its surfaces; when they span several
  areas it is listed under "Across the product", unless its optional `area` field names the
  area that owns the fix.
- `modes`: any of `live`, `design`, `screenshot`, `source`. A surface `mode` overrides it.
- `lenses`: the lens names every surface must carry. Defaults are the five above; drop
  `taste` only when the user asks for a rules-only audit.
- `product.idea` (optional): one sentence on what the product is really about for its users;
  the starting point for signature ideas. `product.direction` (optional): the visual and
  verbal direction as observed, written in the taste pass.
- Task `importance`: `primary` or `secondary`. Task `status`: `walked`, `partial`,
  `blocked`, or `not-walked`; every status but `walked` needs a `note`.
- Lens `status`: `pending`, `checked`, `not-applicable`, or `unverifiable`. The last two need
  a `note`. `pending` is allowed only while the audit is in progress.
- `priorities`: up to five defect IDs, most urgent first.
- `recheck` `result`: `confirmed` (no new problem) or `new-findings` (list them).
- `themes`: groups of defects (never suggestions or ideas) that share a root cause or a moment in the journey, each with
  `id` (`TH-<n>`), `title`, `rootCause`, `findings`, and a `recommendation` for the theme as a
  whole. Every blocker and major defect belongs to a theme.
- `journeys`: for each walked primary task, the measured cost of the path: `screens` visited,
  `interactions` (taps, clicks, key presses that change state), `decisions` the user must
  make, `fields` typed, `scrollPx` scrolled, and `waitSeconds` spent waiting. Count them during
  the walkthrough, on the shortest successful path, and state the viewport in `note`.
- `strengths`: what works and must survive the fixes, each with `title`, `surfaces`, and `why`.
- `verdict` (optional): one or two sentences on the overall state, written last. It opens
  the report and the summary.

## `findings.jsonl`

One JSON object per line.

```json
{"id":"F-001","kind":"defect","lens":"flow","title":"Failed payment clears the whole form","surfaces":["S-003"],"location":{"description":"Checkout form after a declined card","selector":"form#checkout","component":"src/checkout/CheckoutForm.tsx"},"observation":"After a declined test card, all fields reset to empty and the page scrolls to the top. The decline reason appears only in a toast that disappears after 3 seconds.","impact":"The buyer must retype address and card details and may not learn why the payment failed, so some will abandon the order.","principle":["FL-06","WCAG 3.3.1"],"severity":"blocker","frequency":"isolated","evidence":{"basis":"observed","files":["evidence/S-003.png"],"annotations":["annotated/F-001.svg"],"measurement":""},"recommendation":"Keep every entered value after a failed payment, show the decline reason inline above the card field, and move focus to it.","acceptance":"With a declined test card, all non-card fields keep their values, an inline message names the reason, and keyboard focus lands on it.","effort":"M"}
```

Required for every finding: `id`, `kind`, `lens`, `title`, `surfaces`, `location` (a
`description` plus `selector`, `component`, or `node` when available), `observation`,
`evidence.basis`, `evidence.files` or `evidence.measurement`, and `recommendation`.

Additionally required for `kind: "defect"`: `impact`, `principle` (at least one guidebook ID
or WCAG criterion), `severity`, `frequency`, and `acceptance`.

`kind: "suggestion"` records an opinion or improvement idea. It has no severity and never
enters `priorities`. Give it an `impact` that states the expected benefit.

`kind: "signature"` records a product-specific idea from
[signature-ideas.md](signature-ideas.md). It has no severity and never enters `priorities`.
It additionally requires `impact`, `risks`, `cost` (`accent`, `component`, `concept`), and
`obviousness` (`obvious`, `non-obvious`).

`sketches` (optional, any kind): paths to concept sketches, such as
`["sketches/F-021.png", "sketches/F-021.html"]`. The report embeds the images and links the
HTML source.

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
users never notice it.

`frequency`: `widespread` appears on most surfaces or in a shared component; `recurring`
appears in several places; `isolated` appears once.

## Writing findings

- **Title:** the problem, specific to this product. "Failed payment clears the whole form",
  not "Form usability issues".
- **Observation:** what you saw or measured, reproducible by someone else. Include values:
  ratios, sizes, timings, exact copy.
- **Impact:** the consequence for a person on a task.
- **Recommendation:** the change, concrete enough to implement. Name the element, value, or
  pattern. It may offer alternatives; it must not be a direction such as "improve clarity".
- **Acceptance:** an observable check that the problem is gone.

Drop a finding that fails any of these:

- It has no location a reader could find.
- It restates a principle without an observed instance.
- It would read the same in an audit of a different product.
- Its recommendation is a direction, not a change: "improve hierarchy", "add more
  whitespace", "make it more consistent", "enhance the user experience".

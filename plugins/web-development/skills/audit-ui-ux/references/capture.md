---
audience: ai
---

# Capture tools

How to run the phase 3 tools. Which tool a mode uses, and in what order, is in
[evidence-modes.md](evidence-modes.md).

## Files

Name files after the surface: `evidence/S-003.png`, `evidence/S-003.probes.json`,
`evidence/S-003.axe.json`, `evidence/S-003.focus-walk.json`, `evidence/S-003.nodes.json`,
`evidence/S-003.source.txt`, and crops as `evidence/S-003-crop-email.png`. Record the viewport,
device pixel ratio, and scroll offset of every screenshot; the probes report all three under
`page`.

## Browser access

Use the environment's own browser tool when it has one. When it does not, but Chrome or
Chromium is installed, drive it with `scripts/capture.mjs`: a plan of steps runs in a fresh
headless profile and writes files relative to the plan.

```bash
node scripts/capture.mjs <audit-dir>/capture-plan.json
node scripts/capture.mjs <audit-dir>/capture-plan.json --no-sandbox   # only for trusted sites
```

```json
{
  "steps": [
    { "viewport": [390, 844, 2, true] },
    { "navigate": "https://example.com/checkout" },
    { "screenshot": "evidence/S-003.png" },
    { "probes": "evidence/S-003.probes.json", "options": { "inventory": true } },
    { "navigate": "https://example.com/checkout" },
    { "focusWalk": "evidence/S-003.focus-walk.json", "count": 30 },
    { "click": "button[type=submit]" },
    { "screenshot": "evidence/S-004.png" }
  ]
}
```

Steps: `viewport` `[width, height, dpr, mobile]`, `media`, `navigate` (with `settle` ms),
`wait`, `waitFor` (selector, `timeout`), `scrollTo`, `click`, `type` with `into`, `key`
(`Tab`, `Enter`, `Escape`, arrows), `screenshot` (`fullPage`), `probes` (`options`), `evaluate`
(`out`), and `focusWalk`. The script validates the plan before it starts the browser.

The profile is empty, so the session is signed out. For authenticated areas, use the access
option the user chose in phase 1; a test-session cookie can go into the plan's `cookies`.
Some hosts block Chrome's sandbox; `--no-sandbox` works around it and must be limited to
sites the user owns or trusts.

Exit codes separate the product from the environment: `1` is a plan or page problem (a
selector that matches nothing, a page script that throws or never settles), `3` is an
environment problem (no browser, a browser that does not start or stops answering). The
script kills the browser and removes its profile on every exit. Record an environment problem
in `limitations` and mark what it would have verified `unverifiable`; it is never a finding.

## Page probes

`scripts/page-probes.mjs` prints a self-contained browser expression. Evaluate it in the
audited page with the browser tool's script-evaluation capability, or with a `probes` step,
and save the returned JSON. Pass the printed expression itself; a page with a strict content
security policy blocks scripts loaded from elsewhere, but not expressions evaluated through
the browser's debugging protocol.

```bash
node scripts/page-probes.mjs > <scratch>/probe.js      # defaults
node scripts/page-probes.mjs --focus --limit 60          # also check focus indicators
```

The result contains, with every list capped at `--limit` and a `total` count:

| Key | Contents | Leads to |
| --- | --- | --- |
| `page` | URL, title, `lang`, viewport, DPR, scroll, document size | 2.4.2, 3.1.1, annotation scaling |
| `contrast.failures` | Text below 4.5:1 or 3:1 on every possible backdrop, with colors, ratio, size, rect | 1.4.3 |
| `contrast.unknown` | Text over images, unparsed colors, or a gradient it fails on only in part (`ratio` to `bestRatio`) | Visual check where the text sits |
| `targets` | Interactive elements under 24 × 24 px; `inline` marks links in text | 2.5.8 |
| `obscured` | Controls in the viewport whose centre is covered by another element, with the cover | 2.4.11, FL-18 |
| `names` | Interactive elements without an accessible name | 4.1.2, 2.4.4 |
| `placeholderOnly` | Inputs named only by placeholder | 3.3.2, FL-15 |
| `labelNotInName` | ARIA names that do not contain the visible label; `aria-hidden` decoration is ignored | 2.5.3 |
| `images` | Images without `alt` or an accessible name | 1.1.1 |
| `headings` | Outline and issues: skipped levels, not exactly one `h1` | 1.3.1, 2.4.6 |
| `landmarks` | Counts of main, nav, header, footer; skip link presence | 2.4.1 |
| `overflow` | Horizontal page overflow and the outermost offending elements | 1.4.10, VI-10 |
| `truncation` | Clipped or line-clamped text with its full value; visually hidden text is skipped | VI-11 |
| `focusables` | Tab stop count and positive `tabindex` values | 2.4.3 |
| `focus` | With `--focus`: `noVisibleChange` (no style change on focus) and `unconfirmed` (a `:focus-visible` rule targets the element, so programmatic focus proves nothing) | 2.4.7 (heuristic) |
| `inventory` | With `--inventory`: colors, font sizes and families, radii, and shadows in use | VI-07 via `compare-tokens.mjs` |

`--focus` moves focus through the page, which can open menus or trigger handlers. Use it on
pages where that is safe, and reload before taking screenshots or a focus walk afterwards.
Confirm every `focus` item with a focus walk; the heuristic is a lead.

The name computation is simplified. Treat `names` as leads and confirm with the
accessibility tree or axe when available.

## Focus walk

A `focusWalk` step presses Tab `count` times (Shift+Tab with `"reverse": true`) right after a
navigation and records each stop: selector, name, rect, whether it is in the viewport, what
covers its centre (`obscuredBy`), whether it matches `:focus-visible`, and whether its style
differs from the same element blurred (`indicatorChanged`). Read the stops in order to find
skipped controls, illogical order, traps (the same stops repeating early), missing indicators,
and focus hidden behind sticky elements. With a browser tool of your own, press Tab and read
`document.activeElement` and its computed outline instead.

## axe-core

When the browser tool can run a script, run axe-core: inject its source inline through the
evaluation capability (fetch the file from a CDN such as
`https://cdnjs.cloudflare.com/ajax/libs/axe-core/<version>/axe.min.js` first), then run
`await axe.run(document, { runOnly: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] })`
and save `violations` and `incomplete`. If it cannot be loaded at all, continue with the
probes and record the limitation.

## Design tokens

When the project has token files, compare what pages actually use with them:

```bash
node scripts/compare-tokens.mjs evidence/S-001.probes.json src/styles/tokens.css
```

The probes must have run with `--inventory`. The script resolves `var(--x)` and `$x`
references and lists colors, font sizes, and radii that match no token, with usage counts and
an example selector. Browser defaults, such as unstyled link blue, show up here too. Treat
each entry as a lead: confirm it on the page before filing a VI-07 finding.

## Design node trees

```bash
node scripts/design-nodes.mjs evidence/S-005.nodes.json --frame 12:34
```

The input is a node tree in the shape of the Figma REST API (`{ nodes: { id: { document } } }`,
a file with `document`, or a bare node), or any export normalized to it. The script prints
`contrast.failures` and `contrast.unknown` from text fills and the nearest opaque fill behind
each text node (`unknown` when a text style is missing and the ratio sits between 3:1 and
4.5:1), `targets` for control-named nodes under 24 × 24 with the spacing exception judged and
a `statement` to quote, and `rawValues` for fills bound to no variable or style. Rects are relative to the frame, in design px. It exits 1 when
the tree has no node bounds; audit those frames in screenshot mode.

## Pixel contrast

```bash
node scripts/sample-contrast.mjs evidence/S-002.png --scale 2 --rect 24,512,342,20
```

Rects are CSS px, multiplied by `--scale` (the image's device pixel ratio). The script reads
PNG only and exits 2 with a conversion hint for other formats. Results are estimates.

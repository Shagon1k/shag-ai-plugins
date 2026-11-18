---
audience: ai
---

# Evidence, annotations, and report

## Capture

- Name files after the surface: `evidence/S-003.png`, `evidence/S-003.probes.json`,
  `evidence/S-003.axe.json`, crops as `evidence/S-003-crop-email.png`.
- Record the viewport, device pixel ratio, and scroll offset for every screenshot. The
  probes report all three under `page`.
- Viewport screenshots show what the user sees first; use them for hierarchy and
  above-the-fold judgments. Full-page screenshots help with overview and annotation of long
  pages.

## Browser access

Use the environment's own browser tool when it has one. When it does not, but Chrome or
Chromium is installed, drive it with `scripts/capture.mjs`: a plan of steps (viewport,
navigate, click, type, key, scroll, wait, screenshot, probes, evaluate) runs in a fresh
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
    { "click": "button[type=submit]" },
    { "screenshot": "evidence/S-004.png" }
  ]
}
```

The profile is empty, so the session is signed out. For authenticated areas, use the access
option the user chose in phase 1; a test-session cookie can go into the plan's `cookies`.
Some hosts block Chrome's sandbox; `--no-sandbox` works around it and must be limited to
sites the user owns or trusts.

Pages with a strict content security policy can block scripts loaded from elsewhere. When
you evaluate the probes through a browser tool, pass the printed expression directly rather
than loading it from a local server.

## Page probes

`scripts/page-probes.mjs` prints a self-contained browser expression. Evaluate it in the
audited page with the browser tool's script-evaluation capability and save the returned
JSON.

```bash
node scripts/page-probes.mjs > /tmp/probe.js          # defaults
node scripts/page-probes.mjs --focus --limit 60       # also check focus indicators
```

The result contains, with every list capped at `--limit` and a `total` count:

| Key | Contents | Leads to |
| --- | --- | --- |
| `page` | URL, title, `lang`, viewport, DPR, scroll, document size | 2.4.2, 3.1.1, annotation scaling |
| `contrast.failures` | Text below 4.5:1 or 3:1, with colors, ratio, size, rect | 1.4.3 |
| `contrast.unknown` | Text over images or gradients, or unparsed colors | Visual check |
| `targets` | Interactive elements under 24 × 24 px; `inline` marks links in text | 2.5.8 |
| `obscured` | Controls in the viewport whose centre is covered by another element, with the cover | 2.4.11, FL-18 |
| `names` | Interactive elements without an accessible name | 4.1.2, 2.4.4 |
| `placeholderOnly` | Inputs named only by placeholder | 3.3.2, FL-15 |
| `labelNotInName` | ARIA names that do not contain the visible label | 2.5.3 |
| `images` | Images without `alt` or an accessible name | 1.1.1 |
| `headings` | Outline and issues: skipped levels, not exactly one `h1` | 1.3.1, 2.4.6 |
| `landmarks` | Counts of main, nav, header, footer; skip link presence | 2.4.1 |
| `overflow` | Horizontal page overflow and the outermost offending elements | 1.4.10, VI-10 |
| `truncation` | Clipped or line-clamped text with its full value | VI-11 |
| `focusables` | Tab stop count and positive `tabindex` values | 2.4.3 |
| `focus` | With `--focus`: tab stops whose style does not change on focus | 2.4.7 (heuristic) |
| `inventory` | With `--inventory`: colors, font sizes and families, radii, and shadows in use | VI-07 via `compare-tokens.mjs` |

`--focus` moves focus through the page, which can open menus or trigger handlers. Use it on
pages where that is safe, and reload before taking screenshots afterwards.

The `focus` heuristic reports false positives on sites whose focus styles use `:focus-visible`,
because browsers often do not match it for programmatic focus. Treat it as a lead and confirm
with a real keyboard walk: press Tab and read the focused element's computed outline.

Run the probes on first-visit state as well as after dismissing consent banners; banners and
chat widgets are the most common cause of `obscured` controls.

The name computation is simplified. Treat `names` as leads and confirm with the
accessibility tree or axe when available.

### Design tokens

When the project has token files, compare what pages actually use with them:

```bash
node scripts/compare-tokens.mjs evidence/S-001.probes.json src/styles/tokens.css
```

The probes must have run with `--inventory`. The script resolves `var(--x)` and `$x`
references and lists colors, font sizes, and radii that match no token, with usage counts and
an example selector. Browser defaults, such as unstyled link blue, show up here too. Treat
each entry as a lead: confirm it on the page before filing a VI-07 finding.

### axe-core

When the browser tool can load a script, inject axe-core from a CDN such as
`https://cdnjs.cloudflare.com/ajax/libs/axe-core/<version>/axe.min.js`, run
`await axe.run(document, { runOnly: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] })`,
and save `violations` and `incomplete`. If loading is blocked, by a content security policy
or offline access, continue with the probes and note the limitation.

## Annotations

`scripts/annotate.mjs` draws numbered boxes and short callouts over a screenshot and writes
a self-contained SVG with the screenshot embedded.

```bash
node scripts/annotate.mjs annotated/F-003.json --out annotated/F-003.svg --root <audit-dir>
```

```json
{
  "image": "evidence/S-003.png",
  "scale": 2,
  "offset": { "x": 0, "y": 0 },
  "crop": { "x": 0, "y": 380, "w": 390, "h": 420, "padding": 16 },
  "marks": [
    { "id": "1", "rect": { "x": 24, "y": 512, "w": 342, "h": 20 }, "text": "Helper text 2.9:1, needs 4.5:1", "tone": "defect" },
    { "id": "2", "rect": { "x": 24, "y": 560, "w": 342, "h": 48 }, "text": "Error shown only in a toast", "tone": "defect", "approximate": true }
  ]
}
```

- Rects and crops are CSS px. `scale` is the screenshot's DPR. `offset` is subtracted from
  every rect, so pass the scroll offset when probe rects (document coordinates) are drawn on
  a viewport screenshot.
- Take rects from probe output, element bounding boxes, or design node bounds. Estimate
  only when no exact source exists, and set `"approximate": true`.
- Keep callouts under about eight words; the finding carries the explanation. Use one image
  per finding, with several marks for one pattern, and crop to the area that matters.
- `tone`: `defect` (red), `suggestion` (blue), `info` (gray). Approximate marks are dashed.
- When the session client cannot display SVG, open the SVG in the browser tool and save a
  screenshot of it as a PNG with the same basename. The summary prefers the PNG.

When the audit has only screenshots, estimate text contrast from pixels:

```bash
node scripts/sample-contrast.mjs evidence/S-002.png --scale 2 --rect 24,512,342,20
```

Crops keep reports small: with a `crop`, only the cropped region of a PNG is embedded.

## Concept sketches

A sketch makes a recommendation visible: a signature idea, a taste suggestion, or the fix for
a prioritized visual defect. It is a picture of the idea, not an implementation, and must say
so. For visual work, one sketch beside the current screenshot persuades more than a
paragraph.

When a finding has both a sketch and a current image (an annotation or a screenshot), the
report shows them side by side as "Now" and "Proposed". Sketch the same viewport and the
same content as the current image so the pair compares like with like.

- Write one self-contained HTML file per idea in `<audit-dir>/sketches/`, named after the
  finding: `F-021.html`. No network requests; inline styles and SVG only.
- Use the product's tokens, fonts, and real copy where known, so the sketch reads as this
  product rather than a generic mockup.
- Prefer an in-context sketch: the surface's screenshot as the background, with the new
  element drawn over the spot where it would live. A standalone component sketch fits ideas
  that have no single location.
- Keep it to one viewport, and add a small visible label: "Concept sketch" that does not
  cover the content being proposed.
- For phone sketches, include `<meta name="viewport" content="width=device-width,
  initial-scale=1">`; without it, mobile emulation lays the page out 980 px wide and the
  sketch renders shrunken in a corner. Look at every rendered sketch before using it.
- Render it to `F-021.png` with the browser tool or `scripts/capture.mjs`, and list both files
  in the finding's `sketches`. The report embeds the PNG and names the HTML source.

## Report

`scripts/build-report.mjs <audit-dir>` validates the audit, then writes:

- `report.html`: self-contained, with annotated images embedded, findings ordered by
  severity and frequency, filters by severity and lens, a search box, task and coverage
  tables, context, assumptions, and limitations. It works offline and can be attached or
  shared as one file.
- `summary.md`: the verdict, counts, coverage, the fix-first list with absolute image paths,
  and limitations. Use it as the basis of the session reply.

Set the optional `audit.json` field `verdict` to one or two sentences before building; it
opens both outputs. Keep the report under about 15 MB by cropping annotations; the builder
warns above that size.

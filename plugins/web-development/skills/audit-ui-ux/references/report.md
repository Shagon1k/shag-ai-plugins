---
audience: ai
---

# Annotations, sketches, and report

Annotations show what is wrong on a real capture. Sketches show what the recommendation would
look like. The report keeps the two visibly apart: evidence has a plain frame and a "Now"
caption; a concept has a dashed frame and a "Proposed · concept sketch" caption.

## Annotations

`scripts/annotate.mjs` draws numbered boxes and short callouts over a screenshot and writes a
self-contained SVG with the screenshot embedded.

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

- Annotate every defect that has a visual location. Source-mode findings have none.
- Rects and crops are CSS px. `scale` is the screenshot's DPR (or a design frame's export
  scale). `offset` is subtracted from every rect, so pass the scroll offset when probe rects
  (document coordinates) are drawn on a viewport screenshot.
- Take rects from probe output, element bounding boxes, a focus walk, or
  `design-nodes.mjs`. Estimate only when no exact source exists, and set `"approximate": true`;
  approximate marks are dashed and prefixed with "≈".
- Keep callouts under about eight words; the finding carries the explanation. Use one image
  per finding, with several marks for one pattern, and crop to the area that matters: with a
  `crop`, only the cropped region of a PNG is embedded.
- `tone`: `defect` (red), `suggestion` (blue), `info` (gray).
- When the session client cannot display SVG, open the SVG in the browser tool and save a
  screenshot of it as a PNG with the same basename. The summary prefers the PNG.

## Concept sketches

Show, do not only tell. This is the only definition of which findings need a sketch:

- **Every finding** — defect, suggestion, or signature idea — has a sketch of the proposed
  change, or
- `noSketch` with the reason when its change is not visual, such as a copy-only change, a
  markup or ARIA change, a larger hit area that looks the same, or behavior with no visible
  difference (focus order, timing), or
- one audit-level `sketches` exception when nothing can be rendered, naming the render you
  tried and how it failed, or an exception naming the findings whose sketch cannot match (for
  example a version 1 audit whose site is gone).

`noSketch` never applies to a `visual`-lens finding or to colour, contrast, and
focus-visibility criteria (WCAG 1.4.1, 1.4.3, 1.4.11, 2.4.7, 2.4.11, 2.4.13): their fix
always changes what the user sees. For other findings, use `noSketch` only when someone
looking at the fixed screen could not tell it changed.

In version 2 the validator rejects a finding with none of these, a `noSketch` on those
findings, a sketch whose shape differs from its Now image by more than 15%, and one sketch
shared by findings with different Now images. It cannot check that the content matches; look
at each pair yourself.

Make each sketch like this:

1. Write one self-contained HTML file per finding in `sketches/`, named after it:
   `F-021.html`. No network requests; inline styles and SVG only.
2. Sketch the same viewport and the same content as the finding's current image (its first
   annotation, else its screenshot), so "Now" and "Proposed" compare like with like. A
   finding with a cropped annotation gets a sketch of the same crop. Never reuse one sketch
   for findings whose current images differ; the validator rejects both.
3. Prefer an in-context sketch: the surface's screenshot as the background, with the new
   element drawn over the spot where it would live. A standalone component sketch fits ideas
   that have no single location.
4. Use the product's tokens, fonts, and real copy where known, so the sketch reads as this
   product rather than a generic mockup.
5. Add a small visible "Concept sketch" label that does not cover the content being proposed.
6. For phone sketches, include `<meta name="viewport" content="width=device-width,
   initial-scale=1">`; without it, mobile emulation lays the page out 980 px wide and the
   sketch renders shrunken in a corner.
7. Render it to `F-021.png` with the browser tool or a `capture.mjs` plan at the current
   image's viewport and DPR, look at the PNG, and list both files in the finding's `sketches`.

A sketch is a picture of the idea, not an implementation, and must say so.

## Report

`scripts/build-report.mjs <audit-dir>` validates the audit, then writes:

- `report.html`: self-contained and offline. The first screen holds the verdict, the counts,
  and a contents box that links each fix-first finding and every area. Then come fix first,
  themes, journey cost, strengths, problems grouped by area and ordered by severity, ideas
  (suggestions and signatures) apart from problems, the depth pass, the limits of each mode
  (what the mode can never verify, lenses marked unverifiable, depth checks that could not
  run, exceptions, and limitations), tasks, the coverage ledger, and context.
- `summary.md`: the session reply in long form, in the reply's order (below). Items without
  an image carry an `_Images: …_` line naming what is missing and why. The disclaimer names
  only the evidence this audit's modes produced.

Embedded images are optimized: PNGs wider than `--image-width` (default 1280 px) are scaled
down, color channels are reduced to 6 bits, and SVG annotations are embedded as text with
their screenshot re-encoded. Vector marks and callouts stay sharp. Use `--lossless` when exact
pixels matter, such as an annotation that shows a subtle color difference. The report budget
is 6 MB; above it the builder warns, and cropping annotations is the first remedy.

## Session reply

Write the reply from `summary.md`, section by section and in its order. Shorten prose, but
copy numbers, image lines, the disclaimer, and the next-step question exactly; never recount.

1. The verdict and the counts; in a re-audit, also what changed since the last audit.
2. Fix first. For each item, its image lines (annotation and sketch) copied as Markdown
   images, `![…](path)`, so the client shows them inline; a plain link to an image does not
   count. Or its `_Images: …_` line. When the client cannot display images at all, say so
   once.
3. Themes and the journey cost.
4. What works: the strengths a fix must not break.
5. Ideas, apart from problems: signature ideas and suggestions, each with its Now and
   Proposed image lines or its `_Images: …_` line. A taste judgement keeps its opinion label
   here too ("in our view, the plain look suits…").
6. The depth pass and the limits: each mode's limits, exceptions, and limitations.
7. The absolute path of `report.html`, then the disclaimer.
8. Last, the next-step question, word for word. Start none of those steps yourself.

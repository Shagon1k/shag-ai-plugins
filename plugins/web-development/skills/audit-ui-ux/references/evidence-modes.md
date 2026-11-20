---
audience: ai
---

# Evidence modes

The mode decides what you can verify and how precise annotations are. Record the mode in
`audit.json` (per surface when inputs differ) and the basis of every finding. This file is the
only definition of mode limits; the tools named here are documented in
[capture.md](capture.md).

## Choose

| Mode | Use when | Annotation rects | Finding basis |
| --- | --- | --- | --- |
| `live` | A running app, preview, or URL that a browser tool can open | Exact: DOM rects | `measured`, `observed` |
| `design` | A design file reachable through a design-tool integration, or exported frames with their node tree | Exact: node bounds | `design-node` |
| `screenshot` | Only image files, or design frames exported without a node tree | Estimated, marked approximate | `visual-estimate` |
| `source` | Front-end code without a way to render it | None | `source` |

Prefer the most precise mode available. If the user gives screenshots but the app is
reachable and they agree, audit it live and use the screenshots as references. Combine modes
when inputs differ by screen; set the mode per surface in that case.

When the code is available in any mode, map findings to components or files. A developer
fixes `src/checkout/EmailField.tsx`, not `div:nth-of-type(3)`.

## What each mode can verify

`yes` means verifiable; `partial` means verifiable with stated limits; `no` means mark the
lens or check `unverifiable` with the reason.

| Check | live | design | screenshot | source |
| --- | --- | --- | --- | --- |
| Task flow across screens | yes | partial: only prototyped or drawn paths | partial: only supplied sequence | partial: from routes and handlers |
| States: empty, loading, error | yes, when reachable | partial: only drawn states | partial: only supplied states | partial: from code paths |
| Keyboard, focus order, focus visibility | yes | no | no | partial: from markup and styles |
| Semantics, names, roles | yes | no | no | yes, from markup |
| Text contrast | yes, computed | yes, from fills | partial: sampled pixels, no gradients or transparency | partial: from tokens, not from overlaps |
| Target size | yes, measured | yes, from node size | partial: estimated | partial: from styles |
| Layout, overflow, responsive behavior | yes | partial: only drawn viewports | partial: only supplied viewports | no |
| Visual hierarchy and consistency | yes | yes | yes | partial: consistency and type from styles; no rendered hierarchy |
| Interface copy | yes | yes | yes | yes |
| Motion and timing | yes | partial: prototype motion | no | partial: from code |

Write each `partial` limit, and any `no` that matters for a surface, into the lens note of
the surfaces it affects. The report and summary list each mode's `no` rows from this table and
the unverifiable lenses under "Limits of this audit".

## Live

1. Open the surface in the environment's browser tool, or plan it for `capture.mjs`. Set the
   viewport explicitly and record the device pixel ratio.
2. Reach the state honestly: through the UI, test data, or documented dev tooling. Record how
   you reached it when it is not obvious.
3. Save a viewport screenshot as `evidence/<surface>.png`; add a full-page capture only for
   overview. Viewport screenshots carry above-the-fold judgments.
4. Run the page probes on the same state and save `evidence/<surface>.probes.json`. Probe
   first-visit state and again after dismissing consent banners.
5. Run axe-core when it can be injected; save `evidence/<surface>.axe.json`.
6. On the pages of primary tasks, record a focus walk right after a fresh load.
7. Prefer a fresh session per persona so earlier state does not hide first-time problems.

Probe rects are document coordinates in CSS pixels: use them directly with full-page
screenshots and subtract the scroll offset for viewport screenshots.

Fallbacks: without a browser tool, use `capture.mjs`. When no browser starts (`capture.mjs`
exits 3), the run is an environment failure: record it in `limitations` and switch the
affected surfaces to `source` mode when code is available, or ask the user for screenshots.
When a content security policy blocks injected scripts, see [capture.md](capture.md).

## Design

1. Read the frames in scope through the environment's design-tool integration when one is
   available; otherwise ask for exports of the frames at a known scale together with their
   node tree (for example the design tool's API response for those frames).
2. For each frame, save the rendered image as `evidence/<surface>.png` and the node tree as
   `evidence/<surface>.nodes.json`, and note the export scale.
3. Run `scripts/design-nodes.mjs` on the node tree. Confirm each lead on the image: contrast
   failures from fills, small controls from node bounds, and fills with raw values instead
   of variables or styles (VI-07 leads). Read the file's variables and styles as the design
   system; near-duplicates of existing styles are consistency leads too. Judge target size on
   the drawn bounds: put each small target's `statement` (the size against 24 × 24 px and the
   spacing-exception verdict) into the finding's observation, and make the built hit area the
   acceptance check instead of leaving the finding open.
4. Annotate with the frame-relative rects the script prints, `scale` set to the export scale,
   and the node ID as `location.node`.
5. Check what the design does not show: missing states (empty, loading, error, long
   content), missing viewports, and interactions that exist only as a static frame. Record
   them as `unverifiable` or as findings about the design's coverage, not as defects of a
   product you have not seen.

A design does not prove behavior. Interaction findings are about the design's intent and must
say so.

Fallbacks: frames exported without a node tree (only images) are audited in screenshot mode;
set those surfaces' `mode` to `screenshot`. A node tree without frame images still supports
design mode: save the tree as the surface's evidence, give rects and node IDs in each
finding's `location` and `measurement` instead of an annotation, and render sketches from the
node data or record a `sketches` exception. A text node without a fill or type style gives an
`unknown` contrast lead, because its 3:1 or 4.5:1 threshold is unknown; estimate it with
`sample-contrast.mjs` on a frame image if one exists, else report it as a gap in the design.

## Screenshot

1. Ask once, in one grouped question, for the context that changes the audit: the viewport
   and device pixel ratio, the task each screen belongs to, the order of screens, and which
   states exist. Proceed with stated assumptions if the user cannot answer.
2. Copy each image into `evidence/` as `<surface>.png`. Each image is one surface. A sequence
   of images can support a flow walkthrough of the steps shown; anything between them is
   `unverifiable`.
3. Estimate text contrast with `scripts/sample-contrast.mjs`, drawing the rect tightly around
   the text. The result is a `visual-estimate`: thin text and anti-aliasing can make it read
   about 0.3 higher than the true ratio, so treat values within 0.5 of a threshold as
   uncertain and recommend a measured check.
4. Estimate rects from the image and mark every annotation `approximate`.
5. Semantics, keyboard, focus, names, and live behavior stay `unverifiable`; the keyboard
   depth check is `unverifiable` too.

Fallbacks: `sample-contrast.mjs` reads PNG only. Convert a JPEG or WebP screenshot: write
`evidence/<surface>.view.html` containing `<body style="margin:0"><img src="<image>">`, open
it at the image's size and device pixel ratio 1 (a browser tool, or a `capture.mjs` plan with
`viewport`, `navigate`, `screenshot`), and save `evidence/<surface>.png`. When no browser is
available, mark contrast `unverifiable`.
Annotations embed PNG, JPEG, WebP, and GIF directly.

## Source

1. Read the markup, styles, and tokens of the screens in scope, and the route definitions.
2. Save the excerpts you judge as `evidence/<surface>.source.txt`, with file paths and line
   numbers, and cite them in findings with basis `source`.
3. Check semantics, labels, state handling across code paths, copy, and contrast between
   token values.
4. Check the `visual` lens on what the styles state: whether one component or role is styled
   one way everywhere; whether spacing, type sizes, radii, and colors follow a scale (the
   tokens, or the values the code repeats, with one-off values as the deviations); body text
   size; line-length limits; clipping without an ellipsis; and the relative size and weight
   of the key elements. Mark it `checked` with a note that rendered layout and hierarchy were
   not seen. The small-viewport state is `unverifiable`. Do not describe how the page looks
   beyond what the styles state.
5. Record the keyboard depth check as `done` only for what the markup shows (native controls,
   tab order, key handlers), and say in its note that no browser exercised it.

A source audit takes no screenshots and has no annotations; skip phase 5 annotations for its
findings. Sketch a proposed change by rendering the edited markup in a copy under `sketches/`
when a browser is available; otherwise record a `sketches` exception with the reason.

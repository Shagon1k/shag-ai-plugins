---
audience: ai
---

# Evidence modes

The mode decides what you can verify and how precise annotations are. Record the mode in
`audit.json` and the basis of every finding.

## Choose

| Mode | Use when | Annotation rects | Finding basis |
| --- | --- | --- | --- |
| `live` | A running app, preview, or URL that a browser tool can open | Exact: DOM rects | `measured`, `observed` |
| `design` | A design file reachable through a design-tool integration or a detailed export | Exact: node bounds | `design-node` |
| `screenshot` | Only image files | Estimated, marked approximate | `visual-estimate` |
| `source` | Front-end code without a way to render it | None, or estimated from a render you could not verify | `source` |

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
| Visual hierarchy and consistency | yes | yes | yes | no |
| Interface copy | yes | yes | yes | yes |
| Motion and timing | yes | partial: prototype motion | no | partial: from code |

## Mode notes

### Live

- Set the viewport explicitly for each surface. Record device pixel ratio; screenshots are
  usually captured at DPR × CSS pixels, and annotation rects must be scaled to match.
- Probe rects are document coordinates in CSS pixels. Use them directly with full-page
  screenshots; subtract the scroll offset for viewport screenshots.
- Prefer a fresh session per persona so earlier state does not hide first-time problems.

### Design

1. Read the file through the environment's design-tool integration when one is available;
   otherwise ask for exports of the frames in scope at a known scale.
2. For each frame in scope, collect a rendered image (the screenshot), its node tree with
   bounds, fills, and text styles, and the file's variables or styles.
3. Annotation rects are node bounds relative to the frame. Set `scale` to the export scale and
   `offset` to the frame's origin when bounds are absolute on the canvas. Use the node ID as
   `location.node`.
4. Contrast comes from the fills of a text node and the nearest opaque fill behind it.
   Compute it with the same ratio as the probes; translucent fills need blending.
5. The variables and styles are the design system. Nodes with raw values instead of
   variables, or near-duplicates of existing styles, are consistency leads (VI-07).
6. Check what the design does not show: missing states (empty, loading, error, long content),
   missing viewports, and interactions that only exist as a static frame. Record them as
   `unverifiable` or as findings about the design's coverage, not as defects of a product
   you have not seen.

A design does not prove behavior. Interaction findings are about the design's intent and
must say so.

### Screenshot

1. Ask once, in one grouped question, for the context that changes the audit: the viewport
   and device pixel ratio, the task each screen belongs to, the order of screens, and which
   states exist. Proceed with stated assumptions if the user cannot answer.
2. Treat each image as one surface. A sequence of images can support a flow walkthrough of
   the steps shown; anything between them is `unverifiable`.
3. Estimate rects from the image and mark every annotation `approximate`.
4. Estimate text contrast with `scripts/sample-contrast.mjs`, drawing the rect tightly around
   the text. The result is a `visual-estimate`: thin text and anti-aliasing can make it read
   about 0.3 higher than the true ratio, so treat values within 0.5 of a threshold as
   uncertain and recommend a measured check.
5. Semantics, keyboard, focus, names, and live behavior stay `unverifiable`.

### Source

- Read the markup, styles, and tokens of the screens in scope. Check semantics, labels,
  state handling, copy, and token contrast.
- Without a render, `visual` is `unverifiable` for layout and hierarchy. Do not describe how
  the page looks unless you rendered it.

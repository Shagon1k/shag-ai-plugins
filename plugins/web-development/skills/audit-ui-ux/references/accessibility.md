---
audience: ai
---

# Accessibility checks

Baseline: WCAG 2.2 level AA. Cite failures as `WCAG <criterion>` in a finding's
`principle`. Automated tools find only part of the problems, so a clean probe or axe run
never means the interface is accessible. The manual checks below are what make this
lens worth running.

## Method per criterion

`probe` = `scripts/page-probes.mjs` output key; `axe` = axe-core rule results when available;
`manual` = you check it in the browser; `visual` = you judge it from screenshots.

| Criterion | What to check | Method |
| --- | --- | --- |
| 1.1.1 Non-text content | Meaningful images have alt text; decorative ones are hidden | probe `images`, axe, manual |
| 1.3.1 Info and relationships | Headings, lists, tables, and form labels exist in markup, not only visually | probe `headings`, `names`, axe |
| 1.3.5 Identify input purpose | Personal-data fields have `autocomplete` | manual, source |
| 1.4.1 Use of color | State and meaning do not rely on color alone | visual |
| 1.4.3 Contrast (minimum) | Text 4.5:1; large text (24 px, or 18.66 px bold) 3:1 | probe `contrast`, axe |
| 1.4.4 Resize text | At 200% browser zoom nothing is clipped or lost | manual |
| 1.4.10 Reflow | At 320 CSS px width no two-dimensional scrolling, except for content that needs it | probe `overflow` at 320 px, manual |
| 1.4.11 Non-text contrast | Control boundaries, focus indicators, and meaningful graphics reach 3:1 | visual, manual |
| 1.4.12 Text spacing | Increased line, paragraph, letter, and word spacing causes no loss | manual |
| 1.4.13 Content on hover or focus | Tooltips and popovers can be dismissed, hovered, and persist | manual |
| 2.1.1 Keyboard | Every function works with a keyboard | manual |
| 2.1.2 No keyboard trap | Focus can always leave a component | manual |
| 2.2.1 Timing adjustable | Time limits and auto-dismissing messages can be extended or avoided | manual |
| 2.4.1 Bypass blocks | A skip link or landmarks let users bypass repeated blocks | probe `landmarks`, manual |
| 2.4.2 Page titled | Each page or view has a descriptive title | probe `page.title` |
| 2.4.3 Focus order | Focus order follows the visual and logical order | probe `focusables`, manual |
| 2.4.4 Link purpose | Link text, with its context, says where it goes | probe `names`, visual |
| 2.4.6 Headings and labels | Headings and labels describe their content | visual |
| 2.4.7 Focus visible | A visible indicator shows where keyboard focus is | probe `focus` (heuristic), manual |
| 2.4.11 Focus not obscured | Focused elements are not hidden by sticky headers, banners, or chat widgets | manual |
| 2.5.3 Label in name | A control's accessible name contains its visible label | probe `names`, manual |
| 2.5.7 Dragging movements | Every drag action has a single-pointer alternative | manual |
| 2.5.8 Target size (minimum) | Targets are at least 24 × 24 CSS px or have enough spacing | probe `targets`, then judge exceptions |
| 3.1.1 Language of page | `lang` is set correctly | probe `page.lang` |
| 3.2.1 / 3.2.2 On focus, on input | Focus or input does not change context unexpectedly | manual |
| 3.2.6 Consistent help | Help mechanisms appear in the same relative place | visual |
| 3.3.1 Error identification | Errors are identified in text and tied to the field | manual |
| 3.3.2 Labels or instructions | Inputs have visible labels and needed instructions | probe `placeholderOnly`, visual |
| 3.3.3 Error suggestion | Errors suggest a fix when one is known | manual |
| 3.3.7 Redundant entry | Information entered earlier in a process is not requested again | manual |
| 3.3.8 Accessible authentication | Login does not require a cognitive test without an alternative; paste works | manual |
| 4.1.2 Name, role, value | Custom controls expose name, role, and state | probe `names`, axe, manual |
| 4.1.3 Status messages | Status updates are announced without moving focus | manual, source |

Beyond AA, check `prefers-reduced-motion` support and flag motion that ignores it under
VI-13; it is not an AA failure.

## Manual procedures

Run these on primary task paths at minimum. Record what you did in the surface note when
the result is not obvious from the finding.

1. **Keyboard walkthrough.** From the top of the page, complete each primary task with Tab,
   Shift+Tab, Enter, Space, Escape, and arrow keys only. Note unreachable controls, focus
   that disappears or jumps, traps, missing visible focus, and focus hidden behind sticky
   elements.
2. **Dialogs and menus.** Opening moves focus into the dialog; Escape closes it; focus
   returns to the trigger; background content is not reachable while a modal is open.
3. **Zoom and reflow.** Set the viewport to 320 CSS px wide and rerun the overflow probe.
   Then check 200% zoom on a desktop viewport.
4. **Text spacing.** Apply line-height 1.5, paragraph spacing 2× font size, letter spacing
   0.12 em, and word spacing 0.16 em through an injected stylesheet; look for clipping and
   overlap.
5. **Errors.** Submit each form empty and with invalid values. Check the message text, its
   placement, its association with the field, and where focus goes.
6. **Assistive technology.** When a screen reader or accessibility tree inspector is
   available, check the names and roles of custom controls and whether status messages are
   announced. When neither is available, mark those checks `unverifiable`.

## Triage of automated results

- Confirm each probe or axe failure on the page. Contrast over images, gradients, or
  overlapping elements is reported as `unknown` by the probe; judge it visually and mark the
  basis `visual-estimate`.
- Group one failure pattern into one finding with all its surfaces, such as "Gray helper
  text fails contrast across all forms", instead of one finding per element.
- A small target can pass 2.5.8 through spacing or the inline-text exception. Judge the
  exception before filing a defect.

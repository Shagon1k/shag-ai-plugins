---
audience: ai
---

# Taste and direction (lens `taste`)

Rules set the floor; they cannot make an interface memorable. This lens asks whether the
interface has an intentional direction that fits the product, and proposes how to make it
more its own.

Everything this lens produces is an opinion, labelled as one, and never a defect:

- A proposed change is a `suggestion`; a product-specific idea is a `signature`.
- A judgement that something already fits, such as a restrained direction that suits a
  utility, goes into `product.direction`, or into `strengths` when a fix must not break it,
  worded as an opinion wherever it appears ("in our view…").
- A change you would propose is recorded as a suggestion before the reply mentions it; the
  reply proposes nothing the record lacks.
- The `verdict` reports task success and defects only; no taste judgement goes there.

If a stylistic choice breaks a rule, such as contrast or legibility, file that under the
rule's lens instead.

## What this lens takes from `frontend-design`

Anthropic's `frontend-design` skill guides building new interfaces with an intentional,
non-templated aesthetic. An audit judges an existing interface instead, so each idea is turned
from an instruction to build into a question to ask:

| Borrowed from `frontend-design` | Applied in this audit |
| --- | --- |
| Start from purpose, audience, and tone before choosing a look | Phase 1 product understanding; section 2 checks the direction against it |
| Commit to one clear aesthetic direction and execute it with intent | Section 1: name the direction you see; failing to name one is the first observation |
| Typography, color, motion, spatial composition, and background detail are the levers | The dimensions written into `product.direction` and compared in section 2 |
| Avoid generic, templated aesthetics that ignore the subject | Section 3: template defaults, flagged only where they do no work for this content |
| Spend motion and boldness on a few high-impact moments | Section 4 expression zones, section 5 restraint, VI-13 for motion |
| Ask what someone will remember | Section 5: name the one memorable thing; signature ideas create it from the domain |
| Match the effort of the execution to the vision | The `cost` of signature ideas and the restraint check |

Not borrowed: the push for novelty everywhere, and bans on specific fonts or palettes. An
existing product's brand, design system, and convention zones outrank novelty, and a plain
system font can be the right choice for a utility.

## 1. Name the direction

Before judging, write one or two sentences in `audit.json` under `product.direction`: the
palette, type, layout rhythm, imagery, motion, and voice you actually see, and what they add
up to. If you cannot name a direction, that is the first observation.

## 2. Check the fit

Compare the direction with the product summary, audience, and tone from phase 1:

- Does the visual voice match how the product talks and who it serves? A calm tool for
  professionals and a playful product for children should not look interchangeable.
- Does the direction come from the product's subject — its materials, objects, vocabulary —
  or could it be swapped onto any other product unchanged?
- Is it consistent across public pages and the logged-in app, or does the app fall back to
  library defaults?

## 3. Spot template defaults

Generated and templated interfaces cluster around the same choices. Each is legitimate for
some products; flag one only when it appears regardless of the subject and does no work for
the content. Look for:

- Content chopped into identical cards with one radius and the same soft shadow, whatever
  the hierarchy.
- Gradient washes, glows, and blurred blobs used as decoration rather than meaning.
- A small letter-spaced uppercase label above every heading.
- Numbered markers (01, 02, 03 or I, II, III) on content that is not a sequence.
- One ubiquitous sans-serif for everything, with little contrast between sizes or weights.
- A centered hero of headline, subline, two buttons, and an illustration, for any subject.
- One word of the headline set in the accent color or italics as the only typographic idea.
- Entrance animations on every section and hover lifts on every card.
- An icon beside every heading, or emoji standing in for icons.
- Meta strings joined with middle dots, and an arrow appended to every button label.
- The three-features row with an icon, a title, and two lines each.

Report a tell as one `suggestion` with a concrete alternative grounded in this product.

## 4. Separate convention zones from expression zones

| Zone | Examples | Expectation |
| --- | --- | --- |
| Convention | Navigation, forms, checkout, settings, tables, errors | Familiar patterns win (Jakob's law). Novelty here costs usability. |
| Expression | First screen, empty states, loading, success, 404, onboarding, the product's signature moment | Identity belongs here. Blandness is a missed opportunity. |

- Expression in a convention zone that slows the task is a defect under `flow` or `visual`.
- Blandness in an expression zone is a `suggestion`, or material for a signature idea.

## 5. Check restraint

A distinctive interface usually spends its boldness in one place and keeps the rest quiet.

- Is there one memorable thing? Name it.
- If every surface competes for attention (decoration, accent color, motion everywhere),
  suggest what to remove, not what to add.
- Decoration that repeats on every page stops being noticed and starts being noise.

## 6. Write suggestions

Record each as a `suggestion` with `lens: "taste"` ([audit-record.md](audit-record.md)): the
`observation` names where it appears and why it reads as it does here, the `impact` states the
expected benefit (clearer identity, a more memorable moment, less noise), and the
`recommendation` names the element, the treatment, and the token or value, and why it fits
this product. Sketch it as [report.md](report.md) describes.

Keep the strongest three to seven. Do not pad the list with variations of one idea.

## Guardrails

- Never contradict the user's stated brand, design system, or design decisions without
  naming the conflict; suggest, do not overrule.
- Taste never outranks accessibility or task success.
- Do not present taste as consensus or as a measured result.
- Do not recommend a look by naming another product; describe the treatment.

---
audience: ai
---

# Taste and direction (lens `taste`)

Rules set the floor; they cannot make an interface memorable. This lens asks whether the
interface has an intentional direction that fits the product, and proposes how to make it
more its own. It draws on the direction-and-restraint thinking of Anthropic's
`frontend-design` skill.

Everything this lens produces is a `suggestion` or a `signature` idea: an opinion, labelled as
one. It never produces a defect. If a stylistic choice breaks a rule, such as contrast or
legibility, file that under the rule's lens instead.

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

Report a tell as one `suggestion` that names where it appears, why it reads as a default
here, and a concrete alternative grounded in this product.

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

Each `suggestion` with `lens: "taste"`:

- `observation`: what you see, with location, specific to this product.
- `impact`: the expected benefit, such as clearer identity, a more memorable moment, or less
  noise.
- `recommendation`: the concrete change — the element, the treatment, the token or value —
  and why it fits this product.

Keep the strongest three to seven. Do not pad the list with variations of one idea.

## Guardrails

- Never contradict the user's stated brand, design system, or design decisions without
  naming the conflict; suggest, do not overrule.
- Taste never outranks accessibility or task success.
- Do not present taste as consensus or as a measured result.
- Do not recommend a look by naming another product; describe the treatment.

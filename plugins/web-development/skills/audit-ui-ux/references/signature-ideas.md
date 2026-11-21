---
audience: ai
---

# Signature ideas

A signature idea is a product-specific interface move that could only belong to this product,
because it comes from the product's own subject rather than from generic UI patterns. It is an
opinion, never a defect. Every audit that keeps the `taste` lens proposes one to three; when
none fits, record a `signatures` exception with the reason (see
[audit-record.md](audit-record.md)).

This file teaches the method only. It contains no example idea on purpose: an example from one
domain gets copied into the next audit. Every idea must come from the audited product.

## Method

1. **Start from the core idea.** Take `product.idea` from phase 1: what the product is really
   about for its users, beyond its features.
2. **Mine the domain.** Fill the worksheet below from the product itself (its copy, imagery,
   names, onboarding, help pages) and from what its audience knows. Write at least three
   entries per row before choosing.
3. **Find the moments.** Pick interface moments where a metaphor helps and cannot hurt:
   loading and progress, empty states, success and completion, transitions between steps,
   404 and error pages, onboarding, and the product's own signature moment. These are the
   expression zones of [taste.md](taste.md). Avoid core navigation, forms, and anything the
   user operates many times a day.
4. **Generate, then push past the obvious.** The first metaphor that comes to mind is the one
   everyone would propose. Record it as `obvious`, then find at least one idea that needs
   real knowledge of the domain or of this product's users, and mark it `non-obvious`. In
   `obviousnessReason`, name that knowledge: the ritual, the material, or the user moment the
   idea depends on, and why someone who only skimmed the product would not propose it.
5. **Check usability.** The idea must keep the underlying control or message working without
   the metaphor:
   - the control keeps its role, name, and keyboard behavior;
   - text stays readable, and status stays clear without the visual;
   - motion respects `prefers-reduced-motion`;
   - it does not slow a frequent task or add a step.
   An idea that fails these checks is dropped or proposed together with its fix in `risks`.
6. **Respect tone and restraint.** One to three ideas per product. A metaphor everywhere is a
   theme park. A restrained product earns a restrained gesture; match the size of the idea
   (`cost`) to the tone.

## Worksheet

| Row | Prompt | Your entries |
| --- | --- | --- |
| Objects and tools | What does anyone in this domain recognize at a glance? | |
| Rituals and gestures | What do people do with those objects, and in what order? | |
| Materials, textures, sounds | What does the domain feel, look, or sound like? | |
| Vocabulary | Which words does the audience use that outsiders do not? | |
| Moments of tension | Where in the product does the user wait, worry, or celebrate? | |
| Users' own knowledge | What do this product's users know that a generic user would not? | |

An idea is a pairing of one entry from the first four rows with one moment. A non-obvious idea
usually draws on the last row.

## Recording and showing

Record each idea as a `signature` finding ([audit-record.md](audit-record.md)):
`location.description` names the expression zone it lives in, `observation` the moment today
and the domain element used, `risks` the usability check: each risk named first ("the
progress ring alone does not tell a screen reader the step"), then how the idea handles it.
A list of safeguards without the risks they answer does not pass the check. Sketch
it as [report.md](report.md) requires.

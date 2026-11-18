---
audience: ai
---

# Signature ideas

A signature idea is a product-specific interface move that could only belong to this product,
because it comes from the product's own subject rather than from generic UI patterns. It is
optional, never a defect, and never required for a passing audit.

## Method

1. **Start from the core idea.** Use the product understanding from phase 1. Write one
   sentence on what the product is really about for its users, beyond its features.
2. **Mine the domain.** List what anyone familiar with the subject recognizes at a glance:
   - objects and tools of the domain;
   - rituals and gestures people perform with them;
   - materials, textures, and sounds;
   - the vocabulary the audience uses.
3. **Find the moments.** Pick interface moments where a metaphor helps and cannot hurt:
   loading and progress, empty states, success and completion, transitions between steps,
   404 and error pages, onboarding, and the product's own signature moment. Avoid core
   navigation, forms, and anything the user operates many times a day.
4. **Generate, then push past the obvious.** The first metaphor that comes to mind is the one
   everyone would propose. Record it, then find at least one idea that needs real knowledge of
   the domain or of this product's users. Mark each idea `obvious` or `non-obvious`.
5. **Check usability.** The idea must keep the underlying control or message working without
   the metaphor:
   - the control keeps its role, name, and keyboard behavior;
   - text stays readable, and status stays clear without the visual;
   - motion respects `prefers-reduced-motion`;
   - it does not slow a frequent task.
   An idea that fails these checks is dropped or proposed together with its fix.
6. **Respect tone and restraint.** One to three signature ideas per product. A metaphor
   everywhere is a theme park. A restrained product earns a restrained gesture.

## Format

Record each idea in `findings.jsonl` with `kind: "signature"`:

| Field | Contents |
| --- | --- |
| `title` | The idea in a few words |
| `surfaces`, `location.description` | The moment where it lives |
| `observation` | What happens at that moment today, and the domain element the idea uses |
| `recommendation` | The idea, concrete enough to sketch |
| `impact` | Why it fits this product and what it does for users |
| `risks` | Usability, accessibility, or performance risks and how the idea handles them |
| `cost` | `accent` (a small touch), `component` (one reusable piece), or `concept` (a cross-cutting change) |
| `obviousness` | `obvious` or `non-obvious` |

Back the strongest idea with a concept sketch when the environment can render HTML; see
[evidence-and-report.md](evidence-and-report.md).

## Abstract example

For a fictional app that helps people learn to brew coffee: the obvious idea is a progress
bar shaped like a filling cup. A non-obvious one uses the bloom, the first pour where the
grounds swell and release gas, as the loading moment for each lesson: a short swelling
animation that settles when content arrives, reduced to a static frame under reduced motion.
It fits because every user meets the bloom in their first week; it costs one component.

Do not reuse this example's metaphors; derive ideas from the audited product.

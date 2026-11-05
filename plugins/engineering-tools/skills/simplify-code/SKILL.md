---
name: simplify-code
description: Simplify code for clarity, consistency, and maintainability while preserving behavior. Use for explicit simplification requests, focused cleanup during or after implementation, and code reviews assessing readability, unnecessary abstractions, or overengineering. Not for adding features, changing behavior, hunting bugs, or producing a technical-debt roadmap.
user-invocable: true
disable-model-invocation: false
license: Apache-2.0
---

# Simplify Code

Reduce the reasoning and moving parts a maintainer needs to understand, modify, and debug code.
Prefer explicit, readable code over compression. Leave already clear code alone.

## Workflow

1. Establish scope, mode (edit or review), and release context.
2. List every file in scope and read each one in full.
3. Find worthwhile reductions. Each needs a concrete case.
4. Classify each one as behavior-preserving or needing a decision.
5. Apply focused edits only when authorized; otherwise report findings.
6. Verify findings or edits, then report with a coverage line.

## Establish scope and context

Use the requested target or diff. Otherwise, focus on code changed for the current task. Ask for
a target only if none can be identified.

- During implementation, keep cleanup within the authorized task.
- For a review or suggestions, report without editing unless fixes are also requested.
- Honor the requested output format.

Read applicable instructions, nearby code, and relevant requirements. Follow the project's idioms,
naming, organization, and error-handling conventions.

When compatibility or stored data matters, establish the release context from project docs or the
owner: are there real users, deployed consumers, or production data? Do not infer the answer from
a version number or an empty local database. State any unknown that affects a recommendation.

A diff alone is partial coverage. Read each current file in full and inspect the diff when one is
supplied. If the scope exceeds your capacity, divide it or report the remaining scope; do not
claim a complete review.

## Preserve behavior

Preserve public contracts, outputs, side effects, errors, and ordering. Keep required security,
validation, reliability, and performance guarantees. In user interfaces, rendered output,
interaction, visual baselines, and accessibility trees count as behavior.

Label every proposal:

- **Behavior-preserving:** evidence supports unchanged observable behavior and contracts.
- **Needs decision:** the change would alter behavior, requirements, visible output, or data held
  by real users or deployed systems, or it rests on an unresolved material assumption.

A recommendation is not permission to change behavior. For each needs-decision proposal:

- Recommend **do** or **don't**, and explain the tradeoff.
- Name the exact decision or evidence that would settle it.
- Do not recommend leaving code alone merely because the answer is uncertain.

Release context changes the recommendation, not the label:

- **Before launch** (verified: no real users, deployed consumers, or production data), recommend
  removing obsolete compatibility paths now when the gain is concrete. Removing a contract or a
  supported input still needs a decision.
- **After launch**, account for existing data and consumers. A search of the repository does not
  prove that removal is safe.

Keep incidental suspected bugs in a separate list. Check documented intent before calling unusual
behavior a defect. Report each bug with the case that triggers it and leave it unfixed unless
fixes are authorized. A recommended behavior-changing fix still gets the needs-decision label and
a do or don't. Do not expand the task into a bug hunt.

## Find worthwhile reductions

A finding needs a concrete case: an input, a misleading call, or the places that must change
together. Name what disappears: a moving part, a duplicated responsibility, a misleading name,
or a reasoning step. No concrete case, no finding.

Swapping acceptable names, declaration order, or equivalent syntax is a style trade, not a
finding. Neither is a vague but accurate name.

Look for:

- **Control flow:** flatten unnecessary nesting; replace dense conditionals with readable steps.
- **Misleading names:** a name must not misstate a responsibility, shape, or side effect. For
  example, `prepare` that also finishes a job, or an audit helper that also sends notifications.
  Use one name per concept and one concept per name.
- **Opaque arguments:** replace bare `true`/`false` arguments with named options or separate
  functions when this helps the actual callers.
- **Misplaced logic:** keep related logic together and put it where readers expect it, with no
  business rules in presentation code and no work hidden in render paths.
- **Function size:** split by separate jobs, never by length. A long function doing one job in a
  straight line can stay.
- **Unused code and redundant work:** before claiming no uses or a single caller, search the
  whole tree, including tests, fixtures, configuration, and string or dynamic references.
- **Duplicated rules:** consolidate a responsibility that must change together. The strongest
  case is one rule in two places that already disagree; cite both sites and the input where they
  differ. Resolving the disagreement changes behavior, so classify it apart from the extraction.
  Similar-looking code alone does not justify an abstraction.
- **Duplicated or derivable state:** derive it from a single source when that preserves timing
  and ownership. First check whether the copy is an intentional snapshot, cache, or
  independently editable value.
- **Type gaps:** close gaps that force casts, non-null assertions, or repeated checks when an
  existing contract can express the guarantee. Do not add speculative runtime handling inside
  trusted code. Keep validation at real trust boundaries.
- **Speculative structure:** challenge wrappers, configuration, layers, and extension points that
  serve only hypothetical requirements.
- **Expired compatibility:** look for temporary code that outlived its reason, such as a migration
  backfill that still runs on every job cycle.
- **Misnamed wrappers and rule workarounds:** for example, a notification-aware transaction used
  for plain reads, or casts and disable comments that only satisfy a parameter-count limit.
- **Comments:** remove comments that repeat the code; keep rationale and constraints. Add a
  missing reason only for an evidenced, non-obvious decision.

Before proposing removal of an odd rule, workaround, suppression, or wrapper, check the actual
rule, the requirements, and relevant history. Keep structure that serves a current need:

- A helper with one caller that clarifies a concept or isolates a boundary.
- A wrapper that satisfies a rule the project intends, such as catching a rejected promise
  inside a void event handler.

Use existing utilities and standard capabilities when their semantics match. Do not add
dependencies or layers for cleanup. In tests, preserve what each assertion detects; making a
test stricter changes behavior, even when desirable.

Check the result as a maintainer new to the code: they should find the place to change quickly
and read the flow top to bottom without holding the whole module in mind.

## Scale a review

When delegation is authorized and available, divide a large review into disjoint areas balanced
by lines to read and complexity, not by file count. Keep edits in one session.

- Give each reviewer the scope, relevant context, and prior findings to skip on repeat passes.
- Review the seams between areas yourself. Area reviewers miss rules and ownership shared across
  areas.

Before reporting, verify each consolidated finding against current code, usage, and documented
intent. Use an independent pass when available; otherwise run a separate pass yourself and say
that it was not independent. Drop style trades, duplicates, and unsupported claims. Keep
decisions and incidental bugs distinct.

## Verify and report

Apply focused refinements only when authorized. Run the relevant checks for affected behavior and
inspect the final diff. In a review, describe the verification you propose; do not claim it ran.

Lint or analysis tools can locate hotspots and measure before/after results. Treat thresholds
stricter than the project's as measurements, not targets. Never optimize for line count.

Order findings by concrete maintenance value. Fit these fields into the requested format:

- location and symbol
- concrete case and evidence
- simpler approach
- behavior classification, with the recommendation and open decision when needed
- approximate net lines removed (zero or an increase can still be worthwhile)

For edits, report what became simpler and which checks ran, with measured results when
available. Separate estimates from measurements, and name checks that did not run.

End a review with a coverage line: files read in full, files seen only as a diff or in part,
and unread files (or explicitly none). Return no findings when no worthwhile reduction is
supported.

*Adapted and modified from Anthropic's [code-simplifier](https://github.com/anthropics/claude-plugins-official/blob/main/plugins/code-simplifier/agents/code-simplifier.md): provider- and language-neutral guidance, review support, and focused rules for overengineering. Distributed under [Apache-2.0](LICENSE). The rules on concrete cases, splitting by job, and stating unread scope draw on [ponytail](https://github.com/DietrichGebert/ponytail) (MIT).*

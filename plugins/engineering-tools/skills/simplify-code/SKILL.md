---
name: simplify-code
description: Simplify code for clarity, consistency, and maintainability while preserving behavior. Use for explicit simplification requests, focused cleanup during or after implementation, and code reviews assessing readability, unnecessary abstractions, or overengineering. Not for adding features, changing behavior, hunting bugs, or producing a technical-debt roadmap.
user-invocable: true
disable-model-invocation: false
license: Apache-2.0
---

# Simplify Code

Reduce the reasoning and moving parts needed to understand, modify, and debug code.
Prefer explicit, readable code over compression. Leave already clear code alone.

## Establish scope and context

Use the requested target or diff; otherwise focus on changes for the current task.
Ask for a target only if none can be identified. During implementation, keep cleanup
within the authorized task. For review or suggestions, report without editing unless
fixes are also requested. Honor the requested output format.

Read applicable instructions, nearby conventions, and relevant requirements. Establish
release context from project docs or the owner when compatibility or stored data matters:
are there real users, deployed consumers, or production data? Do not infer this from a
version number or an empty local database. State unknowns that affect a recommendation.

List files in scope. Read each current file in full and inspect the diff when supplied;
a diff alone is partial coverage. If scope exceeds available capacity, divide it or report
the remaining scope explicitly rather than claiming a complete review.

## Preserve behavior

Preserve public contracts, outputs, side effects, errors, ordering, and required security,
validation, reliability, and performance guarantees. Rendered output, interaction, visual
baselines, and accessibility trees count as behavior.

Separate incidental suspected bugs from simplifications. Check documented intent before
calling unusual behavior defective; report a bug with a triggering case and leave it
unfixed unless fixes are authorized. If recommending a behavior-changing correction,
apply the needs-decision label and do/don't recommendation below even in the bug list.
Do not expand the task into a bug hunt.

Distinguish a recommendation from permission to change behavior. Label proposals:

- **Behavior-preserving:** evidence supports unchanged observable behavior and contracts.
- **Needs decision:** behavior, requirements, visible output, or data held by real users or
  deployed systems would change, or a material assumption remains unresolved.

For each needs-decision proposal, recommend **do** or **don't**, explain the tradeoff,
and name the exact decision or evidence required. Uncertainty alone is not a reason to
recommend leaving code alone. Before launch, with verified absence of real users, deployed
consumers, and production data, recommend removing obsolete compatibility paths now when
the gain is concrete. Still label contract or supported-input removal as needs decision;
pre-launch status does not authorize it. For deployed systems, account for existing data
and consumers rather than assuming an in-repository search proves safety.

## Find worthwhile reductions

Require a concrete case: an input, a misleading call, or the places that must change together.
Identify what disappears: a moving part, duplicated responsibility, misleading name, or
unnecessary reasoning step. Exchanging acceptable names, declaration order, or equivalent
syntax is a style trade. A vague but accurate name alone is not a finding.

- Flatten unnecessary nesting; replace dense conditionals with readable steps.
- Clarify names that misstate responsibilities, shape, or side effects. Decode opaque boolean
  arguments with named options only where this improves actual callers.
- Keep related logic together and place responsibilities where readers expect them.
  Split by separate jobs, never by length; retain long straight-line functions doing one job.
- Remove confirmed unused code and redundant work. Search the whole tree, including tests,
  fixtures, configuration, string and dynamic references, before claiming no uses or one caller.
- Consolidate the same responsibility that must change together. Cite both sites and any
  disagreeing input; classify resolving that disagreement separately from extraction.
  Similar-looking code alone does not justify an abstraction.
- Remove duplicated or derivable state when a single source preserves timing and ownership.
  Check whether the apparent copy is an intentional snapshot, cache, or independently editable value.
- Close type gaps that force casts, non-null assertions, or repetitive checks when an existing
  contract can express the guarantee. Do not add speculative runtime handling inside trusted code;
  retain validation at real trust boundaries.
- Challenge wrappers, configuration, layers, and extension points supported only by hypothetical
  requirements. Retain helpers, even with one caller, that clarify a concept or isolate a boundary.
- Investigate temporary compatibility paths whose reason may have expired. Before proposing removal
  of an odd rule, workaround, lint/type suppression, or wrapper, check the actual rule, requirements,
  and relevant history. A wrapper required for safe async error handling is useful structure.
- Remove comments that repeat code; retain rationale and constraints. Add a missing reason only
  when an evidenced, non-obvious decision needs it.

Use existing utilities and standard capabilities when semantics match. Avoid new dependencies
or layers for cleanup. In tests, preserve what failures assertions detect; making a test stricter
is a behavior change, even if desirable.

## Scale a review

When delegation is authorized and available, divide large reviews into disjoint areas balanced
by lines to read and complexity, not file count. Keep edits in one session. Give each reviewer
the scope, relevant context, and prior findings to skip on repeat passes. Review seams between
areas explicitly for shared rules and ownership.

Before reporting, use an independent verification pass when available to check each consolidated
finding against current code, usage evidence, and documented intent. Otherwise perform a separate
verification pass yourself and disclose that independence was unavailable. Drop style trades,
duplicates, and unsupported claims; keep decisions and incidental bugs distinct.

## Verify and report

Apply focused refinements only when authorized. Run relevant checks for affected behavior and
inspect the final diff. For reviews, explain proposed verification without claiming it ran.
Use existing lint or analysis tools to locate hotspots and compare before/after results when
useful; stricter thresholds are measurements, not cleanup targets. Never optimize for line count.

Order findings by concrete maintenance value. For each, include location **and symbol**, case,
evidence, simpler approach, behavior classification, and approximate net lines removed (zero or
an increase can be worthwhile). Include the recommendation and unresolved decision where needed.
Fit these fields into the user's format rather than replacing it.

For edits, report what became simpler and checks performed, with measured before/after results
when available. Separate estimates from measurements and report checks not run.
End reviews with a coverage line: files read in full, diff-only/partial files, and unread files
(or explicitly none). Never claim full coverage for partial reading. Return no findings when
no worthwhile reduction is supported.

*Adapted and modified from Anthropic's [code-simplifier](https://github.com/anthropics/claude-plugins-official/blob/main/plugins/code-simplifier/agents/code-simplifier.md): provider- and language-neutral guidance, review support, and focused rules for overengineering. Distributed under [Apache-2.0](LICENSE). The rules on concrete cases, splitting by job, and stating unread scope draw on [ponytail](https://github.com/DietrichGebert/ponytail) (MIT).*

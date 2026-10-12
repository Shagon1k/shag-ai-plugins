---
name: simplify-code
description: Simplify code for clarity, consistency, and maintainability while preserving behavior. Use for explicit simplification requests, focused cleanup during or after implementation, and code reviews assessing readability, unnecessary abstractions, or overengineering. Not for adding features, changing behavior, or producing a technical-debt roadmap.
user-invocable: true
disable-model-invocation: false
license: Apache-2.0
---

# Simplify Code

Make code easier to understand, modify, and debug while preserving its behavior.
Judge improvement by the reasoning and moving parts a maintainer must follow.
Prioritize readable, explicit code over overly compact solutions.

## Scope

Use the user's requested scope, including a supplied diff or code-review target.
Otherwise, focus on code changed for the current task. If no target can be
identified, ask which code to simplify.

During an authorized implementation task, apply worthwhile simplifications within
that task's scope. When invoked directly, follow the requested scope and intent.

When asked to review or suggest improvements, report findings without editing
unless implementing fixes is also requested. Follow the reviewer's existing
instructions and output format.

## Principles

### 1. Preserve behavior

Preserve public contracts, outputs, side effects, error behavior, and ordering.
Keep required validation, security, reliability, and performance guarantees.

Treat suspected bugs and requirement changes separately. If a simplification depends
on an uncertain requirement or usage assumption, investigate it and make any unresolved
uncertainty explicit.

### 2. Follow the project

Read applicable repository instructions and nearby code. Follow the project's
language idioms, naming, organization, and error-handling conventions.

Use existing utilities or standard capabilities when they make the implementation
clearer and preserve its semantics. Avoid introducing dependencies for cleanup.

### 3. Improve clarity

- Flatten unnecessary nesting and make control flow easier to follow.
- Use names that explain responsibilities and meaningful intermediate values.
- Remove redundant work and code confirmed to be unused within scope.
- Keep related logic together without combining unrelated responsibilities.
- Remove comments that merely repeat the code; retain rationale and constraints.
- Explain non-obvious decisions in comments when the code alone cannot
  communicate the reason.
- Prefer readable expressions over dense conditionals or clever compression.

### 4. Reduce unjustified complexity

Prefer the least complex implementation that fully satisfies current requirements.
Judge complexity against the problem being solved.

Challenge wrappers, layers, configuration, and extension points whose only
purpose is hypothetical future use. Replace them with direct code when their
removal reduces the effort needed to understand and maintain the implementation.

Add edge-case handling only for explicit requirements or concrete failure scenarios
in the actual system. Trust established guarantees, and keep safeguards proportionate
to the failure's likelihood and impact.

Consolidate duplication when it represents the same responsibility and should
change together. Similar-looking code alone does not justify a shared abstraction.

Before removing a construct, inspect its callers, tests, and constraints. Check
history when its purpose remains unclear.

### 5. Keep useful structure

Retain abstractions that clarify a concept, isolate a boundary, or support a
current requirement. A helper can be useful with one caller.

Avoid changes that merely trade one style for another, compress unrelated logic,
or make debugging harder. Leave already clear code alone.

## Workflow

1. Identify the target code and whether the task calls for edits or review.
2. Look for worthwhile simplifications using the principles and project conventions.
3. Apply focused refinements, or propose them as findings when reviewing.
4. Check that applied or proposed refinements preserve behavior and make the code
   easier to understand and maintain.
5. Report only significant changes or actionable findings. For review findings,
   identify the location, explain the concrete maintenance cost, and suggest
   a simpler approach.

Do not manufacture changes or findings when the code is already clear.

*Adapted and modified from Anthropic's [code-simplifier](https://github.com/anthropics/claude-plugins-official/blob/main/plugins/code-simplifier/agents/code-simplifier.md): provider- and language-neutral guidance, review support, and focused rules for overengineering. Distributed under [Apache-2.0](LICENSE).*

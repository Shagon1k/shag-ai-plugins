# Optional Code Style Baseline

Use this branch when the developer wants shared naming, readability, and comment conventions for
agents and people writing the code. Keep the rest of the guidance setup independent of it when
they skip it.

## Select a Profile

During a full setup, offer one choice:

| Choice | Behavior |
| --- | --- |
| `Skip` | Leave code style to existing rules and tooling. |
| `Standard` | Render the standard rules and propose the matching enforcement. |
| `Customize` | Ask only for deviations from the standard rules. |

Default to `Skip` when unanswered. For a focused update, enter this branch only when the developer
asks for code style rules. Inspect existing rule files, linter and formatter configuration, and
`AGENTS.md` first; merge with established conventions instead of replacing them.

## Standard Profile

1. Render `assets/CODE_STYLE.template.md` to `<RULES_DIR>/code-style.md` (normally
   `.agent-docs/rules/code-style.md`). Fill the size limits from existing lint configuration or
   approved defaults: 300 lines per file, cognitive complexity 12, four parameters, and the
   formatter's line width.
2. Add a `Code style / naming` row pointing to the file in the `AGENTS.md` Rule Index. Keep the
   detailed rules in the rule file, not in `AGENTS.md`.
3. Fill the Enforcement table with what each rule's tooling actually is. Mark a rule that no tool
   checks as a review item.
4. Record approved exceptions. Common ones: API and database field names stay as their contract
   defines them, framework-required names keep their form, schema factory helpers may read as
   nouns, and string literals checked by a union type stay inline.

### Enforcement by project state

| State | Action |
| --- | --- |
| `Idea` or `Greenfield` without application code | Add the lint rules with the rule file. For an ESLint flat config in TypeScript, adapt `assets/code-style/eslint-code-style.mjs`; for another stack, name the equivalent tooling. |
| `Existing` | Do not enable new lint rules or rename code during planning. Measure violations per rule when tooling allows, then propose adoption as tracked work: one change per rule, renames through language tooling rather than text replacement, and the rule enabled in the same change that fixes its findings. |

Make lint warnings fail the lint run so a cleared rule cannot quietly regress.

## Customize Mini-Questionnaire

Ask only for decisions the developer has not already made:

- Which naming rules to drop or change, including boolean prefixes and private member style.
- Which exceptions apply beyond the standard list.
- Whether the number rule should apply, and to which code.
- Size limits, if they differ from the existing configuration or the defaults.

Treat an unanswered item as the standard choice and say so in the artifact plan.

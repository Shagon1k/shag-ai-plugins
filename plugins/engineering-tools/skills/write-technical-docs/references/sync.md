# Sync documentation with code

Find where documentation and implementation disagree, decide which side is wrong, and fix only
what the evidence supports. Documentation is not a mirror of the code: a document that states a
requirement can prove the code wrong.

Write every edit with the main skill's techniques. This reference covers finding and resolving
drift only.

## 1. Set the scope

Use the scope the user gives. Otherwise ask for one of:

- **Documents:** named files or sections.
- **Change range:** files changed in a git range such as `main...HEAD` or `<sha>..HEAD`, plus the
  documents that mention their symbols, paths, routes, commands, or behavior.
- **Document set:** every document in the repository's documentation map.

State the scope in the report. Do not widen it silently; list out-of-scope drift you noticed
separately.

## 2. Classify the sources

Read the repository's instructions, documentation map, and source-precedence rules first. Sort each
document in scope:

- **Normative:** states what must be true. Requirements, business rules, invariants, acceptance
  criteria, security and privacy rules, API contracts, and decision records such as ADRs.
- **Descriptive:** states what is true now. Architecture "as built", reference pages, guides,
  READMEs, status tables, and generated facts.

One document can hold both; classify per claim. When the repository defines its own precedence,
it overrides this split.

## 3. Extract checkable claims

Collect claims a reader would act on:

- Names, paths, commands, flags, routes, environment variables, and links with anchors.
- Defaults, limits, counts, units, formats, and versions.
- Behavior, guarantees, permissions, and error cases.
- Statuses such as Done, Active, Proposed, or Deprecated.

Skip opinions and rationale unless they depend on a checkable fact.

## 4. Gather evidence

Verify each claim against current sources, in this order of weight:

1. Code, schemas, configuration, and migrations.
2. Tests that assert the behavior.
3. History: the commit, pull request, or decision record that changed the code or the document,
   and whether the change was deliberate.

Open the file and cite `path:line`. Mark a claim **unverified** when you cannot find evidence
either way; never guess.

## 5. Decide the direction

Give every mismatch one verdict:

| Verdict | When | Action |
| --- | --- | --- |
| Document stale | A descriptive claim, and the code changed deliberately (a commit, decision, or test shows intent). | Edit the document. |
| Implementation suspect | The claim is normative; the code contradicts its own tests; or the change looks accidental. | Leave the document. Report a finding with evidence and the code change it implies. |
| Decision needed | Both readings are plausible, or evidence conflicts. | Say which evidence is missing or conflicting, then ask the owner one question with the options and their consequences. |
| Gap | Durable behavior exists but is undocumented where the documentation map places it. | Add it to its owning document. |
| Hygiene | A broken link or anchor, one fact owned by several documents, or a volatile number copied by hand. | Fix the link, keep the fact in one owner and link to it, or point to the source. |

Apply these tie-breakers:

- A normative claim outranks the code until its owner changes it.
- A test that agrees with the document counts against the code.
- Security, privacy, data integrity, money, and authorization default to **implementation
  suspect**.
- Never weaken a guarantee, widen a permission, or drop a requirement to match code without the
  owner's confirmation.
- Append to or supersede decision records; never rewrite accepted history.

## 6. Apply and report

Edit only **document stale**, **gap**, and **hygiene** items, and only within scope. Keep each edit
minimal and preserve the strength of every unaffected claim. Do not change code unless the user
asks; implementation findings stay findings.

After editing, check that every changed link and anchor resolves.

Report one row per mismatch:

| Claim | Location | Evidence | Verdict | Action |
| --- | --- | --- | --- | --- |

Then list the questions for the owner, the unverified claims, and any out-of-scope drift. If
nothing drifted, say so and name the scope checked.

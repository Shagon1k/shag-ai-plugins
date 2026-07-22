---
audience: ai
---

# Skill development workflow

## Discover

1. Read repository instructions, `README.md`, the target plugin manifests, and one adjacent skill.
2. Resolve the target plugin before creating files. Prefer an existing plugin when its purpose
   already covers the workflow.
3. Identify concrete trigger prompts, non-trigger cases, outputs, and reusable resources.
4. Use the environment's `skill-creator` workflow when available.

## Build

- Name the directory and frontmatter `name` identically using lowercase hyphen-case.
- Put only `name` and `description` in `SKILL.md` frontmatter. Make the description state what the
  skill does, when it triggers, and important exclusions.
- Keep `SKILL.md` procedural, imperative, and under 500 lines. Move detailed rubrics, examples, or
  schemas into one-hop `references/` files.
- Add `scripts/` only for repeated deterministic work; test every added script.
- Add `assets/` only for files copied or transformed into output.
- Do not add skill-local README, changelog, installation guide, or duplicated documentation.
- Add `agents/openai.yaml`; its `default_prompt` must mention `$<skill-name>`. Regenerate it with
  the skill-creator helper after trigger or naming changes.

## Preserve platform boundaries

- Keep the shared workflow independent of platform-only tool names. Describe capabilities or use
  conditional instructions when integrations differ.
- Keep the three plugin manifest versions and descriptions aligned.
- When adding a public skill, bump the plugin minor version and update descriptions, keywords,
  default prompts, and the root README where the plugin's advertised scope changes.
- When adding a plugin, update all three marketplace catalogs and all three plugin manifests.

## Evaluate

1. Add or update `evals/<plugin>/<skill>/cases.json`; follow
   [`.agents/skill-evals.md`](skill-evals.md).
2. Cover the skill's critical branches, guardrails, unsafe behaviors, and at least one realistic
   borderline case. Do not encode the intended answer in candidate fixtures.
3. Distinguish skill failures from bad fixtures or overly rigid expectations before changing the
   skill.

## Definition of done

- Skill validator passes when available.
- Added scripts have focused tests.
- Relevant fresh-model eval cases pass when the change affects behavior.
- `npm run validate` passes across marketplace JSON, syntax, and bundled tests.
- README and platform metadata describe the shipped behavior without claiming unimplemented work.

---
audience: ai
---

# Repository instructions

Maintain a cross-platform marketplace of reusable AI-agent skills. Shared workflow logic belongs
under `plugins/<plugin>/skills/`; Codex, Claude Code, and Cursor packaging stays thin.

## Read by task

- Add or change a skill: read [`.agents/skill-development.md`](.agents/skill-development.md).
- Add, change, or run evals: read [`.agents/skill-evals.md`](.agents/skill-evals.md).
- Change marketplace structure or platform metadata: read `README.md` and
  `scripts/validate-marketplace.mjs` first.

## Invariants

- Keep shared `SKILL.md`, references, assets, and scripts platform-neutral.
- Keep platform-specific metadata in `.codex-plugin/`, `.claude-plugin/`, `.cursor-plugin/`, or
  `agents/openai.yaml`.
- Preserve unrelated and pre-existing user changes; never overwrite them for convenience.
- Use Node.js 22+ for repository tooling. Add dependencies only when the standard library is
  insufficient.
- Treat `AGENTS.md` as canonical agent guidance. Keep `CLAUDE.md` as an import only; keep human
  onboarding in `README.md`.

## Required checks

- Run the narrowest relevant test while iterating.
- Run `npm run validate` before handing off repository changes.
- Report fresh-model evals separately from deterministic tests; they have different cost and
  confidence properties.

# Shagon1k AI Plugins

`shag-ai-plugins` is a cross-platform marketplace for reusable AI-agent skills and developer workflows.
The same plugin implementation supports Codex and Claude Code through thin platform adapters.

Bundled validators and audits use Node.js 22 or newer. Husky is the only development dependency.

## Plugins

| Plugin | Purpose | Status |
| --- | --- | --- |
| `web-development` | Plan, build, review, and maintain web applications | Codex and Claude Code |
| `engineering-tools` | Audit technical debt, prepare commits, and optimize agent context | Codex and Claude Code |

## Skills

| Plugin | Skill | Purpose |
| --- | --- | --- |
| `web-development` | `plan-web-app` | Create, align, and maintain Roadmap, Design, Architecture, ADR, and agent guidance for a web app |
| `engineering-tools` | `conventional-commit` | Prepare a Conventional Commit from staged changes with an explicit confirmation gate |
| `engineering-tools` | `tech-debt-audit` | Audit and maintain a prioritized, deduplicated technical-debt roadmap |
| `engineering-tools` | `tokenomy` | Reduce unnecessary AI-agent context and token usage |

## Platform Support

Reusable skill logic lives in each plugin's `skills/` directory and stays platform-neutral.
Platform packaging remains intentionally thin:

- Codex uses `.codex-plugin/plugin.json`, `.agents/plugins/marketplace.json`, and optional
  `agents/openai.yaml` metadata.
- Claude Code uses `.claude-plugin/plugin.json` and `.claude-plugin/marketplace.json` while
  reusing the same `SKILL.md`, references, assets, and scripts.

There is no shared marketplace manifest across Codex and Claude. Keep platform-specific tool
names and UI metadata out of the shared skill workflow so adding another adapter does not require
rewriting the skill.

## Install

Add the marketplace and install the plugin separately in each client:

```bash
# Codex
codex plugin marketplace add Shagon1k/shag-ai-plugins
codex plugin add web-development@shag-ai-plugins
codex plugin add engineering-tools@shag-ai-plugins

# Claude Code
claude plugin marketplace add Shagon1k/shag-ai-plugins
claude plugin install web-development@shag-ai-plugins
claude plugin install engineering-tools@shag-ai-plugins
```

For local development, replace `Shagon1k/shag-ai-plugins` with the absolute path to this
repository.

## Validate

Install the development tooling once after cloning:

```bash
npm install
```

Run the complete local validation suite with one command:

```bash
npm run validate
```

The suite checks marketplace and plugin structure, validates JavaScript syntax, and runs every
bundled Node.js test. A Husky `pre-commit` hook runs the same command before each commit because
the suite is fast enough to keep feedback local. GitHub Actions repeats it on every push and pull
request; configure that check as required on protected branches after publishing the repository.

There is intentionally no `pre-push` hook: it would duplicate the pre-commit check, while CI is
the shared enforcement layer even when local hooks are bypassed.

Claude's native validator remains useful when its CLI is installed:

```bash
claude plugin validate . --strict
```

## Repository Layout

```text
shag-ai-plugins/
  .github/workflows/validate.yml
  .husky/pre-commit
  .agents/plugins/marketplace.json
  .claude-plugin/marketplace.json
  package.json
  plugins/
    <plugin-name>/
      .codex-plugin/plugin.json
      .claude-plugin/plugin.json
      skills/
  scripts/
    validate.mjs
    validate-marketplace.mjs
  evals/
    <plugin-name>/
      <skill-name>/
```

## License

[MIT](LICENSE), Copyright (c) 2026 Aliaksei Hurynovich

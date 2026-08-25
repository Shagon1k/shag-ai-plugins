# Shagon1k AI Plugins

`shag-ai-plugins` is a cross-platform marketplace for reusable AI-agent skills and developer workflows.
The same plugin implementation supports Codex, Claude Code, and Cursor through thin platform
adapters.

## Plugins

| Plugin | Purpose |
| --- | --- |
| `web-development` | Plan, build, review, and maintain web applications |
| `engineering-tools` | Assess changes, maintain engineering workflows, and improve technical documentation |
| `ai-quality` | Improve AI-agent context efficiency and output quality |

## Skills

| Plugin | Skill | Purpose |
| --- | --- | --- |
| `web-development` | `plan-web-app` | Create, align, and maintain web-app guidance with optional GitHub Issue/PR templates and a Project board |
| `engineering-tools` | `assess-change-complexity` | Size proposed software changes with an evidence-backed XS–XXL score, driver guardrails, confidence, and optional project calibration |
| `engineering-tools` | `conventional-commit` | Prepare a Conventional Commit from staged changes with an explicit confirmation gate |
| `engineering-tools` | `tech-debt-audit` | Audit and maintain a prioritized, deduplicated technical-debt roadmap |
| `engineering-tools` | `technical-writing` | Write and review purpose-driven, clear, and precise engineering documentation |
| `ai-quality` | `tokenomy` | Reduce unnecessary AI-agent context and token usage |
| `ai-quality` | `unslop` | Apply a natural prose-quality pass by default while preserving meaning, facts, and structured content |
| `ai-quality` | `bro` | Restate the immediately previous response in plain, concise human language |

## Platform Support

Reusable skill logic lives in each plugin's `skills/` directory and stays platform-neutral.
Platform packaging remains intentionally thin:

- Codex uses `.codex-plugin/plugin.json`, `.agents/plugins/marketplace.json`, and optional
  `agents/openai.yaml` metadata.
- Claude Code uses `.claude-plugin/plugin.json` and `.claude-plugin/marketplace.json` while
  reusing the same `SKILL.md`, references, assets, and scripts.
- Cursor uses `.cursor-plugin/plugin.json` and `.cursor-plugin/marketplace.json` while reusing
  the same skill implementation.

There is no shared marketplace manifest across the three clients. Keep platform-specific tool
names and UI metadata out of the shared skill workflow so adapters remain packaging-only.

## Install

Add the marketplace and install the plugin separately in each client:

```bash
# Codex
codex plugin marketplace add Shagon1k/shag-ai-plugins
codex plugin add web-development@shag-ai-plugins
codex plugin add engineering-tools@shag-ai-plugins
codex plugin add ai-quality@shag-ai-plugins

# Claude Code
claude plugin marketplace add Shagon1k/shag-ai-plugins
claude plugin install web-development@shag-ai-plugins
claude plugin install engineering-tools@shag-ai-plugins
claude plugin install ai-quality@shag-ai-plugins
```

For local development, replace `Shagon1k/shag-ai-plugins` with the absolute path to this
repository.

Cursor support is ready for local use and marketplace submission. Until the plugins are listed in
the public Cursor Marketplace, copy or symlink each plugin directory into Cursor's local plugin
directory and reload Cursor:

```bash
mkdir -p ~/.cursor/plugins/local
ln -s /absolute/path/to/shag-ai-plugins/plugins/web-development ~/.cursor/plugins/local/web-development
ln -s /absolute/path/to/shag-ai-plugins/plugins/engineering-tools ~/.cursor/plugins/local/engineering-tools
ln -s /absolute/path/to/shag-ai-plugins/plugins/ai-quality ~/.cursor/plugins/local/ai-quality
```

## Validate

Install the development tooling once after cloning:

```bash
npm install
```

Run the complete three-platform validation suite with one command:

```bash
npm run validate
```

Run the isolated fresh-model evaluation suite for change-complexity assessment with:

```bash
npm run eval:assess-change-complexity
```

All skill evals use the shared runner. Run any cases file directly with:

```bash
npm run eval:skill -- evals/<plugin>/<skill>/cases.json
```

Run one case while iterating with:

```bash
npm run eval:assess-change-complexity -- --case concentrated-financial-risk
```

Each `cases.json` declares its sandbox mode. The runner materializes only the case's fixture files
in a temporary directory and invokes the candidate in ephemeral mode without exposing expectations.
It then runs a separate read-only semantic grader under a strict JSON schema. Filesystem integrity,
grade ordering, completeness, and the final exit code are deterministic; every expectation must
receive `PASS`. Keep skill directories declarative; do not add a separate runner per eval suite.

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
  AGENTS.md
  CLAUDE.md
  .github/workflows/validate.yml
  .husky/pre-commit
  .agents/skill-development.md
  .agents/skill-evals.md
  .agents/plugins/marketplace.json
  .claude-plugin/marketplace.json
  .cursor-plugin/marketplace.json
  package.json
  plugins/
    <plugin-name>/
      .codex-plugin/plugin.json
      .claude-plugin/plugin.json
      .cursor-plugin/plugin.json
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

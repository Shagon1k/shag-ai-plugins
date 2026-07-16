# Shagon1k AI Plugins

`shag-ai-plugins` is a cross-platform marketplace for reusable AI-agent skills and developer workflows.
The same plugin implementation supports Codex, Claude Code, and Cursor through thin platform
adapters.

Bundled validators and audits use Node.js 22 or newer. Husky is the only development dependency.

## Plugins

| Plugin | Purpose | Status |
| --- | --- | --- |
| `web-development` | Plan, build, review, and maintain web applications | Codex, Claude Code, and Cursor |
| `engineering-tools` | Audit technical debt, prepare commits, and optimize agent context | Codex, Claude Code, and Cursor |

## Skills

| Plugin | Skill | Purpose | Cursor compatibility |
| --- | --- | --- | --- |
| `web-development` | `plan-web-app` | Create, align, and maintain Roadmap, Design, Architecture, ADR, and agent guidance for a web app | Full workflow; clean-project smoke test pending |
| `engineering-tools` | `conventional-commit` | Prepare a Conventional Commit from staged changes with an explicit confirmation gate | Full workflow |
| `engineering-tools` | `tech-debt-audit` | Audit and maintain a prioritized, deduplicated technical-debt roadmap | Full workflow; Jira remains tool-dependent |
| `engineering-tools` | `tokenomy` | Reduce unnecessary AI-agent context and token usage | Guidance and Cursor MCP config discovery; transcript attribution remains Claude/Codex-specific |

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

Cursor plugins can also contain commands, agents, rules, hooks, and MCP server definitions. These
plugins expose only skills because the current workflows do not require Cursor-specific runtime
components. They can be distributed locally, through a team marketplace, or through the public
Cursor Marketplace after review.

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

Cursor support is ready for local use and marketplace submission. Until the plugins are listed in
the public Cursor Marketplace, copy or symlink each plugin directory into Cursor's local plugin
directory and reload Cursor:

```bash
mkdir -p ~/.cursor/plugins/local
ln -s /absolute/path/to/shag-ai-plugins/plugins/web-development ~/.cursor/plugins/local/web-development
ln -s /absolute/path/to/shag-ai-plugins/plugins/engineering-tools ~/.cursor/plugins/local/engineering-tools
```

On Windows, copy the plugin directories instead of creating symbolic links. Each installed plugin
must contain `.cursor-plugin/plugin.json` at its root.

For a symlinked local install, update the repository and reload Cursor. For a copied install,
replace the copied plugin directory before reloading. After public marketplace publication, install
and update the plugins from Cursor's Customize view or with `/add-plugin`.

## Validate

Install the development tooling once after cloning:

```bash
npm install
```

Run the complete three-platform validation suite with one command:

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

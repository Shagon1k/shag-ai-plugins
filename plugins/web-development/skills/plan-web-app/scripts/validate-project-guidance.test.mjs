#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const VALIDATOR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "validate-project-guidance.mjs",
);
const SKILL_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const GITHUB_ASSET_ROOT = path.join(SKILL_ROOT, "assets/github");
const WORK_TRACKING_ASSET = path.join(SKILL_ROOT, "assets/GITHUB_WORK_TRACKING.template.md");

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "plan-web-app-"));
  const write = (relative, content) => {
    const filePath = path.join(root, relative);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content, "utf8");
  };
  const run = (...args) => spawnSync(process.execPath, [VALIDATOR, root, ...args], { encoding: "utf8" });
  const createValidDefault = () => {
    write(
      "AGENTS.md",
      "# Agents\n\n[Documentation map](_docs/README.md)\n\n" +
        "## Project Documentation\n\nReport `Documentation impact: none` when no artifact changes.\n",
    );
    write("CLAUDE.md", "@AGENTS.md\n");
    write("ROADMAP.md", "# Roadmap\n");
    write("DESIGN.md", "# Design\n");
    write("ARCHITECTURE.md", "# Architecture\n");
    write("_docs/decisions/README.md", "# Decisions\n");
    write(
      "_docs/README.md",
      "# Docs\n\n- [Agents](../AGENTS.md)\n- [Claude](../CLAUDE.md)\n" +
        "- [Roadmap](../ROADMAP.md)\n- [Design](../DESIGN.md)\n" +
        "- [Architecture](../ARCHITECTURE.md)\n- [Decisions](decisions/README.md)\n",
    );
  };
  const createValidGithub = () => {
    const workTracking = fs
      .readFileSync(WORK_TRACKING_ASSET, "utf8")
      .replace("<GITHUB_PROJECT_NAME>", "Example Delivery")
      .replace("<GITHUB_PROJECT_URL>", "https://github.com/users/example/projects/1");
    fs.appendFileSync(path.join(root, "AGENTS.md"), `\n${workTracking}`, "utf8");

    for (const relative of [
      "ISSUE_TEMPLATE/task.yml",
      "ISSUE_TEMPLATE/bug.yml",
      "ISSUE_TEMPLATE/tech-debt.yml",
      "ISSUE_TEMPLATE/config.yml",
      "pull_request_template.md",
    ]) {
      write(
        path.join(".github", relative),
        fs.readFileSync(path.join(GITHUB_ASSET_ROOT, relative), "utf8"),
      );
    }
  };
  return { root, write, run, createValidDefault, createValidGithub };
}

test("valid default guidance passes", (t) => {
  const context = fixture();
  t.after(() => fs.rmSync(context.root, { recursive: true, force: true }));
  context.createValidDefault();

  const result = context.run();

  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /validation passed/);
});

test("unresolved template content fails", (t) => {
  const context = fixture();
  t.after(() => fs.rmSync(context.root, { recursive: true, force: true }));
  context.createValidDefault();
  context.write("DESIGN.md", "# <Project Name> Design\n\n## Template Setup\n");

  const result = context.run();

  assert.equal(result.status, 1);
  assert.match(result.stderr, /template marker remains/);
  assert.match(result.stderr, /unresolved placeholders/);
});

test("custom paths pass when links resolve to them", (t) => {
  const context = fixture();
  t.after(() => fs.rmSync(context.root, { recursive: true, force: true }));
  context.write(
    "guidance/AGENTS.md",
    "# Agents\n\n[Docs](../handbook/index.md)\n\n## Project Documentation\n\n" +
      "Report `Documentation impact: none` when no artifact changes.\n",
  );
  context.write(".claude/CLAUDE.md", "@../guidance/AGENTS.md\n\n## Claude Code\n\nProject-specific note.\n");
  context.write("planning/ROADMAP.md", "# Roadmap\n");
  context.write("product/DESIGN.md", "# Design\n");
  context.write("technical/ARCHITECTURE.md", "# Architecture\n");
  context.write("technical/decisions.md", "# Decisions\n");
  context.write(
    "handbook/index.md",
    "# Docs\n\n- [Agents](../guidance/AGENTS.md)\n- [Claude](../.claude/CLAUDE.md)\n" +
      "- [Roadmap](../planning/ROADMAP.md)\n- [Design](../product/DESIGN.md)\n" +
      "- [Architecture](../technical/ARCHITECTURE.md)\n" +
      "- [Decisions](../technical/decisions.md)\n",
  );

  const result = context.run(
    "--agents",
    "guidance/AGENTS.md",
    "--claude",
    ".claude/CLAUDE.md",
    "--roadmap",
    "planning/ROADMAP.md",
    "--design",
    "product/DESIGN.md",
    "--architecture",
    "technical/ARCHITECTURE.md",
    "--docs-map",
    "handbook/index.md",
    "--adr",
    "technical/decisions.md",
  );

  assert.equal(result.status, 0, result.stdout + result.stderr);
});

test("docs map must link to the configured ADR", (t) => {
  const context = fixture();
  t.after(() => fs.rmSync(context.root, { recursive: true, force: true }));
  context.createValidDefault();
  context.write("_docs/other/README.md", "# Unrelated README\n");
  context.write(
    "_docs/README.md",
    "# Docs\n\n- [Agents](../AGENTS.md)\n- [Claude](../CLAUDE.md)\n" +
      "- [Roadmap](../ROADMAP.md)\n- [Design](../DESIGN.md)\n" +
      "- [Architecture](../ARCHITECTURE.md)\n- [Wrong decisions](other/README.md)\n",
  );

  const result = context.run();

  assert.equal(result.status, 1);
  assert.match(result.stderr, /does not link to _docs\/decisions\/README\.md/);
});

test("full setup docs map must link both agent entrypoints", (t) => {
  const context = fixture();
  t.after(() => fs.rmSync(context.root, { recursive: true, force: true }));
  context.createValidDefault();
  context.write(
    "_docs/README.md",
    "# Docs\n\n- [Roadmap](../ROADMAP.md)\n- [Design](../DESIGN.md)\n" +
      "- [Architecture](../ARCHITECTURE.md)\n- [Decisions](decisions/README.md)\n",
  );

  const result = context.run();

  assert.equal(result.status, 1);
  assert.match(result.stderr, /does not link to AGENTS\.md/);
  assert.match(result.stderr, /does not link to CLAUDE\.md/);
});

test("Claude adapter must import the configured AGENTS path", (t) => {
  const context = fixture();
  t.after(() => fs.rmSync(context.root, { recursive: true, force: true }));
  context.createValidDefault();
  context.write("CLAUDE.md", "# Claude\n\nShared rules are elsewhere.\n");

  const result = context.run();

  assert.equal(result.status, 1);
  assert.match(result.stderr, /must import @AGENTS\.md/);
});

test("full setup requires the AGENTS documentation-impact contract", (t) => {
  const context = fixture();
  t.after(() => fs.rmSync(context.root, { recursive: true, force: true }));
  context.createValidDefault();
  context.write("AGENTS.md", "# Agents\n\n[Documentation map](_docs/README.md)\n");

  const result = context.run();

  assert.equal(result.status, 1);
  assert.match(result.stderr, /missing project-documentation impact contract/);
});

test("focused validation requires only selected documents", (t) => {
  const context = fixture();
  t.after(() => fs.rmSync(context.root, { recursive: true, force: true }));
  context.write("DESIGN.md", "# Design\n");

  const result = context.run("--only", "design");

  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /focused update/);
});

test("focused validation checks selected docs-map relationships", (t) => {
  const context = fixture();
  t.after(() => fs.rmSync(context.root, { recursive: true, force: true }));
  context.write("ROADMAP.md", "# Roadmap\n");
  context.write("DESIGN.md", "# Design\n");
  context.write("_docs/README.md", "# Docs\n\n- [Design](../DESIGN.md)\n");

  const result = context.run("--only", "design,roadmap");

  assert.equal(result.status, 1);
  assert.match(result.stderr, /does not link to ROADMAP\.md/);
  assert.doesNotMatch(result.stderr, /missing required architecture/);
});

test("standard GitHub workflow passes with bundled templates", (t) => {
  const context = fixture();
  t.after(() => fs.rmSync(context.root, { recursive: true, force: true }));
  context.createValidDefault();
  context.createValidGithub();

  const result = context.run("--github");

  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /GitHub workflow/);
});

test("standard GitHub workflow requires the technical-debt form", (t) => {
  const context = fixture();
  t.after(() => fs.rmSync(context.root, { recursive: true, force: true }));
  context.createValidDefault();
  context.createValidGithub();
  fs.rmSync(path.join(context.root, ".github/ISSUE_TEMPLATE/tech-debt.yml"));

  const result = context.run("--github");

  assert.equal(result.status, 1);
  assert.match(result.stderr, /missing required GitHub workflow file.*tech-debt\.yml/);
});

test("GitHub workflow rejects blank Issues", (t) => {
  const context = fixture();
  t.after(() => fs.rmSync(context.root, { recursive: true, force: true }));
  context.createValidDefault();
  context.createValidGithub();
  context.write(".github/ISSUE_TEMPLATE/config.yml", "blank_issues_enabled: true\n");

  const result = context.run("--github");

  assert.equal(result.status, 1);
  assert.match(result.stderr, /blank_issues_enabled must be false/);
});

test("custom GitHub workflow may explicitly allow blank Issues", (t) => {
  const context = fixture();
  t.after(() => fs.rmSync(context.root, { recursive: true, force: true }));
  context.createValidDefault();
  context.createValidGithub();
  context.write(".github/ISSUE_TEMPLATE/config.yml", "blank_issues_enabled: true\n");

  const result = context.run("--github", "--allow-blank-issues");

  assert.equal(result.status, 0, result.stdout + result.stderr);
});

test("GitHub workflow requires explicit work-tracking ownership rules", (t) => {
  const context = fixture();
  t.after(() => fs.rmSync(context.root, { recursive: true, force: true }));
  context.createValidDefault();
  context.createValidGithub();
  context.write(
    "AGENTS.md",
    "# Agents\n\n[Documentation map](_docs/README.md)\n\n" +
      "## Project Documentation\n\nReport `Documentation impact: none` when no artifact changes.\n",
  );

  const result = context.run("--github");

  assert.equal(result.status, 1);
  assert.match(result.stderr, /missing Work Tracking section/);
  assert.match(result.stderr, /missing explicit Issue creation rule/);
  assert.match(result.stderr, /missing explicit Roadmap update rule/);
});

test("custom GitHub template paths pass when configured", (t) => {
  const context = fixture();
  t.after(() => fs.rmSync(context.root, { recursive: true, force: true }));
  context.createValidDefault();
  context.createValidGithub();
  context.write(
    ".github/ISSUE_TEMPLATE/work-item.yml",
    fs.readFileSync(path.join(GITHUB_ASSET_ROOT, "ISSUE_TEMPLATE/task.yml"), "utf8"),
  );
  context.write(
    ".github/ISSUE_TEMPLATE/settings.yml",
    fs.readFileSync(path.join(GITHUB_ASSET_ROOT, "ISSUE_TEMPLATE/config.yml"), "utf8"),
  );
  context.write(
    ".github/PULL_REQUEST_TEMPLATE/default.md",
    fs.readFileSync(path.join(GITHUB_ASSET_ROOT, "pull_request_template.md"), "utf8"),
  );

  const result = context.run(
    "--github",
    "--issue-templates",
    ".github/ISSUE_TEMPLATE/work-item.yml",
    "--issue-config",
    ".github/ISSUE_TEMPLATE/settings.yml",
    "--pr-template",
    ".github/PULL_REQUEST_TEMPLATE/default.md",
  );

  assert.equal(result.status, 0, result.stdout + result.stderr);
});

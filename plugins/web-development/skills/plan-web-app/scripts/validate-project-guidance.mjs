#!/usr/bin/env node
/** Validate the mechanical integrity of generated web-app project guidance. */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const DEFAULT_DOCS = {
  agents: "AGENTS.md",
  claude: "CLAUDE.md",
  roadmap: "ROADMAP.md",
  design: "DESIGN.md",
  architecture: "ARCHITECTURE.md",
  "docs-map": "_docs/README.md",
  adr: "_docs/decisions/README.md",
};
const DEFAULT_GITHUB = {
  "issue-templates": [
    ".github/ISSUE_TEMPLATE/task.yml",
    ".github/ISSUE_TEMPLATE/bug.yml",
    ".github/ISSUE_TEMPLATE/tech-debt.yml",
  ],
  "issue-config": ".github/ISSUE_TEMPLATE/config.yml",
  "pr-template": ".github/pull_request_template.md",
};
const LABELS = {
  agents: "agents",
  claude: "Claude adapter",
  roadmap: "roadmap",
  design: "design",
  architecture: "architecture",
  "docs-map": "docs map",
  adr: "ADR registry",
};
const FLAGS = {
  "--agents": "agents",
  "--claude": "claude",
  "--roadmap": "roadmap",
  "--design": "design",
  "--architecture": "architecture",
  "--docs-map": "docs-map",
  "--adr": "adr",
};
const DOCS_MAP_TARGETS = ["agents", "claude", "roadmap", "design", "architecture", "adr"];
const TEMPLATE_MARKERS = ["## Template Setup", "[TODO", "TODO:"];
const HTML_TAGS = new Set([
  "a",
  "br",
  "code",
  "details",
  "div",
  "em",
  "img",
  "kbd",
  "li",
  "ol",
  "p",
  "span",
  "strong",
  "sub",
  "summary",
  "sup",
  "table",
  "tbody",
  "td",
  "th",
  "thead",
  "tr",
  "ul",
]);

function expandHome(value) {
  return value === "~" || value.startsWith("~/")
    ? path.join(os.homedir(), value.slice(2))
    : value;
}

function parseArgs(argv) {
  const configured = { ...DEFAULT_DOCS };
  const github = {
    enabled: false,
    allowBlankIssues: false,
    "issue-templates": [...DEFAULT_GITHUB["issue-templates"]],
    "issue-config": DEFAULT_GITHUB["issue-config"],
    "pr-template": DEFAULT_GITHUB["pr-template"],
  };
  let projectRoot;
  let only;

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--github") {
      github.enabled = true;
    } else if (argument === "--allow-blank-issues") {
      github.enabled = true;
      github.allowBlankIssues = true;
    } else if (argument === "--issue-templates") {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) {
        throw new Error("--issue-templates requires a comma-separated list");
      }
      const paths = value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
      if (paths.length === 0) {
        throw new Error("--issue-templates requires at least one path");
      }
      github.enabled = true;
      github["issue-templates"] = paths;
      index += 1;
    } else if (argument === "--issue-config" || argument === "--pr-template") {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) throw new Error(`${argument} requires a path`);
      github.enabled = true;
      github[argument.slice(2)] = value;
      index += 1;
    } else if (argument === "--only") {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) throw new Error("--only requires a comma-separated list");
      const names = value
        .split(",")
        .map((name) => name.trim())
        .filter(Boolean);
      const unknown = names.filter((name) => !(name in DEFAULT_DOCS));
      if (names.length === 0) throw new Error("--only requires at least one document");
      if (unknown.length > 0) throw new Error(`unknown --only document: ${unknown.join(", ")}`);
      only = new Set([...(only ?? []), ...names]);
      index += 1;
    } else if (argument in FLAGS) {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) throw new Error(`${argument} requires a path`);
      configured[FLAGS[argument]] = value;
      index += 1;
    } else if (argument.startsWith("--")) {
      throw new Error(`unknown option: ${argument}`);
    } else if (projectRoot === undefined) {
      projectRoot = argument;
    } else {
      throw new Error(`unexpected argument: ${argument}`);
    }
  }

  if (!projectRoot) {
    throw new Error(
      "usage: validate-project-guidance.mjs <project-root> [--only design,roadmap] " +
        "[--github] [--allow-blank-issues] [options]",
    );
  }
  return { projectRoot, configured, github, only };
}

function isFile(filePath) {
  try {
    return fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
}

function isPlaceholder(token) {
  const stripped = token.trim();
  if (stripped.startsWith("!--")) return false;
  const tagName = stripped.replace(/^\//, "").split(/\s+/, 1)[0].replace(/\/$/, "").toLowerCase();
  return !HTML_TAGS.has(tagName);
}

function markdownLinks(text) {
  return [...text.matchAll(/(?<!!)\[[^\]]+\]\(([^)]+)\)/g)].map((match) => match[1]);
}

function localLinkTarget(source, rawTarget) {
  const target = rawTarget.trim().replace(/^<|>$/g, "").split("#", 1)[0];
  if (!target || /^(https?:\/\/|mailto:|codex:)/.test(target)) return null;
  return path.resolve(path.dirname(source), target);
}

function resolveProjectPath(root, rawPath) {
  const expanded = expandHome(rawPath);
  return path.isAbsolute(expanded) ? path.resolve(expanded) : path.resolve(root, expanded);
}

function markdownTargets(filePath) {
  return new Set(
    markdownLinks(fs.readFileSync(filePath, "utf8"))
      .map((rawTarget) => localLinkTarget(filePath, rawTarget))
      .filter(Boolean),
  );
}

function topLevelYamlValue(text, key) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return text.match(new RegExp(`^${escaped}:\\s*(.+)$`, "m"))?.[1]?.trim();
}

function hasTopLevelYamlKey(text, key) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^${escaped}:(?:\\s|$)`, "m").test(text);
}

function validateIssueForm(filePath, relative, errors) {
  const content = fs.readFileSync(filePath, "utf8");
  for (const key of ["name", "description", "body"]) {
    if (!hasTopLevelYamlKey(content, key)) {
      errors.push(`${relative}: missing top-level Issue form key: ${key}`);
    }
  }

  const ids = [...content.matchAll(/^\s+id:\s*([^\s#]+)\s*$/gm)].map((match) => match[1]);
  if (ids.length === 0) errors.push(`${relative}: Issue form has no input ids`);

  const duplicateIds = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))].sort();
  if (duplicateIds.length > 0) {
    errors.push(`${relative}: duplicate Issue form ids: ${duplicateIds.join(", ")}`);
  }

  const invalidIds = ids.filter((id) => !/^[a-zA-Z0-9_-]+$/.test(id));
  if (invalidIds.length > 0) {
    errors.push(`${relative}: invalid Issue form ids: ${invalidIds.join(", ")}`);
  }
}

function relativeImport(fromFile, toFile) {
  return path.relative(path.dirname(fromFile), toFile).split(path.sep).join("/");
}

function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    return 2;
  }

  const root = path.resolve(expandHome(args.projectRoot));
  const paths = Object.fromEntries(
    Object.entries(args.configured).map(([name, rawPath]) => [
      name,
      resolveProjectPath(root, rawPath),
    ]),
  );
  const githubPaths = {
    "issue-templates": args.github["issue-templates"].map((rawPath) =>
      resolveProjectPath(root, rawPath),
    ),
    "issue-config": resolveProjectPath(root, args.github["issue-config"]),
    "pr-template": resolveProjectPath(root, args.github["pr-template"]),
  };
  const selected = args.only ?? new Set(Object.keys(DEFAULT_DOCS));
  const fullSetup = args.only === undefined;
  const errors = [];

  for (const name of selected) {
    if (!isFile(paths[name])) {
      errors.push(`missing required ${LABELS[name]}: ${args.configured[name]}`);
    }
  }

  const githubRequired = args.github.enabled
    ? [
        ...githubPaths["issue-templates"],
        githubPaths["issue-config"],
        githubPaths["pr-template"],
      ]
    : [];
  for (const filePath of githubRequired) {
    if (!isFile(filePath)) {
      errors.push(`missing required GitHub workflow file: ${path.relative(root, filePath)}`);
    }
  }

  const selectedExisting = [...selected].map((name) => paths[name]).filter(isFile);
  const githubExisting = githubRequired.filter(isFile);
  for (const filePath of [...selectedExisting, ...githubExisting]) {
    const text = fs.readFileSync(filePath, "utf8");
    const relative = path.relative(root, filePath);

    for (const marker of TEMPLATE_MARKERS) {
      if (text.includes(marker)) errors.push(`${relative}: template marker remains: ${marker}`);
    }

    const placeholders = [
      ...new Set(
        [...text.matchAll(/<([^>\n]{1,160})>/g)]
          .filter((match) => isPlaceholder(match[1]))
          .map((match) => match[0]),
      ),
    ].sort();
    if (placeholders.length > 0) {
      const preview = placeholders.slice(0, 5).join(", ");
      errors.push(`${relative}: unresolved placeholders: ${preview}${placeholders.length > 5 ? " ..." : ""}`);
    }

    for (const rawTarget of markdownLinks(text)) {
      const target = localLinkTarget(filePath, rawTarget);
      if (target && !fs.existsSync(target)) errors.push(`${relative}: broken local link: ${rawTarget}`);
    }
  }

  if (isFile(paths["docs-map"])) {
    const targets = markdownTargets(paths["docs-map"]);
    const requiredTargets = fullSetup
      ? DOCS_MAP_TARGETS
      : selected.has("docs-map")
        ? DOCS_MAP_TARGETS.filter((name) => isFile(paths[name]))
        : DOCS_MAP_TARGETS.filter((name) => selected.has(name));
    for (const name of requiredTargets) {
      if (isFile(paths[name]) && !targets.has(paths[name])) {
        errors.push(`${args.configured["docs-map"]}: does not link to ${args.configured[name]}`);
      }
    }
  }

  if (isFile(paths.agents) && (fullSetup || selected.has("agents"))) {
    const content = fs.readFileSync(paths.agents, "utf8");
    if (
      !content.includes("## Project Documentation") ||
      !content.includes("Documentation impact: none")
    ) {
      errors.push(`${args.configured.agents}: missing project-documentation impact contract`);
    }
    if (isFile(paths["docs-map"])) {
      const targets = markdownTargets(paths.agents);
      if (!targets.has(paths["docs-map"])) {
        errors.push(`${args.configured.agents}: does not link to ${args.configured["docs-map"]}`);
      }
    }
  }

  if (args.github.enabled) {
    if (!isFile(paths.agents)) {
      errors.push(`missing required agents for GitHub work tracking: ${args.configured.agents}`);
    } else {
      const content = fs.readFileSync(paths.agents, "utf8");
      const requiredPatterns = [
        ["Work Tracking section", /## Work Tracking/],
        ["GitHub Issue ownership", /GitHub Issues/],
        ["Project Status and Priority ownership", /Status[\s\S]{0,80}Priority|Priority[\s\S]{0,80}Status/],
        ["explicit Issue creation rule", /routine implementation request/i],
        ["explicit Roadmap update rule", /ROADMAP\.md[\s\S]{0,160}explicit developer request/i],
      ];
      for (const [label, pattern] of requiredPatterns) {
        if (!pattern.test(content)) {
          errors.push(`${args.configured.agents}: missing ${label}`);
        }
      }
    }

    for (const filePath of githubPaths["issue-templates"]) {
      if (isFile(filePath)) validateIssueForm(filePath, path.relative(root, filePath), errors);
    }

    if (isFile(githubPaths["issue-config"])) {
      const content = fs.readFileSync(githubPaths["issue-config"], "utf8");
      const blankIssues = topLevelYamlValue(content, "blank_issues_enabled");
      if (!["true", "false"].includes(blankIssues)) {
        errors.push(
          `${args.github["issue-config"]}: blank_issues_enabled must be true or false`,
        );
      } else if (!args.github.allowBlankIssues && blankIssues !== "false") {
        errors.push(
          `${args.github["issue-config"]}: blank_issues_enabled must be false for this profile`,
        );
      }
    }

    if (isFile(githubPaths["pr-template"])) {
      const content = fs.readFileSync(githubPaths["pr-template"], "utf8");
      const requiredPatterns = [
        ["Summary section", /^## Summary\s*$/m],
        ["Related issue section", /^## Related issue\s*$/m],
        ["Issue closing keyword", /\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\s+#/i],
        ["Verification section", /^## Verification\s*$/m],
        ["Documentation impact section", /^## Documentation impact\s*$/m],
      ];
      for (const [label, pattern] of requiredPatterns) {
        if (!pattern.test(content)) {
          errors.push(`${args.github["pr-template"]}: missing ${label}`);
        }
      }
    }
  }

  if (fullSetup || selected.has("claude")) {
    if (isFile(paths.claude) && isFile(paths.agents)) {
      const expectedImport = `@${relativeImport(paths.claude, paths.agents)}`;
      const content = fs.readFileSync(paths.claude, "utf8");
      const importsAgents = content
        .split(/\r?\n/)
        .some((line) => line.trim() === expectedImport);
      if (!importsAgents) {
        errors.push(`${args.configured.claude}: must import ${expectedImport}`);
      }
    } else if (isFile(paths.claude) && !selected.has("agents")) {
      errors.push(`missing Claude import target agents: ${args.configured.agents}`);
    }
  }

  if (errors.length > 0) {
    console.error("Project guidance validation failed:");
    for (const error of errors) console.error(`- ${error}`);
    return 1;
  }

  const mode = fullSetup ? "full setup" : "focused update";
  console.log(
    `Project guidance validation passed: ${selectedExisting.length + githubExisting.length} ` +
      `files checked (${mode}${args.github.enabled ? ", GitHub workflow" : ""})`,
  );
  return 0;
}

process.exitCode = main();

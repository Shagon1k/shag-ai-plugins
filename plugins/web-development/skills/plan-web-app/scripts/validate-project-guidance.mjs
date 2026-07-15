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
  let projectRoot;
  let only;

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--only") {
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
      "usage: validate-project-guidance.mjs <project-root> [--only design,roadmap] [options]",
    );
  }
  return { projectRoot, configured, only };
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
  const selected = args.only ?? new Set(Object.keys(DEFAULT_DOCS));
  const fullSetup = args.only === undefined;
  const errors = [];

  for (const name of selected) {
    if (!isFile(paths[name])) {
      errors.push(`missing required ${LABELS[name]}: ${args.configured[name]}`);
    }
  }

  const selectedExisting = [...selected].map((name) => paths[name]).filter(isFile);
  for (const filePath of selectedExisting) {
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
    `Project guidance validation passed: ${selectedExisting.length} documents checked (${mode})`,
  );
  return 0;
}

process.exitCode = main();

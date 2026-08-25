#!/usr/bin/env node
/** Validate cross-platform marketplace and plugin alignment. */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CODEX_MARKETPLACE = path.join(ROOT, ".agents/plugins/marketplace.json");
const CLAUDE_MARKETPLACE = path.join(ROOT, ".claude-plugin/marketplace.json");
const CURSOR_MARKETPLACE = path.join(ROOT, ".cursor-plugin/marketplace.json");

function relative(filePath) {
  return path.relative(ROOT, filePath);
}

function loadJson(filePath) {
  const value = JSON.parse(fs.readFileSync(filePath, "utf8"));
  if (value === null || Array.isArray(value) || typeof value !== "object") {
    throw new Error(`${relative(filePath)} must contain a JSON object`);
  }
  return value;
}

function pluginEntries(manifest) {
  if (!Array.isArray(manifest.plugins)) return new Map();
  return new Map(
    manifest.plugins
      .filter((entry) => entry && typeof entry === "object" && typeof entry.name === "string")
      .map((entry) => [entry.name, entry]),
  );
}

function directoryNames(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs
    .readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
    .map((entry) => entry.name)
    .sort();
}

function frontmatterFields(skillPath) {
  const lines = fs.readFileSync(skillPath, "utf8").split(/\r?\n/);
  if (lines[0] !== "---") return new Map();
  const closingDelimiter = lines.indexOf("---", 1);
  if (closingDelimiter === -1) return new Map();
  return new Map(
    lines.slice(1, closingDelimiter).flatMap((line) => {
      const match = line.match(/^([a-z][a-z0-9-]*):\s*(.*?)\s*$/);
      return match ? [[match[1], match[2].replace(/^(["'])(.*)\1$/, "$2")]] : [];
    }),
  );
}

function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function isExpectedCodexSource(source, pluginName) {
  return (
    source &&
    typeof source === "object" &&
    source.source === "local" &&
    source.path === `./plugins/${pluginName}`
  );
}

function main() {
  const errors = [];
  let codex;
  let claude;
  let cursor;

  try {
    codex = loadJson(CODEX_MARKETPLACE);
    claude = loadJson(CLAUDE_MARKETPLACE);
    cursor = loadJson(CURSOR_MARKETPLACE);
  } catch (error) {
    console.error(`Marketplace validation failed:\n- ${error.message}`);
    return 1;
  }

  if (new Set([codex.name, claude.name, cursor.name]).size !== 1) {
    errors.push("Codex, Claude, and Cursor marketplace names differ");
  }

  const codexPlugins = pluginEntries(codex);
  const claudePlugins = pluginEntries(claude);
  const cursorPlugins = pluginEntries(cursor);
  const codexNames = [...codexPlugins.keys()].sort();
  const claudeNames = [...claudePlugins.keys()].sort();
  const cursorNames = [...cursorPlugins.keys()].sort();
  if (!sameJson(codexNames, claudeNames) || !sameJson(codexNames, cursorNames)) {
    errors.push(
      `Platform plugin sets differ: codex=${JSON.stringify(codexNames)}, ` +
        `claude=${JSON.stringify(claudeNames)}, cursor=${JSON.stringify(cursorNames)}`,
    );
  }

  const pluginNames = [...new Set([...codexNames, ...claudeNames, ...cursorNames])].sort();
  const pluginDirectories = directoryNames(path.join(ROOT, "plugins"));
  if (!sameJson(pluginDirectories, pluginNames)) {
    errors.push(
      `Catalog and plugin directories differ: catalog=${JSON.stringify(pluginNames)}, ` +
        `directories=${JSON.stringify(pluginDirectories)}`,
    );
  }

  for (const pluginName of pluginNames) {
    const codexEntry = codexPlugins.get(pluginName);
    const claudeEntry = claudePlugins.get(pluginName);
    const cursorEntry = cursorPlugins.get(pluginName);
    if (codexEntry && !isExpectedCodexSource(codexEntry.source, pluginName)) {
      errors.push(`${pluginName}: invalid Codex marketplace source`);
    }
    if (claudeEntry && claudeEntry.source !== `./plugins/${pluginName}`) {
      errors.push(`${pluginName}: invalid Claude marketplace source`);
    }
    if (cursorEntry && cursorEntry.source !== `./plugins/${pluginName}`) {
      errors.push(`${pluginName}: invalid Cursor marketplace source`);
    }

    const pluginRoot = path.join(ROOT, "plugins", pluginName);
    const codexManifestPath = path.join(pluginRoot, ".codex-plugin/plugin.json");
    const claudeManifestPath = path.join(pluginRoot, ".claude-plugin/plugin.json");
    const cursorManifestPath = path.join(pluginRoot, ".cursor-plugin/plugin.json");

    let codexManifest;
    let claudeManifest;
    let cursorManifest;
    try {
      codexManifest = loadJson(codexManifestPath);
      claudeManifest = loadJson(claudeManifestPath);
      cursorManifest = loadJson(cursorManifestPath);
    } catch (error) {
      errors.push(error.message);
      continue;
    }

    if (codexManifest.name !== pluginName) {
      errors.push(`${relative(codexManifestPath)} name differs from catalog`);
    }
    if (claudeManifest.name !== pluginName) {
      errors.push(`${relative(claudeManifestPath)} name differs from catalog`);
    }
    if (cursorManifest.name !== pluginName) {
      errors.push(`${relative(cursorManifestPath)} name differs from catalog`);
    }
    if (new Set([codexManifest.version, claudeManifest.version, cursorManifest.version]).size !== 1) {
      errors.push(`${pluginName}: Codex, Claude, and Cursor versions differ`);
    }
    if (
      new Set([codexManifest.description, claudeManifest.description, cursorManifest.description])
        .size !== 1
    ) {
      errors.push(`${pluginName}: platform descriptions differ`);
    }
    if (cursorManifest.skills !== "./skills/") {
      errors.push(`${relative(cursorManifestPath)} must expose ./skills/`);
    }

    const skillsRoot = path.join(pluginRoot, "skills");
    const skillNames = directoryNames(skillsRoot);
    if (skillNames.length === 0) {
      errors.push(`${pluginName}: no shared skills found`);
      continue;
    }

    for (const skillName of skillNames) {
      const skillRoot = path.join(skillsRoot, skillName);
      const skillPath = path.join(skillRoot, "SKILL.md");
      const agentMetadataPath = path.join(skillRoot, "agents/openai.yaml");
      if (!fs.existsSync(skillPath)) {
        errors.push(`${relative(skillRoot)}: missing SKILL.md`);
        continue;
      }
      const fields = frontmatterFields(skillPath);
      if (fields.get("name") !== skillName) {
        errors.push(`${relative(skillPath)} name differs from directory`);
      }
      if (fields.get("user-invocable") !== "true") {
        errors.push(`${relative(skillPath)} must set user-invocable: true`);
      }
      const disableModelInvocation = fields.get("disable-model-invocation");
      if (!new Set(["true", "false"]).has(disableModelInvocation)) {
        errors.push(`${relative(skillPath)} must set disable-model-invocation explicitly`);
      }
      if (!fs.existsSync(agentMetadataPath)) {
        errors.push(`${relative(skillRoot)}: missing agents/openai.yaml`);
      } else {
        const agentMetadata = fs.readFileSync(agentMetadataPath, "utf8");
        if (!agentMetadata.includes(`$${skillName}`)) {
          errors.push(`${relative(agentMetadataPath)} must reference $${skillName}`);
        }
        const implicitInvocation = agentMetadata.match(
          /^\s*allow_implicit_invocation:\s*(true|false)\s*$/m,
        )?.[1];
        if (
          disableModelInvocation &&
          implicitInvocation !== String(disableModelInvocation === "false")
        ) {
          errors.push(`${relative(agentMetadataPath)} invocation policy differs from SKILL.md`);
        }
      }
    }
  }

  if (errors.length > 0) {
    console.error("Marketplace validation failed:");
    for (const error of errors) console.error(`- ${error}`);
    return 1;
  }

  console.log(
    `Marketplace validation passed: ${codex.name} (${codexPlugins.size} plugins, 3 platforms)`,
  );
  return 0;
}

process.exitCode = main();

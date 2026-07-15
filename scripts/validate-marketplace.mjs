#!/usr/bin/env node
/** Validate cross-platform marketplace and plugin alignment. */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CODEX_MARKETPLACE = path.join(ROOT, ".agents/plugins/marketplace.json");
const CLAUDE_MARKETPLACE = path.join(ROOT, ".claude-plugin/marketplace.json");

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

function frontmatterName(skillPath) {
  const lines = fs.readFileSync(skillPath, "utf8").split(/\r?\n/);
  if (lines[0] !== "---") return undefined;
  const closingDelimiter = lines.indexOf("---", 1);
  if (closingDelimiter === -1) return undefined;
  const nameLine = lines.slice(1, closingDelimiter).find((line) => line.startsWith("name:"));
  return nameLine
    ?.slice("name:".length)
    .trim()
    .replace(/^(["'])(.*)\1$/, "$2");
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

  try {
    codex = loadJson(CODEX_MARKETPLACE);
    claude = loadJson(CLAUDE_MARKETPLACE);
  } catch (error) {
    console.error(`Marketplace validation failed:\n- ${error.message}`);
    return 1;
  }

  if (codex.name !== claude.name) {
    errors.push("Codex and Claude marketplace names differ");
  }

  const codexPlugins = pluginEntries(codex);
  const claudePlugins = pluginEntries(claude);
  const codexNames = [...codexPlugins.keys()].sort();
  const claudeNames = [...claudePlugins.keys()].sort();
  if (JSON.stringify(codexNames) !== JSON.stringify(claudeNames)) {
    errors.push(
      `Codex and Claude plugin sets differ: codex=${JSON.stringify(codexNames)}, ` +
        `claude=${JSON.stringify(claudeNames)}`,
    );
  }

  const pluginNames = [...new Set([...codexNames, ...claudeNames])].sort();
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
    if (codexEntry && !isExpectedCodexSource(codexEntry.source, pluginName)) {
      errors.push(`${pluginName}: invalid Codex marketplace source`);
    }
    if (claudeEntry && claudeEntry.source !== `./plugins/${pluginName}`) {
      errors.push(`${pluginName}: invalid Claude marketplace source`);
    }

    const pluginRoot = path.join(ROOT, "plugins", pluginName);
    const codexManifestPath = path.join(pluginRoot, ".codex-plugin/plugin.json");
    const claudeManifestPath = path.join(pluginRoot, ".claude-plugin/plugin.json");

    let codexManifest;
    let claudeManifest;
    try {
      codexManifest = loadJson(codexManifestPath);
      claudeManifest = loadJson(claudeManifestPath);
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
    if (codexManifest.version !== claudeManifest.version) {
      errors.push(`${pluginName}: Codex and Claude versions differ`);
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
      if (frontmatterName(skillPath) !== skillName) {
        errors.push(`${relative(skillPath)} name differs from directory`);
      }
      if (!fs.existsSync(agentMetadataPath)) {
        errors.push(`${relative(skillRoot)}: missing agents/openai.yaml`);
      } else if (!fs.readFileSync(agentMetadataPath, "utf8").includes(`$${skillName}`)) {
        errors.push(`${relative(agentMetadataPath)} must reference $${skillName}`);
      }
    }
  }

  if (errors.length > 0) {
    console.error("Marketplace validation failed:");
    for (const error of errors) console.error(`- ${error}`);
    return 1;
  }

  console.log(`Marketplace validation passed: ${codex.name} (${codexPlugins.size} plugins)`);
  return 0;
}

process.exitCode = main();

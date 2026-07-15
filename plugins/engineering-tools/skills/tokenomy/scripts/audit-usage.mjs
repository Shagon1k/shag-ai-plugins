#!/usr/bin/env node
/** Compare configured tooling against directly observable usage. */

import * as fs from "node:fs";
import os from "node:os";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";

const VERSION = "0.1.0";
const OPAQUE_TOOL_WRAPPERS = new Set(["functions.exec", "js", "multi_tool_use.parallel"]);

function expandHome(value) {
  if (value === "~") return os.homedir();
  return value.startsWith("~/") ? path.join(os.homedir(), value.slice(2)) : value;
}

function resolvePath(cwd, rawPath) {
  const expanded = expandHome(rawPath);
  return path.isAbsolute(expanded) ? expanded : path.join(cwd, expanded);
}

function decodeTomlKey(rawKey) {
  if (rawKey.startsWith('"') && rawKey.endsWith('"')) {
    try {
      return JSON.parse(rawKey);
    } catch {
      return null;
    }
  }
  if (rawKey.startsWith("'") && rawKey.endsWith("'")) return rawKey.slice(1, -1);
  return /^[A-Za-z0-9_-]+$/.test(rawKey) ? rawKey : null;
}

function serversFromToml(text) {
  const servers = new Set();
  const tablePattern = /^\s*\[mcp_servers\.((?:"(?:[^"\\]|\\.)*")|(?:'[^']*')|(?:[A-Za-z0-9_-]+))\]\s*(?:#.*)?$/gm;
  for (const match of text.matchAll(tablePattern)) {
    const name = decodeTomlKey(match[1]);
    if (name) servers.add(name);
  }
  return servers;
}

function serversFromConfig(filePath) {
  try {
    const text = fs.readFileSync(filePath, "utf8");
    if (filePath.endsWith(".toml")) return serversFromToml(text);

    const data = JSON.parse(text);
    if (!data || Array.isArray(data) || typeof data !== "object") return new Set();
    const servers = new Set();
    for (const field of ["mcpServers", "servers", "mcp_servers"]) {
      const value = data[field];
      if (value && !Array.isArray(value) && typeof value === "object") {
        for (const name of Object.keys(value)) servers.add(name);
      }
    }
    if (data.projects && !Array.isArray(data.projects) && typeof data.projects === "object") {
      for (const project of Object.values(data.projects)) {
        if (project?.mcpServers && typeof project.mcpServers === "object") {
          for (const name of Object.keys(project.mcpServers)) servers.add(name);
        }
      }
    }
    return servers;
  } catch {
    return new Set();
  }
}

function discoverMcp(cwd, explicit) {
  const candidates = explicit.length
    ? explicit.map((filePath) => resolvePath(cwd, filePath))
    : [
        path.join(cwd, ".mcp.json"),
        path.join(cwd, ".claude/settings.json"),
        path.join(cwd, ".codex/config.toml"),
        path.join(cwd, ".cursor/mcp.json"),
        path.join(cwd, ".vscode/mcp.json"),
        expandHome("~/.claude.json"),
        expandHome("~/.claude/settings.json"),
        expandHome("~/.codex/config.toml"),
        expandHome("~/.cursor/mcp.json"),
      ];
  const servers = new Set();
  for (const candidate of candidates) {
    for (const name of serversFromConfig(candidate)) servers.add(name);
  }
  return servers;
}

function encodeProjectDir(cwd) {
  return cwd.replace(/[^a-zA-Z0-9]/g, "-");
}

function codexSessionMatches(filePath, cwd) {
  try {
    const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/, 20);
    for (const line of lines) {
      if (!line) continue;
      try {
        const record = JSON.parse(line);
        if (record.type === "session_meta") return record.payload?.cwd === cwd;
      } catch {
        // Ignore malformed records while looking for session metadata.
      }
    }
  } catch {
    // Unreadable sessions are not matches.
  }
  return false;
}

function globFiles(pattern) {
  try {
    return fs.globSync(pattern).filter((filePath) => {
      try {
        return fs.statSync(filePath).isFile();
      } catch {
        return false;
      }
    });
  } catch {
    return [];
  }
}

function discoverTranscripts(cwd, explicit) {
  if (explicit.length) {
    return [...new Set(explicit.flatMap((pattern) => globFiles(resolvePath(cwd, pattern))))].sort();
  }

  const files = [];
  const claudeBase = expandHome("~/.claude/projects");
  let transcriptDir = path.join(claudeBase, encodeProjectDir(cwd));
  if (!fs.existsSync(transcriptDir) && fs.existsSync(claudeBase)) {
    const basename = encodeProjectDir(path.basename(cwd));
    const candidates = fs
      .readdirSync(claudeBase, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && entry.name.endsWith(basename))
      .map((entry) => path.join(claudeBase, entry.name));
    if (candidates.length === 1) {
      [transcriptDir] = candidates;
      console.error(`[info] Using Claude transcript match: ${path.basename(transcriptDir)}`);
    } else if (candidates.length > 1) {
      candidates.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
      [transcriptDir] = candidates;
      console.error(`[warn] Multiple Claude transcript matches; using ${path.basename(transcriptDir)}`);
    }
  }
  files.push(...globFiles(path.join(transcriptDir, "*.jsonl")));

  const codexSessions = globFiles(expandHome("~/.codex/sessions/**/*.jsonl"));
  files.push(...codexSessions.filter((filePath) => codexSessionMatches(filePath, cwd)));
  return [...new Set(files)].sort();
}

async function* iterToolUses(jsonlPath) {
  const input = fs.createReadStream(jsonlPath, { encoding: "utf8" });
  const lines = readline.createInterface({ input, crlfDelay: Infinity });

  for await (const line of lines) {
    if (!line.trim()) continue;
    let record;
    try {
      record = JSON.parse(line);
    } catch {
      continue;
    }

    const payload = record.payload;
    if (record.type === "response_item" && payload?.type === "function_call") {
      let args = payload.arguments ?? {};
      if (typeof args === "string") {
        try {
          args = JSON.parse(args);
        } catch {
          args = {};
        }
      }
      yield [payload.name ?? "", args && typeof args === "object" ? args : {}];
      continue;
    }

    if (!Array.isArray(record.message?.content)) continue;
    for (const block of record.message.content) {
      if (block?.type === "tool_use") yield [block.name ?? "", block.input ?? {}];
    }
  }
}

function discoverSkills(cwd) {
  const skills = new Map();
  const roots = [
    path.join(cwd, ".agents/skills"),
    path.join(cwd, ".claude/skills"),
    expandHome("~/.codex/skills"),
    expandHome("~/.claude/skills"),
  ];
  for (const root of roots) {
    if (!fs.existsSync(root)) continue;
    for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
      const skillFile = path.join(root, entry.name, "SKILL.md");
      if (entry.isDirectory() && fs.existsSync(skillFile) && !skills.has(entry.name)) {
        skills.set(entry.name, path.join(root, entry.name));
      }
    }
  }
  return skills;
}

function estimateTokens(filePath) {
  try {
    const words = fs.readFileSync(filePath, "utf8").trim().split(/\s+/).filter(Boolean).length;
    return Math.floor(words * 1.3);
  } catch {
    return null;
  }
}

function skillFileOverhead(skillDir) {
  const result = {};
  const skillTokens = estimateTokens(path.join(skillDir, "SKILL.md"));
  if (skillTokens !== null) result["SKILL.md"] = skillTokens;

  const references = path.join(skillDir, "references");
  if (fs.existsSync(references)) {
    for (const name of fs.readdirSync(references).sort()) {
      const filePath = path.join(references, name);
      if (!fs.statSync(filePath).isFile()) continue;
      const tokens = estimateTokens(filePath);
      if (tokens !== null) result[`references/${name}`] = tokens;
    }
  }
  return result;
}

function increment(counter, name) {
  counter.set(name, (counter.get(name) ?? 0) + 1);
}

function sortedCounter(counter) {
  return [...counter.entries()].sort(([a], [b]) => a.localeCompare(b));
}

function topCounter(counter, limit = 10) {
  return [...counter.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit);
}

function parseArgs(argv) {
  const args = { projectDir: process.cwd(), mcpConfig: [], transcripts: [], json: false };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--json") {
      args.json = true;
      continue;
    }
    const fields = {
      "--project-dir": "projectDir",
      "--mcp-config": "mcpConfig",
      "--transcripts": "transcripts",
    };
    const field = fields[argument];
    if (!field) throw new Error(`unknown option: ${argument}`);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`${argument} requires a value`);
    if (Array.isArray(args[field])) args[field].push(value);
    else args[field] = value;
    index += 1;
  }
  return args;
}

async function buildReport(args) {
  const cwd = path.resolve(expandHome(args.projectDir));
  const configuredMcp = discoverMcp(cwd, args.mcpConfig);
  const configuredSkills = discoverSkills(cwd);
  const transcriptFiles = discoverTranscripts(cwd, args.transcripts);
  const mcpCalls = new Map();
  const skillCalls = new Map();
  const builtinCalls = new Map();

  for (const filePath of transcriptFiles) {
    for await (const [name, input] of iterToolUses(filePath)) {
      if (!name) continue;
      if (name.startsWith("mcp__")) {
        increment(mcpCalls, name.split("__")[1] || name);
      } else if (name === "Skill") {
        const skill = typeof input.skill === "string" ? input.skill.split(":").at(-1) : "(unknown)";
        increment(skillCalls, skill);
      } else {
        increment(builtinCalls, name);
      }
    }
  }

  const haveUsage = transcriptFiles.length > 0;
  const opaqueToolCalls = [...OPAQUE_TOOL_WRAPPERS].reduce(
    (total, name) => total + (builtinCalls.get(name) ?? 0),
    0,
  );
  const canAssessMcp = haveUsage && mcpCalls.size > 0 && opaqueToolCalls === 0;
  const unusedMcp = canAssessMcp
    ? [...configuredMcp].filter((name) => !mcpCalls.has(name)).sort()
    : [];

  const overhead = {};
  for (const name of ["CLAUDE.md", "AGENTS.md"]) {
    const tokens = estimateTokens(path.join(cwd, name));
    if (tokens !== null) overhead[name] = tokens;
  }

  const skillLoadEstimates = {};
  for (const [name, skillPath] of [...configuredSkills.entries()].sort()) {
    const files = skillFileOverhead(skillPath);
    if (Object.keys(files).length) {
      skillLoadEstimates[name] = {
        total_tokens: Object.values(files).reduce((total, count) => total + count, 0),
        files,
      };
    }
  }

  return {
    version: VERSION,
    project: cwd,
    transcripts_found: transcriptFiles.length,
    have_usage: haveUsage,
    can_assess_mcp: canAssessMcp,
    opaque_tool_calls: opaqueToolCalls,
    mcp_servers: [
      ...[...configuredMcp].sort().map((name) => ({
        name,
        calls: mcpCalls.get(name) ?? 0,
        configured: true,
        candidate_to_remove: canAssessMcp && !mcpCalls.has(name),
      })),
      ...[...mcpCalls.keys()]
        .filter((name) => !configuredMcp.has(name))
        .sort()
        .map((name) => ({ name, calls: mcpCalls.get(name), configured: false, candidate_to_remove: false })),
    ],
    skills: [...configuredSkills.keys()].sort().map((name) => ({
      name,
      calls: skillCalls.get(name) ?? 0,
      configured: true,
    })),
    builtin_calls: topCounter(builtinCalls).map(([name, calls]) => ({ name, calls })),
    unused_mcp: unusedMcp,
    context_overhead_estimates: overhead,
    context_overhead_note:
      "Runtime-specific imports are not counted; actual loaded cost may be higher or lazily loaded.",
    skill_load_estimates: skillLoadEstimates,
  };
}

function printHuman(report) {
  console.log("=".repeat(60));
  console.log(`TOKENOMY USAGE AUDIT  v${report.version}`);
  console.log("=".repeat(60));
  console.log(`Project:        ${report.project}`);
  console.log(`MCP config:     ${report.mcp_servers.filter((item) => item.configured).length} server(s) discovered`);
  console.log(
    `Usage history:  ${report.transcripts_found} transcript file(s)` +
      (report.have_usage ? "" : "  (none found - usage cannot be determined)"),
  );
  if (report.have_usage && !report.can_assess_mcp) {
    const detail = report.opaque_tool_calls
      ? `${report.opaque_tool_calls} opaque wrapper call(s) observed`
      : "no direct MCP calls observed";
    console.log(`MCP visibility:  ${detail} - unused servers cannot be determined`);
  }

  if (Object.keys(report.context_overhead_estimates).length) {
    console.log("\n## Context overhead (approximate word-count x 1.3)");
    for (const [name, tokens] of Object.entries(report.context_overhead_estimates)) {
      console.log(`  ${name.padEnd(28)} ~${tokens.toLocaleString()} tokens`);
    }
  }

  console.log("\n## MCP servers (runtime-dependent context cost)");
  const configured = report.mcp_servers.filter((item) => item.configured);
  if (!configured.length) console.log("  none discovered (pass --mcp-config for an explicit config)");
  for (const item of configured) {
    if (report.can_assess_mcp) {
      const flag = item.candidate_to_remove ? "  <-- candidate to remove" : "";
      console.log(`  ${item.name.padEnd(28)} ${String(item.calls).padStart(5)} call(s)${flag}`);
    } else {
      console.log(`  ${item.name}`);
    }
  }

  if (report.skills.length) {
    console.log("\n## Skills");
    for (const item of report.skills) console.log(`  ${item.name.padEnd(28)} ${String(item.calls).padStart(5)} call(s)`);
  }

  if (report.builtin_calls.length) {
    console.log("\n## Other tools invoked (informational)");
    for (const item of report.builtin_calls) {
      console.log(`  ${item.name.padEnd(28)} ${String(item.calls).padStart(5)} call(s)`);
    }
  }

  console.log("\n## Recommendation");
  if (!report.can_assess_mcp) {
    const reason = !report.have_usage
      ? "No usage history"
      : report.opaque_tool_calls
        ? "Opaque wrapper calls may hide nested MCP usage"
        : "No direct MCP calls are observable";
    console.log(`  ${reason}, so 'unused' cannot be determined.`);
  } else if (report.unused_mcp.length) {
    console.log(`  Review configured servers with no observed calls: ${report.unused_mcp.join(", ")}`);
  } else {
    console.log("  No unused MCP servers detected in the observable history.");
  }
}

async function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    return 2;
  }
  const report = await buildReport(args);
  if (args.json) console.log(JSON.stringify(report, null, 2));
  else printHuman(report);
  return 0;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) process.exitCode = await main();

export {
  buildReport,
  iterToolUses,
  serversFromConfig,
  serversFromToml,
};

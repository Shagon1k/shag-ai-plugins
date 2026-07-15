#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { iterToolUses, serversFromConfig } from "./audit-usage.mjs";

const SCRIPT = path.join(path.dirname(fileURLToPath(import.meta.url)), "audit-usage.mjs");

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tokenomy-"));
  const write = (relative, content) => {
    const filePath = path.join(root, relative);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content, "utf8");
    return filePath;
  };
  const run = (config, transcript) => {
    const result = spawnSync(
      process.execPath,
      [
        SCRIPT,
        "--project-dir",
        root,
        "--mcp-config",
        config,
        "--transcripts",
        transcript,
        "--json",
      ],
      { encoding: "utf8" },
    );
    assert.equal(result.status, 0, result.stdout + result.stderr);
    return JSON.parse(result.stdout);
  };
  return { root, write, run };
}

test("reads JSON and Codex TOML MCP configs", (t) => {
  const context = fixture();
  t.after(() => fs.rmSync(context.root, { recursive: true, force: true }));
  const jsonConfig = context.write(
    "mcp.json",
    '{"mcpServers":{"alpha":{}},"servers":{"beta":{}}}',
  );
  const tomlConfig = context.write(
    "config.toml",
    '[mcp_servers.gamma]\ncommand = "gamma"\n[mcp_servers."delta-server"]\ncommand = "delta"\n',
  );

  assert.deepEqual([...serversFromConfig(jsonConfig)].sort(), ["alpha", "beta"]);
  assert.deepEqual([...serversFromConfig(tomlConfig)].sort(), ["delta-server", "gamma"]);
});

test("parses Anthropic and Codex tool calls", async (t) => {
  const context = fixture();
  t.after(() => fs.rmSync(context.root, { recursive: true, force: true }));
  const transcript = context.write(
    "mixed.jsonl",
    '{"message":{"content":[{"type":"tool_use","name":"mcp__alpha__read","input":{}}]}}\n' +
      '{"type":"response_item","payload":{"type":"function_call","name":"mcp__beta__write","arguments":"{\\"value\\":1}"}}\n',
  );
  const calls = [];
  for await (const call of iterToolUses(transcript)) calls.push(call);

  assert.deepEqual(calls, [
    ["mcp__alpha__read", {}],
    ["mcp__beta__write", { value: 1 }],
  ]);
});

test("flags an unused server when direct MCP calls are observable", (t) => {
  const context = fixture();
  t.after(() => fs.rmSync(context.root, { recursive: true, force: true }));
  const config = context.write("mcp.json", '{"mcpServers":{"used":{},"unused":{}}}');
  const transcript = context.write(
    "usage.jsonl",
    '{"message":{"content":[{"type":"tool_use","name":"mcp__used__read","input":{}}]}}\n',
  );

  const result = context.run(config, transcript);

  assert.equal(result.can_assess_mcp, true);
  assert.deepEqual(result.unused_mcp, ["unused"]);
});

test("does not infer unused when no direct MCP calls are visible", (t) => {
  const context = fixture();
  t.after(() => fs.rmSync(context.root, { recursive: true, force: true }));
  const config = context.write("mcp.json", '{"mcpServers":{"unknown":{}}}');
  const transcript = context.write(
    "wrapped.jsonl",
    '{"type":"response_item","payload":{"type":"function_call","name":"functions.exec","arguments":"{}"}}\n',
  );

  const result = context.run(config, transcript);

  assert.equal(result.can_assess_mcp, false);
  assert.deepEqual(result.unused_mcp, []);
  assert.equal(result.mcp_servers[0].candidate_to_remove, false);
});

test("opaque wrapper suppresses candidates even with direct calls", (t) => {
  const context = fixture();
  t.after(() => fs.rmSync(context.root, { recursive: true, force: true }));
  const config = context.write(
    "mcp.json",
    '{"mcpServers":{"visible":{},"possibly-hidden":{}}}',
  );
  const transcript = context.write(
    "mixed-visibility.jsonl",
    '{"message":{"content":[{"type":"tool_use","name":"mcp__visible__read","input":{}}]}}\n' +
      '{"type":"response_item","payload":{"type":"function_call","name":"functions.exec","arguments":"{}"}}\n',
  );

  const result = context.run(config, transcript);

  assert.equal(result.can_assess_mcp, false);
  assert.equal(result.opaque_tool_calls, 1);
  assert.deepEqual(result.unused_mcp, []);
});

#!/usr/bin/env node
/** Run every repository validation through one stable entry point. */

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT_FILES = fs.globSync("{scripts,plugins}/**/*.mjs", { cwd: ROOT }).sort();
const TEST_FILES = SCRIPT_FILES.filter((file) => file.endsWith(".test.mjs"));
const JSON_FILES = [
  "package.json",
  "package-lock.json",
  ...fs.globSync("{.agents,.claude-plugin,plugins,evals}/**/*.json", { cwd: ROOT }),
].sort();

function run(label, args) {
  console.log(`\n> ${label}`);
  const result = spawnSync(process.execPath, args, {
    cwd: ROOT,
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run("validate marketplace structure", ["scripts/validate-marketplace.mjs"]);

for (const file of JSON_FILES) {
  console.log(`\n> check JSON: ${file}`);
  JSON.parse(fs.readFileSync(path.join(ROOT, file), "utf8"));
}

for (const file of SCRIPT_FILES) {
  run(`check syntax: ${file}`, ["--check", file]);
}

if (TEST_FILES.length > 0) {
  run(`run ${TEST_FILES.length} test files`, ["--test", ...TEST_FILES]);
}

console.log("\nAll repository validations passed.");

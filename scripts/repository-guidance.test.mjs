import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

test("keeps AGENTS.md canonical and CLAUDE.md import-only", () => {
  assert.equal(read("CLAUDE.md").trim(), "@AGENTS.md");
  assert.ok(read("AGENTS.md").split(/\r?\n/).length <= 50, "AGENTS.md must stay lean");
});

test("links task-specific guidance from the root instructions", () => {
  const agents = read("AGENTS.md");
  for (const relativePath of [".agents/skill-development.md", ".agents/skill-evals.md"]) {
    assert.ok(agents.includes(relativePath), `AGENTS.md must link ${relativePath}`);
    assert.match(read(relativePath), /^---\naudience: ai\n---/);
  }
});

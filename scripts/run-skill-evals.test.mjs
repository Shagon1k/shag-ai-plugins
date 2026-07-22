import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  buildCodexArguments,
  loadEvalConfig,
  parseArguments,
  diffSnapshots,
  resolveSkillPath,
  safeFixturePath,
  snapshotDirectory,
  validateGrade,
} from "./run-skill-evals.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("parses a cases path and repeatable case filters", () => {
  assert.deepEqual(parseArguments(["evals/example/cases.json", "--case", "a", "--case", "b"]), {
    casesPath: "evals/example/cases.json",
    selected: ["a", "b"],
    list: false,
  });
  assert.equal(parseArguments(["evals/example/cases.json", "--list"]).list, true);
  assert.throws(() => parseArguments([]), /Usage/);
});

test("builds isolated candidate and grader CLI arguments", () => {
  const candidate = buildCodexArguments({
    caseRoot: "/tmp/case",
    sandbox: "read-only",
    prompt: "candidate prompt",
  });
  assert.deepEqual(candidate.slice(-5), ["--sandbox", "read-only", "--cd", "/tmp/case", "candidate prompt"]);

  const grader = buildCodexArguments({
    caseRoot: "/tmp/case",
    sandbox: "read-only",
    prompt: "grader prompt",
    outputSchema: "/tmp/schema.json",
  });
  assert.deepEqual(grader.slice(-5), [
    "--cd",
    "/tmp/case",
    "--output-schema",
    "/tmp/schema.json",
    "grader prompt",
  ]);
  assert.ok(grader.includes("--output-schema"));
});

test("loads both repository eval suites with their execution modes", () => {
  const assessment = loadEvalConfig(
    "evals/engineering-tools/assess-change-complexity/cases.json",
    ROOT,
  );
  const planning = loadEvalConfig("evals/web-development/plan-web-app/cases.json", ROOT);

  assert.equal(assessment.skill, "assess-change-complexity");
  assert.equal(assessment.sandbox, "read-only");
  assert.equal(planning.skill, "plan-web-app");
  assert.equal(planning.sandbox, "workspace-write");
});

test("discovers shared skills by skill slug", () => {
  assert.match(
    resolveSkillPath("assess-change-complexity", ROOT),
    /plugins\/engineering-tools\/skills\/assess-change-complexity\/SKILL\.md$/,
  );
  assert.match(
    resolveSkillPath("plan-web-app", ROOT),
    /plugins\/web-development\/skills\/plan-web-app\/SKILL\.md$/,
  );
});

test("keeps fixture paths inside the isolated case root", () => {
  const caseRoot = path.join(ROOT, ".tmp-eval-case");
  assert.equal(safeFixturePath(caseRoot, "src/index.js"), path.join(caseRoot, "src/index.js"));
  assert.throws(() => safeFixturePath(caseRoot, "../outside.md"), /escapes case root/);
});

test("detects deterministic workspace changes", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "skill-eval-snapshot-"));
  try {
    fs.writeFileSync(path.join(root, "existing.txt"), "before", "utf8");
    fs.writeFileSync(path.join(root, "deleted.txt"), "delete", "utf8");
    const before = snapshotDirectory(root);

    fs.writeFileSync(path.join(root, "existing.txt"), "after", "utf8");
    fs.rmSync(path.join(root, "deleted.txt"));
    fs.writeFileSync(path.join(root, "created.txt"), "created", "utf8");
    const after = snapshotDirectory(root);

    assert.deepEqual(diffSnapshots(before, after), [
      { path: "created.txt", status: "created" },
      { path: "deleted.txt", status: "deleted" },
      { path: "existing.txt", status: "modified" },
    ]);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("accepts only complete ordered semantic grades", () => {
  const expectations = ["first", "second"];
  const grade = validateGrade(
    {
      expectations: [
        { index: 0, verdict: "PASS", evidence: "Explicitly present" },
        { index: 1, verdict: "FAIL", evidence: "Required detail is missing" },
      ],
      summary: "One expectation failed",
    },
    expectations,
  );

  assert.equal(grade.passed, false);
  assert.equal(grade.passedCount, 1);
  assert.equal(grade.items[1].expectation, "second");
  assert.throws(
    () =>
      validateGrade(
        {
          expectations: [{ index: 1, verdict: "PASS", evidence: "Wrong order" }],
          summary: "Invalid",
        },
        ["first"],
      ),
    /has index/,
  );
});

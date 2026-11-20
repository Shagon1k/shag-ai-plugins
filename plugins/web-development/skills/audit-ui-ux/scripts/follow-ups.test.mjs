#!/usr/bin/env node
/** Tests for re-audits (diff-audits.mjs and the previous block) and rubric export. */

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { proposeComparison, similarity } from "./diff-audits.mjs";
import { checkOwnership, draftRubric } from "./export-rubric.mjs";
import { validateAudit } from "./validate-audit.mjs";

const contrast = { id: "F-001", kind: "defect", lens: "a11y", title: "Helper text fails contrast", principle: ["WCAG 1.4.3"], location: { description: "Email helper", selector: "#email-help" }, surfaces: ["S-001"], severity: "major", frequency: "recurring", acceptance: "No contrast failure on #email-help." };
const lostInput = { id: "F-002", kind: "defect", lens: "flow", title: "Failed payment clears the form", principle: ["FL-06"], location: { description: "Checkout form", component: "CheckoutForm.tsx" }, surfaces: ["S-002"], severity: "blocker", frequency: "isolated", acceptance: "Values survive a declined card." };
const toast = { id: "F-003", kind: "defect", lens: "content", title: "Vague error toast", principle: ["CO-03"], location: { description: "Toast" }, surfaces: ["S-003"], severity: "minor", frequency: "isolated", acceptance: "Errors name the cause." };

test("scores the same problem higher than a different one", () => {
  const again = { ...contrast, id: "F-010", title: "Email helper text contrast is too low" };
  assert.ok(similarity(contrast, again) > similarity(contrast, lostInput));
});

test("proposes open, resolved?, and not-rechecked statuses and lists new defects", () => {
  const previousAudit = { surfaces: [{ id: "S-001", screen: "Checkout" }, { id: "S-002", screen: "Checkout" }, { id: "S-003", screen: "Account" }] };
  const currentAudit = { surfaces: [{ id: "S-001", screen: "Checkout" }] };
  const current = [
    { ...contrast, id: "F-010", title: "Email helper text contrast is too low" },
    { id: "F-011", kind: "defect", lens: "visual", title: "Totals jump on load", principle: ["FL-17"], location: { description: "Totals" }, surfaces: ["S-001"] },
  ];
  const { results, newDefects } = proposeComparison(previousAudit, [contrast, lostInput, toast], currentAudit, current);
  assert.deepEqual(results.map((result) => [result.id, result.status, result.now]), [
    ["F-001", "open", "F-010"],
    ["F-002", "resolved?", null],
    ["F-003", "not-rechecked", null],
  ]);
  assert.deepEqual(newDefects.map((finding) => finding.id), ["F-011"]);
});

function writeAudit(root, audit, findings) {
  fs.mkdirSync(path.join(root, "evidence"), { recursive: true });
  fs.writeFileSync(path.join(root, "evidence/S-001.png"), "x");
  fs.writeFileSync(path.join(root, "audit.json"), JSON.stringify(audit));
  fs.writeFileSync(path.join(root, "findings.jsonl"), findings.map((finding) => JSON.stringify(finding)).join("\n") + "\n");
}

test("requires a confirmed status for every previous defect", () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "audit-ui-ux-reaudit-"));
  const minimal = (extra) => ({
    version: 1, title: "t", date: "2026-11-16", target: { name: "n", scope: "s" }, modes: ["live"], lenses: ["flow"],
    product: { summary: "p" }, tasks: [{ id: "T1", goal: "g", importance: "primary", status: "walked", surfaces: ["S-001"] }],
    surfaces: [{ id: "S-001", screen: "Checkout", state: "default", viewport: "m", evidence: ["evidence/S-001.png"], lenses: { flow: { status: "checked" } } }],
    priorities: [], recheck: [{ surface: "S-001", lens: "flow", result: "confirmed" }], ...extra,
  });
  writeAudit(path.join(base, "old"), minimal({}), [contrast, lostInput]);
  const current = path.join(base, "new");
  writeAudit(current, minimal({ previous: { dir: "../old", results: [{ id: "F-001", status: "resolved?" }] } }), []);
  const { errors } = validateAudit(current);
  assert.ok(errors.some((error) => error.includes('confirm proposals such as "resolved?"')));
  assert.ok(errors.some((error) => error.includes("previous defect F-002 has no status")));
  writeAudit(current, minimal({ previous: { dir: "../old", results: [{ id: "F-001", status: "resolved", note: "Probe shows 7.1:1." }, { id: "F-002", status: "not-rechecked", note: "Payment provider was down." }] } }), []);
  assert.deepEqual(validateAudit(current).errors, []);
});

test("drafts a rubric where every defect lands in exactly one place", () => {
  const audit = {
    title: "Shop", date: "2026-11-16", priorities: ["F-002"],
    surfaces: [{ id: "S-001", evidence: ["evidence/S-001.inventory.json"] }],
    themes: [{ id: "TH-1", title: "Errors lose work", findings: ["F-002", "F-003"] }],
    journeys: [{ task: "T1", metrics: { screens: 4, decisions: 6 } }],
  };
  const idea = { id: "F-004", kind: "suggestion", title: "Calmer hero" };
  const { markdown, coverage, gates, checks, criteria } = draftRubric(audit, [contrast, lostInput, toast, idea]);
  assert.deepEqual(coverage, { "F-002": "X3", "F-001": "G1", "F-003": "C1" });
  assert.match(gates[0].text, /WCAG 1\.4\.3/);
  assert.match(checks[1].text, /compare-tokens/);
  assert.deepEqual(criteria.map((criterion) => criterion.name), ["Errors lose work", "Cost of the walked journeys"]);
  assert.match(markdown, /^\| C1 \| Errors lose work \|/m);
  assert.equal(draftRubric(audit, [contrast, lostInput, toast, idea], { withIdeas: true }).coverage["F-004"], "C3");
});

test("the rendered rubric gives every defect exactly one owner", () => {
  // F-001 is prioritized (a check) and also in a theme; the theme criterion must not name it.
  const audit = {
    title: "Shop", date: "2026-11-16", priorities: ["F-001"],
    themes: [{ id: "TH-1", title: "Checkout trust", findings: ["F-001", "F-002", "F-003"] }],
  };
  const { markdown, ownership, coverage } = draftRubric(audit, [contrast, lostInput, toast]);
  assert.deepEqual(ownership, [], markdown);
  assert.deepEqual(coverage, { "F-001": "X2", "F-002": "C1", "F-003": "C1" });
  const row = markdown.split("\n").find((line) => line.startsWith("| C1 |"));
  assert.doesNotMatch(row, /F-001/);
  assert.match(row, /F-002, F-003/);
});

test("ownership check catches an ID rendered in two places and an unowned defect", () => {
  const markdown = ["| C1 | Theme | of F-002 | all of F-001, F-002 |", "Gates:", "- G1 No WCAG 1.4.3 failure (F-003).", "Checks:", "- X2 F-001 Title: done.", "", "Coverage: F-001→X2."].join("\n");
  assert.deepEqual(checkOwnership(markdown, ["F-001", "F-002", "F-003", "F-004"]), [
    "F-001 appears in C1, X2",
    "F-004 appears in no criterion, gate, or check",
  ]);
});

const CASES = JSON.parse(fs.readFileSync(fileURLToPath(new URL("../../../../../evals/web-development/audit-ui-ux/cases.json", import.meta.url)), "utf8"));
const EXPORTER = fileURLToPath(new URL("./export-rubric.mjs", import.meta.url));

function materialize(caseId) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `audit-ui-ux-${caseId}-`));
  for (const [file, content] of Object.entries(CASES.cases.find((entry) => entry.id === caseId).files)) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), content);
  }
  return root;
}

test("the unchanged version 1 eval audits still validate and export through the CLI", () => {
  for (const caseId of ["rubric-export", "re-audit-after-fixes"]) {
    const dir = path.join(materialize(caseId), "audit/2026-10-01-checkout");
    const { errors, warnings } = validateAudit(dir);
    assert.deepEqual(errors, [], caseId);
    assert.ok(warnings.some((warning) => warning.includes("version 1 is the legacy schema")));
    const result = spawnSync(process.execPath, [EXPORTER, dir], { encoding: "utf8" });
    assert.equal(result.status, 0, `${caseId}: ${result.stderr}`);
    assert.match(result.stdout, /^Coverage: F-001→\w+, F-002→\w+, F-003→\w+\.$/m);
  }
});

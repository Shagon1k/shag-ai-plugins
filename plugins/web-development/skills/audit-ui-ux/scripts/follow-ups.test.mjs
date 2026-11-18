#!/usr/bin/env node
/** Tests for re-audits (diff-audits.mjs and the previous block) and rubric export. */

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { proposeComparison, similarity } from "./diff-audits.mjs";
import { draftRubric } from "./export-rubric.mjs";
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

#!/usr/bin/env node
/** Tests for validate-audit.mjs and build-report.mjs, which share the audit-record fixture. */

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { buildAuditOutputs, escapeHtml, groupByArea, loadPrincipleTitles, sortFindings } from "./build-report.mjs";
import { validateAudit } from "./validate-audit.mjs";

const VALIDATOR = fileURLToPath(new URL("./validate-audit.mjs", import.meta.url));
const BUILDER = fileURLToPath(new URL("./build-report.mjs", import.meta.url));
const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);
const LENSES = ["flow", "a11y", "visual", "content"];

function surface(id, overrides = {}) {
  return {
    id,
    screen: "Checkout",
    state: "default",
    viewport: "mobile-390x844",
    area: "checkout",
    evidence: [`evidence/${id}.png`],
    lenses: Object.fromEntries(LENSES.map((lens) => [lens, { status: "checked" }])),
    ...overrides,
  };
}

function defect(overrides = {}) {
  return {
    id: "F-001",
    kind: "defect",
    lens: "a11y",
    title: "Helper text <small> fails contrast",
    surfaces: ["S-001"],
    location: { description: "Email helper text", selector: "#email-help" },
    observation: "Helper text is #AAAAAA on white, 2.32:1 at 13 px.",
    impact: "Low-vision buyers cannot read the privacy note.",
    principle: ["WCAG 1.4.3"],
    severity: "major",
    frequency: "recurring",
    evidence: { basis: "measured", files: ["evidence/S-001.png"], annotations: ["annotated/F-001.svg"], measurement: "2.32:1" },
    recommendation: "Use the #555555 text token for helper text.",
    acceptance: "The probe reports no contrast failure for #email-help.",
    effort: "S",
    ...overrides,
  };
}

function createAudit({ audit = {}, findings = [defect()] } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "audit-ui-ux-record-"));
  fs.mkdirSync(path.join(root, "evidence"));
  fs.mkdirSync(path.join(root, "annotated"));
  for (const id of ["S-001", "S-002"]) fs.writeFileSync(path.join(root, `evidence/${id}.png`), PNG_1X1);
  fs.writeFileSync(
    path.join(root, "annotated/F-001.svg"),
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"></svg>',
  );
  const record = {
    version: 1,
    title: "Checkout audit",
    date: "2026-11-16",
    target: { name: "Shop", location: "http://localhost:3000", scope: "Guest checkout" },
    modes: ["live"],
    areas: [{ id: "browse", title: "Browsing" }, { id: "checkout", title: "Checkout" }],
    lenses: LENSES,
    product: { summary: "Tea shop for returning buyers.", assumptions: ["Guest checkout is primary."] },
    verdict: "Checkout works; contrast needs attention.",
    tasks: [{ id: "T1", goal: "Buy one tea as a guest", importance: "primary", status: "walked", surfaces: ["S-001", "S-002"] }],
    surfaces: [surface("S-001"), surface("S-002", { state: "error" })],
    priorities: ["F-001"],
    recheck: [
      { surface: "S-001", lens: "flow", result: "confirmed" },
      { surface: "S-002", lens: "flow", result: "confirmed" },
      { surface: "S-002", lens: "visual", result: "confirmed" },
    ],
    limitations: ["Payment iframe not audited."],
    journeys: [{ task: "T1", metrics: { screens: 2, interactions: 6, fields: 3 }, note: "mobile" }],
    strengths: [{ title: "Delivery date shown early", surfaces: ["S-001"], why: "Sets expectations." }],
    ...audit,
  };
  fs.writeFileSync(path.join(root, "audit.json"), JSON.stringify(record, null, 2));
  fs.writeFileSync(path.join(root, "findings.jsonl"), findings.map((finding) => JSON.stringify(finding)).join("\n") + "\n");
  return root;
}

test("accepts a complete audit", () => {
  const { errors, warnings, stats } = validateAudit(createAudit());
  assert.deepEqual(errors, []);
  assert.deepEqual(warnings, []);
  assert.equal(stats.findings, 1);
  assert.equal(stats.requiredRechecks, 3);
});

test("rejects pending lenses unless the audit is in progress", () => {
  const root = createAudit({
    audit: { surfaces: [surface("S-001", { lenses: { flow: { status: "pending" }, a11y: { status: "checked" }, visual: { status: "checked" }, content: { status: "checked" } } }), surface("S-002")] },
  });
  assert.ok(validateAudit(root).errors.some((error) => error.includes("still pending")));
  assert.ok(!validateAudit(root, { allowPending: true }).errors.some((error) => error.includes("pending")));
});

test("allows planned surfaces without evidence while the audit is in progress", () => {
  const planned = surface("S-002", { evidence: [], lenses: Object.fromEntries(LENSES.map((lens) => [lens, { status: "pending" }])) });
  const root = createAudit({ audit: { surfaces: [surface("S-001"), planned], recheck: [] } });
  assert.deepEqual(validateAudit(root, { allowPending: true }).errors, []);
  assert.ok(validateAudit(root).errors.some((error) => error.includes("evidence must list at least one file")));
});

test("requires notes for unverifiable lenses and every declared lens", () => {
  const root = createAudit({
    audit: { surfaces: [surface("S-001", { lenses: { flow: { status: "unverifiable" }, a11y: { status: "checked" }, visual: { status: "checked" } } }), surface("S-002")] },
  });
  const { errors } = validateAudit(root);
  assert.ok(errors.some((error) => error.includes("lens flow is unverifiable and needs a note")));
  assert.ok(errors.some((error) => error.includes("lens content needs a status")));
});

test("checks finding fields, references, and evidence files", () => {
  const root = createAudit({
    findings: [
      defect({ severity: "critical", impact: "", surfaces: ["S-404"], evidence: { basis: "measured", files: ["evidence/missing.png"] } }),
      defect({ id: "F-001" }),
      { id: "F-003", kind: "suggestion", lens: "visual", title: "Idea", surfaces: ["S-001"], location: { description: "Hero" }, observation: "Plain hero.", severity: "minor", evidence: { basis: "observed", files: ["evidence/S-001.png"] }, recommendation: "Improve hierarchy" },
    ],
  });
  const { errors, warnings } = validateAudit(root);
  for (const expected of [
    "severity must be one of",
    "impact is required for a defect",
    "unknown surface S-404",
    "evidence file not found: evidence/missing.png",
    "duplicate id",
    "a suggestion must not have a severity",
  ]) {
    assert.ok(errors.some((error) => error.includes(expected)), `missing error: ${expected}\n${errors.join("\n")}`);
  }
  assert.ok(warnings.some((warning) => warning.includes("reads like a direction")));
});

test("requires priorities and a re-check sample for a finished audit", () => {
  const root = createAudit({ audit: { priorities: [], recheck: [] } });
  const { errors } = validateAudit(root);
  assert.ok(errors.some((error) => error.includes("priorities must list")));
  assert.ok(errors.some((error) => error.includes("recheck covers 0")));
  assert.deepEqual(validateAudit(root, { allowPending: true }).errors, []);
});

test("validator CLI exits 1 on errors and 0 on a valid audit", () => {
  const valid = spawnSync(process.execPath, [VALIDATOR, createAudit()], { encoding: "utf8" });
  assert.equal(valid.status, 0, valid.stdout);
  const invalid = spawnSync(process.execPath, [VALIDATOR, createAudit({ audit: { version: 2 } })], { encoding: "utf8" });
  assert.equal(invalid.status, 1);
  assert.match(invalid.stdout, /version must be 1/);
});

test("builds an escaped, self-contained report and a summary", () => {
  const suggestion = {
    id: "F-002",
    kind: "suggestion",
    lens: "visual",
    title: "Group delivery options",
    surfaces: ["S-002"],
    location: { description: "Delivery section" },
    observation: "Three delivery options sit in one row without a heading.",
    impact: "Faster comparison of delivery options.",
    evidence: { basis: "observed", files: ["evidence/S-002.png"] },
    recommendation: "Add a 'Delivery' heading and show options as a radio group.",
  };
  const root = createAudit({ findings: [suggestion, defect()] });
  const { reportPath, summaryPath, warnings } = buildAuditOutputs(root);
  assert.deepEqual(warnings, []);
  const html = fs.readFileSync(reportPath, "utf8");
  assert.match(html, /Helper text &lt;small&gt; fails contrast/);
  assert.doesNotMatch(html, /Helper text <small>/);
  assert.match(html, /data:image\/svg\+xml;base64,/);
  assert.match(html, /data:image\/png;base64,/);
  assert.match(html, /<h2 id="fix-first">Fix first<\/h2>/);
  assert.ok(html.indexOf('id="F-001"') < html.indexOf('id="F-002"'), "defects come before suggestions");
  assert.doesNotMatch(html, /\{\{(?:title|content)\}\}/);
  const summary = fs.readFileSync(summaryPath, "utf8");
  assert.match(summary, /0 blockers, 1 major, 0 minor, 1 suggestion, 0 signature ideas$/m);
  assert.match(html, /<h2 id="ideas">Part 2 · Ideas<\/h2>/);
  assert.match(html, /<h3 class="area-title" id="area-checkout">Checkout/);
  assert.ok(html.indexOf('id="defect-list"') < html.indexOf('id="F-002"'), "suggestions render outside the defect list");
  assert.match(summary, new RegExp(`!\\[F-001\\]\\(${path.join(root, "annotated/F-001.svg").replaceAll(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\)`));
});

test("refuses to build an invalid audit", () => {
  const root = createAudit({ audit: { lenses: [] } });
  assert.throws(() => buildAuditOutputs(root), /Audit is invalid/);
  const result = spawnSync(process.execPath, [BUILDER, root], { encoding: "utf8" });
  assert.equal(result.status, 1);
});

test("loads principle titles and sorts findings by kind, severity, and frequency", () => {
  const titles = loadPrincipleTitles();
  assert.equal(titles.get("FL-06"), "Errors are recoverable");
  assert.ok(titles.size >= 40);
  const sorted = sortFindings([
    { id: "F-004", kind: "suggestion" },
    { id: "F-003", kind: "defect", severity: "minor", frequency: "widespread" },
    { id: "F-002", kind: "defect", severity: "blocker", frequency: "isolated" },
    { id: "F-001", kind: "defect", severity: "minor", frequency: "isolated" },
  ]);
  assert.deepEqual(sorted.map((finding) => finding.id), ["F-002", "F-003", "F-001", "F-004"]);
  assert.equal(escapeHtml(`<a href="x">'`), "&lt;a href=&quot;x&quot;&gt;&#39;");
});

function signature(overrides = {}) {
  return {
    id: "F-003",
    kind: "signature",
    lens: "taste",
    title: "Steam rising while the order brews",
    surfaces: ["S-002"],
    location: { description: "Order confirmation while payment completes" },
    observation: "A plain spinner shows while the order is confirmed.",
    recommendation: "Show a short steam curl rising from the cup icon until confirmation arrives.",
    impact: "Turns waiting into a moment that matches the tea ritual.",
    risks: "Static under prefers-reduced-motion; status text stays visible.",
    cost: "accent",
    obviousness: "non-obvious",
    evidence: { basis: "observed", files: ["evidence/S-002.png"] },
    sketches: ["sketches/F-003.png"],
    ...overrides,
  };
}

test("validates signature ideas and their sketches", () => {
  const lenses = [...LENSES, "taste"];
  const surfaces = [surface("S-001"), surface("S-002", { state: "error" })].map((item) => ({
    ...item,
    lenses: { ...item.lenses, taste: { status: "checked" } },
  }));
  const root = createAudit({ audit: { lenses, surfaces }, findings: [defect(), signature()] });
  fs.mkdirSync(path.join(root, "sketches"));
  fs.writeFileSync(path.join(root, "sketches/F-003.png"), PNG_1X1);
  assert.deepEqual(validateAudit(root).errors, []);

  const { reportPath, summaryPath } = buildAuditOutputs(root);
  const html = fs.readFileSync(reportPath, "utf8");
  assert.match(html, /<h2 id="ideas">Part 2 · Ideas<\/h2>/);
  assert.match(html, /concept sketch, not an implementation/i);
  assert.match(html, /<div class="compare">.*<figcaption>Now<\/figcaption>/s);
  assert.match(fs.readFileSync(summaryPath, "utf8"), /## Signature ideas/);

  const broken = createAudit({
    audit: { lenses, surfaces },
    findings: [defect(), signature({ id: "F-004", cost: "huge", risks: "", severity: "minor", obviousness: "obvious", sketches: ["sketches/none.png"] })],
  });
  const { errors, warnings } = validateAudit(broken);
  for (const expected of ["cost must be one of", "risks is required", "must not have a severity", "sketch not found"]) {
    assert.ok(errors.some((error) => error.includes(expected)), `missing error: ${expected}\n${errors.join("\n")}`);
  }
  assert.ok(warnings.some((warning) => warning.includes("non-obvious")));
});

test("validates themes, journeys, and strengths", () => {
  const second = defect({ id: "F-002", title: "Error toast vanishes", severity: "major" });
  const third = defect({ id: "F-003", title: "Totals jump", severity: "minor" });
  const loose = createAudit({ findings: [defect(), second, third], audit: { themes: [{ id: "TH-1", title: "Checkout trust", rootCause: "No state", findings: ["F-001", "F-003"], recommendation: "Persist state" }] } });
  const { errors, warnings } = validateAudit(loose);
  assert.deepEqual(errors, []);
  assert.ok(warnings.some((warning) => warning.includes("major defect F-002 belongs to no theme")));

  const broken = createAudit({
    audit: {
      themes: [{ id: "T1", title: "x", findings: ["F-001"] }],
      journeys: [{ task: "T9", metrics: { screens: -1 } }],
      strengths: [],
    },
  });
  const result = validateAudit(broken);
  for (const expected of ["id must look like TH-1", "rootCause is required", "at least two findings", "unknown task T9", "screens must be a non-negative number"]) {
    assert.ok(result.errors.some((error) => error.includes(expected)), `missing error: ${expected}\n${result.errors.join("\n")}`);
  }
  assert.ok(result.warnings.some((warning) => warning.includes("no strengths recorded")));
});

test("groups findings by area and keeps themes to defects", () => {
  const audit = {
    areas: [{ id: "a", title: "Area A" }, { id: "b", title: "Area B" }],
    surfaces: [{ id: "S-001", area: "a" }, { id: "S-002", area: "b" }],
  };
  const groups = groupByArea(audit, [
    { id: "F-001", surfaces: ["S-001"] },
    { id: "F-002", surfaces: ["S-001", "S-002"] },
    { id: "F-003", surfaces: ["S-001", "S-002"], area: "b" },
  ]);
  assert.deepEqual(groups.map((group) => [group.id, group.findings.map((finding) => finding.id)]), [
    ["across", ["F-002"]],
    ["a", ["F-001"]],
    ["b", ["F-003"]],
  ]);
  const idea = { id: "F-002", kind: "suggestion", lens: "visual", title: "Idea", surfaces: ["S-001"], location: { description: "Hero" }, observation: "Plain.", impact: "Nicer.", evidence: { basis: "observed", files: ["evidence/S-001.png"] }, recommendation: "Use the serif for the hero headline." };
  const root = createAudit({ findings: [defect(), idea], audit: { themes: [{ id: "TH-1", title: "t", rootCause: "r", recommendation: "x", findings: ["F-001", "F-002"] }] } });
  assert.ok(validateAudit(root).errors.some((error) => error.includes("F-002 is not a defect")));
  const noArea = createAudit({ audit: { surfaces: [surface("S-001", { area: "nowhere" }), surface("S-002")] } });
  assert.ok(validateAudit(noArea).errors.some((error) => error.includes("area must be one of the declared areas")));
});

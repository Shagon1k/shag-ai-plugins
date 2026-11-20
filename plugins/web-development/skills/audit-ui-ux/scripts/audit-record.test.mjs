#!/usr/bin/env node
/** Tests for validate-audit.mjs and build-report.mjs, which share the audit-record fixture. */

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { buildAuditOutputs, disclaimer, escapeHtml, groupByArea, loadPrincipleTitles, missingImageLine, optimizePng, sortFindings, svgDataUri } from "./build-report.mjs";
import { decodePng, encodePng } from "./png.mjs";
import { validateAudit, visibleByNature } from "./validate-audit.mjs";

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
    tasks: ["T1"],
    sketches: ["sketches/F-001.png"],
    effort: "S",
    ...overrides,
  };
}

const ALONE = { rule: "themes", ids: ["F-001"], reason: "The only major defect; nothing shares its cause." };

function depth(overrides = {}) {
  const done = (check, extra = {}) => ({ check, status: "done", tasks: ["T1"], surfaces: ["S-001", "S-002"], note: `Walked T1 for ${check}.`, ...extra });
  return {
    selection: "T1 is the only primary task; both checkout states carry its risk.",
    checks: [
      done("first-use"),
      done("failure-recovery", { findings: ["F-001"] }),
      done("keyboard"),
      done("constrained-states", { states: { empty: "done", error: "done", "long-content": "done", "small-viewport": "done" } }),
    ],
    complete: "Every check ran on T1; a second error-state pass found nothing new.",
    ...overrides,
  };
}

function createAudit({ audit = {}, findings = [defect()] } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "audit-ui-ux-record-"));
  fs.mkdirSync(path.join(root, "evidence"));
  fs.mkdirSync(path.join(root, "annotated"));
  fs.mkdirSync(path.join(root, "sketches"));
  fs.writeFileSync(path.join(root, "sketches/F-001.png"), PNG_1X1);
  for (const id of ["S-001", "S-002"]) fs.writeFileSync(path.join(root, `evidence/${id}.png`), PNG_1X1);
  fs.writeFileSync(
    path.join(root, "annotated/F-001.svg"),
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"></svg>',
  );
  const record = {
    version: 2,
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
      { surface: "S-002", lens: "content", result: "confirmed" },
    ],
    depth: depth(),
    exceptions: [ALONE],
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
    audit: { surfaces: [surface("S-001", { lenses: { flow: { status: "pending" }, a11y: { status: "checked" }, visual: { status: "checked" }, content: { status: "checked" } } }), surface("S-002")], recheck: [] },
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
  const invalid = spawnSync(process.execPath, [VALIDATOR, createAudit({ audit: { version: 3 } })], { encoding: "utf8" });
  assert.equal(invalid.status, 1);
  assert.match(invalid.stdout, /version must be one of 1, 2/);
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
    sketches: ["sketches/F-002.png"],
  };
  const root = createAudit({ findings: [suggestion, defect()] });
  fs.mkdirSync(path.join(root, "sketches"), { recursive: true });
  fs.writeFileSync(path.join(root, "sketches/F-002.png"), PNG_1X1);
  const { reportPath, summaryPath, warnings } = buildAuditOutputs(root);
  assert.deepEqual(warnings, []);
  const html = fs.readFileSync(reportPath, "utf8");
  assert.match(html, /Helper text &lt;small&gt; fails contrast/);
  assert.doesNotMatch(html, /Helper text <small>/);
  assert.match(html, /data:image\/svg\+xml,%3Csvg/, "SVG embedded as text, not base64");
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
  // The first screen links the top five and every area; limits and depth are reported.
  const contents = html.slice(html.indexOf('<nav class="contents"'), html.indexOf("</nav>", html.indexOf('<nav class="contents"')));
  assert.match(contents, /href="#F-001"/);
  assert.match(contents, /href="#area-checkout"/);
  assert.match(contents, /<li>Checkout: <a href="#area-checkout">1 problem<\/a> · <a href="#ideas-checkout">1 idea<\/a><\/li>/);
  assert.match(contents, /<li>Browsing: no findings<\/li>/, "areas without findings still appear");
  assert.ok(html.indexOf('<nav class="contents"') < html.indexOf('id="fix-first"'), "contents come before the sections");
  assert.match(html, /<h2 id="limits">Limits of this audit<\/h2>/);
  assert.match(html, /<h2 id="depth">Depth pass<\/h2>/);
  assert.match(html, /class="fig-evidence"/);
  assert.match(summary, /## Limitations\n\n- live mode, 2 surfaces: no lens marked unverifiable\n- Payment iframe not audited\./);
  assert.doesNotMatch(summary, /every lens was verifiable/);
  assert.match(summary, /## Depth pass/);
  assert.match(summary, /It is not usability testing with real users/);
  assert.match(summary, /## Next step\n\nShall I start a fix pass driven by these findings, export a rubric for improve-artifact, or plan a re-audit after the fixes\?\n$/, "the question closes the summary");
  // Taste and other suggestions reach the session summary with Now and Proposed images.
  assert.match(summary, /## Suggestions\n\n- \*\*F-002: Group delivery options\*\* \(visual\)/);
  assert.match(summary, /!\[F-002 now\]\(.*evidence\/S-002\.png\)/);
  assert.match(summary, /!\[F-002 proposed\]\(.*sketches\/F-002\.png\)/);
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
    obviousnessReason: "Needs to know that buyers wait for the confirmation e-mail before closing the tab.",
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
  fs.mkdirSync(path.join(root, "sketches"), { recursive: true });
  fs.writeFileSync(path.join(root, "sketches/F-003.png"), PNG_1X1);
  assert.deepEqual(validateAudit(root).errors, []);

  const { reportPath, summaryPath } = buildAuditOutputs(root);
  const html = fs.readFileSync(reportPath, "utf8");
  assert.match(html, /<h2 id="ideas">Part 2 · Ideas<\/h2>/);
  assert.match(html, /concept sketch, not an implementation/i);
  assert.match(html, /<div class="compare"><figure class="fig-evidence">.*<figcaption>Now · screenshot<\/figcaption>.*<figure class="fig-concept">/s);
  assert.match(fs.readFileSync(summaryPath, "utf8"), /## Signature ideas/);

  const broken = createAudit({
    audit: { lenses, surfaces },
    findings: [defect(), signature({ id: "F-004", cost: "huge", risks: "", severity: "minor", obviousness: "obvious", obviousnessReason: "", sketches: ["sketches/none.png"] })],
  });
  const { errors } = validateAudit(broken);
  for (const expected of ["cost must be one of", "risks is required", "must not have a severity", "sketch not found", "non-obvious", "obviousnessReason must say"]) {
    assert.ok(errors.some((error) => error.includes(expected)), `missing error: ${expected}\n${errors.join("\n")}`);
  }

  const unsketched = createAudit({ audit: { lenses, surfaces }, findings: [defect(), signature({ sketches: [] })] });
  assert.ok(validateAudit(unsketched).errors.some((error) => error.includes("F-003: signature idea without a sketch image")));
  const none = createAudit({ audit: { lenses, surfaces }, findings: [defect()] });
  assert.ok(validateAudit(none).errors.some((error) => error.includes("no signature ideas")));
  const rulesOnly = createAudit({ audit: { lenses, surfaces, exceptions: [ALONE, { rule: "signatures", reason: "The user asked for a rules-only audit." }] }, findings: [defect()] });
  assert.deepEqual(validateAudit(rulesOnly).errors, []);
});

test("validates themes, journeys, and strengths", () => {
  const second = defect({ id: "F-002", title: "Error toast vanishes", severity: "major" });
  const third = defect({ id: "F-003", title: "Totals jump", severity: "minor" });
  const theme = { id: "TH-1", title: "Checkout trust", rootCause: "No state", findings: ["F-001", "F-003"], recommendation: "Persist state" };
  const loose = createAudit({ findings: [defect(), second, third], audit: { themes: [theme] } });
  assert.ok(validateAudit(loose).errors.some((error) => error.includes("major defect F-002 belongs to no theme")));
  const excused = createAudit({ findings: [defect(), second, third], audit: { themes: [theme], exceptions: [{ rule: "themes", ids: ["F-002"], reason: "Caused by the payment iframe alone." }] } });
  assert.deepEqual(validateAudit(excused).errors, []);
  const unthemed = createAudit({ findings: [defect(), second, third], audit: { exceptions: [] } });
  assert.ok(validateAudit(unthemed).errors.some((error) => error.includes("no themes")));
  // A single major defect in a small audit still needs a theme or a reasoned exception.
  const alone = createAudit({ audit: { exceptions: [] } });
  assert.ok(validateAudit(alone).errors.some((error) => error.includes("major defect F-001 belongs to no theme")));
  const legacy = createAudit({ findings: [defect(), second, third], audit: { version: 1, depth: undefined } });
  const legacyResult = validateAudit(legacy);
  assert.deepEqual(legacyResult.errors, [], "version 1 audits keep synthesis rules as warnings");
  assert.ok(legacyResult.warnings.some((warning) => warning.includes("legacy schema")));
  assert.ok(legacyResult.warnings.some((warning) => warning.includes("no themes")));

  const broken = createAudit({
    audit: {
      themes: [{ id: "T1", title: "x", findings: ["F-001"] }],
      journeys: [{ task: "T9", metrics: { screens: -1 } }],
      strengths: [],
    },
  });
  const result = validateAudit(broken);
  for (const expected of ["id must look like TH-1", "rootCause is required", "at least two findings", "unknown task T9", "screens must be a non-negative number", "no strengths recorded", "walked primary task T1 has no journey metrics"]) {
    assert.ok(result.errors.some((error) => error.includes(expected)), `missing error: ${expected}\n${result.errors.join("\n")}`);
  }
  const excepted = createAudit({ audit: { journeys: [], strengths: [], exceptions: [ALONE, { rule: "journeys", ids: ["T1"], reason: "The payment step needs a real card." }, { rule: "strengths", reason: "A one-page source audit." }] } });
  assert.deepEqual(validateAudit(excepted).errors, []);
  assert.ok(validateAudit(createAudit({ audit: { exceptions: [{ rule: "vibes" }] } })).errors.some((error) => error.includes("rule must be one of")));
});

test("requires the depth benchmark in version 2", () => {
  const missing = createAudit({ audit: { depth: undefined } });
  assert.ok(validateAudit(missing).errors.some((error) => error.includes("depth is required")));
  assert.deepEqual(validateAudit(missing, { allowPending: true }).errors, []);
  const partial = createAudit({
    audit: {
      depth: depth({
        complete: "",
        checks: [
          { check: "first-use", status: "done", note: "", surfaces: [] },
          { check: "keyboard", status: "skipped", note: "x", surfaces: ["S-404"] },
          { check: "constrained-states", status: "done", note: "Two states.", surfaces: ["S-002"], states: { empty: "done", error: "done" } },
          { check: "vibes", status: "done", note: "x", surfaces: ["S-001"] },
        ],
      }),
    },
  });
  const { errors } = validateAudit(partial);
  for (const expected of ["complete must say", "needs exactly one failure-recovery check", "depth first-use: note must say", "depth first-use: done needs the surfaces", "depth keyboard: status must be one of", "unknown surface S-404", "states.long-content must be one of", "states.small-viewport must be one of", "unknown check vibes"]) {
    assert.ok(errors.some((error) => error.includes(expected)), `missing error: ${expected}\n${errors.join("\n")}`);
  }
});

test("blocker and major defects name the tasks they affect", () => {
  const root = createAudit({ findings: [defect({ tasks: [] }), defect({ id: "F-002", severity: "minor", tasks: ["T7"] })] });
  const { errors } = validateAudit(root);
  assert.ok(errors.some((error) => error.includes("F-001: a major defect must list the tasks")));
  assert.ok(errors.some((error) => error.includes("F-002: unknown task T7")));
});

test("accepts only eligible re-check pairs", () => {
  const surfaces = [surface("S-001", { lenses: { ...surface("S-001").lenses, content: { status: "not-applicable", note: "No copy." } } }), surface("S-002", { state: "error" })];
  const recheck = [
    { surface: "S-001", lens: "content", result: "confirmed" },
    { surface: "S-001", lens: "a11y", result: "confirmed" },
    { surface: "S-002", lens: "flow", result: "new-findings", findings: ["F-001"] },
    { surface: "S-002", lens: "visual", result: "confirmed" },
  ];
  const { errors } = validateAudit(createAudit({ audit: { surfaces, recheck } }));
  for (const expected of ["recheck[0]: S-001 content is not-applicable", "recheck[1]: S-001 a11y has findings", "recheck[2]: F-001 must list S-002 and lens flow", "recheck covers 1 surface lenses"]) {
    assert.ok(errors.some((error) => error.includes(expected)), `missing error: ${expected}\n${errors.join("\n")}`);
  }
  const legacy = validateAudit(createAudit({ audit: { surfaces, recheck, version: 1 } }));
  assert.ok(!legacy.errors.some((error) => error.startsWith("recheck")), legacy.errors.join("\n"));
  assert.ok(legacy.warnings.some((warning) => warning.includes("recheck[1]: S-001 a11y has findings")));
  const reopened = defect({ id: "F-002", severity: "minor", lens: "flow", surfaces: ["S-002"], tasks: undefined, noSketch: "Copy change." });
  const valid = createAudit({
    findings: [defect(), reopened],
    audit: { recheck: [{ surface: "S-002", lens: "flow", result: "new-findings", findings: ["F-002"] }, { surface: "S-001", lens: "flow", result: "confirmed" }, { surface: "S-002", lens: "content", result: "confirmed" }], themes: [{ id: "TH-1", title: "t", rootCause: "r", recommendation: "x", findings: ["F-001", "F-002"] }] },
  });
  assert.deepEqual(validateAudit(valid).errors, []);
});

test("requires sketches for ideas and prioritized defects, and flags mismatched pairs", () => {
  const idea = { id: "F-002", kind: "suggestion", lens: "visual", title: "Calmer hero", surfaces: ["S-001"], location: { description: "Hero" }, observation: "Two loud CTAs.", impact: "Clearer start.", evidence: { basis: "observed", files: ["evidence/S-001.png"] }, recommendation: "Make the secondary CTA a text link." };
  const unsketched = createAudit({ findings: [defect({ sketches: undefined }), idea] });
  const { errors } = validateAudit(unsketched);
  assert.ok(errors.some((error) => error.includes("F-001: defect without a sketch image")));
  assert.ok(errors.some((error) => error.includes("F-002: suggestion without a sketch image")));
  const capability = createAudit({ findings: [defect({ sketches: undefined }), idea], audit: { exceptions: [ALONE, { rule: "sketches", reason: "No way to render HTML in this environment." }] } });
  assert.deepEqual(validateAudit(capability).errors, []);

  const wide = Buffer.from(PNG_1X1);
  const root = createAudit({ findings: [defect({ sketches: ["sketches/shared.png"] }), { ...idea, evidence: { basis: "observed", files: ["evidence/S-002.png"] }, sketches: ["sketches/shared.png"] }] });
  fs.mkdirSync(path.join(root, "sketches"), { recursive: true });
  wide.writeUInt32BE(400, 16);
  wide.writeUInt32BE(100, 20);
  fs.writeFileSync(path.join(root, "sketches/shared.png"), wide);
  const { errors: mismatch } = validateAudit(root);
  assert.ok(mismatch.some((error) => error.includes("sketches/shared.png is the proposed sketch for F-001, F-002")));
  assert.ok(mismatch.some((error) => error.includes("F-002: Now (evidence/S-002.png, 1×1) and Proposed (sketches/shared.png, 400×100) have different shapes")));
  // A version 1 audit keeps these as warnings.
  const audit = JSON.parse(fs.readFileSync(path.join(root, "audit.json"), "utf8"));
  fs.writeFileSync(path.join(root, "audit.json"), JSON.stringify({ ...audit, version: 1 }));
  const legacy = validateAudit(root);
  assert.ok(!legacy.errors.some((error) => error.includes("different shapes")));
  assert.ok(legacy.warnings.some((warning) => warning.includes("different shapes")));

  // Every defect needs a sketch or a reason in version 2, not only the prioritized ones.
  const minor = defect({ id: "F-002", severity: "minor", sketches: undefined, tasks: undefined });
  assert.ok(validateAudit(createAudit({ findings: [defect(), minor] })).errors.some((error) => error.includes("F-002: defect without a sketch image")));
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

/** A textured screenshot-like image (illustration grain), the case that bloats reports. */
function noisyImage(width, height) {
  const data = new Uint8Array(width * height * 4);
  let seed = 7;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      const noise = (seed >> 16) % 48;
      data.set([100 + noise, 60 + noise, 140 + (noise >> 1), 255], (y * width + x) * 4);
    }
  }
  return { width, height, data };
}

test("embeds smaller images that keep their size within the width cap", () => {
  const original = encodePng(noisyImage(300, 200));
  const lossy = optimizePng(original);
  assert.ok(lossy.length < original.length * 0.8, `${lossy.length} vs ${original.length}`);
  assert.deepEqual([decodePng(lossy).width, decodePng(lossy).height], [300, 200], "below the cap the size is kept");
  const capped = decodePng(optimizePng(original, { imageWidth: 150 }));
  assert.deepEqual([capped.width, capped.height], [150, 100]);
  const lossless = decodePng(optimizePng(original, { lossless: true }));
  assert.deepEqual(lossless.data, decodePng(original).data, "--lossless keeps every pixel");
  const wide = decodePng(optimizePng(original, { lossless: true, imageWidth: 150 }));
  assert.deepEqual([wide.width, wide.height], [300, 200], "--lossless keeps the size above the width cap");
  assert.equal(optimizePng(Buffer.from("not a png")).toString(), "not a png", "unreadable images pass through");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 200"><image href="data:image/png;base64,${original.toString("base64")}" width="300" height="200"/><text>A #1 "mark"</text></svg>`;
  const uri = svgDataUri(svg);
  assert.ok(uri.startsWith("data:image/svg+xml,%3Csvg"));
  assert.ok(!/[\s"'<>#]/.test(uri), "safe inside an HTML attribute");
  assert.ok(uri.length < svg.length, "the nested screenshot is re-encoded");
  assert.match(decodeURIComponent(uri), /viewBox="0 0 300 200"/);
});

test("the review stage checks the end of phase 4 but not the phase 5 outputs", () => {
  // Phase 5 outputs missing: no priorities, re-check, or sketches yet.
  const root = createAudit({ audit: { priorities: [], recheck: [], exceptions: [] }, findings: [defect({ sketches: undefined })] });
  assert.deepEqual(validateAudit(root, { stage: "review" }).errors, []);
  assert.ok(validateAudit(root).errors.length > 0);
  const pending = createAudit({ audit: { depth: undefined, surfaces: [surface("S-001", { lenses: { ...surface("S-001").lenses, flow: { status: "pending" } } }), surface("S-002")], recheck: [] } });
  const { errors } = validateAudit(pending, { stage: "review" });
  assert.ok(errors.some((error) => error.includes("1 surface lenses are still pending")));
  assert.ok(errors.some((error) => error.includes("depth is required")));
  assert.deepEqual(validateAudit(pending, { stage: "plan" }).errors, []);
  const cli = spawnSync(process.execPath, [VALIDATOR, pending, "--stage", "review"], { encoding: "utf8" });
  assert.equal(cli.status, 1);
  assert.equal(spawnSync(process.execPath, [VALIDATOR, pending, "--stage", "later"], { encoding: "utf8" }).status, 2);
});

test("node-only design findings need no annotation, defects with a frame image do", () => {
  const nodeOnly = defect({ evidence: { basis: "design-node", files: [], measurement: "2.31:1 from fills" }, location: { description: "Hint", node: "12:12" } });
  const imageless = createAudit({ findings: [nodeOnly], audit: { modes: ["design"], surfaces: [surface("S-001", { evidence: ["evidence/S-001.nodes.json"] }), surface("S-002")] } });
  fs.writeFileSync(path.join(imageless, "evidence/S-001.nodes.json"), "{}");
  assert.ok(!validateAudit(imageless).warnings.some((warning) => warning.includes("no annotated image")));
  const framed = createAudit({ findings: [nodeOnly], audit: { modes: ["design"] } });
  assert.ok(validateAudit(framed).warnings.some((warning) => warning.includes("no annotated image")));
});

test("summary items without images say which image is missing and why", () => {
  const sourceDefect = defect({ evidence: { basis: "source", files: ["evidence/S-001.png"], measurement: "line 12" }, sketches: ["sketches/F-001.html"] });
  const audit = { exceptions: [{ rule: "sketches", reason: "No browser can render HTML here." }] };
  assert.equal(missingImageLine({ ...sourceDefect, evidence: { basis: "source", measurement: "line 12" } }, audit), "_Images: no current image (source mode renders nothing); no sketch image: No browser can render HTML here (HTML source: sketches/F-001.html)._");
  const copyOnly = { lens: "content", principle: ["CO-02"], sketches: undefined, noSketch: "Copy change only." };
  assert.equal(missingImageLine(defect(copyOnly), {}), "_Images: no sketch: Copy change only._");
  assert.equal(missingImageLine(defect(), {}), "", "nothing missing, no line");
  const root = createAudit({ findings: [defect(copyOnly)] });
  const summary = fs.readFileSync(buildAuditOutputs(root).summaryPath, "utf8");
  assert.match(summary, /1\. \*\*F-001: [^\n]+\n\n   !\[F-001\]\([^)]+\)\n\n   _Images: no sketch: Copy change only\._/);
});

test("noSketch is refused where the fix is visible by nature, and allowed for an invisible hit area", () => {
  const noSketch = { sketches: undefined, noSketch: "Token change only." };
  const errorsFor = (overrides, audit = {}) => validateAudit(createAudit({ findings: [defect({ ...noSketch, ...overrides })], audit })).errors.filter((error) => error.includes("noSketch on a"));
  assert.equal(errorsFor({}).length, 1, "contrast (WCAG 1.4.3) always changes what is seen");
  assert.equal(errorsFor({ lens: "visual", principle: ["VI-02"] }).length, 1, "visual lens");
  assert.equal(errorsFor({ principle: ["WCAG 2.4.7"] }).length, 1, "focus visible");
  assert.deepEqual(errorsFor({ principle: ["WCAG 2.5.8"], noSketch: "Only the transparent hit area grows." }), [], "target size can be invisible");
  assert.deepEqual(errorsFor({ lens: "flow", principle: ["FL-06"], noSketch: "Focus order only." }), [], "behaviour");
  assert.deepEqual(errorsFor({}, { exceptions: [{ rule: "sketches", reason: "No browser can render HTML here; capture.mjs exited 3." }] }), [], "a capability exception still covers it");
  assert.ok(visibleByNature({ lens: "a11y", principle: ["WCAG 1.4.11"] }));
  assert.ok(!visibleByNature({ lens: "content", principle: ["CO-02"] }));
});

test("the disclaimer names only the evidence the audit's modes produced", () => {
  assert.match(disclaimer({ modes: ["source"] }), /based on the front-end source\./);
  assert.doesNotMatch(disclaimer({ modes: ["source"] }), /running page|measurements|screenshots/);
  assert.match(disclaimer({ modes: ["design", "live"] }), /based on the design export and measurements in the running page\./);
  assert.match(disclaimer({}), /^This is an expert review against usability principles and WCAG 2\.2 AA\. It is not usability testing/);
});

test("summary sections follow the session reply order", () => {
  const root = createAudit();
  const summary = fs.readFileSync(buildAuditOutputs(root).summaryPath, "utf8");
  const order = ["## Fix first", "## Cost of the journey", "## What works", "## Limitations", "This is an expert review", "## Next step"].map((heading) => summary.indexOf(heading));
  assert.ok(order.every((index) => index >= 0), "every section present");
  assert.deepEqual([...order].sort((a, b) => a - b), order);
});

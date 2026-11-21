#!/usr/bin/env node
/**
 * The live, screenshot, and design procedures of references/evidence-modes.md, run end to end
 * on local fixtures: capture or compute evidence, annotate, record a version 2 audit, validate
 * it, and build the report. Mode limits must reach both the coverage ledger and the outputs.
 * The live and JPEG-conversion tests need Chrome or Chromium; see capture.test.mjs.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { renderAnnotation, imageInfo } from "./annotate.mjs";
import { findChrome, runPlan } from "./capture.mjs";
import { buildAuditOutputs, loadModeLimits } from "./build-report.mjs";
import { analyzeNodes } from "./design-nodes.mjs";
import { encodePng } from "./png.mjs";
import { sampleFile } from "./sample-contrast.mjs";
import { validateAudit } from "./validate-audit.mjs";

/** A 2x phone capture: white page, a light-gray button with pale "text" strokes. */
function capture() {
  const width = 200;
  const height = 120;
  const data = new Uint8Array(width * height * 4).fill(255);
  for (let y = 40; y < 80; y += 1) {
    for (let x = 40; x < 160; x += 1) {
      const stroke = y >= 54 && y <= 66 && x >= 60 && x < 140 && x % 6 < 3;
      data.set([...(stroke ? [255, 255, 255] : [170, 170, 170]), 255], (y * width + x) * 4);
    }
  }
  return encodePng({ width, height, data });
}

/** A concept sketch: the HTML source and a rendered PNG of the same size as the Now image. */
function writeSketch(root, png) {
  fs.mkdirSync(path.join(root, "sketches"), { recursive: true });
  fs.writeFileSync(path.join(root, "sketches/F-001.html"), '<!doctype html><meta name="viewport" content="width=device-width, initial-scale=1"><p>Concept sketch</p>');
  fs.writeFileSync(path.join(root, "sketches/F-001.png"), png);
  return ["sketches/F-001.png", "sketches/F-001.html"];
}

/** The capture with the button darkened: the proposed state at the same viewport. */
function proposed() {
  const image = { width: 200, height: 120, data: new Uint8Array(200 * 120 * 4).fill(255) };
  for (let y = 40; y < 80; y += 1) for (let x = 40; x < 160; x += 1) image.data.set([40, 40, 40, 255], (y * 200 + x) * 4);
  return encodePng(image);
}

function record(root, { modes, surface, finding, unverifiable }) {
  const lenses = ["flow", "a11y", "visual", "content"];
  const statuses = Object.fromEntries(lenses.map((lens) => [lens, unverifiable[lens] ? { status: "unverifiable", note: unverifiable[lens] } : lens === "visual" ? { status: "checked", note: "Alignment, type scale, spacing: consistent." } : { status: "checked" }]));
  const audit = {
    version: 2,
    title: `${modes[0]} audit`,
    date: "2026-11-18",
    target: { name: "Fixture", scope: "One screen" },
    modes,
    areas: [{ id: "signup", title: "Sign-up" }],
    lenses,
    product: { summary: "Fixture product." },
    tasks: [{ id: "T1", goal: "Sign up", importance: "primary", status: "partial", note: "Only the supplied screen exists.", surfaces: ["S-001"] }],
    surfaces: [{ id: "S-001", area: "signup", screen: "Sign-up", state: "default", viewport: "mobile-390x844", evidence: ["evidence/S-001.png"], lenses: statuses, ...surface }],
    priorities: [finding.id],
    recheck: lenses
      .filter((lens) => !unverifiable[lens] && lens !== finding.lens)
      .map((lens) => ({ surface: "S-001", lens, result: "confirmed", note: "Looked again at a fresh copy of the frame." })),
    themes: [],
    strengths: [{ title: "One clear primary action", surfaces: ["S-001"], why: "Keep it." }],
    exceptions: [
      { rule: "themes", reason: "A single defect; nothing to group." },
      { rule: "journeys", reason: "Only one static screen; no path to count." },
    ],
    depth: {
      selection: "The only supplied screen.",
      complete: "Every benchmark check was attempted on the only screen.",
      checks: [
        { check: "first-use", status: "done", surfaces: ["S-001"], note: "Read the screen as a first-time visitor." },
        { check: "failure-recovery", status: "unverifiable", note: "No error state was supplied." },
        { check: "keyboard", status: "unverifiable", note: `${modes[0]} mode has no focus or keyboard behaviour.` },
        { check: "constrained-states", status: "unverifiable", note: "Only the default state was supplied." },
      ],
    },
  };
  fs.writeFileSync(path.join(root, "audit.json"), JSON.stringify(audit, null, 2));
  fs.writeFileSync(path.join(root, "findings.jsonl"), `${JSON.stringify(finding)}\n`);
}

test("screenshot mode: estimated contrast, approximate marks, limits in the outputs", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "audit-ui-ux-screenshot-"));
  fs.mkdirSync(path.join(root, "evidence"));
  fs.mkdirSync(path.join(root, "annotated"));
  const shot = path.join(root, "evidence/S-001.png");
  fs.writeFileSync(shot, capture());

  // Step 4 of the screenshot procedure: a tight rect, scale = DPR, result is an estimate.
  const [estimate] = sampleFile({ image: shot, rects: [{ x: 28, y: 25, w: 44, h: 10 }], scale: 2 });
  assert.equal(estimate.detected, true);
  assert.equal(estimate.basis, "visual-estimate");
  assert.ok(estimate.ratio < 3, JSON.stringify(estimate));

  // Step 3: estimated rects are approximate, drawn dashed with a "≈" callout.
  const spec = { image: "evidence/S-001.png", scale: 2, marks: [{ id: "1", rect: { x: 20, y: 20, w: 60, h: 20 }, text: `Label ≈${estimate.ratio}:1`, approximate: true }] };
  const buffer = fs.readFileSync(shot);
  const svg = renderAnnotation(spec, { buffer, info: imageInfo(buffer) });
  assert.match(svg, /stroke-dasharray/);
  assert.match(svg, /≈ Label/);
  fs.writeFileSync(path.join(root, "annotated/F-001.svg"), svg);

  const unverifiable = { a11y: "Screenshot mode: names, roles, keyboard, and focus cannot be seen in an image." };
  record(root, {
    modes: ["screenshot"],
    surface: {},
    unverifiable,
    finding: {
      id: "F-001", kind: "defect", lens: "visual", title: "Button label is nearly invisible on the gray button", surfaces: ["S-001"], tasks: ["T1"],
      location: { description: "Primary button, centre of the screen" },
      observation: `The label reads about ${estimate.ratio}:1 against the button (pixel estimate, within anti-aliasing error).`,
      impact: "Many visitors cannot read what the button does.", principle: ["VI-08", "WCAG 1.4.3"], severity: "major", frequency: "isolated",
      evidence: { basis: "visual-estimate", files: ["evidence/S-001.png"], annotations: ["annotated/F-001.svg"], measurement: `${estimate.ratio}:1 estimated` },
      recommendation: "Use the dark text token on the button, or a dark button with white text.",
      acceptance: "A measured check on the built page shows at least 4.5:1 for the label.",
      sketches: writeSketch(root, proposed()),
    },
  });
  const { errors } = validateAudit(root);
  assert.deepEqual(errors, []);
  const { reportPath, summaryPath } = buildAuditOutputs(root);
  const html = fs.readFileSync(reportPath, "utf8");
  const summary = fs.readFileSync(summaryPath, "utf8");
  assert.match(html, /<strong>screenshot<\/strong> mode, 1 surface: cannot verify keyboard, focus order, focus visibility; semantics, names, roles; motion and timing; a11y unverifiable on 1 \(Screenshot mode: names, roles, keyboard, and focus/);
  assert.match(html, /Depth check not verifiable: Keyboard/);
  assert.match(html, /\? Unverifiable<span class="note">Screenshot mode/, "the coverage ledger shows the limit");
  assert.match(summary, /- screenshot mode, 1 surface: cannot verify keyboard, focus order, focus visibility; semantics, names, roles; motion and timing; a11y unverifiable on 1/);
  assert.match(summary, /Keyboard: unverifiable/);
});

test("design mode: node contrast, frame-relative marks, limits in the outputs", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "audit-ui-ux-design-mode-"));
  fs.mkdirSync(path.join(root, "evidence"));
  fs.mkdirSync(path.join(root, "annotated"));
  // The exported frame image (1x) and its node tree, drawn at x=500 on the canvas.
  fs.writeFileSync(path.join(root, "evidence/S-001.png"), capture());
  const solid = (r, g, b) => ({ type: "SOLID", color: { r: r / 255, g: g / 255, b: b / 255, a: 1 } });
  const nodes = {
    nodes: {
      "4:1": {
        document: {
          id: "4:1", name: "Sign-up", type: "FRAME", absoluteBoundingBox: { x: 500, y: 0, width: 200, height: 120 }, fills: [solid(255, 255, 255)],
          children: [
            { id: "4:2", name: "Button/Primary", type: "INSTANCE", absoluteBoundingBox: { x: 540, y: 40, width: 120, height: 40 }, fills: [solid(170, 170, 170)] },
            { id: "4:3", name: "Label", type: "TEXT", characters: "Continue", style: { fontSize: 14, fontWeight: 600 }, absoluteBoundingBox: { x: 560, y: 52, width: 80, height: 16 }, fills: [solid(255, 255, 255)] },
          ],
        },
      },
    },
  };
  fs.writeFileSync(path.join(root, "evidence/S-001.nodes.json"), JSON.stringify(nodes));
  const { contrast } = analyzeNodes(nodes);
  const [failure] = contrast.failures;
  assert.equal(failure.id, "4:3");
  assert.deepEqual(failure.rect, { x: 60, y: 52, w: 80, h: 16 });

  const buffer = fs.readFileSync(path.join(root, "evidence/S-001.png"));
  const svg = renderAnnotation({ image: "evidence/S-001.png", scale: 1, marks: [{ id: "1", rect: failure.rect, text: `Label ${failure.ratio}:1, needs ${failure.required}:1` }] }, { buffer, info: imageInfo(buffer) });
  assert.doesNotMatch(svg, /stroke-dasharray/, "node bounds are exact");
  fs.writeFileSync(path.join(root, "annotated/F-001.svg"), svg);

  record(root, {
    modes: ["design"],
    surface: { evidence: ["evidence/S-001.png", "evidence/S-001.nodes.json"] },
    unverifiable: { flow: "Design mode: only the drawn frame exists; no prototype links." },
    finding: {
      id: "F-001", kind: "defect", lens: "a11y", title: "Continue label fails contrast on the gray button", surfaces: ["S-001"], tasks: ["T1"],
      location: { description: "Primary button label", node: failure.id },
      observation: `Label fill ${failure.foreground} on ${failure.background}: ${failure.ratio}:1 at ${failure.fontSize} px.`,
      impact: "Low-vision visitors cannot read the main action.", principle: ["WCAG 1.4.3"], severity: "major", frequency: "isolated",
      evidence: { basis: "design-node", files: ["evidence/S-001.nodes.json"], annotations: ["annotated/F-001.svg"], measurement: `${failure.ratio}:1` },
      recommendation: "Bind the button fill to the primary action colour variable so white text reaches 4.5:1.",
      acceptance: "design-nodes.mjs reports no contrast failure for node 4:3.",
      sketches: writeSketch(root, proposed()),
    },
  });
  assert.deepEqual(validateAudit(root).errors, []);
  const { reportPath, summaryPath } = buildAuditOutputs(root);
  const html = fs.readFileSync(reportPath, "utf8");
  assert.match(html, /Design node: <code>4:3<\/code>/);
  // Even with the a11y lens checked (contrast comes from fills), the outputs say what design cannot verify.
  assert.match(html, /<strong>design<\/strong> mode, 1 surface: cannot verify keyboard, focus order, focus visibility; semantics, names, roles; flow unverifiable on 1/);
  const summary = fs.readFileSync(summaryPath, "utf8");
  assert.match(summary, /- design mode, 1 surface: cannot verify keyboard, focus order, focus visibility; semantics, names, roles; flow unverifiable on 1 \(Design mode: only the drawn frame exists/);
  assert.match(summary, /- Depth check not verifiable: Keyboard \(design mode has no focus or keyboard behaviour\.\)/);
});

test("mode limits come from the evidence-modes table", () => {
  const limits = loadModeLimits();
  assert.deepEqual(limits.live, []);
  assert.ok(limits.design.includes("keyboard, focus order, focus visibility"));
  assert.ok(limits.source.includes("layout, overflow, responsive behavior"));
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "audit-ui-ux-limits-"));
  const file = path.join(root, "modes.md");
  fs.writeFileSync(file, "| Check | live | design | screenshot | source |\n| --- | --- | --- | --- | --- |\n| Hover states | yes | no | partial: maybe | no |\n\nAfter.\n");
  assert.deepEqual(loadModeLimits(file), { live: [], design: ["hover states"], screenshot: [], source: ["hover states"] });
});

const chrome = findChrome();
const skipBrowser = !chrome && "no Chrome or Chromium found";

test("live mode: capture plan to validated audit and report", { skip: skipBrowser }, async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "audit-ui-ux-live-"));
  fs.writeFileSync(
    path.join(root, "signup.html"),
    `<!doctype html><html lang="en"><head><title>Sign up</title><style>body{margin:0;font:16px system-ui;background:#fff}
    .hint{color:#aaaaaa;font-size:13px;margin:8px 16px}button{margin:16px;min-height:44px}</style></head>
    <body><main><h1>Sign up</h1><label for=e>Email</label><input id=e type=email><p class=hint id=hint>We never share your email.</p><button>Create account</button></main></body></html>`,
  );
  const page = `file://${path.join(root, "signup.html")}`;
  // Steps 1–6 of the live procedure: viewport, honest state, screenshot, probes, fresh load, focus walk.
  await runPlan(
    { steps: [{ viewport: [390, 844, 1, true] }, { navigate: page, settle: 200 }, { screenshot: "evidence/S-001.png" }, { probes: "evidence/S-001.probes.json" }, { navigate: page, settle: 200 }, { focusWalk: "evidence/S-001.focus-walk.json", count: 3 }] },
    { baseDir: root, chromePath: chrome, sandbox: false },
  );
  const probes = JSON.parse(fs.readFileSync(path.join(root, "evidence/S-001.probes.json"), "utf8"));
  const failure = probes.contrast.failures.items.find((item) => item.selector === "#hint");
  assert.ok(failure, JSON.stringify(probes.contrast));
  const walk = JSON.parse(fs.readFileSync(path.join(root, "evidence/S-001.focus-walk.json"), "utf8"));
  assert.deepEqual(walk.stops.slice(0, 2).map((stop) => stop.selector), ["#e", "main > button"]);

  // Exact rects from the probes, scrolled 0, DPR 1.
  fs.mkdirSync(path.join(root, "annotated"));
  const buffer = fs.readFileSync(path.join(root, "evidence/S-001.png"));
  const svg = renderAnnotation({ image: "evidence/S-001.png", scale: probes.page.viewport.dpr, marks: [{ id: "1", rect: failure.rect, text: `Hint ${failure.ratio}:1, needs 4.5:1` }] }, { buffer, info: imageInfo(buffer) });
  fs.writeFileSync(path.join(root, "annotated/F-001.svg"), svg);
  // The sketch: the page with the proposed hint colour, rendered at the capture's viewport.
  fs.mkdirSync(path.join(root, "sketches"));
  fs.writeFileSync(path.join(root, "sketches/F-001.html"), fs.readFileSync(path.join(root, "signup.html"), "utf8").replace("#aaaaaa", "#595959").replace("<main>", '<main><p style="position:absolute;right:8px;top:8px;margin:0">Concept sketch</p>'));
  await runPlan(
    { steps: [{ viewport: [390, 844, 1, true] }, { navigate: `file://${path.join(root, "sketches/F-001.html")}`, settle: 200 }, { screenshot: "sketches/F-001.png" }] },
    { baseDir: root, chromePath: chrome, sandbox: false },
  );
  record(root, {
    modes: ["live"],
    surface: { evidence: ["evidence/S-001.png", "evidence/S-001.probes.json", "evidence/S-001.focus-walk.json"] },
    unverifiable: {},
    finding: {
      id: "F-001", kind: "defect", lens: "a11y", title: "Email hint fails contrast", surfaces: ["S-001"], tasks: ["T1"],
      location: { description: "Hint under the email field", selector: "#hint" },
      observation: `Hint ${failure.foreground} on ${failure.background}: ${failure.ratio}:1 at ${failure.fontSize} px.`,
      impact: "Low-vision visitors miss the privacy promise.", principle: ["WCAG 1.4.3"], severity: "major", frequency: "isolated",
      evidence: { basis: "measured", files: ["evidence/S-001.probes.json"], annotations: ["annotated/F-001.svg"], measurement: `${failure.ratio}:1` },
      recommendation: "Use the #595959 text token for hints.", acceptance: "The probe reports no contrast failure for #hint.",
      sketches: ["sketches/F-001.png", "sketches/F-001.html"],
    },
  });
  const audit = JSON.parse(fs.readFileSync(path.join(root, "audit.json"), "utf8"));
  audit.depth.checks[2] = { check: "keyboard", status: "done", surfaces: ["S-001"], note: "Focus walk: email field, then the button, each with a visible indicator." };
  fs.writeFileSync(path.join(root, "audit.json"), JSON.stringify(audit));
  assert.deepEqual(validateAudit(root).errors, []);
  const { reportPath, summaryPath } = buildAuditOutputs(root);
  assert.match(fs.readFileSync(reportPath, "utf8"), /<strong>live<\/strong> mode, 1 surface: no lens marked unverifiable/);
  assert.match(fs.readFileSync(summaryPath, "utf8"), new RegExp(`!\\[F-001\\]\\(${root.replaceAll(/[.*+?^${}()|[\]\\]/g, "\\$&")}/annotated/F-001\\.svg\\)`));
});

test("screenshot mode: a JPEG is converted to PNG through a capture plan before pixel sampling", { skip: skipBrowser }, async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "audit-ui-ux-jpeg-"));
  // Make a real JPEG screenshot: light gray text box on white.
  const make = await runPlan(
    { steps: [{ navigate: "about:blank", settle: 50 }, { evaluate: "(() => { const c = document.createElement('canvas'); c.width = 200; c.height = 80; const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, 200, 80); x.fillStyle = '#b0b0b0'; x.fillRect(40, 30, 120, 20); return c.toDataURL('image/jpeg', 0.95); })()" }] },
    { baseDir: root, chromePath: chrome, sandbox: false },
  );
  fs.mkdirSync(path.join(root, "evidence"));
  fs.writeFileSync(path.join(root, "evidence/S-001.jpg"), Buffer.from(make.at(-1).value.split(",")[1], "base64"));
  assert.throws(() => sampleFile({ image: path.join(root, "evidence/S-001.jpg"), rects: [{ x: 0, y: 0, w: 10, h: 10 }], scale: 1 }), /not a PNG/);
  // The documented conversion: a page that shows the image at 1x, screenshotted at its size.
  fs.writeFileSync(path.join(root, "evidence/S-001.view.html"), '<!doctype html><body style="margin:0"><img src="S-001.jpg"></body>');
  await runPlan(
    { steps: [{ viewport: [200, 80, 1, false] }, { navigate: `file://${path.join(root, "evidence/S-001.view.html")}`, settle: 200 }, { screenshot: "evidence/S-001.png" }] },
    { baseDir: root, chromePath: chrome, sandbox: false },
  );
  const png = fs.readFileSync(path.join(root, "evidence/S-001.png"));
  assert.deepEqual([imageInfo(png).width, imageInfo(png).height], [200, 80]);
  const [estimate] = sampleFile({ image: path.join(root, "evidence/S-001.png"), rects: [{ x: 20, y: 20, w: 160, h: 40 }], scale: 1 });
  assert.equal(estimate.detected, true);
  assert.ok(estimate.ratio > 1.8 && estimate.ratio < 2.4, JSON.stringify(estimate));
});

test("design frames exported without a node tree are audited in screenshot mode", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "audit-ui-ux-image-only-"));
  fs.mkdirSync(path.join(root, "evidence"));
  fs.writeFileSync(path.join(root, "evidence/S-001.png"), capture());
  // The export carries frame names only, no bounds: design-nodes.mjs refuses and names the fallback.
  assert.throws(() => analyzeNodes({ nodes: { "7:1": { document: { id: "7:1", name: "Sign-up", type: "FRAME" } } } }), /screenshot mode/);
  const [estimate] = sampleFile({ image: path.join(root, "evidence/S-001.png"), rects: [{ x: 28, y: 25, w: 44, h: 10 }], scale: 2 });
  record(root, {
    modes: ["design", "screenshot"],
    surface: { mode: "screenshot" },
    unverifiable: { a11y: "Image-only design export: names, roles, keyboard, and focus cannot be seen." },
    finding: {
      id: "F-001", kind: "defect", lens: "visual", title: "Button label is nearly invisible on the gray button", surfaces: ["S-001"], tasks: ["T1"],
      location: { description: "Primary button in the exported frame" },
      observation: `The label reads about ${estimate.ratio}:1 against the button (pixel estimate).`,
      impact: "Many visitors cannot read what the button does.", principle: ["VI-08"], severity: "major", frequency: "isolated",
      evidence: { basis: "visual-estimate", files: ["evidence/S-001.png"], measurement: `${estimate.ratio}:1 estimated` },
      recommendation: "Use the dark text token on the button.", acceptance: "A design-node or measured check shows at least 4.5:1 for the label.",
      sketches: writeSketch(root, proposed()),
    },
  });
  // The finding has no annotation: the warning blocks the final stage until it is explained.
  assert.ok(validateAudit(root).errors.some((error) => error.includes("neither fixed nor explained: F-001")));
  const auditPath = path.join(root, "audit.json");
  const audit = JSON.parse(fs.readFileSync(auditPath, "utf8"));
  audit.limitations = ["F-001 has no annotation: the export gives no reliable bounds for the button."];
  fs.writeFileSync(auditPath, JSON.stringify(audit, null, 2));
  assert.deepEqual(validateAudit(root).errors, []);
  const { summaryPath } = buildAuditOutputs(root);
  const summary = fs.readFileSync(summaryPath, "utf8");
  assert.match(summary, /- screenshot mode, 1 surface: cannot verify keyboard, focus order, focus visibility; semantics, names, roles; motion and timing/);
  assert.doesNotMatch(summary, /- design mode/, "no surface claims design-mode precision");
});

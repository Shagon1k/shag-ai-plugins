#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { analyzeNodes, judgeTarget, rootsOf } from "./design-nodes.mjs";

const SCRIPT = fileURLToPath(new URL("./design-nodes.mjs", import.meta.url));
const solid = (hex, extra = {}) => {
  const value = (index) => parseInt(hex.slice(index, index + 2), 16) / 255;
  return { type: "SOLID", color: { r: value(1), g: value(3), b: value(5), a: 1 }, ...extra };
};
const box = (x, y, width, height) => ({ absoluteBoundingBox: { x, y, width, height } });

/** A sign-up card frame drawn at x=1000 on the canvas, so rects must be frame-relative. */
function frame() {
  return {
    id: "1:1", name: "Sign up / mobile", type: "FRAME", ...box(1000, 0, 390, 844), fills: [solid("#ffffff")], boundVariables: { fills: [{}] },
    children: [
      { id: "1:2", name: "Card", type: "RECTANGLE", ...box(1016, 100, 358, 300), fills: [solid("#f3f4f6")] },
      { id: "1:3", name: "Title", type: "TEXT", characters: "Create your account", style: { fontSize: 24, fontWeight: 700 }, ...box(1032, 120, 300, 32), fills: [solid("#111827")], styles: { fill: "S:1" } },
      { id: "1:4", name: "Hint", type: "TEXT", characters: "We never share your email", style: { fontSize: 13, fontWeight: 400 }, ...box(1032, 200, 300, 18), fills: [solid("#9ca3af")] },
      { id: "1:5", name: "Banner", type: "RECTANGLE", ...box(1000, 500, 390, 80), fills: [{ type: "GRADIENT_LINEAR" }] },
      { id: "1:6", name: "Banner text", type: "TEXT", characters: "Spring offer", style: { fontSize: 16 }, ...box(1016, 520, 200, 20), fills: [solid("#ffffff")] },
      { id: "1:7", name: "Icon/Close", type: "INSTANCE", ...box(1350, 16, 20, 20), fills: [] },
      { id: "1:8", name: "Button/Primary", type: "INSTANCE", ...box(1016, 700, 358, 48), fills: [solid("#1d4ed8")], boundVariables: { fills: [{}] },
        children: [{ id: "1:9", name: "Icon/Arrow", type: "VECTOR", ...box(1340, 714, 16, 16), fills: [] }] },
      { id: "1:10", name: "Hidden note", type: "TEXT", visible: false, characters: "x", ...box(1032, 240, 100, 18), fills: [solid("#eeeeee")] },
    ],
  };
}

test("reads Figma REST shapes and bare nodes", () => {
  assert.equal(rootsOf({ nodes: { "1:1": { document: frame() } } })[0].id, "1:1");
  assert.equal(rootsOf({ document: { id: "0:0", type: "DOCUMENT", children: [] } })[0].id, "0:0");
  assert.equal(rootsOf(frame())[0].id, "1:1");
});

test("computes text contrast from the nearest opaque fill behind the text", () => {
  const result = analyzeNodes({ nodes: { "1:1": { document: frame() } } });
  const hint = result.contrast.failures.find((item) => item.id === "1:4");
  assert.ok(hint, JSON.stringify(result.contrast));
  assert.equal(hint.background, "rgb(243, 244, 246)");
  assert.ok(hint.ratio < 4.5);
  assert.deepEqual(hint.rect, { x: 32, y: 200, w: 300, h: 18 });
  assert.ok(!result.contrast.failures.some((item) => item.id === "1:3"), "dark title passes");
  const banner = result.contrast.unknown.find((item) => item.id === "1:6");
  assert.match(banner.reason, /gradient_linear fill behind the text/);
  assert.ok(![...result.contrast.failures, ...result.contrast.unknown].some((item) => item.id === "1:10"), "hidden nodes are skipped");
});

test("lists small controls but not icons inside a large control", () => {
  const { targets } = analyzeNodes(frame());
  assert.deepEqual(targets.map((item) => item.id), ["1:7"]);
  assert.equal(targets[0].size, "20×20");
});

test("lists fills with raw values and skips fills bound to variables or styles", () => {
  const ids = analyzeNodes(frame()).rawValues.map((item) => item.id);
  assert.ok(ids.includes("1:2") && ids.includes("1:4"));
  assert.ok(!ids.includes("1:1") && !ids.includes("1:3") && !ids.includes("1:8"));
});

test("fails clearly when the export has no node bounds", () => {
  assert.throws(() => analyzeNodes({ id: "1:1", type: "FRAME", children: [{ id: "1:2", type: "TEXT" }] }), /screenshot mode/);
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "audit-ui-ux-design-"));
  fs.writeFileSync(path.join(root, "flat.json"), JSON.stringify({ id: "1:1", type: "FRAME" }));
  const result = spawnSync(process.execPath, [SCRIPT, path.join(root, "flat.json")], { encoding: "utf8" });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /screenshot mode/);
  fs.writeFileSync(path.join(root, "frame.json"), JSON.stringify(frame()));
  const ok = spawnSync(process.execPath, [SCRIPT, path.join(root, "frame.json"), "--frame", "1:1"], { encoding: "utf8" });
  assert.equal(ok.status, 0, ok.stderr);
  assert.equal(JSON.parse(ok.stdout).frames[0].name, "Sign up / mobile");
  assert.equal(spawnSync(process.execPath, [SCRIPT], { encoding: "utf8" }).status, 2);
});

test("missing text styles leave the contrast threshold unknown instead of assuming one", () => {
  const base = frame();
  const styleless = (id, hex) => ({ id, name: `Note ${id}`, type: "TEXT", characters: "Note", ...box(1032, 600, 200, 18), fills: [solid(hex)] });
  base.children.push(styleless("1:20", "#949494"), styleless("1:21", "#bbbbbb"), styleless("1:22", "#333333"));
  const result = analyzeNodes(base);
  const unknown = result.contrast.unknown.find((item) => item.id === "1:20");
  assert.ok(unknown && unknown.ratio >= 3 && unknown.ratio < 4.5, JSON.stringify(unknown));
  assert.match(unknown.reason, /no text style/);
  assert.equal(unknown.required, null);
  assert.ok(result.contrast.failures.some((item) => item.id === "1:21"), "below 3:1 fails either threshold");
  assert.ok(![...result.contrast.failures, ...result.contrast.unknown].some((item) => item.id === "1:22"), "4.5:1 or more passes both");
  assert.equal(result.missing.textStyle, 3);
});

test("judges the spacing exception for small targets and states the 24 × 24 comparison", () => {
  const { targets } = analyzeNodes(frame());
  assert.equal(targets[0].spacingException, true, "the lone close icon passes through spacing");
  assert.match(targets[0].statement, /drawn 20 × 20 px, below the 24 × 24 px minimum \(WCAG 2\.5\.8\), but it passes through the spacing exception/);
  const crowded = frame();
  crowded.children.push({ id: "1:30", name: "Icon/Help", type: "INSTANCE", ...box(1328, 16, 20, 20), fills: [] });
  const close = analyzeNodes(crowded).targets.find((item) => item.id === "1:7");
  assert.equal(close.spacingException, false);
  assert.equal(close.statement, "Icon/Close: drawn 20 × 20 px, below the 24 × 24 px minimum (WCAG 2.5.8); the spacing exception fails because its 24 px circle overlaps Icon/Help (22 px away, centre to centre).");
  // Next to a large control, the circle (radius 12) must not reach the control's edge.
  const near = judgeTarget({ name: "Chip", rect: { x: 0, y: 0, w: 16, h: 16 } }, [{ name: "Button", rect: { x: 18, y: 0, w: 100, h: 44 } }]);
  assert.equal(near.spacingException, false);
  const far = judgeTarget({ name: "Chip", rect: { x: 0, y: 0, w: 16, h: 16 } }, [{ name: "Button", rect: { x: 30, y: 0, w: 100, h: 44 } }]);
  assert.equal(far.spacingException, true);
});

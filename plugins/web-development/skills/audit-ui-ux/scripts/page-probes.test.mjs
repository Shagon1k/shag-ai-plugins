#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  blendColors,
  classifyContrast,
  classifyFocus,
  contrastRatio,
  gradientSamples,
  labelNotInName,
  truncationKind,
  isLargeText,
  parseCliOptions,
  parseColor,
  probeSource,
  requiredContrast,
} from "./page-probes.mjs";

const SCRIPT = fileURLToPath(new URL("./page-probes.mjs", import.meta.url));

test("parses computed-style and hex colors", () => {
  assert.deepEqual(parseColor("rgb(10, 20, 30)"), { r: 10, g: 20, b: 30, a: 1 });
  assert.deepEqual(parseColor("rgba(10, 20, 30, 0.5)"), { r: 10, g: 20, b: 30, a: 0.5 });
  assert.deepEqual(parseColor("rgb(0 0 0 / 40%)"), { r: 0, g: 0, b: 0, a: 0.4 });
  assert.deepEqual(parseColor("#fff"), { r: 255, g: 255, b: 255, a: 1 });
  assert.deepEqual(parseColor("#00000080"), { r: 0, g: 0, b: 0, a: 0.502 });
  assert.deepEqual(parseColor("transparent"), { r: 0, g: 0, b: 0, a: 0 });
  assert.equal(parseColor("oklch(0.5 0.1 200)"), null);
  assert.equal(parseColor("#12345"), null);
});

test("computes WCAG contrast ratios", () => {
  const white = parseColor("#ffffff");
  assert.equal(contrastRatio(parseColor("#000000"), white), 21);
  assert.equal(contrastRatio(parseColor("#777777"), white), 4.48);
  assert.equal(contrastRatio(parseColor("#767676"), white), 4.54);
  assert.equal(contrastRatio(white, parseColor("#767676")), 4.54);
});

test("blends translucent layers over their backdrop", () => {
  const blended = blendColors({ r: 0, g: 0, b: 0, a: 0.5 }, { r: 255, g: 255, b: 255, a: 1 });
  assert.deepEqual(blended, { r: 127.5, g: 127.5, b: 127.5, a: 1 });
});

test("applies the large-text threshold", () => {
  assert.equal(isLargeText(24, "400"), true);
  assert.equal(isLargeText(18.66, "700"), true);
  assert.equal(isLargeText(18.66, "400"), false);
  assert.equal(isLargeText(19, "bold"), true);
  assert.equal(requiredContrast(16, "400"), 4.5);
  assert.equal(requiredContrast(32, "400"), 3);
});

test("prints a self-contained expression that parses", () => {
  const source = probeSource({ limit: 5, focus: true });
  assert.match(source, /^\(\(\) => \{/);
  assert.match(source, /return runProbes\(\{"limit":5,"focus":true\}\);/);
  assert.doesNotThrow(() => new Function(`return ${source.replace(/\)\(\)\s*$/, ")")}`));
});

test("parses CLI options and rejects unknown ones", () => {
  assert.deepEqual(parseCliOptions(["--limit", "10", "--focus"]), { limit: 10, focus: true });
  assert.throws(() => parseCliOptions(["--limit", "0"]), /positive integer/);
  assert.throws(() => parseCliOptions(["--nope"]), /Unknown argument/);
  const result = spawnSync(process.execPath, [SCRIPT, "--limit", "3"], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /runProbes\(\{"limit":3\}\)/);
});

test("extracts gradient stop colors from computed background images", async () => {
  const { extractColors } = await import("./page-probes.mjs");
  assert.deepEqual(
    extractColors("linear-gradient(rgb(46, 16, 17) 0%, rgba(66, 28, 25, 0.5) 100%)"),
    ["rgb(46, 16, 17)", "rgba(66, 28, 25, 0.5)"],
  );
  assert.deepEqual(extractColors("radial-gradient(circle, #fff 0, transparent 70%)"), ["#fff", "transparent"]);
  assert.deepEqual(extractColors('url("a.png")'), []);
});

test("classifies gradient contrast as a range", () => {
  assert.equal(classifyContrast([2.1, 3.9], 4.5), "fail");
  assert.equal(classifyContrast([2.1, 7.2], 4.5), "partial");
  assert.equal(classifyContrast([4.6, 9], 4.5), "pass");
  assert.equal(classifyContrast([3.2], 3), "pass");
});

test("ignores visually hidden text but reports real truncation", () => {
  const base = { width: 120, height: 20, scrollWidth: 300, clientWidth: 120, scrollHeight: 20, clientHeight: 20, textOverflow: "ellipsis", overflowX: "hidden", lineClamp: "none" };
  assert.equal(truncationKind(base), "horizontal");
  assert.equal(truncationKind({ ...base, width: 1, height: 1 }), null, "sr-only 1 px box");
  assert.equal(truncationKind({ ...base, clippedAway: true }), null, "clip: rect(0 0 0 0)");
  assert.equal(truncationKind({ ...base, scrollWidth: 120 }), null, "fits");
  assert.equal(truncationKind({ ...base, textOverflow: "clip", overflowX: "visible" }), null, "overflow is visible");
  assert.equal(truncationKind({ ...base, scrollWidth: 120, lineClamp: "2", scrollHeight: 60 }), "line-clamp");
});

test("label-in-name ignores empty visible text and accepts names that contain the label", () => {
  assert.equal(labelNotInName("Send now", "Go"), true);
  assert.equal(labelNotInName("Close dialog", "close"), false);
  assert.equal(labelNotInName("Close dialog", "  "), false, "only aria-hidden decoration was visible");
  assert.equal(labelNotInName("Search the shop", "Search"), false);
});

test("focus heuristic separates missing indicators from :focus-visible styles", () => {
  assert.equal(classifyFocus({ changed: true, matchesFocusVisible: false, focusVisibleRules: true }), "visible");
  assert.equal(classifyFocus({ changed: false, matchesFocusVisible: false, focusVisibleRules: true }), "unconfirmed");
  assert.equal(classifyFocus({ changed: false, matchesFocusVisible: false, focusVisibleRules: "unknown" }), "unconfirmed");
  assert.equal(classifyFocus({ changed: false, matchesFocusVisible: false, focusVisibleRules: false }), "none");
  assert.equal(classifyFocus({ changed: false, matchesFocusVisible: true, focusVisibleRules: true }), "none");
});

test("samples gradient interiors so mid-gradient matches are found", () => {
  const white = { r: 255, g: 255, b: 255, a: 1 };
  const black = { r: 0, g: 0, b: 0, a: 1 };
  const samples = gradientSamples([white, black], 4);
  assert.equal(samples.length, 5);
  assert.deepEqual(samples[2], { r: 127.5, g: 127.5, b: 127.5, a: 1 });
  const text = parseColor("#767676");
  const endpoints = [white, black].map((backdrop) => contrastRatio(text, backdrop));
  assert.equal(classifyContrast(endpoints, 4.5), "pass", "the stops alone hide the problem");
  const interior = gradientSamples([white, black]).map((backdrop) => contrastRatio(text, backdrop));
  assert.ok(Math.min(...interior) < 1.5);
  assert.equal(classifyContrast(interior, 4.5), "partial");
  assert.deepEqual(gradientSamples([white]), [white]);
});

#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { encodePng } from "./png.mjs";
import { estimateContrast, otsuThreshold, parseArguments } from "./sample-contrast.mjs";

const SCRIPT = fileURLToPath(new URL("./sample-contrast.mjs", import.meta.url));

/** A badge: dark page corners, an orange pill, and cream "text" strokes in the middle. */
function badge() {
  const width = 60;
  const height = 20;
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const corner = (x < 4 || x >= width - 4) && (y < 4 || y >= height - 4);
      const stroke = y >= 7 && y <= 12 && x >= 10 && x < 50 && x % 4 < 2;
      const color = corner ? [46, 16, 17] : stroke ? [248, 234, 206] : [248, 110, 66];
      data.set([...color, 255], (y * width + x) * 4);
    }
  }
  return { width, height, data };
}

test("separates text from background despite surrounding tones", () => {
  const result = estimateContrast(badge());
  assert.equal(result.detected, true);
  assert.equal(result.background, "rgb(248, 110, 66)");
  assert.equal(result.foreground, "rgb(248, 234, 206)");
  assert.equal(result.ratio, 2.42);
});

test("reports no text in a flat region", () => {
  const data = new Uint8Array(10 * 10 * 4).fill(255);
  assert.equal(estimateContrast({ width: 10, height: 10, data }).detected, false);
});

test("finds a bimodal threshold", () => {
  const threshold = otsuThreshold([...new Array(50).fill(20), ...new Array(50).fill(220)]);
  assert.ok(threshold >= 20 && threshold < 220);
});

test("validates arguments and runs from the CLI with a scale", () => {
  assert.throws(() => parseArguments(["a.png"]), /at least one --rect/);
  assert.throws(() => parseArguments(["a.png", "--rect", "1,2,0,4"]), /positive width/);
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "audit-ui-ux-sample-"));
  const file = path.join(root, "badge.png");
  fs.writeFileSync(file, encodePng(badge()));
  const result = spawnSync(process.execPath, [SCRIPT, file, "--scale", "2", "--rect", "0,0,30,10"], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout)[0].ratio, 2.42);
});

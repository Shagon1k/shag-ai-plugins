#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { compareInventory, hslToRgb, parseTokens, toPixels } from "./compare-tokens.mjs";

const SCRIPT = fileURLToPath(new URL("./compare-tokens.mjs", import.meta.url));
const TOKENS = `
:root {
  /* brand */
  --color-fox: #f86e42;
  --accent: var(--color-fox);
  --text-muted: rgba(248, 234, 206, 0.66);
  --leaf: hsl(110, 25%, 39%);
  --fs-body: 1rem; // 16px
  --radius-md: 12px;
}
$space: 8px;
$fallback: var(--missing, #000000);
`;

test("parses CSS and SCSS tokens and resolves references", () => {
  const tokens = parseTokens(TOKENS);
  assert.equal(tokens.get("--accent"), "#f86e42");
  assert.equal(tokens.get("$fallback"), "#000000");
  assert.equal(tokens.get("--fs-body"), "1rem");
  assert.equal(toPixels("1rem"), 16);
  assert.equal(toPixels("auto"), null);
  const leaf = hslToRgb("hsl(110, 25%, 39%)");
  assert.ok(Math.abs(leaf.r - 83) <= 1 && Math.abs(leaf.g - 124) <= 1);
});

test("flags used values that match no token", () => {
  const inventory = {
    color: [
      { value: "rgb(248, 110, 66)", count: 9, example: "a" },
      { value: "rgb(0, 0, 238)", count: 2, example: "main a" },
      { value: "rgba(248, 234, 206, 0.66)", count: 4, example: "p" },
    ],
    background: [{ value: "rgb(249, 111, 67)", count: 1, example: "button" }],
    fontSize: [{ value: "16px", count: 20, example: "p" }, { value: "13px", count: 3, example: "small" }],
    radius: [{ value: "12px", count: 5, example: ".card" }, { value: "7px", count: 1, example: ".chip" }],
    fontFamily: [{ value: "Inter", count: 20, example: "p" }],
  };
  const result = compareInventory(inventory, parseTokens(TOKENS));
  assert.deepEqual(result.offTokenColors.map((entry) => entry.value), ["rgb(0, 0, 238)"]);
  assert.deepEqual(result.offScaleFontSizes.map((entry) => entry.value), ["13px"]);
  assert.deepEqual(result.offScaleRadii.map((entry) => entry.value), ["7px"]);
});

test("explains a missing inventory", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "audit-ui-ux-tokens-"));
  fs.writeFileSync(path.join(root, "probes.json"), "{}");
  fs.writeFileSync(path.join(root, "tokens.css"), TOKENS);
  const result = spawnSync(process.execPath, [SCRIPT, path.join(root, "probes.json"), path.join(root, "tokens.css")], { encoding: "utf8" });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /--inventory/);
});

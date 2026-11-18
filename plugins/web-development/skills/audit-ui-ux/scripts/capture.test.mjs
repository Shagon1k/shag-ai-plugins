#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { chromeCandidates, findChrome, runPlan, validatePlan } from "./capture.mjs";

const SCRIPT = fileURLToPath(new URL("./capture.mjs", import.meta.url));

test("validates plan steps", () => {
  assert.deepEqual(validatePlan({ steps: [{ navigate: "https://example.com" }, { screenshot: "a.png" }] }), []);
  const errors = validatePlan({ steps: [{}, { navigate: "x", wait: 1 }, { type: "hi" }, { viewport: [1] }] });
  assert.equal(errors.length, 4);
  assert.deepEqual(validatePlan(null), ["Plan must be an object with a steps array"]);
});

test("prefers CHROME_PATH and lists platform locations", () => {
  const linux = chromeCandidates({ CHROME_PATH: "/opt/chrome", PATH: "/usr/bin" }, "linux", "/home/u");
  assert.equal(linux[0], "/opt/chrome");
  assert.ok(linux.includes("/usr/bin/chromium"));
  const mac = chromeCandidates({ PATH: "" }, "darwin", "/Users/u");
  assert.ok(mac.includes("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"));
});

test("prints usage without a plan", () => {
  const result = spawnSync(process.execPath, [SCRIPT], { encoding: "utf8" });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /Usage/);
});

const chrome = findChrome();
test("captures a screenshot and runs the page probes in a real browser", { skip: !chrome && "no Chrome or Chromium found" }, async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "audit-ui-ux-capture-"));
  const page = "<html lang=en><title>Fixture</title><body style='background:#fff'><h1>Shop</h1>" +
    "<p style='color:#aaa'>Low contrast note</p><input placeholder=Email><button aria-label='Send now'>Go</button></body></html>";
  const log = await runPlan(
    {
      steps: [
        { viewport: [390, 844, 1, true] },
        { navigate: `data:text/html,${encodeURIComponent(page)}`, settle: 200 },
        { type: "a@b.c", into: "input" },
        { screenshot: "shot.png" },
        { probes: "probes.json", options: { limit: 5 } },
        { evaluate: "document.querySelector('input').value", out: "value.json" },
      ],
    },
    { baseDir: root, chromePath: chrome, sandbox: false },
  );
  assert.equal(log.length, 4);
  assert.ok(fs.statSync(path.join(root, "shot.png")).size > 0);
  const probes = JSON.parse(fs.readFileSync(path.join(root, "probes.json"), "utf8"));
  assert.equal(probes.contrast.failures.total, 1);
  assert.equal(probes.placeholderOnly.total, 1);
  assert.equal(probes.labelNotInName.total, 1);
  assert.equal(JSON.parse(fs.readFileSync(path.join(root, "value.json"), "utf8")), "a@b.c");
});

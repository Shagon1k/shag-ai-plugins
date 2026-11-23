#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { EnvironmentError, chromeCandidates, connect, findChrome, runPlan, validatePlan } from "./capture.mjs";

const SCRIPT = fileURLToPath(new URL("./capture.mjs", import.meta.url));
const tempDir = (prefix) => fs.mkdtempSync(path.join(os.tmpdir(), prefix));
const page = (body, head = "") =>
  `data:text/html,${encodeURIComponent(`<!doctype html><html lang=en><head><title>Fixture</title>${head}</head><body style="background:#fff;margin:0">${body}</body></html>`)}`;

test("validates plan steps and their values", () => {
  assert.deepEqual(validatePlan({ steps: [{ navigate: "https://example.com" }, { screenshot: "a.png" }, { focusWalk: "walk.json", count: 5 }] }), []);
  const errors = validatePlan({ steps: [{}, { navigate: "x", wait: 1 }, { type: "hi" }, { viewport: [1] }] });
  assert.equal(errors.length, 4);
  assert.deepEqual(validatePlan(null), ["Plan must be an object with a steps array"]);
  const values = validatePlan({
    cookies: {},
    steps: [{ viewport: [390, "844"] }, { wait: -5 }, { navigate: "" }, { focusWalk: "w.json", count: 0 }, { click: "a", settle: "slow" }, { media: [{ name: "prefers-color-scheme" }] }],
  });
  for (const expected of ["cookies must be", "viewport must be", "wait must be", "navigate must be", "count must be", "settle must be", "media must be"]) {
    assert.ok(values.some((error) => error.includes(expected)), `missing: ${expected}\n${values.join("\n")}`);
  }
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

test("a dropped DevTools connection fails pending commands as an environment problem", async () => {
  const socket = new EventTarget();
  const sent = [];
  socket.send = (message) => sent.push(JSON.parse(message));
  const { send } = connect(socket, 5000);
  const answered = send("Runtime.evaluate", { expression: "1" });
  const pending = send("Page.captureScreenshot");
  socket.dispatchEvent(Object.assign(new Event("message"), { data: JSON.stringify({ id: sent[0].id, result: { ok: 1 } }) }));
  assert.deepEqual(await answered, { ok: 1 });
  socket.dispatchEvent(new Event("close"));
  await assert.rejects(pending, (error) => error instanceof EnvironmentError && /closed the DevTools connection/.test(error.message));
});

test("an unanswered browser command is environmental; an unsettled page script is not", async () => {
  const socket = new EventTarget();
  socket.send = () => {};
  const { send } = connect(socket, 50);
  await assert.rejects(send("Page.enable"), (error) => error instanceof EnvironmentError && /Page\.enable did not answer within 50 ms/.test(error.message));
  await assert.rejects(send("Runtime.evaluate", { expression: "new Promise(() => {})" }), (error) => !(error instanceof EnvironmentError) && /did not answer/.test(error.message));
});

const posix = process.platform !== "win32";

function fakeBrowser(dir, body) {
  const file = path.join(dir, "fake-chrome");
  fs.writeFileSync(file, `#!${process.execPath}\n${body}\n`, { mode: 0o755 });
  return file;
}

const isAlive = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

test("a browser that never starts is killed, its profile removed, and the failure reported as environmental", { skip: !posix && "needs POSIX executables" }, async () => {
  const dir = tempDir("audit-ui-ux-fake-");
  const pidFile = path.join(dir, "pid");
  const chromePath = fakeBrowser(dir, `require("fs").writeFileSync(${JSON.stringify(pidFile)}, String(process.pid)); setInterval(() => {}, 1000);`);
  const profileRoot = tempDir("audit-ui-ux-profiles-");
  await assert.rejects(
    runPlan({ steps: [{ navigate: "about:blank" }] }, { chromePath, profileRoot, startupTimeoutMs: 800 }),
    (error) => error instanceof EnvironmentError && /did not start within 800 ms/.test(error.message),
  );
  const pid = Number(fs.readFileSync(pidFile, "utf8"));
  assert.equal(isAlive(pid), false, "the hung browser process must be killed");
  assert.deepEqual(fs.readdirSync(profileRoot), [], "the temporary profile must be removed");
});

test("a browser that exits at startup gets a sandbox hint and leaves no profile", { skip: !posix && "needs POSIX executables" }, async () => {
  const dir = tempDir("audit-ui-ux-fake-");
  const chromePath = fakeBrowser(dir, `process.stderr.write("No usable sandbox!\\n"); process.exit(1);`);
  const profileRoot = tempDir("audit-ui-ux-profiles-");
  await assert.rejects(
    runPlan({ steps: [{ navigate: "about:blank" }] }, { chromePath, profileRoot }),
    (error) => error instanceof EnvironmentError && /exited with code 1/.test(error.message) && /--no-sandbox/.test(error.message) && /No usable sandbox/.test(error.message),
  );
  assert.deepEqual(fs.readdirSync(profileRoot), []);
});

test("the CLI exits 3 for environment problems and 1 for plan problems", { skip: !posix && "needs POSIX executables" }, () => {
  const dir = tempDir("audit-ui-ux-fake-");
  const chromePath = fakeBrowser(dir, "process.exit(1);");
  fs.writeFileSync(path.join(dir, "plan.json"), JSON.stringify({ steps: [{ navigate: "about:blank" }] }));
  const environment = spawnSync(process.execPath, [SCRIPT, path.join(dir, "plan.json"), "--chrome", chromePath], { encoding: "utf8" });
  assert.equal(environment.status, 3);
  assert.match(environment.stderr, /Environment problem, not a product finding/);
  fs.writeFileSync(path.join(dir, "bad.json"), JSON.stringify({ steps: [{ wait: -1 }] }));
  const plan = spawnSync(process.execPath, [SCRIPT, path.join(dir, "bad.json"), "--chrome", chromePath], { encoding: "utf8" });
  assert.equal(plan.status, 1);
  assert.match(plan.stderr, /wait must be/);
});

const chrome = findChrome();
const skipBrowser = !chrome && "no Chrome or Chromium found";

// The browser regressions skip without Chrome; say so loudly, and fail where a browser is required.
test("a browser is available for the browser regression tests", (t) => {
  if (chrome) return;
  if (process.env.CI || process.env.AUDIT_UI_UX_REQUIRE_BROWSER) {
    assert.fail("No Chrome or Chromium found: the probe, focus, CSP, and capture regressions cannot run. Set CHROME_PATH.");
  }
  t.skip("no Chrome or Chromium: 6 browser regression tests here and 2 in modes.test.mjs are skipped; set CHROME_PATH to run them");
});
const capture = (steps, root = tempDir("audit-ui-ux-capture-"), options = {}) =>
  runPlan({ steps }, { baseDir: root, chromePath: chrome, sandbox: false, ...options }).then((log) => ({ log, root }));
const readJson = (root, file) => JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));

test("captures a screenshot and runs the page probes in a real browser", { skip: skipBrowser }, async () => {
  const html = "<h1>Shop</h1><p style='color:#aaa'>Low contrast note</p><input placeholder=Email><button aria-label='Send now'>Go</button>";
  const { log, root } = await capture([
    { viewport: [390, 844, 1, true] },
    { navigate: page(html), settle: 200 },
    { type: "a@b.c", into: "input" },
    { screenshot: "shot.png" },
    { probes: "probes.json", options: { limit: 5 } },
    { evaluate: "document.querySelector('input').value", out: "value.json" },
  ]);
  assert.equal(log.length, 4);
  assert.ok(fs.statSync(path.join(root, "shot.png")).size > 0);
  const probes = readJson(root, "probes.json");
  assert.equal(probes.contrast.failures.total, 1);
  assert.equal(probes.placeholderOnly.total, 1);
  assert.equal(probes.labelNotInName.total, 1);
  assert.equal(readJson(root, "value.json"), "a@b.c");
});

test("probe regressions: gradient ranges, sr-only text, aria-hidden decoration", { skip: skipBrowser }, async () => {
  const html = [
    // Gradient contrast is a range: fails everywhere, fails on part, passes everywhere.
    "<p id=g-fail style='background:linear-gradient(#eee,#ddd);color:#bbb'>Fails on the whole gradient</p>",
    "<p id=g-part style='background:linear-gradient(#000,#fff);color:#777'>Fails on part of the gradient</p>",
    "<p id=g-pass style='background:linear-gradient(#fff,#f4f4f4);color:#222'>Passes on the whole gradient</p>",
    // Passes against both stops, but matches the middle of the gradient.
    "<p id=g-mid style='background:linear-gradient(#fff,#000);color:#767676'>Fails in the middle of the gradient</p>",
    // Visually hidden text is not truncation; a real ellipsis is.
    "<span id=sr style='position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap'>Screen reader only text that is long</span>",
    "<div id=cut style='width:80px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap'>A very long product name that gets cut</div>",
    // aria-hidden decoration is not part of the visible label; a different visible word is.
    "<button id=close aria-label='Close dialog'><span aria-hidden=true>×</span> Close</button>",
    "<button id=mismatch aria-label='Send now'>Go</button>",
  ].join("");
  const { root } = await capture([{ viewport: [800, 600, 1, false] }, { navigate: page(html), settle: 100 }, { probes: "p.json" }]);
  const probes = readJson(root, "p.json");
  const selectors = (bucket) => bucket.items.map((item) => item.selector);
  assert.ok(selectors(probes.contrast.failures).includes("#g-fail"));
  assert.ok(!selectors(probes.contrast.failures).includes("#g-part"));
  assert.ok(probes.contrast.unknown.items.some((item) => item.selector === "#g-part" && item.gradient && item.bestRatio > item.ratio));
  assert.ok(![...selectors(probes.contrast.failures), ...selectors(probes.contrast.unknown)].includes("#g-pass"));
  const middle = probes.contrast.unknown.items.find((item) => item.selector === "#g-mid");
  assert.ok(middle && middle.ratio < 1.5, JSON.stringify(middle));
  assert.ok(selectors(probes.truncation).includes("#cut"));
  assert.ok(!selectors(probes.truncation).includes("#sr"));
  assert.ok(selectors(probes.labelNotInName).includes("#mismatch"));
  assert.ok(!selectors(probes.labelNotInName).includes("#close"));
});

test("focus heuristic does not flag :focus-visible styles and does flag removed outlines", { skip: skipBrowser }, async () => {
  const head = "<style>button{outline:none;border:1px solid #888;background:#fff}#good:focus-visible{outline:3px solid #1d4ed8}</style>";
  const html = "<button id=good>Visible focus</button><button id=bad>No focus style</button>";
  const { root } = await capture([
    { viewport: [800, 600, 1, false] },
    { navigate: page(html, head), settle: 100 },
    { probes: "p.json", options: { focus: true } },
    // The focus probe moves focus; reload so the walk starts from the top of the page.
    { navigate: page(html, head), settle: 100 },
    { focusWalk: "walk.json", count: 2 },
  ]);
  const { focus } = readJson(root, "p.json");
  const flagged = focus.noVisibleChange.items.map((item) => item.selector);
  assert.ok(flagged.includes("#bad"), JSON.stringify(focus));
  assert.ok(!flagged.includes("#good"), JSON.stringify(focus));
  const { stops } = readJson(root, "walk.json");
  assert.deepEqual(stops.map((stop) => stop.selector), ["#good", "#bad"]);
  assert.equal(stops[0].matchesFocusVisible, true);
  assert.equal(stops[0].indicatorChanged, true);
  assert.equal(stops[1].indicatorChanged, false);
});

test("probes run inline under a strict content security policy that blocks loaded scripts", { skip: skipBrowser }, async () => {
  const head = `<meta http-equiv="Content-Security-Policy" content="script-src 'none'">`;
  const { root } = await capture([
    { navigate: page("<h1>Locked</h1><p style='color:#bbb'>Faint</p>", head), settle: 100 },
    {
      evaluate:
        "new Promise((resolve) => { const s = document.createElement('script'); s.src = 'data:text/javascript,window.loaded=1'; s.onload = () => resolve('loaded'); s.onerror = () => resolve('blocked'); document.head.append(s); })",
      out: "inject.json",
    },
    { probes: "p.json" },
  ]);
  assert.equal(readJson(root, "inject.json"), "blocked", "the page CSP must block a loaded script");
  assert.equal(readJson(root, "p.json").contrast.failures.total, 1, "inline probes still run");
});

test("a page script that never settles fails with a timeout and closes the browser", { skip: skipBrowser }, async () => {
  const profileRoot = tempDir("audit-ui-ux-profiles-");
  await assert.rejects(
    capture([{ navigate: page("<p>x</p>"), settle: 50 }, { evaluate: "new Promise(() => {})" }], undefined, { commandTimeoutMs: 1000, profileRoot }),
    (error) => !(error instanceof EnvironmentError) && /did not answer within 1000 ms/.test(error.message),
  );
  assert.deepEqual(fs.readdirSync(profileRoot), []);
});

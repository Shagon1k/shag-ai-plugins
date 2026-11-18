#!/usr/bin/env node
/**
 * Drive a local headless Chrome or Chromium over the DevTools protocol to capture audit
 * evidence when the agent has no browser tool of its own. No dependencies.
 *
 *   node capture.mjs <plan.json> [--chrome <path>] [--no-sandbox]
 *
 * Plan: { "cookies": [CDP cookie objects], "steps": [ ...steps ] }
 *   { "viewport": [width, height, dpr, mobile] }
 *   { "media": [{ "name": "prefers-color-scheme", "value": "dark" }] }
 *   { "navigate": "https://…", "settle": 2500 }
 *   { "wait": 1000 }                      { "waitFor": "css selector", "timeout": 10000 }
 *   { "scrollTo": 1200 }                  { "click": "css selector" }
 *   { "type": "text", "into": "css selector" }   { "key": "Tab" }
 *   { "screenshot": "evidence/S-001.png", "fullPage": false }
 *   { "probes": "evidence/S-001.probes.json", "options": { "limit": 40 } }
 *   { "evaluate": "expression", "out": "file.json" }
 * Relative output paths resolve against the plan file's directory.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { probeSource } from "./page-probes.mjs";

const STEP_KEYS = ["viewport", "media", "navigate", "wait", "waitFor", "scrollTo", "click", "type", "key", "screenshot", "probes", "evaluate"];

export function chromeCandidates(env = process.env, platform = process.platform, home = os.homedir()) {
  const candidates = [];
  if (env.CHROME_PATH) candidates.push(env.CHROME_PATH);
  const pathDirs = (env.PATH ?? "").split(path.delimiter).filter(Boolean);
  const names = platform === "win32" ? ["chrome.exe", "msedge.exe"] : ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser", "chrome"];
  for (const dir of pathDirs) for (const name of names) candidates.push(path.join(dir, name));
  if (platform === "darwin") {
    candidates.push("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/Applications/Chromium.app/Contents/MacOS/Chromium");
  }
  if (platform === "win32") {
    for (const base of [env.PROGRAMFILES, env["PROGRAMFILES(X86)"], env.LOCALAPPDATA].filter(Boolean)) {
      candidates.push(path.join(base, "Google/Chrome/Application/chrome.exe"));
    }
  }
  const caches = [path.join(home, ".cache/ms-playwright"), path.join(home, "Library/Caches/ms-playwright")];
  for (const cache of caches) {
    if (!fs.existsSync(cache)) continue;
    for (const entry of fs.readdirSync(cache).filter((name) => /^chromium-\d+$/.test(name)).sort().reverse()) {
      candidates.push(
        path.join(cache, entry, "chrome-linux64/chrome"),
        path.join(cache, entry, "chrome-linux/chrome"),
        path.join(cache, entry, "chrome-mac/Chromium.app/Contents/MacOS/Chromium"),
      );
    }
  }
  return candidates;
}

export function findChrome(options = {}) {
  return chromeCandidates(options.env, options.platform, options.home).find((candidate) => {
    try {
      return fs.statSync(candidate).isFile();
    } catch {
      return false;
    }
  });
}

export function validatePlan(plan) {
  const errors = [];
  if (!plan || typeof plan !== "object" || !Array.isArray(plan.steps)) return ["Plan must be an object with a steps array"];
  plan.steps.forEach((step, index) => {
    const keys = Object.keys(step ?? {}).filter((key) => STEP_KEYS.includes(key));
    if (keys.length !== 1) errors.push(`steps[${index}] must contain exactly one of ${STEP_KEYS.join(", ")}`);
    if (step?.viewport && (!Array.isArray(step.viewport) || step.viewport.length < 2)) {
      errors.push(`steps[${index}].viewport must be [width, height, dpr?, mobile?]`);
    }
    if (step?.type !== undefined && typeof step.into !== "string") errors.push(`steps[${index}].type needs an "into" selector`);
    if (step?.evaluate !== undefined && typeof step.evaluate !== "string") errors.push(`steps[${index}].evaluate must be a string`);
  });
  return errors;
}

async function launch(chromePath, sandbox) {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "audit-ui-ux-chrome-"));
  const args = ["--headless=new", "--disable-gpu", "--hide-scrollbars", "--mute-audio", "--no-first-run", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "about:blank"];
  if (!sandbox) args.unshift("--no-sandbox");
  const chrome = spawn(chromePath, args, { stdio: ["ignore", "ignore", "pipe"] });
  const browserWs = await new Promise((resolve, reject) => {
    let output = "";
    const timer = setTimeout(() => reject(new Error(`Chrome did not start. Output:\n${output.slice(-800)}`)), 20000);
    chrome.stderr.on("data", (chunk) => {
      output += chunk;
      const match = output.match(/DevTools listening on (ws:\/\/\S+)/);
      if (match) {
        clearTimeout(timer);
        resolve(match[1]);
      }
    });
    chrome.on("exit", (code) => {
      clearTimeout(timer);
      const hint = sandbox
        ? " If the host blocks Chrome's sandbox (for example AppArmor on Ubuntu 23.10+), rerun with --no-sandbox, and only for sites you trust."
        : "";
      reject(new Error(`Chrome exited with code ${code} before DevTools started.${hint}\nLast output:\n${output.slice(-400)}`));
    });
  });
  const port = new URL(browserWs).port;
  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const socket = new WebSocket(targets.find((target) => target.type === "page").webSocketDebuggerUrl);
  await new Promise((resolve) => socket.addEventListener("open", resolve, { once: true }));
  const close = async () => {
    socket.close();
    chrome.kill("SIGKILL");
    await new Promise((resolve) => {
      chrome.once("exit", resolve);
      setTimeout(resolve, 3000);
    });
    try {
      // Chrome helper processes can still be flushing the profile right after exit.
      fs.rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    } catch {
      // A leftover temporary profile is harmless; never fail the capture over it.
    }
  };
  return { socket, close };
}

function connect(socket) {
  let nextId = 1;
  const pending = new Map();
  const listeners = new Set();
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const { resolve, reject } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) reject(new Error(`${message.error.message} (${message.error.code})`));
      else resolve(message.result);
    } else if (message.method) {
      for (const listener of listeners) listener(message);
    }
  });
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = nextId++;
      pending.set(id, { resolve, reject });
      socket.send(JSON.stringify({ id, method, params }));
    });
  const once = (method, timeout) =>
    new Promise((resolve) => {
      const listener = (message) => {
        if (message.method !== method) return;
        listeners.delete(listener);
        resolve(true);
      };
      listeners.add(listener);
      setTimeout(() => {
        listeners.delete(listener);
        resolve(false);
      }, timeout);
    });
  return { send, once };
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function runPlan(plan, { baseDir = process.cwd(), chromePath = findChrome(), sandbox = true } = {}) {
  const errors = validatePlan(plan);
  if (errors.length) throw new Error(errors.join("; "));
  if (!chromePath) throw new Error("No Chrome or Chromium found; set CHROME_PATH or pass --chrome");
  const { socket, close } = await launch(chromePath, sandbox);
  const { send, once } = connect(socket);
  const resolveOut = (file) => path.resolve(baseDir, file);
  const write = (file, content) => {
    fs.mkdirSync(path.dirname(resolveOut(file)), { recursive: true });
    fs.writeFileSync(resolveOut(file), content);
  };
  const evaluate = async (expression) => {
    const result = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) {
      throw new Error(`Page script failed: ${result.exceptionDetails.exception?.description ?? result.exceptionDetails.text}`);
    }
    return result.result.value;
  };
  const log = [];
  try {
    await send("Page.enable");
    await send("Runtime.enable");
    await send("Network.enable");
    for (const cookie of plan.cookies ?? []) await send("Network.setCookie", cookie);
    for (const step of plan.steps) {
      if (step.viewport) {
        const [width, height, deviceScaleFactor = 2, mobile = width < 700] = step.viewport;
        await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor, mobile });
        await send("Emulation.setTouchEmulationEnabled", { enabled: mobile });
      } else if (step.media) {
        await send("Emulation.setEmulatedMedia", { features: step.media });
      } else if (step.navigate) {
        const loaded = once("Page.loadEventFired", 30000);
        const result = await send("Page.navigate", { url: step.navigate });
        if (result.errorText) throw new Error(`Navigation to ${step.navigate} failed: ${result.errorText}`);
        await loaded;
        await sleep(step.settle ?? 2500);
        log.push({ navigate: step.navigate, url: await evaluate("location.href") });
      } else if (step.wait) {
        await sleep(step.wait);
      } else if (step.waitFor) {
        const deadline = Date.now() + (step.timeout ?? 10000);
        while (!(await evaluate(`!!document.querySelector(${JSON.stringify(step.waitFor)})`))) {
          if (Date.now() > deadline) throw new Error(`Timed out waiting for ${step.waitFor}`);
          await sleep(250);
        }
      } else if (step.scrollTo !== undefined) {
        await evaluate(`window.scrollTo(0, ${Number(step.scrollTo)})`);
        await sleep(step.settle ?? 800);
      } else if (step.click) {
        const clicked = await evaluate(`(() => { const el = document.querySelector(${JSON.stringify(step.click)}); if (!el) return false; el.click(); return true; })()`);
        if (!clicked) throw new Error(`No element matches ${step.click}`);
        await sleep(step.settle ?? 800);
      } else if (step.type !== undefined) {
        const focused = await evaluate(`(() => { const el = document.querySelector(${JSON.stringify(step.into)}); if (!el) return false; el.focus(); return true; })()`);
        if (!focused) throw new Error(`No element matches ${step.into}`);
        await send("Input.insertText", { text: String(step.type) });
      } else if (step.key) {
        for (const type of ["keyDown", "keyUp"]) {
          await send("Input.dispatchKeyEvent", { type, key: step.key, code: step.code ?? step.key, windowsVirtualKeyCode: step.keyCode ?? (step.key === "Tab" ? 9 : step.key === "Enter" ? 13 : 0) });
        }
        await sleep(step.settle ?? 150);
      } else if (step.screenshot) {
        let params = { format: "png" };
        if (step.fullPage) {
          const { cssContentSize } = await send("Page.getLayoutMetrics");
          params = { ...params, captureBeyondViewport: true, clip: { x: 0, y: 0, width: cssContentSize.width, height: Math.min(cssContentSize.height, 16000), scale: 1 } };
        }
        const shot = await send("Page.captureScreenshot", params);
        write(step.screenshot, Buffer.from(shot.data, "base64"));
        log.push({ screenshot: step.screenshot });
      } else if (step.probes) {
        write(step.probes, JSON.stringify(await evaluate(probeSource(step.options ?? {})), null, 2));
        log.push({ probes: step.probes });
      } else if (step.evaluate !== undefined) {
        const value = await evaluate(step.evaluate);
        if (step.out) write(step.out, JSON.stringify(value, null, 2));
        log.push(step.out ? { out: step.out } : { value });
      }
    }
  } finally {
    await close();
  }
  return log;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const args = process.argv.slice(2);
  const chromeIndex = args.indexOf("--chrome");
  const chromePath = chromeIndex >= 0 ? args[chromeIndex + 1] : findChrome();
  const positional = args.filter((argument, index) => !argument.startsWith("--") && !(chromeIndex >= 0 && index === chromeIndex + 1));
  if (positional.length !== 1) {
    console.error("Usage: capture.mjs <plan.json> [--chrome <path>] [--no-sandbox]");
    process.exit(2);
  }
  try {
    const planPath = path.resolve(positional[0]);
    const plan = JSON.parse(fs.readFileSync(planPath, "utf8"));
    const log = await runPlan(plan, { baseDir: path.dirname(planPath), chromePath, sandbox: !args.includes("--no-sandbox") });
    console.log(JSON.stringify(log, null, 2));
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

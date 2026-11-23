#!/usr/bin/env node
/**
 * Drive a local headless Chrome or Chromium over the DevTools protocol to capture audit
 * evidence when the agent has no browser tool of its own. No dependencies.
 *
 *   node capture.mjs <plan.json> [--chrome <path>] [--no-sandbox]
 *
 * Exit codes: 0 done, 1 plan or page problem (bad selector, failing script), 2 usage,
 * 3 environment problem (no browser, browser failed to start or stopped answering). An
 * environment problem says nothing about the audited product; record it as a limitation.
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
 *   { "focusWalk": "evidence/S-001.focus-walk.json", "count": 30 }   real Tab presses right after
 *       a navigate; per stop: selector, name, rect, focused vs unfocused style, :focus-visible,
 *       obscured. "reverse": true presses Shift+Tab.
 * Relative output paths resolve against the plan file's directory. Expressions run through the
 * DevTools protocol, so a page's content security policy does not block them.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { probeSource } from "./page-probes.mjs";

const STEP_KEYS = ["viewport", "media", "navigate", "wait", "waitFor", "scrollTo", "click", "type", "key", "screenshot", "probes", "evaluate", "focusWalk"];

/** The browser or its connection failed; nothing is known about the audited page. */
export class EnvironmentError extends Error {
  constructor(message) {
    super(message);
    this.name = "EnvironmentError";
  }
}

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
  if (plan.cookies !== undefined && !Array.isArray(plan.cookies)) errors.push("cookies must be a list of DevTools cookie objects");
  const positive = (value) => Number.isFinite(value) && value > 0;
  const nonNegative = (value) => Number.isFinite(value) && value >= 0;
  const text = (value) => typeof value === "string" && value.trim().length > 0;
  plan.steps.forEach((step, index) => {
    const at = `steps[${index}]`;
    const keys = Object.keys(step ?? {}).filter((key) => STEP_KEYS.includes(key));
    if (keys.length !== 1) {
      errors.push(`${at} must contain exactly one of ${STEP_KEYS.join(", ")}`);
      return;
    }
    const [key] = keys;
    const value = step[key];
    if (key === "viewport") {
      const [width, height, dpr = 1, mobile = false] = Array.isArray(value) ? value : [];
      if (!Array.isArray(value) || value.length < 2 || !positive(width) || !positive(height) || !positive(dpr) || typeof mobile !== "boolean") {
        errors.push(`${at}.viewport must be [width, height, dpr?, mobile?] with positive numbers and a boolean`);
      }
    }
    if (key === "media" && !(Array.isArray(value) && value.every((feature) => text(feature?.name) && typeof feature?.value === "string"))) {
      errors.push(`${at}.media must be a list of { name, value }`);
    }
    if (["navigate", "waitFor", "click", "key", "screenshot", "probes", "focusWalk"].includes(key) && !text(value)) {
      errors.push(`${at}.${key} must be a non-empty string`);
    }
    if (key === "wait" && !positive(value)) errors.push(`${at}.wait must be a positive number of milliseconds`);
    if (key === "scrollTo" && !nonNegative(value)) errors.push(`${at}.scrollTo must be a non-negative number`);
    if (key === "type" && (typeof value !== "string" || !text(step.into))) errors.push(`${at}.type needs text and an "into" selector`);
    if (key === "evaluate" && !text(value)) errors.push(`${at}.evaluate must be a non-empty string`);
    if (key === "focusWalk" && step.count !== undefined && !(Number.isInteger(step.count) && step.count > 0 && step.count <= 500)) {
      errors.push(`${at}.count must be an integer from 1 to 500`);
    }
    for (const option of ["settle", "timeout"]) {
      if (step[option] !== undefined && !nonNegative(step[option])) errors.push(`${at}.${option} must be a non-negative number`);
    }
  });
  return errors;
}

export async function launch(chromePath, sandbox, { startupTimeoutMs = 20000, profileRoot = os.tmpdir() } = {}) {
  const profile = fs.mkdtempSync(path.join(profileRoot, "audit-ui-ux-chrome-"));
  const args = ["--headless=new", "--disable-gpu", "--hide-scrollbars", "--mute-audio", "--no-first-run", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "about:blank"];
  if (!sandbox) args.unshift("--no-sandbox");
  // Its own process group on POSIX, so cleanup also stops renderer and helper processes.
  const group = process.platform !== "win32";
  const chrome = spawn(chromePath, args, { stdio: ["ignore", "ignore", "pipe"], detached: group });
  let exited = false;
  chrome.once("exit", () => {
    exited = true;
  });
  // Kill the browser and remove its profile on every path, including failed startups.
  const cleanup = async () => {
    if (group) {
      try {
        process.kill(-chrome.pid, "SIGKILL");
      } catch {
        // The group is already gone.
      }
    }
    if (!exited) {
      chrome.kill("SIGKILL");
      await new Promise((resolve) => {
        if (exited) return resolve();
        chrome.once("exit", resolve);
        setTimeout(resolve, 3000);
      });
    }
    try {
      // Chrome helper processes can still be flushing the profile right after exit.
      fs.rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
    } catch {
      // A leftover temporary profile is harmless; never fail the capture over it.
    }
  };
  let socket;
  try {
    const browserWs = await new Promise((resolve, reject) => {
      let output = "";
      const timer = setTimeout(
        () => reject(new EnvironmentError(`Chrome did not start within ${startupTimeoutMs} ms. Output:\n${output.slice(-800)}`)),
        startupTimeoutMs,
      );
      chrome.stderr.on("data", (chunk) => {
        output += chunk;
        const match = output.match(/DevTools listening on (ws:\/\/\S+)/);
        if (match) {
          clearTimeout(timer);
          resolve(match[1]);
        }
      });
      chrome.once("error", (error) => {
        clearTimeout(timer);
        reject(new EnvironmentError(`Chrome could not be started from ${chromePath}: ${error.message}`));
      });
      chrome.once("exit", (code) => {
        clearTimeout(timer);
        const hint = sandbox
          ? " If the host blocks Chrome's sandbox (for example AppArmor on Ubuntu 23.10+), rerun with --no-sandbox, and only for sites you trust."
          : "";
        reject(new EnvironmentError(`Chrome exited with code ${code} before DevTools started.${hint}\nLast output:\n${output.slice(-400)}`));
      });
    });
    const port = new URL(browserWs).port;
    // The page target can appear a moment after DevTools starts listening.
    let page;
    for (const deadline = Date.now() + 5000; !page && Date.now() < deadline; ) {
      const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`, { signal: AbortSignal.timeout(5000) })).json();
      page = targets.find((target) => target.type === "page");
      if (!page) await sleep(100);
    }
    if (!page) throw new EnvironmentError("Chrome started without a page target within 5000 ms");
    socket = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new EnvironmentError("DevTools socket did not open within 5000 ms")), 5000);
      socket.addEventListener("open", () => (clearTimeout(timer), resolve()), { once: true });
      socket.addEventListener("error", () => (clearTimeout(timer), reject(new EnvironmentError("DevTools socket failed to open"))), { once: true });
    });
  } catch (error) {
    socket?.close();
    await cleanup();
    throw error instanceof EnvironmentError ? error : new EnvironmentError(`Chrome started but DevTools could not be reached: ${error.message}`);
  }
  const close = async () => {
    socket.close();
    await cleanup();
  };
  return { socket, close, pid: chrome.pid, profile };
}

export function connect(socket, commandTimeoutMs = 60000) {
  let nextId = 1;
  const pending = new Map();
  const listeners = new Set();
  socket.addEventListener("close", () => {
    for (const { reject } of pending.values()) reject(new EnvironmentError("The browser closed the DevTools connection"));
    pending.clear();
  });
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
      const timer = setTimeout(() => {
        pending.delete(id);
        // A page script that never settles is the page's problem; a browser-control command
        // that never answers means the browser itself has stopped responding.
        const message = `${method} did not answer within ${commandTimeoutMs} ms`;
        reject(method === "Runtime.evaluate" ? new Error(message) : new EnvironmentError(message));
      }, commandTimeoutMs);
      pending.set(id, {
        resolve: (value) => (clearTimeout(timer), resolve(value)),
        reject: (error) => (clearTimeout(timer), reject(error)),
      });
      socket.send(JSON.stringify({ id, method, params }));
    });
  const once = (method, timeout) =>
    new Promise((resolve) => {
      const timer = setTimeout(() => {
        listeners.delete(listener);
        resolve(false);
      }, timeout);
      const listener = (message) => {
        if (message.method !== method) return;
        clearTimeout(timer);
        listeners.delete(listener);
        resolve(true);
      };
      listeners.add(listener);
    });
  return { send, once };
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const KEY_CODES = { Tab: 9, Enter: 13, Escape: 27, " ": 32, ArrowLeft: 37, ArrowUp: 38, ArrowRight: 39, ArrowDown: 40 };

async function pressKey(send, { key, code, keyCode, shift = false }) {
  const modifiers = shift ? 8 : 0;
  const text = key === "Enter" ? "\r" : key === " " ? " " : undefined;
  for (const type of ["keyDown", "keyUp"]) {
    await send("Input.dispatchKeyEvent", { type, key, code: code ?? (key === " " ? "Space" : key), windowsVirtualKeyCode: keyCode ?? KEY_CODES[key] ?? 0, modifiers, ...(type === "keyDown" && text ? { text } : {}) });
  }
}

/** Runs in the page after each Tab press: what has focus and whether it shows. */
export const FOCUS_STOP_SOURCE = `(() => {
  const element = document.activeElement;
  if (!element || element === document.body || element === document.documentElement) return { selector: "body" };
  const describe = (node) => node.id ? "#" + CSS.escape(node.id) : node.tagName.toLowerCase() + (node.className && typeof node.className === "string" ? "." + node.className.trim().split(/\\s+/).slice(0, 2).map((name) => CSS.escape(name)).join(".") : "");
  const path = [];
  for (let node = element; node && node.nodeType === 1 && node !== document.body && path.length < 4; node = node.parentElement) {
    path.unshift(describe(node));
    if (node.id) break;
  }
  const style = (node) => { const computed = getComputedStyle(node); return { outline: computed.outlineStyle + " " + computed.outlineWidth + " " + computed.outlineColor, boxShadow: computed.boxShadow, border: computed.borderColor, background: computed.backgroundColor, color: computed.color, textDecoration: computed.textDecorationLine }; };
  const rect = element.getBoundingClientRect();
  const focused = style(element);
  let matchesFocusVisible = false;
  try { matchesFocusVisible = element.matches(":focus-visible"); } catch {}
  element.blur();
  const unfocused = style(element);
  element.focus({ preventScroll: true, focusVisible: true });
  const centre = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
  return {
    selector: path.join(" > "),
    name: (element.getAttribute("aria-label") || element.innerText || element.value || "").trim().slice(0, 80),
    rect: { x: Math.round(rect.left + scrollX), y: Math.round(rect.top + scrollY), w: Math.round(rect.width), h: Math.round(rect.height) },
    inViewport: rect.bottom > 0 && rect.top < innerHeight && rect.right > 0 && rect.left < innerWidth,
    obscuredBy: centre && centre !== element && !element.contains(centre) && !centre.contains(element) ? describe(centre) : "",
    matchesFocusVisible,
    indicatorChanged: JSON.stringify(focused) !== JSON.stringify(unfocused),
    focused,
  };
})()`;

export async function runPlan(plan, { baseDir = process.cwd(), chromePath = findChrome(), sandbox = true, startupTimeoutMs, commandTimeoutMs = 60000, profileRoot } = {}) {
  const errors = validatePlan(plan);
  if (errors.length) throw new Error(errors.join("; "));
  if (!chromePath) throw new EnvironmentError("No Chrome or Chromium found; set CHROME_PATH or pass --chrome");
  const { socket, close } = await launch(chromePath, sandbox, { startupTimeoutMs, profileRoot });
  const { send, once } = connect(socket, commandTimeoutMs);
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
        await pressKey(send, step);
        await sleep(step.settle ?? 150);
      } else if (step.focusWalk) {
        const stops = [];
        for (let index = 0; index < (step.count ?? 30); index += 1) {
          await pressKey(send, { key: "Tab", shift: step.reverse === true });
          await sleep(step.settle ?? 60);
          stops.push({ press: index + 1, ...(await evaluate(FOCUS_STOP_SOURCE)) });
        }
        write(step.focusWalk, JSON.stringify({ stops, note: "Real Tab presses. indicatorChanged compares the focused style with the same element blurred." }, null, 2));
        log.push({ focusWalk: step.focusWalk, stops: stops.length });
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
    if (error instanceof EnvironmentError) {
      console.error(`Environment problem, not a product finding: ${error.message}`);
      process.exit(3);
    }
    console.error(error.message);
    process.exit(1);
  }
}

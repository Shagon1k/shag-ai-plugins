#!/usr/bin/env node
/**
 * Read a design export's node tree and list leads for design mode: text contrast from fills,
 * small targets from node bounds with the WCAG 2.5.8 spacing exception judged, and fills with
 * raw values instead of variables or styles.
 *
 *   node design-nodes.mjs <nodes.json> [--frame <node id>] [--min-target 24]
 *
 * Input: a node tree in the shape of the Figma REST API — a `{ nodes: { id: { document } } }`
 * response, a file with `document`, or a bare node — or any export normalized to it: nodes
 * with `id`, `name`, `type`, `absoluteBoundingBox {x, y, width, height}`, `fills`
 * (`SOLID` colors in 0–1 channels), `opacity`, `visible`, `characters`, `style.fontSize`,
 * `style.fontWeight`, `boundVariables`, `styles`, and `children`.
 *
 * Rects in the output are relative to their top-level frame, in design px: pass them to
 * annotate.mjs with `scale` set to the export scale of the frame image. Exits 1 when the export
 * has no node bounds; audit those frames in screenshot mode instead.
 */

import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { blendColors, classifyContrast, contrastRatio, formatColor, requiredContrast } from "./page-probes.mjs";

const CONTROL_NAME = /\b(button|btn|icon|link|close|toggle|switch|checkbox|radio|tab|chip|input|field|select|menu|cta)\b/i;
const CONTAINER_TYPES = new Set(["DOCUMENT", "CANVAS", "PAGE"]);

export function rootsOf(data) {
  if (data?.nodes && typeof data.nodes === "object") return Object.values(data.nodes).map((entry) => entry?.document ?? entry).filter(Boolean);
  if (data?.document) return [data.document];
  if (Array.isArray(data)) return data;
  return data ? [data] : [];
}

const visible = (node) => node.visible !== false;
const solidFill = (node) =>
  (node.fills ?? []).filter((fill) => fill.visible !== false && fill.type === "SOLID" && fill.color).at(-1);
const coveringFill = (node) => (node.fills ?? []).filter((fill) => fill.visible !== false).at(-1);
const toColor = (fill, opacity = 1) => ({
  r: Math.round(fill.color.r * 255),
  g: Math.round(fill.color.g * 255),
  b: Math.round(fill.color.b * 255),
  a: (fill.color.a ?? 1) * (fill.opacity ?? 1) * opacity,
});
const contains = (outer, inner) =>
  outer.x <= inner.x + 0.5 && outer.y <= inner.y + 0.5 && outer.x + outer.width >= inner.x + inner.width - 0.5 && outer.y + outer.height >= inner.y + inner.height - 0.5;

/** Flatten visible nodes in paint order (parents before children, siblings in order). */
export function paintOrder(roots) {
  const order = [];
  const walk = (node, frame, opacity, parent) => {
    if (!node || !visible(node)) return;
    const box = node.absoluteBoundingBox;
    const container = CONTAINER_TYPES.has(node.type);
    const ownFrame = !frame && !container && box ? node : frame;
    const effective = opacity * (node.opacity ?? 1);
    if (box && !container) order.push({ node, frame: ownFrame, opacity: effective, parent });
    for (const child of node.children ?? []) walk(child, ownFrame, container ? 1 : effective, container ? undefined : node);
  };
  for (const root of roots) walk(root, undefined, 1, undefined);
  return order;
}

export function analyzeNodes(data, { frame: frameId, minTarget = 24 } = {}) {
  const order = paintOrder(rootsOf(data)).filter((entry) => !frameId || entry.frame?.id === frameId);
  if (order.length === 0) {
    throw new Error("The export has no nodes with absoluteBoundingBox; audit these frames as screenshots (screenshot mode) instead");
  }
  const relative = (entry) => {
    const box = entry.node.absoluteBoundingBox;
    const origin = entry.frame.absoluteBoundingBox;
    return { x: box.x - origin.x, y: box.y - origin.y, w: box.width, h: box.height };
  };
  const frames = [...new Map(order.map((entry) => [entry.frame.id, entry.frame])).values()].map((frame) => ({
    id: frame.id,
    name: frame.name,
    size: { w: frame.absoluteBoundingBox.width, h: frame.absoluteBoundingBox.height },
  }));
  const text = [];
  const targets = [];
  const controls = [];
  const rawValues = [];
  const missing = { textStyle: 0, fills: 0 };

  order.forEach((entry, index) => {
    const { node } = entry;
    const base = { id: node.id, name: node.name, frame: entry.frame.id, rect: relative(entry) };
    const fill = solidFill(node);
    if (fill && !node.boundVariables?.fills && !node.styles?.fill && !node.styles?.fills) {
      rawValues.push({ ...base, property: "fill", value: formatColor(toColor(fill)) });
    }
    if (node.type === "TEXT") {
      const fontSize = node.style?.fontSize;
      const fontWeight = String(node.style?.fontWeight ?? 400);
      if (!fontSize) missing.textStyle += 1;
      if (!fill) {
        missing.fills += 1;
        text.push({ ...base, characters: String(node.characters ?? "").slice(0, 60), verdict: "unknown", reason: "text node has no solid fill" });
        return;
      }
      // Backdrop: everything painted earlier whose box covers the text, topmost opaque fill first.
      const behind = order.slice(0, index).filter((other) => other.frame === entry.frame && other.node.type !== "TEXT" && contains(other.node.absoluteBoundingBox, node.absoluteBoundingBox));
      let backdrop;
      let reason = "";
      for (let cursor = behind.length - 1; cursor >= 0; cursor -= 1) {
        const covering = coveringFill(behind[cursor].node);
        if (!covering) continue;
        if (covering.type !== "SOLID") {
          reason = `${covering.type.toLowerCase()} fill behind the text on ${behind[cursor].node.name}`;
          break;
        }
        const color = toColor(covering, behind[cursor].opacity);
        if (color.a >= 1) {
          backdrop = behind.slice(cursor + 1).reduce((under, layer) => {
            const top = solidFill(layer.node);
            return top ? blendColors(toColor(top, layer.opacity), under) : under;
          }, color);
          break;
        }
      }
      if (!backdrop) {
        text.push({ ...base, characters: String(node.characters ?? "").slice(0, 60), verdict: "unknown", reason: reason || "no opaque fill behind the text" });
        return;
      }
      const color = toColor(fill, entry.opacity);
      const shown = color.a < 1 ? blendColors(color, backdrop) : color;
      const ratio = contrastRatio(shown, backdrop);
      // Without a text style the threshold is unknown: below 3:1 fails either, 4.5:1 passes both.
      const required = fontSize ? requiredContrast(fontSize, fontWeight) : null;
      const verdict = required ? classifyContrast([ratio], required) : ratio < 3 ? "fail" : ratio >= 4.5 ? "pass" : "unknown";
      text.push({
        ...base,
        characters: String(node.characters ?? "").slice(0, 60),
        fontSize: fontSize ?? null,
        fontWeight,
        foreground: formatColor(shown),
        background: formatColor(backdrop),
        ratio,
        required,
        verdict,
        ...(verdict === "unknown" ? { reason: "no text style: the size and weight that set the 3:1 or 4.5:1 threshold are missing" } : {}),
      });
    } else if (CONTROL_NAME.test(node.name ?? "") && entry.node !== entry.frame) {
      // An icon inside a large enough control is not the target; the control is.
      const { w, h } = base.rect;
      const host = entry.parent?.absoluteBoundingBox;
      const hosted = host && CONTROL_NAME.test(entry.parent.name ?? "") && host.width >= minTarget && host.height >= minTarget;
      if (!hosted) controls.push(base);
      if ((w < minTarget || h < minTarget) && !hosted) targets.push({ ...base, size: `${w}×${h}` });
    }
  });

  for (const target of targets) Object.assign(target, judgeTarget(target, controls.filter((other) => other.frame === target.frame && other.id !== target.id), minTarget));

  return {
    frames,
    contrast: { failures: text.filter((item) => item.verdict === "fail"), unknown: text.filter((item) => item.verdict === "unknown"), checked: text.length },
    targets,
    rawValues,
    missing,
    note: "Leads, not verdicts: confirm each on the frame image. Design px equal CSS px only when the frame is drawn at 1x.",
  };
}

/**
 * WCAG 2.5.8 for an undersized target: it still passes when a circle of `min` px diameter on
 * its centre intersects no other target and no other undersized target's circle. Returns the
 * verdict and a sentence to use in the finding's observation.
 */
export function judgeTarget(target, others, min = 24) {
  const centre = (rect) => ({ x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 });
  const own = centre(target.rect);
  const radius = min / 2;
  let conflict;
  for (const other of others) {
    const small = other.rect.w < min || other.rect.h < min;
    const distance = small
      ? Math.hypot(centre(other.rect).x - own.x, centre(other.rect).y - own.y)
      : Math.hypot(Math.max(other.rect.x - own.x, 0, own.x - (other.rect.x + other.rect.w)), Math.max(other.rect.y - own.y, 0, own.y - (other.rect.y + other.rect.h)));
    const limit = small ? min : radius;
    if (distance < limit && (!conflict || distance < conflict.distance)) conflict = { other, distance: Math.round(distance * 10) / 10 };
  }
  const drawn = `drawn ${target.rect.w} × ${target.rect.h} px, below the ${min} × ${min} px minimum (WCAG 2.5.8)`;
  return conflict
    ? {
        spacingException: false,
        statement: `${target.name}: ${drawn}; the spacing exception fails because its ${min} px circle overlaps ${conflict.other.name} (${conflict.distance} px away, centre to ${conflict.other.rect.w < min || conflict.other.rect.h < min ? "centre" : "edge"}).`,
      }
    : {
        spacingException: true,
        statement: `${target.name}: ${drawn}, but it passes through the spacing exception: no other target is within its ${min} px circle.`,
      };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const args = process.argv.slice(2);
  const option = (name) => {
    const index = args.indexOf(name);
    return index >= 0 ? args[index + 1] : undefined;
  };
  const values = new Set(["--frame", "--min-target"].map((name) => option(name)).filter(Boolean));
  const files = args.filter((argument) => !argument.startsWith("--") && !values.has(argument));
  const minTarget = option("--min-target") === undefined ? 24 : Number(option("--min-target"));
  if (files.length !== 1 || !(minTarget > 0)) {
    console.error("Usage: design-nodes.mjs <nodes.json> [--frame <node id>] [--min-target 24]");
    process.exit(2);
  }
  try {
    const data = JSON.parse(fs.readFileSync(files[0], "utf8"));
    console.log(JSON.stringify(analyzeNodes(data, { frame: option("--frame"), minTarget }), null, 2));
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

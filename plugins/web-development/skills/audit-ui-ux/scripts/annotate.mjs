#!/usr/bin/env node
/**
 * Draw numbered boxes and short callouts over a screenshot as a self-contained SVG.
 *
 *   node annotate.mjs <spec.json> --out <file.svg> [--root <dir>]
 *
 * Spec (coordinates in CSS px; image paths relative to --root, default the current directory):
 *   {
 *     "image": "evidence/S-003.png",
 *     "scale": 2,                          image px per CSS px (device pixel ratio), default 1
 *     "offset": { "x": 0, "y": 0 },        subtracted from rects, e.g. scroll offset
 *     "crop": { "x": 0, "y": 0, "w": 600, "h": 400, "padding": 24 },   optional
 *     "marks": [
 *       { "id": "1", "rect": { "x": 10, "y": 20, "w": 200, "h": 40 },
 *         "text": "Helper text 2.9:1", "tone": "defect", "approximate": false }
 *     ]
 *   }
 * Tones: defect, suggestion, info. Approximate marks are dashed and prefixed with "≈".
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { cropImage, decodePng, encodePng } from "./png.mjs";

const TONES = {
  defect: "#D92D20",
  suggestion: "#2563EB",
  info: "#475467",
};
const MIME = { png: "image/png", jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif" };

export function imageInfo(buffer) {
  if (buffer.length >= 24 && buffer.readUInt32BE(0) === 0x89504e47) {
    return { type: "png", width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  }
  if (buffer.length >= 10 && buffer.toString("ascii", 0, 3) === "GIF") {
    return { type: "gif", width: buffer.readUInt16LE(6), height: buffer.readUInt16LE(8) };
  }
  if (
    buffer.length >= 30 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    const chunk = buffer.toString("ascii", 12, 16);
    if (chunk === "VP8X") {
      return { type: "webp", width: 1 + buffer.readUIntLE(24, 3), height: 1 + buffer.readUIntLE(27, 3) };
    }
    if (chunk === "VP8 ") {
      return { type: "webp", width: buffer.readUInt16LE(26) & 0x3fff, height: buffer.readUInt16LE(28) & 0x3fff };
    }
    if (chunk === "VP8L") {
      const [b0, b1, b2, b3] = buffer.subarray(21, 25);
      return {
        type: "webp",
        width: 1 + (((b1 & 0x3f) << 8) | b0),
        height: 1 + (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6)),
      };
    }
  }
  if (buffer.length >= 4 && buffer[0] === 0xff && buffer[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 < buffer.length) {
      if (buffer[offset] !== 0xff) {
        offset += 1;
        continue;
      }
      const marker = buffer[offset + 1];
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
        offset += 2;
        continue;
      }
      const isFrame = marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);
      if (isFrame) {
        return { type: "jpeg", width: buffer.readUInt16BE(offset + 7), height: buffer.readUInt16BE(offset + 5) };
      }
      offset += 2 + buffer.readUInt16BE(offset + 2);
    }
  }
  throw new Error("Unsupported image: expected PNG, JPEG, WebP, or GIF");
}

export function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export function wrapText(text, maxChars) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";
  for (const word of words) {
    if (!line) line = word;
    else if (`${line} ${word}`.length <= maxChars) line = `${line} ${word}`;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

function validRect(rect) {
  return rect && ["x", "y", "w", "h"].every((key) => Number.isFinite(rect[key])) && rect.w >= 0 && rect.h >= 0;
}

export function validateSpec(spec) {
  const errors = [];
  if (!spec || typeof spec !== "object") return ["Spec must be a JSON object"];
  if (typeof spec.image !== "string" || !spec.image) errors.push("image must be a path");
  if (spec.scale !== undefined && !(Number.isFinite(spec.scale) && spec.scale > 0)) {
    errors.push("scale must be a positive number");
  }
  if (spec.crop !== undefined && !validRect(spec.crop)) errors.push("crop must have numeric x, y, w, h");
  if (!Array.isArray(spec.marks) || spec.marks.length === 0) errors.push("marks must be a non-empty array");
  for (const [index, mark] of (spec.marks ?? []).entries()) {
    if (!validRect(mark?.rect)) errors.push(`marks[${index}].rect must have numeric x, y, w, h`);
    if (mark?.tone !== undefined && !(mark.tone in TONES)) {
      errors.push(`marks[${index}].tone must be one of ${Object.keys(TONES).join(", ")}`);
    }
  }
  return errors;
}

/** Build the SVG markup. `image` is { buffer, info }. */
export function renderAnnotation(spec, image) {
  const errors = validateSpec(spec);
  if (errors.length) throw new Error(errors.join("; "));
  const scale = spec.scale ?? 1;
  const offset = { x: spec.offset?.x ?? 0, y: spec.offset?.y ?? 0 };
  const toPixels = (rect) => ({
    x: (rect.x - offset.x) * scale,
    y: (rect.y - offset.y) * scale,
    w: rect.w * scale,
    h: rect.h * scale,
  });

  let view = { x: 0, y: 0, w: image.info.width, h: image.info.height };
  if (spec.crop) {
    const padding = (spec.crop.padding ?? 0) * scale;
    const crop = toPixels(spec.crop);
    const x = clamp(crop.x - padding, 0, image.info.width);
    const y = clamp(crop.y - padding, 0, image.info.height);
    view = {
      x,
      y,
      w: clamp(crop.w + padding * 2, 1, image.info.width - x),
      h: clamp(crop.h + padding * 2, 1, image.info.height - y),
    };
  }

  const fontSize = clamp(Math.round(Math.max(view.w * 0.02, Math.min(view.w, view.h) * 0.028)), 12, 72);
  const stroke = Math.max(2, Math.round(fontSize * 0.18));
  const radius = Math.round(fontSize * 0.85);
  const padding = Math.round(fontSize * 0.45);
  const lineHeight = Math.round(fontSize * 1.3);
  const charWidth = fontSize * 0.62;
  const maxChars = Math.max(16, Math.floor((view.w * 0.55) / charWidth));
  const gap = Math.round(radius * 0.6) + stroke;
  const marks = spec.marks.map((mark, index) => ({
    ...mark,
    color: TONES[mark.tone ?? "defect"],
    label: escapeXml(mark.id ?? String(index + 1)),
    px: toPixels(mark.rect),
  }));

  const overlapArea = (a, b) =>
    Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) *
    Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
  const markBoxes = marks.map(({ px }) => ({ x: px.x - stroke, y: px.y - stroke, w: px.w + stroke * 2, h: px.h + stroke * 2 }));

  // Badges go on a corner just outside their box, choosing the corner that covers the least.
  const badges = [];
  for (const { px } of marks) {
    const corners = [
      [px.x - radius * 0.6, px.y - radius * 0.6],
      [px.x + px.w + radius * 0.6, px.y - radius * 0.6],
      [px.x - radius * 0.6, px.y + px.h + radius * 0.6],
      [px.x + px.w + radius * 0.6, px.y + px.h + radius * 0.6],
    ].map(([x, y]) => ({
      x: clamp(x, view.x + radius, view.x + view.w - radius),
      y: clamp(y, view.y + radius, view.y + view.h - radius),
    }));
    const area = (badge) => ({ x: badge.x - radius, y: badge.y - radius, w: radius * 2, h: radius * 2 });
    const cost = (badge) =>
      [...markBoxes, ...badges.map(area)].reduce((total, other) => total + overlapArea(area(badge), other), 0);
    badges.push(corners.reduce((best, corner) => (cost(corner) < cost(best) ? corner : best)));
  }
  const obstacles = [
    ...markBoxes,
    ...badges.map((badge) => ({ x: badge.x - radius, y: badge.y - radius, w: radius * 2, h: radius * 2 })),
  ];
  const shapes = [];
  const callouts = [];
  const placed = [];
  for (const mark of marks) {
    const { px: rect, color } = mark;
    const dash = mark.approximate ? ` stroke-dasharray="${stroke * 3} ${stroke * 2}"` : "";
    const box = `x="${rect.x}" y="${rect.y}" width="${rect.w}" height="${rect.h}" rx="${stroke}"`;
    shapes.push(
      `<rect ${box} fill="none" stroke="#FFFFFF" stroke-width="${stroke * 2.5}" stroke-opacity="0.85"/>`,
      `<rect ${box} fill="${color}" fill-opacity="0.08" stroke="${color}" stroke-width="${stroke}"${dash}/>`,
    );
    if (!mark.text) continue;

    const lines = wrapText(`${mark.approximate ? "≈ " : ""}${mark.text}`, maxChars);
    const width = Math.ceil(Math.max(...lines.map((line) => line.length)) * charWidth) + padding * 2;
    const height = lines.length * lineHeight + padding * 2;
    const fit = (x, y) => ({
      x: clamp(x, view.x, view.x + view.w - width),
      y: clamp(y, view.y, view.y + view.h - height),
      w: width,
      h: height,
    });
    const candidates = [
      fit(rect.x, rect.y + rect.h + gap),
      fit(rect.x, rect.y - gap - height),
      fit(rect.x + rect.w + gap, rect.y),
      fit(rect.x - gap - width, rect.y),
      fit(rect.x + rect.w - width, rect.y + rect.h + gap),
      fit(rect.x + rect.w - width, rect.y - gap - height),
    ];
    const cost = (candidate) =>
      [...obstacles, ...placed].reduce((total, other) => total + overlapArea(candidate, other), 0);
    let best = candidates[0];
    let bestCost = cost(best);
    for (const candidate of candidates.slice(1)) {
      const candidateCost = cost(candidate);
      if (candidateCost < bestCost) {
        best = candidate;
        bestCost = candidateCost;
      }
    }
    placed.push(best);

    const nearest = (value, start, size) => clamp(value, start, start + size);
    const anchor = { x: nearest(best.x + best.w / 2, rect.x, rect.w), y: nearest(best.y + best.h / 2, rect.y, rect.h) };
    const from = { x: nearest(anchor.x, best.x, best.w), y: nearest(anchor.y, best.y, best.h) };
    if (Math.hypot(anchor.x - from.x, anchor.y - from.y) > gap * 1.5) {
      callouts.push(
        `<line x1="${from.x}" y1="${from.y}" x2="${anchor.x}" y2="${anchor.y}" stroke="#FFFFFF" stroke-width="${stroke * 2}" stroke-linecap="round"/>`,
        `<line x1="${from.x}" y1="${from.y}" x2="${anchor.x}" y2="${anchor.y}" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round"/>`,
      );
    }
    const tspans = lines
      .map(
        (line, lineIndex) =>
          `<tspan x="${best.x + padding}" y="${best.y + padding + lineIndex * lineHeight + fontSize}">${escapeXml(line)}</tspan>`,
      )
      .join("");
    callouts.push(
      `<rect x="${best.x}" y="${best.y}" width="${width}" height="${height}" rx="${stroke * 2}" fill="${color}" stroke="#FFFFFF" stroke-width="${Math.max(1, stroke / 2)}"/>`,
      `<text font-size="${fontSize}" font-weight="600" fill="#FFFFFF">${tspans}</text>`,
    );
  }
  const labels = marks.flatMap((mark, index) => [
    `<circle cx="${badges[index].x}" cy="${badges[index].y}" r="${radius}" fill="${mark.color}" stroke="#FFFFFF" stroke-width="${stroke}"/>`,
    `<text x="${badges[index].x}" y="${badges[index].y}" dy="0.35em" text-anchor="middle" font-size="${fontSize}" font-weight="700" fill="#FFFFFF">${mark.label}</text>`,
  ]);

  // Embed only the visible part of a cropped PNG so reports stay small.
  let embedded = { buffer: image.buffer, x: 0, y: 0, width: image.info.width, height: image.info.height };
  if (spec.crop && image.info.type === "png") {
    try {
      const cropped = cropImage(decodePng(image.buffer), view);
      embedded = { buffer: encodePng(cropped), x: cropped.x, y: cropped.y, width: cropped.width, height: cropped.height };
    } catch {
      // Unsupported PNG variants fall back to embedding the full image.
    }
  }
  const data = embedded.buffer.toString("base64");
  const title = escapeXml(spec.title ?? `Annotated ${path.basename(spec.image)}`);
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" role="img"`,
    ` viewBox="${view.x} ${view.y} ${view.w} ${view.h}" width="${view.w}" height="${view.h}"`,
    ` font-family="system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif">`,
    `<title>${title}</title>`,
    `<image href="data:${MIME[image.info.type]};base64,${data}" x="${embedded.x}" y="${embedded.y}" width="${embedded.width}" height="${embedded.height}"/>`,
    ...shapes,
    ...callouts,
    ...labels,
    `</svg>`,
    "",
  ].join("\n");
}

export function parseCliArguments(args) {
  const parsed = { root: process.cwd() };
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--out" || argument === "--root") {
      if (!args[index + 1]) throw new Error(`${argument} requires a value`);
      parsed[argument.slice(2)] = args[index + 1];
      index += 1;
    } else if (argument.startsWith("-")) {
      throw new Error(`Unknown argument: ${argument}`);
    } else if (parsed.spec) {
      throw new Error(`Unexpected argument: ${argument}`);
    } else {
      parsed.spec = argument;
    }
  }
  if (!parsed.spec || !parsed.out) throw new Error("Spec path and --out are required");
  return parsed;
}

export function annotateFile({ spec: specPath, out, root }) {
  const spec = JSON.parse(fs.readFileSync(specPath, "utf8"));
  const errors = validateSpec(spec);
  if (errors.length) throw new Error(errors.join("; "));
  const buffer = fs.readFileSync(path.resolve(root, spec.image));
  const svg = renderAnnotation(spec, { buffer, info: imageInfo(buffer) });
  fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
  fs.writeFileSync(out, svg, "utf8");
  return path.resolve(out);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    console.log(annotateFile(parseCliArguments(process.argv.slice(2))));
  } catch (error) {
    console.error(error.message);
    console.error("Usage: annotate.mjs <spec.json> --out <file.svg> [--root <dir>]");
    process.exit(2);
  }
}

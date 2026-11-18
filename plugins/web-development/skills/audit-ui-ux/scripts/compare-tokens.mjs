#!/usr/bin/env node
/**
 * Compare the styles a page actually uses with the project's design tokens.
 *
 *   node compare-tokens.mjs <probes.json> <tokens.css|scss> [more token files] [--tolerance 2]
 *
 * <probes.json> must come from page-probes with --inventory. Token files may define CSS custom
 * properties (--name: value) or SCSS variables ($name: value); references through var(--x) or
 * $x are resolved. The report lists used colors, font sizes, and radii that match no token.
 * Off-token values are leads for VI-07, not defects by themselves.
 */

import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { formatColor, parseColor } from "./page-probes.mjs";

export function parseTokens(text) {
  const tokens = new Map();
  const pattern = /(--[\w-]+|\$[\w-]+)\s*:\s*([^;{}]+);/g;
  for (const match of text.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, "").matchAll(pattern)) {
    tokens.set(match[1], match[2].trim());
  }
  const resolve = (value, depth = 0) =>
    depth > 10
      ? value
      : value
          .replace(/var\((--[\w-]+)(?:\s*,\s*([^)]+))?\)/g, (whole, name, fallback) =>
            tokens.has(name) ? resolve(tokens.get(name), depth + 1) : fallback ? resolve(fallback.trim(), depth + 1) : whole,
          )
          .replace(/\$[\w-]+/g, (name) => (tokens.has(name) ? resolve(tokens.get(name), depth + 1) : name));
  return new Map([...tokens].map(([name, value]) => [name, resolve(value)]));
}

export function hslToRgb(value) {
  const match = value.match(/^hsla?\(\s*([\d.]+)(?:deg)?[\s,]+([\d.]+)%[\s,]+([\d.]+)%(?:[\s,/]+([\d.]+%?))?\s*\)$/i);
  if (!match) return null;
  const h = Number(match[1]) / 360;
  const s = Number(match[2]) / 100;
  const l = Number(match[3]) / 100;
  const a = match[4] === undefined ? 1 : match[4].endsWith("%") ? parseFloat(match[4]) / 100 : Number(match[4]);
  const hue = (p, q, t) => {
    const x = t < 0 ? t + 1 : t > 1 ? t - 1 : t;
    if (x < 1 / 6) return p + (q - p) * 6 * x;
    if (x < 1 / 2) return q;
    if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6;
    return p;
  };
  if (s === 0) return { r: l * 255, g: l * 255, b: l * 255, a };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return { r: hue(p, q, h + 1 / 3) * 255, g: hue(p, q, h) * 255, b: hue(p, q, h - 1 / 3) * 255, a };
}

const toColor = (value) => parseColor(value) ?? hslToRgb(String(value).trim());

export function toPixels(value) {
  const match = String(value).trim().match(/^(-?[\d.]+)(px|rem|em)?$/);
  if (!match) return null;
  const number = Number(match[1]);
  return match[2] === "rem" || match[2] === "em" ? number * 16 : number;
}

export function tokenSets(tokens) {
  const colors = [];
  const lengths = [];
  for (const [name, value] of tokens) {
    const color = toColor(value);
    if (color) colors.push({ name, color });
    const pixels = toPixels(value);
    if (pixels !== null) lengths.push({ name, pixels });
  }
  return { colors, lengths };
}

function colorDistance(left, right) {
  return Math.max(Math.abs(left.r - right.r), Math.abs(left.g - right.g), Math.abs(left.b - right.b), Math.abs(left.a - right.a) * 255);
}

export function compareInventory(inventory, tokens, tolerance = 2) {
  const { colors, lengths } = tokenSets(tokens);
  const offColors = [];
  for (const kind of ["color", "background", "border"]) {
    for (const entry of inventory[kind] ?? []) {
      const used = parseColor(entry.value);
      if (!used) continue;
      const nearest = colors
        .map((token) => ({ token, distance: colorDistance(used, token.color) }))
        .sort((left, right) => left.distance - right.distance)[0];
      if (!nearest || nearest.distance > tolerance) {
        offColors.push({
          kind,
          value: entry.value,
          count: entry.count,
          example: entry.example,
          nearestToken: nearest ? `${nearest.token.name} (${formatColor(nearest.token.color)})` : "",
        });
      }
    }
  }
  const offLengths = (kind) =>
    (inventory[kind] ?? [])
      .map((entry) => ({ ...entry, pixels: toPixels(entry.value) }))
      .filter((entry) => entry.pixels !== null && !lengths.some((token) => Math.abs(token.pixels - entry.pixels) < 0.5))
      .map(({ value, count, example }) => ({ kind, value, count, example }));
  return {
    tokenCounts: { colors: colors.length, lengths: lengths.length },
    offTokenColors: offColors.sort((left, right) => right.count - left.count),
    offScaleFontSizes: offLengths("fontSize").sort((left, right) => right.count - left.count),
    offScaleRadii: offLengths("radius").sort((left, right) => right.count - left.count),
    fontFamilies: (inventory.fontFamily ?? []).map(({ value, count }) => ({ value, count })),
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const args = process.argv.slice(2);
  const toleranceIndex = args.indexOf("--tolerance");
  const tolerance = toleranceIndex >= 0 ? Number(args[toleranceIndex + 1]) : 2;
  const files = args.filter((argument, index) => !argument.startsWith("--") && !(toleranceIndex >= 0 && index === toleranceIndex + 1));
  if (files.length < 2 || !Number.isFinite(tolerance)) {
    console.error("Usage: compare-tokens.mjs <probes.json> <tokens.css|scss> [more token files] [--tolerance 2]");
    process.exit(2);
  }
  try {
    const probes = JSON.parse(fs.readFileSync(files[0], "utf8"));
    if (!probes.inventory) throw new Error(`${files[0]} has no inventory; run page-probes with --inventory`);
    const tokens = parseTokens(files.slice(1).map((file) => fs.readFileSync(file, "utf8")).join("\n"));
    console.log(JSON.stringify(compareInventory(probes.inventory, tokens, tolerance), null, 2));
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

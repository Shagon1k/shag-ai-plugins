#!/usr/bin/env node
/**
 * Estimate text contrast from screenshot pixels when no DOM or design file is available.
 *
 *   node sample-contrast.mjs <image.png> --rect x,y,w,h [--rect ...] [--scale 2]
 *
 * Rects are CSS px and are multiplied by --scale (the screenshot's device pixel ratio).
 * Pixels are split into two luminance classes (Otsu); the larger class is the background, and
 * the core of the smaller class (the 25% farthest from the background) is the text color,
 * which limits the anti-aliasing bias. Results are estimates, never measurements.
 */

import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { contrastRatio, formatColor, relativeLuminance } from "./page-probes.mjs";
import { cropImage, decodePng, isPng } from "./png.mjs";

function mean(pixels) {
  const total = pixels.reduce((sum, pixel) => ({ r: sum.r + pixel.r, g: sum.g + pixel.g, b: sum.b + pixel.b }), { r: 0, g: 0, b: 0 });
  return { r: total.r / pixels.length, g: total.g / pixels.length, b: total.b / pixels.length, a: 1 };
}

export function otsuThreshold(values) {
  const histogram = new Array(256).fill(0);
  for (const value of values) histogram[value] += 1;
  const total = values.length;
  let sum = 0;
  for (let i = 0; i < 256; i += 1) sum += i * histogram[i];
  let sumBackground = 0;
  let weightBackground = 0;
  let best = { threshold: 127, variance: -1 };
  for (let t = 0; t < 256; t += 1) {
    weightBackground += histogram[t];
    if (!weightBackground) continue;
    const weightForeground = total - weightBackground;
    if (!weightForeground) break;
    sumBackground += t * histogram[t];
    const meanBackground = sumBackground / weightBackground;
    const meanForeground = (sum - sumBackground) / weightForeground;
    const variance = weightBackground * weightForeground * (meanBackground - meanForeground) ** 2;
    if (variance > best.variance) best = { threshold: t, variance };
  }
  return best.threshold;
}

/** Estimate foreground and background colors inside an RGBA region. */
export function estimateContrast(region) {
  const pixels = [];
  const inset = Math.floor(Math.min(region.width, region.height) * 0.2);
  for (let y = 0; y < region.height; y += 1) {
    for (let x = 0; x < region.width; x += 1) {
      const i = (y * region.width + x) * 4;
      const alpha = region.data[i + 3] / 255;
      const blend = (value) => value * alpha + 255 * (1 - alpha);
      const pixel = { r: blend(region.data[i]), g: blend(region.data[i + 1]), b: blend(region.data[i + 2]), a: 1 };
      pixel.l = Math.round(relativeLuminance(pixel) ** (1 / 2.2) * 255);
      pixel.inner = x >= inset && y >= inset && x < region.width - inset && y < region.height - inset;
      pixels.push(pixel);
    }
  }

  // Background: the most common color, quantized so anti-aliasing noise does not split it.
  const buckets = new Map();
  for (const pixel of pixels) {
    const key = [pixel.r, pixel.g, pixel.b].map((value) => Math.round(value / 16)).join(",");
    const bucket = buckets.get(key) ?? [];
    bucket.push(pixel);
    buckets.set(key, bucket);
  }
  const backgroundPixels = [...buckets.values()].sort((left, right) => right.length - left.length)[0];
  const background = mean(backgroundPixels);
  const backgroundLevel = Math.round(relativeLuminance(background) ** (1 / 2.2) * 255);

  // Text: inner pixels that differ clearly from the background. The outer ring is ignored
  // because rounded corners and neighbouring surfaces live there, not glyphs.
  const differs = (pixel) => Math.abs(pixel.l - backgroundLevel) > 24;
  let candidates = pixels.filter((pixel) => pixel.inner && differs(pixel));
  if (candidates.length < 4) candidates = pixels.filter(differs);
  const textShare = candidates.length / pixels.length;
  if (candidates.length < 4 || textShare < 0.01) {
    return { detected: false, reason: "Too few contrasting pixels to separate text from background." };
  }

  // Several tones can remain (text and an icon, or two text colors); keep the larger group.
  const threshold = otsuThreshold(candidates.map((pixel) => pixel.l));
  const lower = candidates.filter((pixel) => pixel.l <= threshold);
  const upper = candidates.filter((pixel) => pixel.l > threshold);
  const group = !lower.length || !upper.length ? candidates : lower.length >= upper.length ? lower : upper;
  const core = [...group]
    .sort((left, right) => Math.abs(right.l - backgroundLevel) - Math.abs(left.l - backgroundLevel))
    .slice(0, Math.max(1, Math.ceil(group.length * 0.25)));
  const foreground = mean(core);
  return {
    detected: true,
    foreground: formatColor(foreground),
    background: formatColor(background),
    ratio: contrastRatio(foreground, background),
    textShare: Math.round(textShare * 1000) / 1000,
    basis: "visual-estimate",
  };
}

export function parseArguments(args) {
  const parsed = { rects: [], scale: 1 };
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--rect") {
      const values = (args[index + 1] ?? "").split(",").map(Number);
      if (values.length !== 4 || values.some((value) => !Number.isFinite(value)) || values[2] <= 0 || values[3] <= 0) {
        throw new Error("--rect needs x,y,w,h with a positive width and height");
      }
      parsed.rects.push({ x: values[0], y: values[1], w: values[2], h: values[3] });
      index += 1;
    } else if (argument === "--scale") {
      parsed.scale = Number(args[index + 1]);
      if (!(parsed.scale > 0)) throw new Error("--scale needs a positive number");
      index += 1;
    } else if (argument.startsWith("-")) {
      throw new Error(`Unknown argument: ${argument}`);
    } else if (parsed.image) {
      throw new Error(`Unexpected argument: ${argument}`);
    } else {
      parsed.image = argument;
    }
  }
  if (!parsed.image || parsed.rects.length === 0) throw new Error("An image and at least one --rect are required");
  return parsed;
}

export function sampleFile({ image, rects, scale }) {
  const buffer = fs.readFileSync(image);
  if (!isPng(buffer)) {
    throw new Error(
      `${image} is not a PNG. Convert it first (open it in a browser tool and save a 1x PNG screenshot, or ` +
        "run capture.mjs on a page that shows it); if no conversion is possible, mark contrast unverifiable.",
    );
  }
  const decoded = decodePng(buffer);
  return rects.map((rect) => {
    const pixelRect = { x: rect.x * scale, y: rect.y * scale, w: rect.w * scale, h: rect.h * scale };
    return { rect, ...estimateContrast(cropImage(decoded, pixelRect)) };
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    console.log(JSON.stringify(sampleFile(parseArguments(process.argv.slice(2))), null, 2));
  } catch (error) {
    console.error(error.message);
    console.error("Usage: sample-contrast.mjs <image.png> --rect x,y,w,h [--rect ...] [--scale n]");
    process.exit(2);
  }
}

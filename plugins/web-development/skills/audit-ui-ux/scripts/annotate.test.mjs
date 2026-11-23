#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { escapeXml, imageInfo, renderAnnotation, validateSpec, wrapText } from "./annotate.mjs";

const SCRIPT = fileURLToPath(new URL("./annotate.mjs", import.meta.url));
const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

function pngHeader(width, height) {
  const buffer = Buffer.alloc(24);
  buffer.writeUInt32BE(0x89504e47, 0);
  buffer.writeUInt32BE(width, 16);
  buffer.writeUInt32BE(height, 20);
  return buffer;
}

test("reads dimensions of PNG, JPEG, GIF, and WebP images", () => {
  assert.deepEqual(imageInfo(PNG_1X1), { type: "png", width: 1, height: 1 });
  const jpeg = Buffer.from([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x00, 0x00, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x02, 0x58, 0x03, 0x20, 0x03,
  ]);
  assert.deepEqual(imageInfo(jpeg), { type: "jpeg", width: 800, height: 600 });
  const gif = Buffer.from("GIF89a\x40\x01\xf0\x00", "latin1");
  assert.deepEqual(imageInfo(gif), { type: "gif", width: 320, height: 240 });
  const webp = Buffer.alloc(30);
  webp.write("RIFF", 0, "ascii");
  webp.write("WEBP", 8, "ascii");
  webp.write("VP8X", 12, "ascii");
  webp.writeUIntLE(1279, 24, 3);
  webp.writeUIntLE(719, 27, 3);
  assert.deepEqual(imageInfo(webp), { type: "webp", width: 1280, height: 720 });
  assert.throws(() => imageInfo(Buffer.from("not an image")), /Unsupported image/);
});

test("validates the annotation spec", () => {
  assert.deepEqual(validateSpec({ image: "a.png", marks: [{ rect: { x: 0, y: 0, w: 1, h: 1 } }] }), []);
  const errors = validateSpec({ image: "", scale: 0, marks: [{ rect: { x: 0 }, tone: "loud" }] });
  assert.equal(errors.length, 4);
});

test("wraps callout text by words", () => {
  assert.deepEqual(wrapText("one two three four", 9), ["one two", "three", "four"]);
  assert.deepEqual(wrapText("", 9), [""]);
});

test("renders scaled, escaped marks over the embedded image", () => {
  const svg = renderAnnotation(
    {
      image: "evidence/S-001.png",
      scale: 2,
      offset: { x: 0, y: 100 },
      marks: [
        { id: "1", rect: { x: 10, y: 120, w: 50, h: 20 }, text: "Contrast <2:1> & small", tone: "defect" },
        { id: "2", rect: { x: 200, y: 300, w: 40, h: 40 }, tone: "suggestion", approximate: true },
      ],
    },
    { buffer: pngHeader(1000, 800), info: { type: "png", width: 1000, height: 800 } },
  );
  assert.match(svg, /viewBox="0 0 1000 800"/);
  assert.match(svg, /<rect x="20" y="40" width="100" height="40"/);
  assert.match(svg, /stroke-dasharray/);
  assert.match(svg, /Contrast &lt;2:1&gt; &amp; small/);
  assert.match(svg, /href="data:image\/png;base64,/);
  assert.equal(escapeXml(`"'`), "&quot;&apos;");
});

test("crops the view box with padding inside the image bounds", () => {
  const svg = renderAnnotation(
    {
      image: "x.png",
      crop: { x: 10, y: 10, w: 100, h: 50, padding: 20 },
      marks: [{ rect: { x: 20, y: 20, w: 10, h: 10 }, text: "Here" }],
    },
    { buffer: pngHeader(400, 300), info: { type: "png", width: 400, height: 300 } },
  );
  assert.match(svg, /viewBox="0 0 140 90"/);
});

test("writes an SVG from the CLI", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "audit-ui-ux-annotate-"));
  fs.mkdirSync(path.join(root, "evidence"));
  fs.writeFileSync(path.join(root, "evidence/S-001.png"), PNG_1X1);
  fs.writeFileSync(
    path.join(root, "spec.json"),
    JSON.stringify({ image: "evidence/S-001.png", marks: [{ rect: { x: 0, y: 0, w: 1, h: 1 } }] }),
  );
  const out = path.join(root, "annotated/F-001.svg");
  const result = spawnSync(process.execPath, [SCRIPT, path.join(root, "spec.json"), "--out", out, "--root", root], {
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(fs.readFileSync(out, "utf8"), /^<svg /);
  const missing = spawnSync(process.execPath, [SCRIPT, path.join(root, "spec.json")], { encoding: "utf8" });
  assert.equal(missing.status, 2);
});

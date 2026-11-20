#!/usr/bin/env node

import assert from "node:assert/strict";
import test from "node:test";
import { cropImage, decodePng, encodePng, isPng, quantizeImage, scaleImage } from "./png.mjs";

function gradient(width, height, alpha = 255) {
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) data.set([x * 10, y * 20, (x + y) * 5, alpha], (y * width + x) * 4);
  }
  return { width, height, data };
}

test("round-trips opaque and transparent images", () => {
  for (const alpha of [255, 128]) {
    const image = gradient(7, 5, alpha);
    const png = encodePng(image);
    assert.ok(isPng(png));
    const decoded = decodePng(png);
    assert.equal(decoded.width, 7);
    assert.equal(decoded.height, 5);
    assert.deepEqual([...decoded.data], [...image.data]);
  }
});

test("crops to a clamped rectangle", () => {
  const cropped = cropImage(gradient(10, 10), { x: 8, y: -3, w: 5, h: 2 });
  assert.equal(cropped.width, 2);
  assert.equal(cropped.height, 2);
  assert.equal(cropped.x, 8);
  assert.equal(cropped.y, 0);
  assert.deepEqual([...cropped.data.subarray(0, 4)], [80, 0, 40, 255]);
});

test("rejects non-PNG input", () => {
  assert.throws(() => decodePng(Buffer.from("nope")), /Not a PNG/);
});

test("scales down by area averaging and never scales up", () => {
  const image = { width: 4, height: 2, data: new Uint8Array([0, 0, 0, 255, 100, 100, 100, 255, 200, 200, 200, 255, 50, 50, 50, 255, 0, 0, 0, 255, 100, 100, 100, 255, 200, 200, 200, 255, 50, 50, 50, 255]) };
  const half = scaleImage(image, 0.5);
  assert.deepEqual([half.width, half.height], [2, 1]);
  assert.deepEqual([...half.data], [50, 50, 50, 255, 125, 125, 125, 255]);
  assert.equal(scaleImage(image, 1), image);
  assert.equal(scaleImage(image, 2), image);
});

test("quantizes color channels and keeps alpha", () => {
  const image = { width: 1, height: 1, data: new Uint8Array([0, 130, 255, 77]) };
  assert.deepEqual([...quantizeImage(image, 6).data], [2, 130, 254, 77]);
  assert.equal(quantizeImage(image, 8), image);
});

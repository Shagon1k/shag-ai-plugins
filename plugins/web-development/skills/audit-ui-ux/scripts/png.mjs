/**
 * Minimal PNG decoding, cropping, and encoding with the Node.js standard library.
 * Supports non-interlaced 8- and 16-bit grayscale, RGB, palette, and alpha images.
 */

import zlib from "node:zlib";

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const CHANNELS = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };

let crcTable;
function crc32(buffer) {
  if (typeof zlib.crc32 === "function") return zlib.crc32(buffer);
  crcTable ??= Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  let crc = 0xffffffff;
  for (const byte of buffer) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

export function isPng(buffer) {
  return buffer.length >= 8 && buffer.subarray(0, 8).equals(SIGNATURE);
}

/** Decode to { width, height, data } where data is RGBA, 8 bits per channel. */
export function decodePng(buffer) {
  if (!isPng(buffer)) throw new Error("Not a PNG file");
  let offset = 8;
  let header;
  let palette;
  let transparency;
  const idat = [];
  while (offset + 8 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    const chunk = buffer.subarray(offset + 8, offset + 8 + length);
    if (type === "IHDR") {
      header = {
        width: chunk.readUInt32BE(0),
        height: chunk.readUInt32BE(4),
        depth: chunk[8],
        colorType: chunk[9],
        interlace: chunk[12],
      };
    } else if (type === "PLTE") palette = chunk;
    else if (type === "tRNS") transparency = chunk;
    else if (type === "IDAT") idat.push(chunk);
    else if (type === "IEND") break;
    offset += 12 + length;
  }
  if (!header) throw new Error("PNG has no IHDR chunk");
  const { width, height, depth, colorType, interlace } = header;
  if (interlace) throw new Error("Interlaced PNG is not supported");
  if (!(colorType in CHANNELS) || ![8, 16].includes(depth)) {
    throw new Error(`Unsupported PNG format: color type ${colorType}, bit depth ${depth}`);
  }
  const channels = CHANNELS[colorType];
  const bytesPerPixel = (channels * depth) / 8;
  const stride = width * bytesPerPixel;
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const pixels = Buffer.alloc(stride * height);
  let previous = Buffer.alloc(stride);
  for (let y = 0; y < height; y += 1) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    const out = pixels.subarray(y * stride, (y + 1) * stride);
    for (let x = 0; x < stride; x += 1) {
      const left = x >= bytesPerPixel ? out[x - bytesPerPixel] : 0;
      const up = previous[x];
      const upLeft = x >= bytesPerPixel ? previous[x - bytesPerPixel] : 0;
      let value = line[x];
      if (filter === 1) value += left;
      else if (filter === 2) value += up;
      else if (filter === 3) value += (left + up) >> 1;
      else if (filter === 4) {
        const estimate = left + up - upLeft;
        const a = Math.abs(estimate - left);
        const b = Math.abs(estimate - up);
        const c = Math.abs(estimate - upLeft);
        value += a <= b && a <= c ? left : b <= c ? up : upLeft;
      } else if (filter !== 0) throw new Error(`Unknown PNG filter ${filter}`);
      out[x] = value & 0xff;
    }
    previous = out;
  }

  const data = new Uint8Array(width * height * 4);
  const sample = (index) => (depth === 16 ? pixels[index * 2] : pixels[index]);
  for (let i = 0; i < width * height; i += 1) {
    const base = i * channels;
    let r;
    let g;
    let b;
    let a = 255;
    if (colorType === 0) r = g = b = sample(base);
    else if (colorType === 2) [r, g, b] = [sample(base), sample(base + 1), sample(base + 2)];
    else if (colorType === 3) {
      const index = pixels[i];
      [r, g, b] = [palette[index * 3], palette[index * 3 + 1], palette[index * 3 + 2]];
      if (transparency && index < transparency.length) a = transparency[index];
    } else if (colorType === 4) {
      r = g = b = sample(base);
      a = sample(base + 1);
    } else [r, g, b, a] = [sample(base), sample(base + 1), sample(base + 2), sample(base + 3)];
    data.set([r, g, b, a], i * 4);
  }
  return { width, height, data };
}

/** Crop an RGBA image to the rectangle, clamped to its bounds. */
export function cropImage(image, rect) {
  const x = Math.max(0, Math.floor(rect.x));
  const y = Math.max(0, Math.floor(rect.y));
  const width = Math.max(1, Math.min(image.width - x, Math.ceil(rect.w)));
  const height = Math.max(1, Math.min(image.height - y, Math.ceil(rect.h)));
  const data = new Uint8Array(width * height * 4);
  for (let row = 0; row < height; row += 1) {
    const start = ((y + row) * image.width + x) * 4;
    data.set(image.data.subarray(start, start + width * 4), row * width * 4);
  }
  return { width, height, data, x, y };
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

/** Encode an RGBA image as an 8-bit PNG, dropping alpha when every pixel is opaque. */
export function encodePng(image) {
  const opaque = image.data.every((value, index) => index % 4 !== 3 || value === 255);
  const channels = opaque ? 3 : 4;
  const stride = image.width * channels;
  const raw = Buffer.alloc((stride + 1) * image.height);
  for (let y = 0; y < image.height; y += 1) {
    const rowStart = y * (stride + 1);
    raw[rowStart] = 1; // Sub filter: compresses screenshots well and is cheap.
    for (let x = 0; x < image.width; x += 1) {
      for (let c = 0; c < channels; c += 1) {
        const value = image.data[(y * image.width + x) * 4 + c];
        const left = x > 0 ? image.data[(y * image.width + x - 1) * 4 + c] : 0;
        raw[rowStart + 1 + x * channels + c] = (value - left) & 0xff;
      }
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(image.width, 0);
  header.writeUInt32BE(image.height, 4);
  header[8] = 8;
  header[9] = opaque ? 2 : 6;
  return Buffer.concat([
    SIGNATURE,
    chunk("IHDR", header),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/** Scale an RGBA image by `factor` (< 1 shrinks) with area averaging, which keeps text legible. */
export function scaleImage(image, factor) {
  if (!(factor > 0) || factor >= 1) return image;
  const width = Math.max(1, Math.round(image.width * factor));
  const height = Math.max(1, Math.round(image.height * factor));
  const data = new Uint8Array(width * height * 4);
  const stepX = image.width / width;
  const stepY = image.height / height;
  const sums = new Float64Array(4);
  for (let y = 0; y < height; y += 1) {
    const top = Math.floor(y * stepY);
    const bottom = Math.max(top + 1, Math.min(image.height, Math.floor((y + 1) * stepY)));
    for (let x = 0; x < width; x += 1) {
      const left = Math.floor(x * stepX);
      const right = Math.max(left + 1, Math.min(image.width, Math.floor((x + 1) * stepX)));
      sums.fill(0);
      for (let row = top; row < bottom; row += 1) {
        for (let column = left; column < right; column += 1) {
          const index = (row * image.width + column) * 4;
          for (let channel = 0; channel < 4; channel += 1) sums[channel] += image.data[index + channel];
        }
      }
      const count = (bottom - top) * (right - left);
      for (let channel = 0; channel < 4; channel += 1) data[(y * width + x) * 4 + channel] = Math.round(sums[channel] / count);
    }
  }
  return { width, height, data };
}

/** Keep `bits` per color channel (alpha untouched) so DEFLATE finds longer repeats. */
export function quantizeImage(image, bits = 6) {
  if (!(bits >= 1 && bits < 8)) return image;
  const shift = 8 - bits;
  const half = 1 << (shift - 1);
  const data = new Uint8Array(image.data);
  for (let index = 0; index < data.length; index += 1) {
    if (index % 4 === 3) continue;
    data[index] = Math.min(255, ((data[index] >> shift) << shift) + half);
  }
  return { ...image, data };
}

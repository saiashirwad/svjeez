import { inflateSync } from "node:zlib";

/** Decodes an 8-bit RGB or RGBA PNG into a pixel reader that also knows its size. */
export const pixels = (png: Uint8Array) => {
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  const width = view.getUint32(16);
  const height = view.getUint32(20);
  const channels = png[25] === 6 ? 4 : 3;
  const chunks: Uint8Array[] = [];

  for (let at = 8; at < png.length;) {
    const length = view.getUint32(at);
    const type = String.fromCharCode(...png.subarray(at + 4, at + 8));

    if (type === "IDAT") chunks.push(png.subarray(at + 8, at + 8 + length));
    at += 12 + length;
  }

  const raw = inflateSync(Buffer.concat(chunks));
  const stride = width * channels;
  const rows: Uint8Array[] = [];

  for (let y = 0, at = 0; at < raw.length; y++, at += stride + 1) {
    const row = Uint8Array.from(raw.subarray(at + 1, at + 1 + stride));
    const up = rows[y - 1] ?? new Uint8Array(stride);

    for (let i = 0; i < stride; i++) {
      const a = i >= channels ? row[i - channels]! : 0;
      const b = up[i]!;
      const c = i >= channels ? up[i - channels]! : 0;
      const p = a + b - c;

      const nearest =
        Math.abs(p - a) <= Math.abs(p - b) && Math.abs(p - a) <= Math.abs(p - c)
          ? a
          : Math.abs(p - b) <= Math.abs(p - c)
            ? b
            : c;

      const add = [0, a, b, (a + b) >> 1, nearest][raw[at]!]!;

      row[i] = (row[i]! + add) & 255;
    }

    rows.push(row);
  }

  const at = (x: number, y: number): [number, number, number] => {
    const row = rows[y]!;

    return [row[x * channels]!, row[x * channels + 1]!, row[x * channels + 2]!];
  };

  return Object.assign(at, { width, height });
};

/** How many pixels of two same-size PNGs differ by more than `level` in any channel. */
export const differing = (a: Uint8Array, b: Uint8Array, level: number): number => {
  const [left, right] = [pixels(a), pixels(b)];

  if (left.width !== right.width || left.height !== right.height) return Infinity;
  let count = 0;

  for (let y = 0; y < left.height; y++)
    for (let x = 0; x < left.width; x++) {
      const [p, q] = [left(x, y), right(x, y)];

      if (p.some((value, i) => Math.abs(value - q[i]!) > level)) count++;
    }

  return count;
};

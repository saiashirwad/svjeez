import { deflateSync } from "node:zlib";
import { ease, motion, render } from "svjeez";

export const pngSize = (png: Uint8Array) => {
  const view = new DataView(png.buffer, png.byteOffset);

  return { width: view.getUint32(16), height: view.getUint32(20) };
};

export const solidPng = (
  width: number,
  height: number,
  [r, g, b]: [number, number, number],
): Uint8Array => {
  const crc = (bytes: Uint8Array) => {
    let c = 0xffffffff;

    for (const byte of bytes) {
      c ^= byte;

      for (let bit = 0; bit < 8; bit++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }

    return (c ^ 0xffffffff) >>> 0;
  };

  const chunk = (type: string, data: Uint8Array) => {
    const body = Buffer.concat([Buffer.from(type), data]);
    const out = Buffer.alloc(body.length + 8);
    out.writeUInt32BE(data.length, 0);
    body.copy(out, 4);
    out.writeUInt32BE(crc(body), body.length + 4);

    return out;
  };

  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.set([8, 2], 8);

  const row = Buffer.concat([
    Buffer.from([0]),
    Buffer.from(Array.from({ length: width }, () => [r, g, b]).flat()),
  ]);

  const pixels = Buffer.concat(Array.from({ length: height }, () => row));

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 13, 10, 26, 10]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(pixels)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
};

export const same = (a: Uint8Array, b: Uint8Array) => Buffer.from(a).equals(Buffer.from(b));

export const fade = render(
  { width: 40, height: 20, duration: 4, title: "Fade" },
  <rect
    width={40}
    height={20}
    fill="#3EE6D6"
    animation={motion({ opacity: 0 }).at(1).to({ opacity: 1 }, 1, ease.linear)}
  />,
);

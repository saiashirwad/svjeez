export const isText = (part: number | string): part is string => typeof part === "string";

export const bytes = (...parts: (number | string)[]): Uint8Array =>
  Uint8Array.from(
    parts.flatMap((part) => (isText(part) ? [...part].map((char) => char.charCodeAt(0)) : [part])),
  );

export const be32 = (n: number) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
export const le16 = (n: number) => [n & 255, (n >> 8) & 255];
export const le24 = (n: number) => [n & 255, (n >> 8) & 255, (n >> 16) & 255];
export const pad = (count: number) => Array.from({ length: count }, () => 0);

export const lossless = (width: number, height: number) => {
  const packed = (width - 1) | ((height - 1) << 14);

  return bytes(
    "RIFF",
    ...pad(4),
    "WEBPVP8L",
    ...pad(4),
    0x2f,
    ...be32(packed).reverse(),
    ...pad(8),
  );
};

export const fixtures = {
  png: bytes(
    0x89,
    "PNG\r\n",
    0x1a,
    0x0a,
    ...be32(13),
    "IHDR",
    ...be32(300),
    ...be32(200),
    8,
    6,
    0,
    0,
    0,
  ),
  jpeg: bytes(
    0xff,
    0xd8,
    0xff,
    0xe0,
    0,
    4,
    0,
    0,
    0xff,
    0xc0,
    0,
    17,
    8,
    0x00,
    0x96,
    0x01,
    0x2c,
    3,
    ...pad(9),
  ),
  gif: bytes("GIF89a", ...le16(40), ...le16(30), 0, 0, 0),
  webpLossy: bytes(
    "RIFF",
    ...pad(4),
    "WEBP",
    "VP8 ",
    ...pad(4),
    ...pad(3),
    0x9d,
    0x01,
    0x2a,
    ...le16(64),
    ...le16(48),
    ...pad(4),
  ),
  webpExtended: bytes(
    "RIFF",
    ...pad(4),
    "WEBPVP8X",
    ...pad(4),
    ...pad(4),
    ...le24(511),
    ...le24(255),
    ...pad(4),
  ),
};

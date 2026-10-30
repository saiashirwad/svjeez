import { describe, expect, test } from "bun:test";
import { picture } from "svjeez";
import { bytes, fixtures, lossless, pad } from "../helpers/picture-fixtures";

describe("picture", () => {
  test("reads each raster format's size from its header", () => {
    expect(picture(fixtures.png)).toMatchObject({ format: "png", width: 300, height: 200 });
    expect(picture(fixtures.jpeg)).toMatchObject({ format: "jpeg", width: 300, height: 150 });
    expect(picture(fixtures.gif)).toMatchObject({ format: "gif", width: 40, height: 30 });
    expect(picture(fixtures.webpLossy)).toMatchObject({ format: "webp", width: 64, height: 48 });
    expect(picture(lossless(99, 77))).toMatchObject({ format: "webp", width: 99, height: 77 });
    expect(picture(fixtures.webpExtended)).toMatchObject({
      format: "webp",
      width: 512,
      height: 256,
    });
  });

  test("a JPEG finds its size past other segments", () => {
    const app = [0xff, 0xe1, 0, 8, 1, 2, 3, 4, 5, 6];

    const file = bytes(
      0xff,
      0xd8,
      ...app,
      0xff,
      0xc4,
      0,
      4,
      0,
      0,
      0xff,
      0xc2,
      0,
      17,
      8,
      0,
      20,
      0,
      10,
      3,
      ...pad(9),
    );

    expect(picture(file)).toMatchObject({ format: "jpeg", width: 10, height: 20 });
  });

  test("raster bytes become a base64 data URI that round-trips", () => {
    const { href, bytes: cost } = picture(fixtures.png);
    expect(href.startsWith("data:image/png;base64,")).toBe(true);
    expect(cost).toBe(href.length);
    expect(Buffer.from(href.split(",")[1]!, "base64").equals(Buffer.from(fixtures.png))).toBe(true);
  });

  test("a large raster encodes without overflowing the call stack", () => {
    const big = new Uint8Array(3_000_000);
    big.set(fixtures.png);
    expect(picture(big).href.length).toBeGreaterThan(4_000_000);
  });

  test("SVG takes its size from width and height, else the viewBox", () => {
    expect(
      picture('<svg xmlns="http://www.w3.org/2000/svg" width="120px" height="80"><rect/></svg>'),
    ).toMatchObject({ format: "svg", width: 120, height: 80 });
    expect(picture('<?xml version="1.0"?><svg viewBox="0 0 24 12"/>')).toMatchObject({
      width: 24,
      height: 12,
    });
    expect(picture('<svg width="100%" viewBox="0 0 10 5"/>')).toMatchObject({
      width: 10,
      height: 5,
    });
  });

  test("a JPEG turned a quarter by its EXIF orientation reports the size the browser draws", () => {
    const exif = (orientation: number, little: boolean) => {
      const u16 = (n: number) => (little ? [n & 0xff, n >> 8] : [n >> 8, n & 0xff]);

      const tiff = [
        ...(little ? [0x49, 0x49] : [0x4d, 0x4d]),
        ...u16(42),
        ...(little ? [8, 0, 0, 0] : [0, 0, 0, 8]),
        ...u16(1),
        ...u16(0x0112),
        ...u16(3),
        ...(little ? [1, 0, 0, 0] : [0, 0, 0, 1]),
        ...u16(orientation),
        0,
        0,
        0,
        0,
        0,
        0,
      ];

      const app1 = [0x45, 0x78, 0x69, 0x66, 0, 0, ...tiff];

      return bytes(
        0xff,
        0xd8,
        0xff,
        0xe1,
        0,
        app1.length + 2,
        ...app1,
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
      );
    };

    expect(picture(exif(6, false))).toMatchObject({ width: 150, height: 300 });
    expect(picture(exif(8, true))).toMatchObject({ width: 150, height: 300 });
    expect(picture(exif(3, true))).toMatchObject({ width: 300, height: 150 });
  });

  test("an SVG with one side and a viewBox derives the other from the viewBox ratio", () => {
    expect(picture('<svg width="200" viewBox="0 0 20 10"/>')).toMatchObject({
      width: 200,
      height: 100,
    });
    expect(picture('<svg height="50" viewBox="0 0 20 10"/>')).toMatchObject({
      width: 100,
      height: 50,
    });
  });
});

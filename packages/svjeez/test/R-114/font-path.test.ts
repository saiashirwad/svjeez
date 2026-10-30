import { describe, expect, test } from "bun:test";
import { contours, pathData } from "../../src/font/glyf";
import { sans } from "../helpers/font";

describe("path", () => {
  test("returns one glyph per character, placed by advance, with the same width measure gives", () => {
    const run = sans.path("Wave", { size: 48, x: 10, y: 60 });
    expect(run.glyphs.map((glyph) => glyph.char)).toEqual(["W", "a", "v", "e"]);
    expect(run.glyphs[0]!.x).toBe(10);
    expect(run.glyphs[1]!.x).toBeCloseTo(10 + run.glyphs[0]!.advance, 6);
    expect(run.width).toBeCloseTo(sans.measure("Wave", 48), 6);
    expect(run.d).toBe(run.glyphs.map((glyph) => glyph.d).join(""));
  });

  test("outlines sit on the baseline and scale with size", () => {
    const ys = (d: string) =>
      [...d.matchAll(/-?\d+(?:\.\d+)? (-?\d+(?:\.\d+)?)/g)].map((m) => Number(m[1]));

    const small = ys(sans.path("H", { size: 10, y: 100 }).d);
    const big = ys(sans.path("H", { size: 100, y: 100 }).d);
    expect(Math.max(...small)).toBeCloseTo(100, 0);
    expect(100 - Math.min(...small)).toBeCloseTo(7, 0);
    expect(100 - Math.min(...big)).toBeCloseTo(70, 0);
  });

  test("a space has an advance and no outline", () => {
    const [, space] = sans.path("a b", { size: 20 }).glyphs;
    expect(space).toMatchObject({ char: " ", d: "" });
    expect(space!.advance).toBeGreaterThan(0);
  });

  test("a composite glyph such as é draws its base and its accent", () => {
    const contours = (d: string) => d.split("M").length - 1;
    expect(contours(sans.path("é", { size: 20 }).d)).toBeGreaterThan(
      contours(sans.path("e", { size: 20 }).d),
    );
  });

  test("a contour of only off-curve points closes through implied on-curve midpoints", () => {
    const ring = [
      { x: 0, y: 10, on: false },
      { x: 10, y: 0, on: false },
      { x: 0, y: -10, on: false },
      { x: -10, y: 0, on: false },
    ];

    expect(pathData([ring], 1, 0, 0)).toBe("M-5 -5Q0 -10 5 -5Q10 0 5 5Q0 10 -5 5Q-10 0 -5 -5Z");
  });

  test("composites that fan out exponentially throw instead of hanging", () => {
    const [fanout, levels] = [10, 9];
    const size = 10 + fanout * 6;
    const view = new DataView(new ArrayBuffer(256 + size * levels + 16));
    view.setInt16(50, 1);

    for (let g = 0; g <= levels + 1; g++) view.setUint32(64 + 4 * g, Math.min(g, levels) * size);

    for (let g = 0; g < levels; g++) {
      view.setInt16(256 + g * size, -1);

      for (let i = 0; i < fanout; i++) {
        const at = 256 + g * size + 10 + 6 * i;
        view.setUint16(at, (i < fanout - 1 ? 0x20 : 0) | 2);
        view.setUint16(at + 2, g + 1);
      }
    }

    const tables = new Map([
      ["head", 0],
      ["loca", 64],
      ["glyf", 256],
    ]);

    const lengths = new Map<string, number>();
    expect(() => contours({ view, tables, lengths }, 0)).toThrow("too many components");
  });

  test("needs a positive size", () => {
    expect(() => sans.path("a", { size: 0 })).toThrow("positive size");
  });
});

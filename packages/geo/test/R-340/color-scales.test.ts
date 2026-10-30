import { describe, expect, test } from "bun:test";
import { diverging, palettes, sequential } from "../../src/index.ts";

describe("scales", () => {
  const scale = sequential(["#000000", "#ffffff"], { domain: [0, 100], steps: 5 });

  test("cut the domain into classes and color each", () => {
    expect(scale.edges).toEqual([0, 20, 40, 60, 80, 100]);
    expect(scale.index(-5)).toBe(0);
    expect(scale.index(39)).toBe(1);
    expect(scale.index(100)).toBe(4);
    expect(scale.index(500)).toBe(4);
    expect(scale(10)).toBe(scale.colors[0]!);
    expect(scale(Number.NaN)).toBe(scale.empty);
  });

  test("blend lighter toward the high end", () => {
    const light = (hex: string) => parseInt(hex.slice(1, 3), 16);

    expect(light(scale.colors[0]!)).toBeLessThan(light(scale.colors[4]!));
  });

  test("diverging puts the middle color on the middle value", () => {
    const rb = diverging(palettes.redBlue, { domain: [-10, 0, 30], steps: 7 });

    expect(rb.index(0)).toBe(3);
    expect(rb.index(-10)).toBe(0);
    expect(rb.index(30)).toBe(6);
    expect(rb.colors[3]).toBe("#f7f7f7");
    expect(rb.edges[3]).toBeLessThan(0);
  });

  test("reject colors that can't be blended", () => {
    // SAFETY: the type already rejects "red"; the cast lets the test reach the runtime check for JavaScript callers.
    expect(() => sequential(["red", "#fff"] as never, { domain: [0, 1] })).toThrow(
      'A color scale needs hex colors such as "#1f77b4", got "red".',
    );
    expect(() => sequential(["#000", "#fff"], { domain: [1, 1] })).toThrow("domain that rises");
  });
});

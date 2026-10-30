import { describe, expect, test } from "bun:test";
import { ease } from "svjeez";
import { bend, nudge, rgbOf, scrub, withRgb } from "../../src/controls";

describe("gestures", () => {
  const p = { kind: "number", value: 5, min: 0, max: 30, step: 1 } as const;

  test("a full-width scrub crosses about the whole range, and a fine one a fifth of it", () => {
    expect(scrub(p, 0, 300)).toBe(30);
    expect(scrub(p, 0, 300, true)).toBe(6);
    expect(scrub(p, 5, -1000)).toBe(0);
  });

  test("a nudge moves one step, or ten", () => {
    expect(nudge(p, 5, 1)).toBe(6);
    expect(nudge(p, 5, -1, true)).toBe(0);
  });

  test("bending an ease keeps x in range and turns a named ease into a bezier", () => {
    expect(bend(ease.pop, 0, 1.4, -0.333)).toEqual(ease.bezier(1, -0.33, 0.64, 1));
    expect(bend(ease.linear, 1, 0.5, 0.5)).toEqual(ease.bezier(0, 0, 0.5, 0.5));
    expect(bend(ease.linear, 1, 0.5, 9)).toEqual(ease.bezier(0, 0, 0.5, 2.2));
    expect(bend(ease.linear, 0, 0.5, -9)).toEqual(ease.bezier(0.5, -0.8, 1, 1));
  });

  test("a color input's #rrggbb goes back in the case and alpha it came from", () => {
    expect(rgbOf("#ABC")).toBe("#aabbcc");
    expect(rgbOf("#181f2e8c")).toBe("#181f2e");
    expect(withRgb("#181f2e8c", "#ff0000")).toBe("#ff00008c");
    expect(withRgb("#3EE6D6", "#ff00aa")).toBe("#FF00AA");
  });
});

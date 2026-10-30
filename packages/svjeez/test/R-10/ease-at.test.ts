import { expect, test } from "bun:test";
import { ease, easeAt } from "svjeez";

test("linear returns its progress, clamped to the transition", () => {
  expect(easeAt(ease.linear, 0.3)).toBe(0.3);
  expect(easeAt(ease.linear, -1)).toBe(0);
  expect(easeAt(ease.linear, 2)).toBe(1);
});

test("a bezier starts at 0, ends at 1, and matches CSS's ease at its midpoint", () => {
  expect(easeAt(ease.inOut, 0)).toBeCloseTo(0, 6);
  expect(easeAt(ease.inOut, 1)).toBeCloseTo(1, 6);
  // CSS's `ease`, cubic-bezier(0.25, 0.1, 0.25, 1), is 0.8024 halfway.
  expect(easeAt(ease.bezier(0.25, 0.1, 0.25, 1), 0.5)).toBeCloseTo(0.8024, 3);
});

test("pop overshoots past 1 before it settles", () => {
  const peak = Math.max(...Array.from({ length: 101 }, (_, i) => easeAt(ease.pop, i / 100)));

  expect(peak).toBeGreaterThan(1.05);
  expect(easeAt(ease.pop, 1)).toBeCloseTo(1, 6);
});

test("steps jump at the end of each slice, and hold jumps only at the end", () => {
  expect(easeAt(ease.steps(4), 0.24)).toBe(0);
  expect(easeAt(ease.steps(4), 0.25)).toBe(0.25);
  expect(easeAt(ease.hold, 0.99)).toBe(0);
  expect(easeAt(ease.hold, 1)).toBe(1);
});

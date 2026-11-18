import { expect, test } from "bun:test";
import { foldKeys, type Key } from "../src/keys";
import { ease } from "../src/time";
import { cssKeyframes } from "../src/css";

const key = (t: number, x: number, y: number, e = ease.linear): Key => ({
  t,
  values: { x, y },
  ease: e,
});

test("folds stops on the time-linear line", () => {
  const keys = [key(0, 0, 0), key(1, 10, 5), key(2, 20, 10), key(4, 40, 20)];
  expect(foldKeys("translate", keys).map((k) => k.t)).toEqual([0, 4]);
});

test("keeps a stop that is collinear in space but off in time", () => {
  const keys = [key(0, 0, 0), key(1, 30, 0), key(2, 40, 0), key(3, 40, 0)];
  expect(foldKeys("translate", keys).map((k) => k.t)).toEqual([0, 1, 2, 3]);
  expect(foldKeys("translate", [key(0, 0, 0), key(1, 30, 0), key(2, 40, 0)]).length).toBe(3);
});

test("keeps non-linear easing and steps", () => {
  const keys = [key(0, 0, 0), key(1, 10, 0, ease.out), key(2, 20, 0)];
  expect(foldKeys("translate", keys).length).toBe(3);
  const hold = [key(0, 0, 0), key(1, 10, 0, ease.hold), key(2, 20, 0)];
  expect(foldKeys("translate", hold).length).toBe(3);
});

test("keeps drift beyond tolerance across a skipped run", () => {
  const keys = [key(0, 0, 0), key(1, 10, 0), key(2, 20.04, 0), key(3, 30, 0), key(4, 41, 0)];
  const out = foldKeys("translate", keys).map((k) => k.t);
  expect(out[0]).toBe(0);
  expect(out.at(-1)).toBe(4);
  expect(out.length).toBeGreaterThan(2);
});

test("leaves other lanes alone and emits fewer keyframes", () => {
  const keys = [key(0, 0, 0), key(1, 10, 5), key(2, 20, 10)];
  expect(foldKeys("opacity", keys)).toBe(keys);
  const body = cssKeyframes("translate", "value", keys, 2).body;
  expect(body).not.toContain("50%");
});

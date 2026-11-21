import { expect, test } from "bun:test";
import { Shape, ease, enter, rect, scene, span, track, type Curve } from "svjeez";
import { isLane, valueAt } from "svjeez/tools";

const blend = (a: number, b: number, k: number) => a + (b - a) * k;

const opacityOf = (curve: Curve) => {
  const { root } = scene({ size: [40, 40], duration: 2, title: "Curve" }, () => (
    <Shape
      key="box"
      geometry={rect(40, 40)}
      fill="#000000"
      opacity={track(0).to(1, span(0, 2), curve)}
    />
  ));

  if (root.kind !== "group" || root.children[0]?.kind !== "shape")
    throw new Error("expected a shape");
  const lane = root.children[0].layers[0]?.opacity;

  if (!lane || !isLane(lane)) throw new Error("expected an opacity lane");

  return lane;
};

const cubic = (a: number, b: number, u: number) =>
  3 * a * u * (1 - u) ** 2 + 3 * b * u * u * (1 - u) + u ** 3;

// The bezier's y at progress x, by bisection on its x curve.
const bezierAt = ([x1, y1, x2, y2]: readonly [number, number, number, number], x: number) => {
  let [lo, hi] = [0, 1];

  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;

    if (cubic(x1, x2, mid) < x) lo = mid;
    else hi = mid;
  }

  return cubic(y1, y2, (lo + hi) / 2);
};

test("a plain function is a curve, and matches the bezier it describes", () => {
  const points = [0.23, 1, 0.32, 1] as const;
  const fn = opacityOf((k) => bezierAt(points, k));
  const bez = opacityOf(ease.bezier(...points));

  for (let t = 0; t <= 2; t += 0.05)
    expect(Math.abs(valueAt(fn, t, blend) - valueAt(bez, t, blend))).toBeLessThan(2e-3);
});

test("a function curve with overshoot keeps its overshoot", () => {
  const lane = opacityOf((k) => 1 - Math.cos(k * Math.PI * 2.5) * (1 - k));
  let peak = 0;

  for (let t = 0; t <= 2; t += 0.01) peak = Math.max(peak, valueAt(lane, t, blend));

  expect(peak).toBeGreaterThan(1.1);
  expect(valueAt(lane, 2, blend)).toBe(1);
});

test("a function curve builds the same every time and leaves no code in the model", () => {
  const fn = (k: number) => k * k * (3 - 2 * k);

  expect(JSON.stringify(opacityOf(fn))).toBe(JSON.stringify(opacityOf(fn)));
  expect(JSON.stringify(opacityOf(fn))).not.toContain("=>");
});

test("a function curve works in enter(), and k => k is linear", () => {
  expect(enter(span(0, 1), { curve: (k) => k }).opacity).toBeDefined();
  expect(
    valueAt(
      opacityOf((k) => k),
      0.5,
      blend,
    ),
  ).toBeCloseTo(0.25, 6);
});

test("a function curve must run from 0 to 1", () => {
  expect(() => opacityOf((k) => k + 1)).toThrow("must return 0 at progress 0 and 1 at progress 1");
  expect(() => opacityOf(() => Number.NaN)).toThrow("finite");
});

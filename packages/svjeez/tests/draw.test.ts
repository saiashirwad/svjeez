import { describe, expect, test } from "bun:test";
import { blob, bounds, brush, circle, limb, line, scatter, type Vec } from "svjeez";

const apart = (a: Vec, b: Vec): number => Math.hypot(a[0] - b[0], a[1] - b[1]);

const pointCount = (geometry: ReturnType<typeof brush>): number =>
  geometry.kind === "path" ? geometry.contours.reduce((n, c) => n + c.curves.length, 0) : -1;

describe("brush", () => {
  test("spans its centerline and is as wide as asked", () => {
    const box = bounds(
      brush(
        [
          [0, 0],
          [100, 0],
        ],
        10,
      ),
    );

    // Round caps add half a width at each end; the smooth outline overshoots them by under a unit.
    expect(Math.abs(box.width - 110)).toBeLessThan(1);
    expect(Math.abs(box.height - 10)).toBeLessThan(0.5);
  });

  test("tapers from the first width to the last", () => {
    const shape = brush(
      [
        [0, 0],
        [100, 0],
      ],
      [20, 0],
    );

    const start = bounds(
      brush(
        [
          [0, 0],
          [1, 0],
        ],
        20,
      ),
    );

    expect(bounds(shape).height).toBeCloseTo(start.height, 0);
  });

  test("keeps the same outline size for any bend, so it can be sampled", () => {
    const straight = brush(
      [
        [0, 0],
        [50, 0],
        [100, 0],
      ],
      [8, 2],
    );

    const bent = brush(
      [
        [0, 0],
        [50, 40],
        [100, 0],
      ],
      [8, 2],
    );

    expect(pointCount(bent)).toBe(pointCount(straight));
  });

  test("refuses fewer than two points and negative widths", () => {
    expect(() => brush([[0, 0]], 4)).toThrow("two points or more");
    expect(() =>
      brush(
        [
          [0, 0],
          [1, 1],
        ],
        [-1],
      ),
    ).toThrow("widths of 0 or more");
  });
});

describe("blob", () => {
  test("is a closed shape around its points", () => {
    const shape = blob(
      [
        [0, 0],
        [40, 0],
        [40, 30],
        [0, 30],
      ],
      { round: 0 },
    );

    const box = bounds(shape);

    expect(box.width).toBeCloseTo(40, 5);
    expect(box.height).toBeCloseTo(30, 5);
    expect(shape.kind === "path" && shape.contours[0]!.closed).toBe(true);
  });

  test("refuses fewer than three points", () => {
    expect(() =>
      blob([
        [0, 0],
        [1, 1],
      ]),
    ).toThrow("three points or more");
  });
});

describe("limb", () => {
  test("two bones keep their lengths and land on the target", () => {
    const [root, knee, tip] = limb([0, 0], [30, 30], [40, 10]);

    expect(apart(root!, knee!)).toBeCloseTo(30, 1);
    expect(apart(knee!, tip!)).toBeCloseTo(30, 1);
    expect(apart(tip!, [40, 10])).toBeLessThan(0.02);
  });

  test("bend picks the side the joint bows to", () => {
    const right = limb([0, 0], [30, 30], [40, 0], { bend: 1 })[1]!;
    const left = limb([0, 0], [30, 30], [40, 0], { bend: -1 })[1]!;

    expect(right[1]).toBeGreaterThan(0);
    expect(left[1]).toBeLessThan(0);
  });

  test("three bones reach the target with every bone its own length", () => {
    const joints = limb([0, 0], [20, 20, 20], [30, 25]);

    expect(joints).toHaveLength(4);

    for (let i = 0; i < 3; i++) expect(apart(joints[i]!, joints[i + 1]!)).toBeCloseTo(20, 1);

    expect(apart(joints[3]!, [30, 25])).toBeLessThan(0.05);
  });

  test("points straight at a target out of reach", () => {
    const [, knee, tip] = limb([0, 0], [10, 10], [100, 0]);

    expect(knee).toEqual([10, 0]);
    expect(tip).toEqual([20, 0]);
  });
});

describe("scatter", () => {
  const dot = blob([
    [0, -1],
    [1, 0],
    [0, 1],
    [-1, 0],
  ]);

  test("places one copy per count along the line", () => {
    const shape = scatter(dot, { along: line([0, 0], [100, 0]), count: 5 });

    expect(shape.kind === "path" && shape.contours.length).toBe(5);
    expect(bounds(shape).width).toBeCloseTo(82, 0);
  });

  test("the same seed scatters the same way", () => {
    const options = { along: circle(20), count: 6, jitter: 0.6, seed: "leaves" };

    expect(scatter(dot, options)).toEqual(scatter(dot, options));
  });

  test("refuses a count below one and a jitter outside 0..1", () => {
    expect(() => scatter(dot, { along: line([0, 0], [1, 0]), count: 0 })).toThrow("count of 1");
    expect(() => scatter(dot, { along: line([0, 0], [1, 0]), count: 2, jitter: 2 })).toThrow(
      "jitter",
    );
  });
});

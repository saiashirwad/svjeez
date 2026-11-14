import { describe, expect, test } from "bun:test";
import { polylinePath, resample } from "svjeez";

describe("resample", () => {
  test("spaces points evenly along the runs, keeping both ends", () => {
    const points = resample(
      [
        { x: 0, y: 0 },
        { x: 30, y: 0 },
        { x: 30, y: 10 },
      ],
      5,
    );

    expect(points).toEqual([
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 20, y: 0 },
      { x: 30, y: 0 },
      { x: 30, y: 10 },
    ]);
  });

  test("needs two points and a whole count of 2 or more", () => {
    expect(() => resample([{ x: 0, y: 0 }], 4)).toThrow("at least two points, got 1");
    expect(() =>
      resample(
        [
          { x: 0, y: 0 },
          { x: 1, y: 1 },
        ],
        1.5,
      ),
    ).toThrow("got 1.5");
  });
});

describe("polylinePath", () => {
  test("writes M then L to each point, rounded to one place by default", () => {
    expect(
      polylinePath([
        { x: 0, y: 0 },
        { x: 10.04, y: -2.36 },
      ]),
    ).toBe("M0 0L10 -2.4");
  });

  test("closes the shape and keeps more places when asked", () => {
    expect(
      polylinePath(
        [
          { x: 0.123, y: 0 },
          { x: 1, y: 1 },
        ],
        { closed: true, precision: 2 },
      ),
    ).toBe("M0.12 0L1 1Z");
  });
});

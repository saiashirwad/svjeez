import { describe, expect, test } from "bun:test";
import { resample } from "svjeez";

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

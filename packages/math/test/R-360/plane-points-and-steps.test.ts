import { describe, expect, test } from "bun:test";
import { plane } from "../../src/index";
import { base, shear } from "../helpers/plane";

describe("plane", () => {
  test("point() puts (0, 0) at the origin, with y up", () => {
    expect(base.point(0, 0)).toEqual({ x: 200, y: 150 });
    expect(base.point(1, 2)).toEqual({ x: 220, y: 110 });
  });

  test("steps compose: map() follows each matrix in order, and reset() returns home", () => {
    const rotate = shear.apply(
      [
        [0, -1],
        [1, 0],
      ],
      { at: 3, over: 1 },
    );

    expect(shear.map(0, 1)).toEqual(base.point(1, 1));
    expect(rotate.map(0, 1)).toEqual(base.point(-1, 1));
    expect(rotate.reset({ at: 5, over: 1 }).map(0, 1)).toEqual(base.point(0, 1));
  });

  test("errors name the fix", () => {
    expect(() =>
      shear.apply(
        [
          [1, 0],
          [0, 1],
        ],
        { at: 2, over: 1 },
      ),
    ).toThrow("A plane step starts at 2s, before the previous step ends at 3s.");
    expect(() => plane({ origin: { x: 0, y: 0 }, unit: 0 })).toThrow(
      "plane() needs a finite origin",
    );
  });
});

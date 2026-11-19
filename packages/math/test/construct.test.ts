import { describe, expect, test } from "bun:test";
import {
  angle,
  bisect,
  brace,
  compass,
  crossings,
  distance,
  extend,
  foot,
  meet,
  midpoint,
  rightAngle,
  ticks,
} from "../src/index.ts";

const close = (a: readonly number[], b: readonly number[]) =>
  a.forEach((n, i) => expect(n).toBeCloseTo(b[i]!));

describe("constructions", () => {
  test("two circles through each other's centers meet at the apex of an equilateral triangle", () => {
    const [a, b] = [
      [0, 0],
      [100, 0],
    ] as const;

    const [up, down] = crossings({ center: a, radius: 100 }, { center: b, radius: 100 });

    close(up!, [50, -50 * Math.sqrt(3)]);
    close(down!, [50, 50 * Math.sqrt(3)]);
    expect(crossings({ center: a, radius: 10 }, { center: b, radius: 10 })).toEqual([]);
  });

  test("a line crosses a circle twice", () => {
    const hits = crossings({ center: [0, 0], radius: 5 }, [
      [-10, 3],
      [10, 3],
    ]);

    close(hits[0]!, [-4, 3]);
    close(hits[1]!, [4, 3]);
  });

  test("meet() finds where two lines cross, and refuses parallels", () => {
    close(
      meet(
        [
          [0, 0],
          [2, 2],
        ],
        [
          [0, 2],
          [2, 0],
        ],
      ),
      [1, 1],
    );
    expect(() =>
      meet(
        [
          [0, 0],
          [1, 0],
        ],
        [
          [0, 1],
          [1, 1],
        ],
      ),
    ).toThrow("runs parallel");
  });

  test("bisect, foot, midpoint, extend and distance", () => {
    close(bisect([10, 0], [0, 0], [0, 10]), [Math.SQRT1_2, Math.SQRT1_2]);
    close(foot([3, 5], [0, 0], [10, 0]), [3, 0]);
    close(midpoint([0, 0], [4, 2]), [2, 1]);
    close(extend([0, 0], [3, 4], 5), [6, 8]);
    expect(distance([0, 0], [3, 4])).toBe(5);
  });

  test("marks build as geometry, and bad input says what it needs", () => {
    expect(compass([0, 0], [10, 0])).toBeDefined();
    expect(angle([10, 0], [0, 0], [0, 10])).toBeDefined();
    expect(rightAngle([10, 0], [0, 0], [0, 10])).toBeDefined();
    expect(ticks([0, 0], [10, 0], { count: 2 })).toBeDefined();
    expect(brace(40)).toBeDefined();
    expect(() => compass([1, 1], [1, 1])).toThrow("compass() needs a point away from its center");
    expect(() => brace(0)).toThrow("brace() needs a width and height above 0");
  });
});

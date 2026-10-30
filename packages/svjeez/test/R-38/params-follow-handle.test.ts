import { describe, expect, test } from "bun:test";
import { follow, number } from "svjeez/params";

describe("params", () => {
  test("a drag moves a value as far as it carries the value's handle, along the way the handle goes", () => {
    const length = number(100, { min: 50, max: 200, step: 1 });
    const below = (v: number) => ({ x: 240, y: 40 + v });

    expect(follow(length, below, 100, { x: 30, y: 12 })).toBeCloseTo(112);
    expect(follow(length, below, 100, { x: 0, y: 500 })).toBe(200);

    const angle = number(30, { min: 0, max: 90, step: 1 });

    const rim = (deg: number) => ({
      x: 100 * Math.sin((deg * Math.PI) / 180),
      y: 100 * Math.cos((deg * Math.PI) / 180),
    });

    let v = 30;

    for (let deg = 30; deg < 60; deg += 0.5) {
      const [from, to] = [rim(deg), rim(deg + 0.5)];

      v = follow(angle, rim, v, { x: to.x - from.x, y: to.y - from.y });
    }

    expect(v).toBeCloseTo(60, 1);
    expect(follow(angle, () => ({ x: 0, y: 0 }), 30, { x: 5, y: 5 })).toBe(30);
  });
});

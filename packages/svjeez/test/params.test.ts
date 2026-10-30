import { describe, expect, test } from "bun:test";
import { ease } from "svjeez";
import {
  choice,
  color,
  count,
  defaults,
  easing,
  fit,
  fitValues,
  follow,
  number,
  positionOf,
  seconds,
  valueAt,
  withValues,
  type Handles,
} from "svjeez/params";

const params = {
  flowers: count(5, { min: 1, max: 12, label: "how many" }),
  stagger: seconds(0.18, { max: 0.4 }),
  petal: color("#FF5D8F"),
  rise: easing(ease.bezier(0.2, 0.8, 0.2, 1)),
  fur: choice("ginger", ["ginger", "grey"]),
};

describe("params", () => {
  test("defaults are every declared value, typed by kind", () => {
    const p = defaults(params);
    const fur: "ginger" | "grey" = p.fur;

    expect(p).toEqual({
      flowers: 5,
      stagger: 0.18,
      petal: "#FF5D8F",
      rise: ease.bezier(0.2, 0.8, 0.2, 1),
      fur,
    });
  });

  test("a schema is plain data that survives a structured clone", () => {
    expect(structuredClone(params)).toEqual(params);
  });

  test("count and seconds fill in their own step, floor and unit", () => {
    expect(params.flowers).toMatchObject({ kind: "number", min: 1, max: 12, step: 1 });
    expect(params.stagger).toMatchObject({ min: 0, max: 0.4, step: 0.01, unit: "s" });
  });

  test("a value outside its range, a fractional count or an unknown choice throws", () => {
    expect(() => count(13, { max: 12 })).toThrow("count(13) is outside its range 0 to 12.");
    expect(() => count(1.5, { max: 12 })).toThrow("count(1.5) needs a whole number.");
    expect(() => number(1, { min: 2, max: 1 })).toThrow("needs min below max");
    expect(() => number(1, { min: 0, max: 2, scale: "log" })).toThrow("min must be positive");
    // @ts-expect-error "blue" is not an option
    expect(() => choice("blue", ["ginger", "grey"])).toThrow('choice("blue") is not one of');
  });

  test("fit clamps and rounds to the step without float dust", () => {
    expect(fit(params.stagger, 0.1234)).toBe(0.12);
    expect(fit(params.stagger, 9)).toBe(0.4);
    expect(fit(params.flowers, 0)).toBe(1);
    expect(fit(number(0.3, { min: 0.04, max: 0.6, step: 0.02 }), 0.325)).toBe(0.32);
  });

  test("fitValues fits only the numbers a patch carries", () => {
    expect(fitValues(params, { flowers: 30, petal: "#000000" })).toEqual({
      flowers: 12,
      petal: "#000000",
    });
  });

  test("withValues gives each param its current value and keeps the rest of it", () => {
    const now = withValues(params, { ...defaults(params), flowers: 7, fur: "grey" });

    expect(now.flowers).toEqual({ ...params.flowers, value: 7 });
    expect(now.fur).toEqual({ ...params.fur, value: "grey" });
    expect(now.petal).toEqual(params.petal);
  });

  test("a log slider gives small values as much room as large ones", () => {
    const circles = count(24, { min: 1, max: 400, scale: "log" });

    expect(valueAt(circles, 0)).toBe(1);
    expect(valueAt(circles, 1)).toBe(400);
    expect(valueAt(circles, 0.5)).toBe(20);
    expect(valueAt(circles, positionOf(circles, 24))).toBe(24);
    expect(positionOf(params.flowers, 12)).toBe(1);
  });

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

  test("handles are typed by the schema: only number params, read from every value", () => {
    const schema = {
      length: number(100, { min: 50, max: 200 }),
      fur: choice("ginger", ["ginger", "grey"]),
    };

    const handles: Handles<typeof schema> = (p) => ({ length: { x: 0, y: p.length } });

    // @ts-expect-error a choice has no handle
    const wrong: Handles<typeof schema> = () => ({ fur: { x: 0, y: 0 } });

    expect(handles(defaults(schema)).length).toEqual({ x: 0, y: 100 });
    expect(wrong).toBeFunction();
  });
});

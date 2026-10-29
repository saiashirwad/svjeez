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
  number,
  positionOf,
  seconds,
  valueAt,
  withValues,
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
});

import { describe, expect, test } from "bun:test";
import {
  count,
  defaults,
  fit,
  fitValues,
  number,
  positionOf,
  valueAt,
  withValues,
} from "svjeez/params";
import { params } from "../helpers/timeline-params";

describe("params", () => {
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

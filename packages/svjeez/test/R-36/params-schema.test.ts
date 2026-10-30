import { describe, expect, test } from "bun:test";
import { ease } from "svjeez";
import { choice, count, defaults, number } from "svjeez/params";
import { params } from "../helpers/timeline-params";

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
});

import { describe, expect, test } from "bun:test";
import { ease } from "svjeez";
import {
  choice,
  color,
  count,
  defaults,
  easing,
  number,
  seconds,
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

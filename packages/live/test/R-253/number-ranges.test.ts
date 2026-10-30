import { describe, expect, test } from "bun:test";
import { count } from "svjeez/params";
import { paramFor } from "../../src/controls";
import { paramLiteral, parse } from "../../src/source";
import { meadow, numbers } from "../helpers/live-source";

const number = (text: string, at = 0) => {
  const found = numbers(text)[at];

  if (!found) throw new Error(`no number ${at} in ${text}`);

  return found;
};

describe("paramFor", () => {
  test("a declared number drags in its declared range", () => {
    const flowers = paramLiteral(parse(meadow), "flowers");

    if (flowers?.kind !== "number") throw new Error("meadow declares flowers with a number");

    expect(
      paramFor(flowers, { flowers: count(5, { min: 1, max: 12, label: "how many" }) }),
    ).toMatchObject({ min: 1, max: 12, step: 1, label: "how many" });
  });

  test("svjeez's own names say what a bare number means", () => {
    expect(paramFor(number("<rect opacity={1} />"))).toMatchObject({ min: 0, max: 1, step: 0.01 });
    expect(paramFor(number("<g rotate={-30} />"))).toMatchObject({
      min: -360,
      max: 360,
      unit: "°",
    });
    expect(paramFor(number("draw({ at: 0.2, over: 1.2 })", 1))).toMatchObject({
      min: 0,
      unit: "s",
    });
    expect(paramFor(number("m.at(2).to({ x: 9 }, 0.6)", 2))).toMatchObject({ min: 0, unit: "s" });
    expect(paramFor(number("<circle r={16.5} />"))).toMatchObject({ min: 0, max: 33, step: 0.1 });
  });

  test("any other number gets room on both sides, zero and negatives included", () => {
    for (const v of ["0", "-400", "7"]) {
      const p = paramFor(number(`const k = ${v};`));

      expect(p.min).toBeLessThan(Number(v));
      expect(p.max).toBeGreaterThan(Number(v));
      expect(p.step).toBe(1);
    }
  });
});

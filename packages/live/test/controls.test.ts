import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { ease } from "svjeez";
import { choice, count } from "svjeez/params";
import { bend, nudge, paramFor, rgbOf, scrub, valuesOf, withRgb } from "../src/controls";
import { paramLiteral, parse } from "../src/source";

const meadow = readFileSync(new URL("../../../site/src/lab/a/meadow.tsx", import.meta.url), "utf8");

const number = (text: string, at = 0) => {
  const found = parse(text).literals.filter((l) => l.kind === "number")[at];

  if (found?.kind !== "number") throw new Error(`no number ${at} in ${text}`);

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

describe("valuesOf", () => {
  const scene = `export const params = {
  look: choice("circle", ["circle", "square"]),
  n: count(3, { min: 1, max: 9 }),
};
export default () => <rect fill="#3EE6D6" opacity={0.5} label="hi" animation={enter({ at: 1 }, {}, ease.pop)} />;
`;

  const schema = {
    look: choice("circle", ["circle", "square"]),
    n: count(3, { min: 1, max: 9 }),
  };

  test("every number, color and ease is a value, a choice's string is one, other strings and options are not", () => {
    expect(valuesOf(parse(scene), schema).map((v) => [v.key, v.kind])).toEqual([
      ["params.look", "choice"],
      ["params.n", "number"],
      ["default#0", "color"],
      ["default#1", "number"],
      ["default#3", "number"],
      ["default#4", "ease"],
    ]);
  });

  test("a choice lists its options", () => {
    expect(valuesOf(parse(scene), schema)[0]).toMatchObject({ options: ["circle", "square"] });
  });

  test("a choice string is plain text until the schema says it is a choice", () => {
    expect(valuesOf(parse(scene)).some((v) => v.kind === "choice")).toBe(false);
  });
});

describe("gestures", () => {
  const p = { kind: "number", value: 5, min: 0, max: 30, step: 1 } as const;

  test("a full-width scrub crosses about the whole range, and a fine one a fifth of it", () => {
    expect(scrub(p, 0, 300)).toBe(30);
    expect(scrub(p, 0, 300, true)).toBe(6);
    expect(scrub(p, 5, -1000)).toBe(0);
  });

  test("a nudge moves one step, or ten", () => {
    expect(nudge(p, 5, 1)).toBe(6);
    expect(nudge(p, 5, -1, true)).toBe(0);
  });

  test("bending an ease keeps x in range and turns a named ease into a bezier", () => {
    expect(bend(ease.pop, 0, 1.4, -0.333)).toEqual(ease.bezier(1, -0.33, 0.64, 1));
    expect(bend(ease.linear, 1, 0.5, 0.5)).toEqual(ease.bezier(0, 0, 0.5, 0.5));
    expect(bend(ease.linear, 1, 0.5, 9)).toEqual(ease.bezier(0, 0, 0.5, 2.2));
    expect(bend(ease.linear, 0, 0.5, -9)).toEqual(ease.bezier(0.5, -0.8, 1, 1));
  });

  test("a color input's #rrggbb goes back in the case and alpha it came from", () => {
    expect(rgbOf("#ABC")).toBe("#aabbcc");
    expect(rgbOf("#181f2e8c")).toBe("#181f2e");
    expect(withRgb("#181f2e8c", "#ff0000")).toBe("#ff00008c");
    expect(withRgb("#3EE6D6", "#ff00aa")).toBe("#FF00AA");
  });
});

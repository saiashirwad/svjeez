import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { costOf } from "../scripts/cost";

// The scene-model examples may not grow: a change that writes more bytes, elements, keyframes or animations for the
// same scene fails here. Bytes leave out the embedded font, whose subset follows the text. Each budget is a little over
// what the file is now; lower it when a change makes the file smaller.
interface Budget {
  readonly bytes: number;
  readonly elements: number;
  readonly stops: number;
  readonly smil: number;
  readonly cost: number;
}

const budgets = {
  "readme/basic": { bytes: 1700, elements: 7, stops: 4, smil: 0, cost: 2 },
  "readme/loops": { bytes: 2450, elements: 7, stops: 20, smil: 0, cost: 3 },
  "readme/motion": { bytes: 1700, elements: 6, stops: 5, smil: 0, cost: 2 },
  clips: { bytes: 5100, elements: 35, stops: 16, smil: 0, cost: 6 },
  geometry: { bytes: 7800, elements: 19, stops: 11, smil: 5, cost: 9 },
  springs: { bytes: 8400, elements: 28, stops: 60, smil: 0, cost: 4 },
  layout: { bytes: 11000, elements: 43, stops: 80, smil: 0, cost: 15 },
  morph: { bytes: 10000, elements: 32, stops: 48, smil: 6, cost: 37 },
  derived: { bytes: 9300, elements: 21, stops: 46, smil: 1, cost: 5 },
  type: { bytes: 3900, elements: 35, stops: 20, smil: 0, cost: 10 },
  paint: { bytes: 8800, elements: 52, stops: 18, smil: 14, cost: 14 },
} satisfies Record<string, Budget>;

/** What a file costs to send and to play. */
const measure = (svg: string): Budget => {
  const tags = [...svg.matchAll(/<([a-zA-Z]+)[\s>/]/g)].map((match) => match[1]!);
  const smil = tags.filter((tag) => tag === "animate" || tag === "set").length;

  return {
    bytes: svg.replace(/@font-face\{[^}]*\}/g, "").length,
    elements: tags.length - smil,
    stops: [...svg.matchAll(/@keyframes [\w-]+\{((?:[^{}]*\{[^}]*\})*)\}/g)].reduce(
      (sum, match) => sum + (match[1]!.match(/\{/g) ?? []).length,
      0,
    ),
    smil,
    cost: costOf(svg),
  };
};

describe("scene examples stay small", () => {
  for (const [name, budget] of Object.entries(budgets))
    test(`${name} fits its budget`, () => {
      const svg = readFileSync(join(import.meta.dir, "..", "dist", `${name}.svg`), "utf8");
      const found = measure(svg);

      expect(found.bytes).toBeLessThanOrEqual(budget.bytes);
      expect(found.elements).toBeLessThanOrEqual(budget.elements);
      expect(found.stops).toBeLessThanOrEqual(budget.stops);
      expect(found.smil).toBeLessThanOrEqual(budget.smil);
      expect(found.cost).toBeLessThanOrEqual(budget.cost);
    });
});

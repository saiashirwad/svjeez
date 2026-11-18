import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { costOf } from "../scripts/cost";

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
  count: { bytes: 16600, elements: 49, stops: 170, smil: 0, cost: 26 },
  type: { bytes: 3900, elements: 35, stops: 20, smil: 0, cost: 10 },
  icons: { bytes: 10350, elements: 33, stops: 48, smil: 0, cost: 24 },
  charts: { bytes: 15500, elements: 96, stops: 76, smil: 0, cost: 38 },
  paint: { bytes: 8800, elements: 52, stops: 18, smil: 14, cost: 14 },
  epicycles: { bytes: 45200, elements: 145, stops: 119, smil: 0, cost: 84 },
  escapement: { bytes: 51500, elements: 143, stops: 128, smil: 0, cost: 49 },
  code: { bytes: 11600, elements: 152, stops: 32, smil: 0, cost: 23 },
  globe: { bytes: 440000, elements: 80, stops: 210, smil: 14, cost: 30 },
  math: { bytes: 24000, elements: 48, stops: 20, smil: 0, cost: 13 },
  flowchart: { bytes: 14600, elements: 74, stops: 110, smil: 0, cost: 52 },
  sequence: { bytes: 12100, elements: 79, stops: 79, smil: 0, cost: 39 },
  mermaid: { bytes: 15400, elements: 78, stops: 130, smil: 0, cost: 56 },
  state: { bytes: 13100, elements: 86, stops: 55, smil: 0, cost: 9 },
  lanes: { bytes: 20100, elements: 97, stops: 104, smil: 28, cost: 62 },
} satisfies Record<string, Budget>;

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

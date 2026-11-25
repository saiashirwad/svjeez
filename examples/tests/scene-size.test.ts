import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { costOf } from "svjeez/frames";

interface Budget {
  readonly bytes: number;
  readonly elements: number;
  readonly stops: number;
  readonly smil: number;
  readonly cost: number;
}

const budgets = {
  "readme/hero": { bytes: 32500, elements: 80, stops: 240, smil: 8, cost: 34 },
  "readme/basic": { bytes: 1600, elements: 7, stops: 4, smil: 0, cost: 2 },
  "readme/loops": { bytes: 2200, elements: 7, stops: 20, smil: 0, cost: 3 },
  "readme/motion": { bytes: 1600, elements: 6, stops: 5, smil: 0, cost: 2 },
  clocks: { bytes: 4700, elements: 33, stops: 20, smil: 0, cost: 10 },
  "gpu-card": { bytes: 13550, elements: 86, stops: 6, smil: 0, cost: 9 },
  clips: { bytes: 4300, elements: 30, stops: 16, smil: 0, cost: 6 },
  geometry: { bytes: 6850, elements: 19, stops: 10, smil: 5, cost: 8.8 },
  springs: { bytes: 7500, elements: 28, stops: 54, smil: 0, cost: 4 },
  layout: { bytes: 9850, elements: 37, stops: 71, smil: 0, cost: 13 },
  morph: { bytes: 7750, elements: 29, stops: 38, smil: 6, cost: 31.7 },
  derived: { bytes: 8800, elements: 19, stops: 43, smil: 1, cost: 4 },
  count: { bytes: 15350, elements: 49, stops: 170, smil: 0, cost: 26 },
  type: { bytes: 6400, elements: 34, stops: 100, smil: 0, cost: 9 },
  icons: { bytes: 9300, elements: 32, stops: 36, smil: 0, cost: 18 },
  charts: { bytes: 15050, elements: 98, stops: 70, smil: 0, cost: 35 },
  paint: { bytes: 8400, elements: 50, stops: 15, smil: 14, cost: 17.4 },
  epicycles: { bytes: 44550, elements: 145, stops: 119, smil: 0, cost: 84 },
  escapement: { bytes: 50850, elements: 140, stops: 122, smil: 0, cost: 48 },
  code: { bytes: 8100, elements: 98, stops: 25, smil: 1, cost: 12 },
  globe: { bytes: 435850, elements: 79, stops: 207, smil: 14, cost: 42.5 },
  math: { bytes: 22600, elements: 48, stops: 18, smil: 0, cost: 12 },
  flowchart: { bytes: 15000, elements: 74, stops: 105, smil: 0, cost: 39 },
  sequence: { bytes: 11300, elements: 79, stops: 52, smil: 0, cost: 30 },
  state: { bytes: 14400, elements: 86, stops: 95, smil: 0, cost: 9 },
  lanes: { bytes: 19050, elements: 97, stops: 76, smil: 28, cost: 47.2 },
} satisfies Record<string, Budget>;

// Scenes change all the time; the budgets only catch a blowup, so each number may grow by a quarter before a test fails.
const SLACK = 1.25;

const measure = (svg: string): Budget => {
  const cost = costOf(svg);
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
    cost: Math.round((cost.animations + cost.repaint) * 10) / 10,
  };
};

describe("scene examples stay small", () => {
  for (const [name, budget] of Object.entries(budgets))
    test(`${name} fits its budget`, () => {
      const svg = readFileSync(join(import.meta.dir, "..", "dist", `${name}.svg`), "utf8");
      const found = measure(svg);

      // SAFETY: every budget is a Budget literal, so its keys are exactly Budget's.
      for (const key of Object.keys(budget) as (keyof Budget)[])
        expect(found[key], key).toBeLessThanOrEqual(budget[key] * SLACK);
    });
});

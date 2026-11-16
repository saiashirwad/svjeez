import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { costOf } from "../scripts/cost";

// Chrome ticks every running animation on every frame, so a recording that runs more of them plays worse on a weak
// machine. These are the @svjeez/dom recordings, with about 15% of room over what they run now.
const budget = { dom: 280, logseq: 76, "live-story": 160, demos: 300, "svelte-demos": 66 };

for (const [name, max] of Object.entries(budget))
  test(`${name} runs at most ${max} animations per frame`, () => {
    const svg = readFileSync(join(import.meta.dir, "..", "dist", `${name}.svg`), "utf8");

    expect(costOf(svg)).toBeLessThanOrEqual(max);
  });

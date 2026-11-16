import { afterAll, beforeAll, describe, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { chromium, firefox, webkit, type Browser, type BrowserType, type Page } from "playwright-core";
import { loopLength, seek } from "svjeez/page";

// Every example SVG must play and seek the same in Chromium, Firefox and WebKit (Safari's engine). Each file is loaded
// inline, paused, and set to the same scene times in each engine, forward and then backward: some spread over the loop,
// some just before, inside and after every SMIL window, and some in the second loop. At each time, every element with a
// SMIL or CSS animation reports its box, opacity, visibility and transforms, and each engine is compared to Chromium.
//
// Locally an engine that isn't installed is skipped. In CI it fails. Install them inside packages/svjeez with
//   bun run playwright-core install --with-deps chromium-headless-shell firefox webkit

const DIST = join(import.meta.dir, "..", "dist");
const ENGINES = { chromium, firefox, webkit } as const;
type Engine = keyof typeof ENGINES;

const GEOMETRY = 1;
const OPACITY = 0.02;
const BLUR = 0.1;

/** Room on a box beyond a pixel, as a share of its size: text is shaped by each engine's own rasterizer and fallback font. */
const TEXT = 0.2;
const CURVES = 0.02;

/** How many scene times one file is checked at, and how many pages one browser works on at once. */
const TIMES = 60;
const PAGES = 4;

/**
 * Files that differ across engines for a reason that isn't timing, as "engine file": the props left out of that file's
 * comparison, and why. Each one must say why.
 */
const DIFFERS: Record<string, { props: string[]; why: string }> = {};

const files = [...new Bun.Glob("**/*.svg").scanSync(DIST)].sort();

type Value = number | string | null;
type Snapshot = Record<string, Value>;
type Run = { times: number[]; labels: string[]; texty: string[]; forward: Snapshot[]; backward: Snapshot[] };

/** Runs in the page: the scene times to check, from the SMIL windows in the file. */
const plan = ([loopSrc, count]: [string, number]): number[] => {
  const loop = (0, eval)(`(${loopSrc})`)(document) as number;
  const marks = new Set<number>();
  const add = (time: number) => time >= 0 && marks.add(Math.round(time * 1000) / 1000);

  for (const element of document.querySelectorAll("animate, animateTransform, animateMotion, set")) {
    const begin = parseFloat(element.getAttribute("begin") ?? "0") || 0;
    const dur = parseFloat(element.getAttribute("dur") ?? "0") || 0;

    for (const lap of [0, loop]) {
      add(begin + lap - 0.04);
      add(begin + lap + Math.max(dur / 2, 0.002));
      add(begin + lap + dur + 0.04);
    }
  }

  for (let k = 0; k < 8; k++) add((loop * k) / 8 + 0.013);
  for (let k = 0; k < 4; k++) add(loop + (loop * k) / 4 + 0.007);
  add(0);
  add(loop - 0.04);
  add(loop);
  add(loop + 0.04);
  add(loop * 2 - 0.04);

  const all = [...marks].sort((a, b) => a - b);

  if (all.length <= count) return all;

  // Evenly through the sorted list, keeping the first and last.
  const picked = Array.from({ length: count }, (_, k) => all[Math.round((k * (all.length - 1)) / (count - 1))]!);

  return picked.filter((time, k) => picked.indexOf(time) === k);
};

/** Runs in the page: set each time with seek, forward then backward, and read every animated element at each. */
const probe = ([seekSrc, times]: [string, number[]]) => {
  const seekTo = (0, eval)(`(${seekSrc})`) as (time: number) => void;
  const targets = new Set<Element>();

  for (const element of document.querySelectorAll("animate, animateTransform, animateMotion, set")) {
    const href = element.getAttribute("href") ?? element.getAttribute("xlink:href");
    const target = href ? document.getElementById(href.slice(1)) : element.parentElement;

    if (target) targets.add(target);
  }

  for (const animation of document.getAnimations()) {
    const target = animation.effect instanceof KeyframeEffect ? animation.effect.target : null;

    if (target) targets.add(target);
  }

  const all = [...document.querySelectorAll("*")];
  const list = [...targets].sort((a, b) => all.indexOf(a) - all.indexOf(b));
  const labels = list.map((element) => `${element.tagName}${element.id ? "#" + element.id : ""}[${all.indexOf(element)}]`);
  const round = (n: number) => Math.round(n * 100) / 100;

  const read = (): Snapshot => {
    const snapshot: Snapshot = {};

    list.forEach((element, k) => {
      const key = labels[k]!;
      const style = getComputedStyle(element);

      // Elements in a mask aren't laid out on their own, and Firefox gives its percentages no size.
      const unlaidOut = element.closest("mask") !== null;

      try {
        if (unlaidOut) throw new Error("no box");
        const box = (element as SVGGraphicsElement).getBBox();

        // An empty box has no position worth comparing: Chromium keeps where it is, Firefox and WebKit say 0 0.
        const empty = round(box.width) === 0 || round(box.height) === 0;

        snapshot[key + " x"] = empty ? 0 : round(box.x);
        snapshot[key + " y"] = empty ? 0 : round(box.y);
        snapshot[key + " width"] = empty ? 0 : round(box.width);
        snapshot[key + " height"] = empty ? 0 : round(box.height);
      } catch {
        // Not every element has a box: a filter primitive, a gradient stop.
      }

      // Where the element ends up on the page, with the transform attribute, CSS transforms and every ancestor's.
      const bounds = element.getBoundingClientRect();
      const nothing = round(bounds.width) === 0 || round(bounds.height) === 0;

      snapshot[key + " bx"] = nothing || unlaidOut ? 0 : round(bounds.x);
      snapshot[key + " by"] = nothing || unlaidOut ? 0 : round(bounds.y);
      snapshot[key + " bw"] = nothing || unlaidOut ? 0 : round(bounds.width);
      snapshot[key + " bh"] = nothing || unlaidOut ? 0 : round(bounds.height);

      for (const prop of ["opacity", "visibility", "translate", "rotate", "scale"])
        snapshot[key + " " + prop] = style.getPropertyValue(prop);

      const blur = element as SVGFEGaussianBlurElement;

      if (blur.stdDeviationX) {
        snapshot[key + " stdDeviation"] = round(blur.stdDeviationX.animVal);
        snapshot[key + " stdDeviationY"] = round(blur.stdDeviationY.animVal);
      }
    });

    return snapshot;
  };

  const at = (time: number): Snapshot => {
    seekTo(time);

    return read();
  };

  const forward = times.map(at);
  const backward = [...times].reverse().map(at).reverse();

  const texty = labels.filter((_, k) => list[k]!.matches("text, tspan") || list[k]!.querySelector("text"));

  return { labels, texty, forward, backward };
};

const numbers = /(-?\d*\.?\d+(?:e[-+]?\d+)?)/;

/** Whether two computed values are the same, to within a tolerance on every number in them. */
const close = (prop: string, a: Value, b: Value, slack = 0): boolean => {
  if (a === b) return true;

  if (typeof a === "number" && typeof b === "number")
    return Math.abs(a - b) <= (prop.startsWith("stdDeviation") ? BLUR : GEOMETRY + slack);

  if (typeof a !== "string" || typeof b !== "string") return false;
  const x = a.split(numbers);
  const y = b.split(numbers);

  if (x.length !== y.length) return false;

  return x.every((part, k) => {
    if (k % 2 === 0) return part === y[k];
    return Math.abs(Number(part) - Number(y[k])) <= (prop === "opacity" ? OPACITY : GEOMETRY);
  });
};

type Mismatch = { when: string; key: string; expected: Value; got: Value };

/** Where a run differs from the Chromium one. */
const diff = (reference: Run, run: Run, skip: string[]): Mismatch[] => {
  if (reference.labels.join() !== run.labels.join())
    return [
      {
        when: "targets",
        key: "animated elements",
        expected: reference.labels.filter((label) => !run.labels.includes(label)).join(" ") + " (only in Chromium)",
        got: run.labels.filter((label) => !reference.labels.includes(label)).join(" ") + " (only here)",
      },
    ];

  const found: Mismatch[] = [];

  for (const direction of ["forward", "backward"] as const)
    reference.times.forEach((time, k) => {
      const want = reference.forward[k]!;
      const have = run[direction][k]!;

      for (const key of Object.keys(want)) {
        const prop = key.slice(key.lastIndexOf(" ") + 1);

        const label = key.slice(0, key.lastIndexOf(" "));
        // Text is measured by each engine's own shaping, so the box around it, and around a group holding it, gets room.
        const box = ["x", "y", "width", "height", "bx", "by", "bw", "bh"].includes(prop);
        const size = Math.max(Number(want[label + " width"]), Number(want[label + " height"]), Number(want[label + " bw"]), Number(want[label + " bh"]));
        const slack = box ? size * (reference.texty.includes(label) ? TEXT : CURVES) : 0;

        if (skip.includes(prop) || close(prop, want[key]!, have[key] ?? null, slack)) continue;
        found.push({ when: `${direction} at ${time}s`, key, expected: want[key]!, got: have[key] ?? null });
      }
    });

  return found;
};

/** One line per kind of difference, with the first time it shows and how many there are. */
const describeMismatches = (found: Mismatch[]) => {
  const kinds = new Map<string, Mismatch[]>();

  for (const m of found) {
    const kind = m.key.replace(/\[\d+\]\S* /, " ");

    kinds.set(kind, [...(kinds.get(kind) ?? []), m]);
  }

  return [...kinds]
    .slice(0, 12)
    .map(([kind, list]) => {
      const times = [...new Set(list.map((m) => m.when))];
      const m = list[0]!;

      return `  ${kind} x${list.length}: ${m.when}: ${m.key} is ${m.got}, Chromium has ${m.expected} (also ${times.slice(1, 4).join(", ") || "-"})`;
    })
    .join("\n");
};

const open = async (browser: Browser, svg: string): Promise<Page> => {
  // The same color scheme everywhere: engines differ in which one a headless page starts in.
  const page = await browser.newPage({ colorScheme: "light" });

  await page.setContent(`<!doctype html><meta charset="utf-8"><body style="margin:0">${svg}</body>`);
  await page.evaluate(() => document.fonts.ready);

  return page;
};

/** Every file's run in one browser, at the times Chromium chose when it has chosen them. */
const collect = async (browser: Browser, times?: Map<string, number[]>) => {
  const runs = new Map<string, Run | Error>();
  const queue = [...files];

  await Promise.all(
    Array.from({ length: PAGES }, async () => {
      for (let file = queue.shift(); file; file = queue.shift()) {
        const page = await open(browser, readFileSync(join(DIST, file), "utf8"));

        try {
          const when = times?.get(file) ?? (await page.evaluate(plan, [String(loopLength), TIMES]));
          const { labels, texty, forward, backward } = await page.evaluate(probe, [String(seek), when]);

          runs.set(file, { times: when, labels, texty, forward, backward });
        } catch (error) {
          runs.set(file, error as Error);
        } finally {
          await page.close();
        }
      }
    }),
  );

  return runs;
};

const launched = new Map<Engine, Browser>();

for (const [name, type] of Object.entries(ENGINES) as [Engine, BrowserType][]) {
  const browser = await type.launch().catch((error: Error) => {
    if (process.env.CI) throw error;
    console.warn(`skipping ${name}: ${error.message.split("\n")[0]}`);
  });

  if (browser) launched.set(name, browser);
}

afterAll(async () => {
  for (const browser of launched.values()) await browser.close();
});

const seconds = (start: number) => Math.round((performance.now() - start) / 100) / 10;
let chromiumRuns: Map<string, Run | Error>;

describe("every example seeks the same in each engine", () => {
  beforeAll(async () => {
    const browser = launched.get("chromium");

    if (!browser) throw new Error("Chromium is the reference, so it has to be installed.");
    const start = performance.now();

    chromiumRuns = await collect(browser);
    console.log(`chromium: ${files.length} files in ${seconds(start)}s`);
  }, 600_000);

  for (const [name, browser] of launched) {
    describe(name, () => {
      let runs: Map<string, Run | Error>;

      beforeAll(async () => {
        const start = performance.now();
        const times = new Map<string, number[]>();

        for (const [file, run] of chromiumRuns) if (!(run instanceof Error)) times.set(file, run.times);
        runs = name === "chromium" ? chromiumRuns : await collect(browser, times);
        console.log(`${name}: ${files.length} files in ${seconds(start)}s`);
      }, 600_000);

      for (const file of files)
        test(file, () => {
          const run = runs.get(file)!;
          const want = chromiumRuns.get(file)!;

          if (run instanceof Error) throw run;
          if (want instanceof Error) throw want;
          const found = diff(want, run, DIFFERS[`${name} ${file}`]?.props ?? []);

          if (found.length)
            throw new Error(`${found.length} differences from Chromium\n${describeMismatches(found)}`);
        });
    });
  }
});

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
/** A rotated shape's bounds can be 41% larger around its box than around the shape. */
const ROTATED = 0.45;
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
type Run = {
  times: number[];
  /** Which elements the engine runs an animation on, as their positions in the document. */
  animated: number[];
  labels: string[];
  texty: string[];
  forward: Snapshot[];
  backward: Snapshot[];
};

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
  // Not at the loop itself: where one interval ends and the next begins, engines may pick either, and no frame lands there.
  add(loop + 0.002);
  add(loop + 0.04);
  add(loop * 2 - 0.04);

  const all = [...marks].sort((a, b) => a - b);

  if (all.length <= count) return all;

  // Evenly through the sorted list, keeping the first and last.
  const picked = Array.from({ length: count }, (_, k) => all[Math.round((k * (all.length - 1)) / (count - 1))]!);

  return picked.filter((time, k) => picked.indexOf(time) === k);
};

/** Runs in the page: set each time with seek, forward then backward, and read every animated element at each. */
const probe = ([seekSrc, times, indices]: [string, number[], number[] | undefined]) => {
  const seekTo = (0, eval)(`(${seekSrc})`) as (time: number) => void;
  const targets = new Set<Element>();

  // Chromium runs animations inside a display: none subtree, and Firefox and WebKit don't. Nothing there is on screen.
  const hidden = (element: Element) => {
    for (let node: Element | null = element; node; node = node.parentElement)
      if (getComputedStyle(node).display === "none") return true;

    return false;
  };

  for (const element of document.querySelectorAll("animate, animateTransform, animateMotion, set")) {
    const href = element.getAttribute("href") ?? element.getAttribute("xlink:href");
    const target = href ? document.getElementById(href.slice(1)) : element.parentElement;

    if (target) targets.add(target);
  }

  for (const animation of document.getAnimations()) {
    const target = animation.effect instanceof KeyframeEffect ? animation.effect.target : null;

    if (target) targets.add(target);
  }

  for (const element of targets) if (hidden(element)) targets.delete(element);

  const all = [...document.querySelectorAll("*")];
  // The elements Chromium animates, when it has said which, so an engine that animates fewer is measured on them too.
  const list = indices ? indices.map((index) => all[index]!) : [...targets].sort((a, b) => all.indexOf(a) - all.indexOf(b));
  const labels = list.map((element) => `${element.tagName}${element.id ? "#" + element.id : ""}[${all.indexOf(element)}]`);
  const round = (n: number) => Math.round(n * 100) / 100;

  const read = (): Snapshot => {
    const snapshot: Snapshot = {};

    list.forEach((element, k) => {
      const key = labels[k]!;
      const style = getComputedStyle(element);

      // Elements in a mask aren't laid out on their own, and Firefox gives its percentages no size.
      const unlaidOut = element.closest("mask") !== null;

      let empty = true;

      try {
        if (unlaidOut || element.matches("g, svg, use")) throw new Error("no box");
        const box = (element as SVGGraphicsElement).getBBox();

        // An empty box has no position worth comparing: Chromium keeps where it is, Firefox and WebKit say 0 0.
        empty = round(box.width) === 0 || round(box.height) === 0;

        snapshot[key + " x"] = empty ? 0 : round(box.x);
        snapshot[key + " y"] = empty ? 0 : round(box.y);
        snapshot[key + " width"] = empty ? 0 : round(box.width);
        snapshot[key + " height"] = empty ? 0 : round(box.height);
      } catch {
        // Not every element has a box: a filter primitive, a gradient stop.
      }

      // Where the element ends up on the page, with the transform attribute, CSS transforms and every ancestor's.
      // A group's bounds depend on how each engine counts what it holds, so the shapes inside it are measured instead.
      // A line has no area, and engines disagree on the bounds of one that is turned.
      if (!unlaidOut && !element.matches("g, svg, use, line")) {
        const bounds = element.getBoundingClientRect();
        const nothing = round(bounds.width) === 0 || round(bounds.height) === 0;

        snapshot[key + " bcx"] = nothing ? 0 : round(bounds.x + bounds.width / 2);
        snapshot[key + " bcy"] = nothing ? 0 : round(bounds.y + bounds.height / 2);
        snapshot[key + " bw"] = nothing ? 0 : round(bounds.width);
        snapshot[key + " bh"] = nothing ? 0 : round(bounds.height);
      }

      for (const prop of ["display", "opacity", "visibility", "translate", "rotate", "scale"])
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

  const animated = [...targets].map((element) => all.indexOf(element)).sort((a, b) => a - b);

  return { labels, animated, texty, forward, backward };
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
  const found: Mismatch[] = [];
  const lacks = reference.animated.filter((index) => !run.animated.includes(index));

  // The elements an engine runs animations on: one that leaves some out, or adds some, plays differently.
  if (lacks.length || run.animated.length !== reference.animated.length)
    found.push({
      when: "targets",
      key: "animated elements",
      expected: `${reference.animated.length}, ${lacks.length} of them without an animation here: ${lacks.map((index) => reference.labels[reference.animated.indexOf(index)]).join(" ")}`,
      got: run.animated.length,
    });

  for (const direction of ["forward", "backward"] as const)
    reference.times.forEach((time, k) => {
      const want = reference.forward[k]!;
      const have = run[direction][k]!;

      for (const key of Object.keys(want)) {
        if (!(key in have)) continue;
        const prop = key.slice(key.lastIndexOf(" ") + 1);

        const label = key.slice(0, key.lastIndexOf(" "));
        // Text is measured by each engine's own shaping, so the box around it, and around a group holding it, gets room.
        const box = ["x", "y", "width", "height", "bcx", "bcy", "bw", "bh"].includes(prop);
        const size = Math.max(...["width", "height", "bw", "bh"].map((side) => Number(want[label + " " + side]) || 0));
        // Engines measure a rotated shape's bounds differently, Firefox around the shape and Chromium around its box, so
        // the size of those bounds gets room. Where the bounds sit doesn't.
        const loose = reference.texty.includes(label);
        const slack = box ? size * (prop === "bw" || prop === "bh" ? ROTATED : loose ? TEXT : CURVES) : 0;

        if (prop === "display" || skip.includes(prop) || close(prop, want[key]!, have[key] ?? null, slack)) continue;
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
  // Firefox's bounds include the stroke and Chromium's don't, so only the fill is measured.
  await page.addStyleTag({ content: "*{stroke:none!important}" });
  await page.evaluate(() => document.fonts.ready);

  return page;
};

/** Every file's run in one browser, at the times Chromium chose when it has chosen them. */
const collect = async (browser: Browser, reference?: Map<string, Run | Error>) => {
  const runs = new Map<string, Run | Error>();
  const queue = [...files];

  await Promise.all(
    Array.from({ length: PAGES }, async () => {
      for (let file = queue.shift(); file; file = queue.shift()) {
        const page = await open(browser, readFileSync(join(DIST, file), "utf8"));

        try {
          const want = reference?.get(file);
          const chosen = want instanceof Error ? undefined : want;
          const when = chosen?.times ?? (await page.evaluate(plan, [String(loopLength), TIMES]));
          const found = await page.evaluate(probe, [String(seek), when, chosen?.animated]);

          runs.set(file, { times: when, ...found });
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
        runs = name === "chromium" ? chromiumRuns : await collect(browser, chromiumRuns);
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

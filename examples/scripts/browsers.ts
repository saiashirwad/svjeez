import { afterAll, beforeAll, describe, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { chromium, firefox, webkit, type Browser, type Page } from "playwright-core";
import { loopLength, seek } from "svjeez/page";

const DIST = join(import.meta.dir, "..", "dist");

const ENGINES = { chromium, firefox, webkit };

const GEOMETRY = 1;
const OPACITY = 0.02;
const BLUR = 0.1;

const TEXT = 0.2;

const ROTATED = 0.45;
const CURVES = 0.02;

const TIMES = 60;
const PAGES = 4;

const DIFFERS = new Map<string, { props: string[]; why: string }>(
  Object.entries({
    "firefox escapement.svg": {
      props: ["bcx", "bcy"],
      why: "A curved path turns inside rotating groups. Firefox bounds the turned curve and Chromium its turned box, so the centres of the two differ while the frames are the same pixels.",
    },
    "firefox jellyfish.svg": {
      props: ["bcx", "bcy"],
      why: "The tentacles are curved paths inside swaying, rotating groups. Same as escapement.svg: Firefox bounds the turned curve and Chromium its turned box, so the centres differ while the frames are the same pixels.",
    },
    "firefox layout.svg": {
      props: ["bcx"],
      why: "An arrow head turns inside a group that rotates it about the arrow's start, so as it tilts Firefox bounds the turned head and Chromium its turned box. The frames are the same pixels in both.",
    },
    "firefox plain-ts/layout.svg": {
      props: ["bcx"],
      why: "Byte-identical to layout.svg, written with h() instead of JSX.",
    },
    "firefox readme/hero.svg": {
      props: ["bcy"],
      why: "Same as layout.svg: the magenta arrow head turns inside a group that rotates it about the arrow's start, so Firefox bounds the turned head and Chromium its turned box.",
    },
  }),
);

const files = [...new Bun.Glob("**/*.svg").scanSync(DIST)].sort();

type Snapshot = Record<string, string>;

type Run = {
  times: number[];
  animated: number[];
  labels: string[];
  texty: string[];
  forward: Snapshot[];
  backward: Snapshot[];
};

declare global {
  interface Window {
    seekTo: typeof seek;
    loopOf: typeof loopLength;
  }
}

const plan = ({ loop, count }: { loop: number; count: number }): number[] => {
  const marks = new Set<number>();

  const add = (time: number) =>
    time >= 0 &&
    time < loop * 2 &&
    marks.add(Number((Math.round(time * 1000) / 1000 + 0.001).toFixed(4)));

  for (const element of document.querySelectorAll(
    "animate, animateTransform, animateMotion, set",
  )) {
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
  add(loop + 0.002);
  add(loop + 0.04);
  add(loop * 2 - 0.04);

  const all = [...marks].sort((a, b) => a - b);

  if (all.length <= count) return all;

  const picked = Array.from(
    { length: count },
    (_, k) => all[Math.round((k * (all.length - 1)) / (count - 1))]!,
  );

  return picked.filter((time, k) => picked.indexOf(time) === k);
};

const probe = ({ times, indices }: { times: number[]; indices?: number[] }) => {
  const targets = new Set<Element>();

  const hidden = (element: Element) => {
    for (let node: Element | null = element; node; node = node.parentElement)
      if (getComputedStyle(node).display === "none") return true;

    return false;
  };

  for (const element of document.querySelectorAll(
    "animate, animateTransform, animateMotion, set",
  )) {
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

  const list = indices
    ? indices.map((index) => all[index]!)
    : [...targets].sort((a, b) => all.indexOf(a) - all.indexOf(b));

  const labels = list.map(
    (element) => `${element.tagName}${element.id ? "#" + element.id : ""}[${all.indexOf(element)}]`,
  );

  const round = (n: number) => String(Math.round(n * 100) / 100);

  const read = () => {
    const snapshot: Snapshot = {};

    list.forEach((element, k) => {
      const key = labels[k]!;
      const style = getComputedStyle(element);

      const unlaidOut = element.closest("mask, clipPath") !== null;

      if (element instanceof SVGRectElement || element instanceof SVGImageElement) {
        const { width, height } = element;

        if (width.animVal.unitType === SVGLength.SVG_LENGTHTYPE_NUMBER)
          snapshot[key + " aw"] = round(width.animVal.value);

        if (height.animVal.unitType === SVGLength.SVG_LENGTHTYPE_NUMBER)
          snapshot[key + " ah"] = round(height.animVal.value);
      }

      if (
        !unlaidOut &&
        element instanceof SVGGraphicsElement &&
        !element.matches("g, svg, use, tspan")
      ) {
        try {
          const box = element.getBBox();
          const empty = round(box.width) === "0" || round(box.height) === "0";

          snapshot[key + " x"] = empty ? "0" : round(box.x);
          snapshot[key + " y"] = empty ? "0" : round(box.y);
          snapshot[key + " width"] = empty ? "0" : round(box.width);
          snapshot[key + " height"] = empty ? "0" : round(box.height);
        } catch {}
      }

      if (!unlaidOut && !element.matches("g, svg, use, line")) {
        const bounds = element.getBoundingClientRect();
        const nothing = round(bounds.width) === "0" || round(bounds.height) === "0";

        snapshot[key + " bcx"] = nothing ? "0" : round(bounds.x + bounds.width / 2);
        snapshot[key + " bcy"] = nothing ? "0" : round(bounds.y + bounds.height / 2);
        snapshot[key + " bw"] = nothing ? "0" : round(bounds.width);
        snapshot[key + " bh"] = nothing ? "0" : round(bounds.height);
      }

      for (const prop of ["display", "opacity", "visibility", "translate", "rotate", "scale"])
        snapshot[key + " " + prop] = style.getPropertyValue(prop);

      if (element instanceof SVGFEGaussianBlurElement) {
        snapshot[key + " stdDeviation"] = round(element.stdDeviationX.animVal);
        snapshot[key + " stdDeviationY"] = round(element.stdDeviationY.animVal);
      }
    });

    return snapshot;
  };

  const at = (time: number) => {
    window.seekTo(time);

    return read();
  };

  const forward = times.map(at);
  const backward = [...times].reverse().map(at).reverse();

  const texty = labels.filter(
    (_, k) => list[k]!.matches("text, tspan") || list[k]!.querySelector("text"),
  );

  const animated = [...targets].map((element) => all.indexOf(element)).sort((a, b) => a - b);

  return { labels, animated, texty, forward, backward };
};

const numbers = /(-?\d*\.?\d+(?:e[-+]?\d+)?)/;

const close = (prop: string, a: string, b: string | undefined, slack: number): boolean => {
  if (a === b) return true;

  if (b === undefined) return false;
  const x = a.split(numbers);
  const y = b.split(numbers);

  if (x.length !== y.length) return false;

  const tolerance = prop.startsWith("stdDeviation")
    ? BLUR
    : prop === "opacity"
      ? OPACITY
      : GEOMETRY + slack;

  return x.every((part, k) =>
    k % 2 === 0 ? part === y[k] : Math.abs(Number(part) - Number(y[k])) <= tolerance,
  );
};

type Mismatch = { when: string; key: string; expected: string; got: string };

const diff = (reference: Run, run: Run, skip: string[]): Mismatch[] => {
  const found: Mismatch[] = [];
  const lacks = reference.animated.filter((index) => !run.animated.includes(index));

  if (lacks.length || run.animated.length !== reference.animated.length)
    found.push({
      when: "targets",
      key: "animated elements",
      expected: `${reference.animated.length}, ${lacks.length} of them without an animation here: ${lacks.map((index) => reference.labels[reference.animated.indexOf(index)]).join(" ")}`,
      got: String(run.animated.length),
    });

  for (const direction of ["forward", "backward"] as const)
    reference.times.forEach((time, k) => {
      const want = reference[direction][k]!;
      const have = run[direction][k]!;

      for (const key of Object.keys(want)) {
        if (!(key in have)) continue;
        const prop = key.slice(key.lastIndexOf(" ") + 1);
        const label = key.slice(0, key.lastIndexOf(" "));
        const box = ["x", "y", "width", "height", "bcx", "bcy", "bw", "bh"].includes(prop);

        const size = Math.max(
          ...["width", "height", "bw", "bh"].map((side) => Number(want[label + " " + side]) || 0),
        );

        const loose = reference.texty.includes(label);

        const slack = box
          ? size * (prop === "bw" || prop === "bh" ? ROTATED : loose ? TEXT : CURVES)
          : 0;

        if (prop === "display" || skip.includes(prop) || close(prop, want[key]!, have[key], slack))
          continue;
        found.push({
          when: `${direction} at ${time}s`,
          key,
          expected: want[key]!,
          got: have[key] ?? "missing",
        });
      }
    });

  return found;
};

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
  const page = await browser.newPage({ colorScheme: "light" });

  await page.setContent(
    `<!doctype html><meta charset="utf-8"><body style="margin:0">${svg}</body>`,
  );
  await page.addStyleTag({ content: "*{stroke:none!important}" });
  await page.addScriptTag({ content: `window.seekTo = ${seek}; window.loopOf = ${loopLength};` });
  await page.evaluate(() => document.fonts.ready);

  return page;
};

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
          const loop = await page.evaluate(() => window.loopOf(document));
          const when = chosen?.times ?? (await page.evaluate(plan, { loop, count: TIMES }));
          const found = await page.evaluate(probe, { times: when, indices: chosen?.animated });

          runs.set(file, { times: when, ...found });
        } catch (error) {
          runs.set(file, error instanceof Error ? error : new Error(String(error)));
        } finally {
          await page.close();
        }
      }
    }),
  );

  return runs;
};

const launched = new Map<string, Browser>();

for (const [name, type] of Object.entries(ENGINES)) {
  const browser = await type.launch().catch((error: Error) => {
    if (process.env.CI) throw error;
    console.warn(`skipping ${name}: ${error.message.split("\n")[0]}`);
  });

  if (browser) launched.set(name, browser);
}

afterAll(async () => {
  await Promise.all([...launched.values()].map((browser) => browser.close()));
}, 30_000);

const seconds = (start: number) => Math.round((performance.now() - start) / 100) / 10;
let chromiumRuns = new Map<string, Run | Error>();

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
      let runs = new Map<string, Run | Error>();

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
          const found = diff(want, run, DIFFERS.get(`${name} ${file}`)?.props ?? []);

          if (found.length)
            throw new Error(
              `${found.length} differences from Chromium\n${describeMismatches(found)}`,
            );
        });
    });
  }
});

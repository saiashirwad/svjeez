import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { chromium, type Browser, type Page } from "playwright-core";
import { compileScene } from "../../src/compile.ts";
import type { measureMove } from "../../src/probe.ts";

declare global {
  interface Window {
    measureMove: typeof measureMove;
  }
}

let browser: Browser;
let page: Page;

beforeAll(async () => {
  const built = await Bun.build({
    entrypoints: [new URL("../../src/probe.ts", import.meta.url).pathname],
    conditions: ["@svjeez/source"],
    format: "esm",
  });

  const code = await built.outputs[0]!.text();
  browser = await chromium.launch();
  page = await browser.newPage();
  await page.setContent("<!doctype html><body></body>");
  await page.addScriptTag({
    type: "module",
    content: `${code.replace(/export\s*\{[^}]*\};?\s*$/, "")}\nwindow.measureMove = measureMove;`,
  });
  await page.waitForFunction(() => "measureMove" in window);
});

afterAll(() => browser?.close());

const svgOf = async (text: string) => {
  const result = await compileScene(text);

  if (!result.ok) throw new Error(result.error.message);

  return result.svg;
};

const scene = (cx: number, r: number, at = 0) => `import { render, motion } from "svjeez";
export default () => render({ width: 400, height: 200, duration: 2, title: "t" }, <>
  <rect width={400} height={200} fill="#111111" />
  <circle cx={${cx}} cy={100} r={${r}} fill="#FF0000" animation={motion({ x: 0 }).at(${at}).to({ x: 100 }, 1)} />
</>);`;

const measure = (before: string, after: string, by: number, at: number) =>
  page.evaluate(([b, a, n, t]) => window.measureMove(b, a, n, t), [before, after, by, at] as const);

describe("measureMove", () => {
  test("a number that shifts a shape gets a handle on the shape, moving the way the shape does", async () => {
    const move = await measure(await svgOf(scene(100, 10)), await svgOf(scene(110, 10)), 10, 0);

    expect(move?.at.x).toBeCloseTo(100, 0);
    expect(move?.at.y).toBeCloseTo(100, 0);
    expect(move?.way.x).toBeCloseTo(1, 1);
    expect(move?.way.y).toBeCloseTo(0, 1);
  });

  test("a radius moves the shape's edge, not its centre", async () => {
    const move = await measure(await svgOf(scene(100, 10)), await svgOf(scene(100, 20)), 10, 0);

    expect(move?.at.x).toBeCloseTo(110, 0);
    expect(move?.way.x).toBeCloseTo(1, 1);
  });

  test("the handle sits where the shape is at the clock's time, motion included", async () => {
    const move = await measure(await svgOf(scene(100, 10)), await svgOf(scene(110, 10)), 10, 1.5);

    expect(move?.at.x).toBeCloseTo(200, 0);
  });

  test("a number that moves nothing gets no handle", async () => {
    const svg = await svgOf(scene(100, 10));

    expect(await measure(svg, svg, 1, 0)).toBeUndefined();
  });
});

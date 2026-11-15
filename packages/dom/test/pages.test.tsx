/** @jsxImportSource svjeez */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { render } from "svjeez";
import {
  browser,
  Dom,
  size,
  snap,
  type Box,
  type Browser,
  type Item,
  type TextRun,
} from "../src/index.ts";

let dom: Browser;

beforeAll(async () => {
  dom = await browser();
});

afterAll(() => dom.close());

const runs = (it: Item): TextRun[] =>
  it.kind === "text" ? [it] : it.kind === "box" ? it.children.flatMap(runs) : [];

const draw = async (markup: string, css = "") => {
  const card = await dom.mount(markup, { css });
  const state = await card.snap();
  await card.close();

  return state!;
};

describe("real pages", () => {
  test("a font stack keeps its fallbacks and ends in a generic family", async () => {
    const state = await draw(
      '<div><p style="font:16px -apple-system, system-ui, \'Segoe UI\', Helvetica">hi</p><code style="font:13px Hack Mono, Menlo">x</code></div>',
    );

    const [a, b] = state.root.children.flatMap(runs);
    const svg = render({ ...size(state), duration: 1, title: "dom" }, <Dom states={[state]} />);

    expect(a).toMatchObject({
      family: "-apple-system",
      fallback: "system-ui, Segoe UI, Helvetica, sans-serif",
    });
    expect(b?.fallback).toBe("Menlo, monospace");
    expect(svg).toContain(
      'font-family="-apple-system, system-ui, Segoe UI, Helvetica, sans-serif"',
    );
  });

  test("an underline and a condensed width are drawn, a clear underline is not", async () => {
    const state = await draw(
      '<div><p>see <a href="#" style="text-decoration:underline"><b>this</b> link</a> <a href="#" style="text-decoration:underline transparent">not</a></p><h1 style="font-stretch:62%">wide</h1></div>',
    );

    const all = runs(state.root);
    const svg = render({ ...size(state), duration: 1, title: "dom" }, <Dom states={[state]} />);

    expect(all.filter((r) => r.decoration).map((r) => r.text)).toEqual(["this", "link"]);
    expect(all.find((r) => r.text === "wide")?.stretch).toBe(62);
    expect(svg).toContain('text-decoration="underline"');
    expect(svg).toContain('font-stretch="62%"');
  });

  test("images: backgrounds, object-fit and a mask draw once per file, as <use>", async () => {
    const icon = (c: string) =>
      `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 10'%3E%3Crect width='10' height='10' fill='${c}'/%3E%3C/svg%3E")`;

    const state = await draw(
      `<div>
        <i class="a"></i><i class="a"></i>
        <b class="m"></b>
        <img style="width:40px;height:20px;object-fit:contain" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10'%3E%3C/svg%3E">
      </div>`,
      `i.a { display:block; width:20px; height:20px; background: ${icon("%23f00")} center / 10px 10px no-repeat }
       b.m { display:block; width:30px; height:30px; background:#06c; mask: ${icon("%23000")} center / calc(100% - 10px) auto no-repeat }`,
    );

    const boxes = state.root.children.filter((c) => c.kind === "box");
    const img = state.root.children.find((c) => c.kind === "image");
    const svg = render({ ...size(state), duration: 1, title: "dom" }, <Dom states={[state]} />);

    expect(boxes[0]).toMatchObject({
      pictures: [{ tiles: [{ x: 21, y: 21, width: 10, height: 10 }] }],
    });
    expect(boxes[2]?.mask?.[0]?.tiles[0]).toMatchObject({ width: 20, height: 20 });
    expect(img).toMatchObject({ fit: { x: 26, width: 20, height: 20 } });
    expect(svg.match(/<symbol/g)).toHaveLength(3);
    expect(svg).toContain("<mask");
  });
});

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

const draw = async (markup: string, css = "", pad?: number) => {
  const card = await dom.mount(markup, { css, pad });
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

  test("a canvas is drawn as a still, and an SVG with only a viewBox gets a size", async () => {
    const svg =
      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 20'%3E%3Crect width='40' height='20' fill='red'/%3E%3C/svg%3E";

    const card = await dom.mount(
      `<div><canvas id="c" width="40" height="20" style="width:40px;height:20px"></canvas><img src="${svg}" width="40" height="20"></div>`,
    );

    const state = await card.snap(async (page) => {
      await page.evaluate(() => {
        const g = (document.getElementById("c") as HTMLCanvasElement).getContext("2d")!;

        g.fillStyle = "#08f";
        g.fillRect(0, 0, 40, 20);
      });
    });

    await card.close();
    const json = JSON.stringify(state.root);

    expect(json).toContain("data:image/webp");
    expect(json).toContain('width=\'40\'');
  });

  test("a painted canvas is drawn as a WebP still", async () => {
    const card = await dom.mount('<div><canvas id="c" width="800" height="800"></canvas></div>');

    const state = await card.snap(async (page) => {
      await page.evaluate(() => {
        const g = (document.getElementById("c") as HTMLCanvasElement).getContext("2d")!;

        for (let i = 0; i < 800; i += 8) {
          g.fillStyle = `hsl(${i / 2.2} 80% 50%)`;
          g.fillRect(i, 0, 8, 800);
        }
      });
    });

    await card.close();
    // An 800px canvas drawn at 800px is kept at its size, as WebP.
    expect(JSON.stringify(state.root)).toContain("data:image/webp");
  });

  test("text-overflow: ellipsis draws the dots, an image's border is a box", async () => {
    const state = await draw(
      `<div><p style="width:80px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;font:14px monospace">a long commit message</p><img src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" width="20" height="20" style="border:2px solid red"></div>`,
    );

    const [line] = runs(state.root);
    const boxes = (state.root.children as Item[]).flatMap((c) => (c.kind === "box" ? [c] : []));

    expect(line?.text.endsWith("…")).toBe(true);
    expect(line!.text.length).toBeLessThan("a long commit message".length);
    expect(boxes.some((b) => b.tag === "img" && b.border)).toBe(true);
  });

  test("an open shadow root's text is read", async () => {
    const card = await dom.mount('<div><x-t id="t"></x-t></div>');

    const state = await card.snap(async (page) => {
      await page.evaluate(() => {
        document.getElementById("t")!.attachShadow({ mode: "open" }).innerHTML = "<b>2 weeks ago</b>";
      });
    });

    await card.close();
    expect(runs(state.root).map((r) => r.text)).toEqual(["2 weeks ago"]);
  });

  test("mix-blend-mode is drawn as a blend", async () => {
    const state = await draw(
      '<div style="position:relative;width:50px;height:50px;background:#888"><div style="position:absolute;inset:0;background:#fff;mix-blend-mode:overlay;isolation:isolate"></div></div>',
    );

    const svg = render({ ...size(state), duration: 1, title: "dom" }, <Dom states={[state]} />);

    expect(svg).toContain("mix-blend-mode:overlay");
  });
  test("a fixed header inside a zero-height wrapper is read", async () => {
    const state = await draw(
      '<div style="height:100px;width:200px"><div><header style="position:fixed;width:100px">Product</header></div></div>',
      "",
      0,
    );

    expect(runs(state.root).map((r) => r.text)).toContain("Product");
  });
});

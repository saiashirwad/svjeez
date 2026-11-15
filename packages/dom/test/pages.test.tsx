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
  const [state] = await card.run([snap("a")]);
  await card.close();

  return state!;
};

describe("real pages", () => {
  test("a font stack keeps its fallbacks and ends in a generic family", async () => {
    const state = await draw(
      '<div><p style="font:16px -apple-system, system-ui, \'Segoe UI\', Helvetica">hi</p><code style="font:13px Hack Mono, Menlo">x</code></div>',
    );

    const [a, b] = state.root.children.flatMap(runs);
    const svg = render({ ...size(state), duration: 1 }, <Dom states={[state]} />);

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
    const svg = render({ ...size(state), duration: 1 }, <Dom states={[state]} />);

    expect(all.filter((r) => r.decoration).map((r) => r.text)).toEqual(["this", "link"]);
    expect(all.find((r) => r.text === "wide")?.stretch).toBe(62);
    expect(svg).toContain('text-decoration="underline"');
    expect(svg).toContain('font-stretch="62%"');
  });
});

import { describe, expect, test } from "bun:test";
import { scene } from "svjeez";
import { svg } from "svjeez/tools";
import { compile, mergeSchemes } from "../src/index.ts";
import { box, snapshot } from "./fixtures.ts";

const page = (bg: string, ink: string) =>
  snapshot(
    box({
      background: bg,
      children: [box({ tag: "p", children: [{ type: "text", runs: [run("Hi", ink)] }] })],
    }),
  );

const run = (text: string, color: string) => ({
  x: 0,
  y: 16,
  text,
  advances: [8, 8],
  font: { family: "Arial", weight: 400, italic: false, stretch: 100, size: 16 },
  letterSpacing: 0,
  color,
});

const white = "rgb(255, 255, 255)";
const black = "rgb(0, 0, 0)";

describe("mergeSchemes", () => {
  test("pairs the colors that differ and keeps the ones that do not", () => {
    const merged = mergeSchemes(page(white, black), page(black, black));
    const root = merged.root;

    expect(root.background).toEqual({ light: white, dark: black });

    const para = root.children[0];
    const text = para?.type === "element" ? para.children[0] : undefined;

    expect(text?.type === "text" && text.runs[0]?.color).toBe(black);
  });

  test("a color set in one scheme only pairs with clear", () => {
    const light = snapshot(box());
    const dark = snapshot(box({ background: black }));

    expect(mergeSchemes(light, dark).root.background).toEqual({
      light: "rgba(0, 0, 0, 0)",
      dark: black,
    });
  });

  test("a different tree is an error that says where", () => {
    expect(() => mergeSchemes(snapshot(box({ children: [box()] })), snapshot(box()))).toThrow(
      /root\.children.*1 entries in light, 0 in dark/,
    );

    expect(() => mergeSchemes(snapshot(box()), snapshot(box({ tag: "span" })))).toThrow(
      /root\.tag/,
    );
  });

  test("compile emits one theme token per pair", () => {
    const compiled = compile(mergeSchemes(page(white, "rgb(10, 10, 10)"), page(black, white)));

    const out = svg.emit(
      scene({ size: compiled.size, duration: 1, title: "t" }, () => compiled.element),
    );

    expect(out).toContain("--c-ffffff-000000:");
    expect(out).toContain("--c-0a0a0a-ffffff:");
    expect(out).toContain("var(--c-ffffff-000000");
  });
});

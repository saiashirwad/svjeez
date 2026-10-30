import { describe, expect, test } from "bun:test";
import { tex } from "../../src/index";
import { svg } from "../helpers/tex";

describe("tex", () => {
  test("\\color paints the part it wraps and leaves the rest to the theme", () => {
    const g = tex(String.raw`a \color{red}{b}`);
    expect(g.words.map((w) => w.fill)).toEqual([undefined, "red"]);
  });

  test("color overrides the theme, and a \\color run overrides both", () => {
    const out = svg(tex(String.raw`a \color{red}{b}`, { color: "#123456" }).node);
    expect(out).toContain('fill="#123456"');
    expect(out).toContain('fill="red"');
  });
});

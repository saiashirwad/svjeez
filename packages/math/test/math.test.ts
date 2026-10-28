import { describe, expect, test } from "bun:test";
import { render } from "svjeez";
import { morph } from "svjeez/extras";
import { tex } from "../src/index";

const svg = (...children: Parameters<typeof render>[1][]) =>
  render({ width: 400, height: 200, duration: 4, title: "math" }, children);

describe("tex", () => {
  const f = tex(String.raw`(a+b)^2`, { x: 40, y: 80, fontSize: 40 });

  test("the box starts at x, y and scales with fontSize, 1000 units to the em", () => {
    expect(f.bounds).toMatchObject({ x: 40, y: 80 });
    const double = tex(String.raw`(a+b)^2`, { x: 40, y: 80, fontSize: 80 });
    expect(double.width).toBeCloseTo(f.width * 2, 2);
    expect(double.height).toBeCloseTo(f.height * 2, 2);
  });

  test("every glyph sits inside the box, in reading order", () => {
    const slack = 1;

    for (const g of f.words) {
      expect(g.bounds.x).toBeGreaterThanOrEqual(f.bounds.x - slack);
      expect(g.bounds.y).toBeGreaterThanOrEqual(f.bounds.y - slack);
      expect(g.bounds.x + g.bounds.w).toBeLessThanOrEqual(f.bounds.x + f.bounds.w + slack);
      expect(g.bounds.y + g.bounds.h).toBeLessThanOrEqual(f.bounds.y + f.bounds.h + slack);
    }

    expect(f.words.map((g) => g.char).join("")).toBe("(a+b)2");
    expect(f.words.map((g) => g.x)).toEqual(f.words.map((g) => g.x).sort((a, b) => a - b));
  });

  test("a superscript is a smaller glyph, raised above the baseline", () => {
    const [base, power] = [f.words.find((g) => g.char === ")")!, f.words.at(-1)!];
    expect(base.size).toBe(1);
    expect(power.size).toBeCloseTo(0.707, 3);
    expect(power.y).toBeLessThan(base.y);
  });

  test("glyphs draw upright: y grows downward on screen, so the matrix flips the font's y-up path", () => {
    for (const g of f.words) {
      expect(g.matrix[0]).toBeGreaterThan(0);
      expect(g.matrix[3]).toBeLessThan(0);
    }
  });

  test("get() and find() return the rect of the part they name", () => {
    const g = tex(String.raw`a^2 + \cssId{mid}{2ab} + b^2`, { x: 40, y: 80, fontSize: 40 });
    const mid = g.get("mid");
    const box = ({ x, y, w, h }: typeof mid) => ({ x, y, w, h });
    expect(box(g.find("2ab"))).toEqual(box(mid));
    expect(g.find("b2").x).toBeGreaterThan(mid.x + mid.w);
    expect(g.find("2", 2)).toMatchObject({ x: g.words.filter((w) => w.char === "2")[1]!.bounds.x });
    expect(g.words.filter((w) => w.id === "mid").map((w) => w.char)).toEqual(["2", "a", "b"]);
  });

  test("find() reads through no glyph boundary, and says what it found", () => {
    expect(() => f.find("(a+")).not.toThrow();
    expect(() => f.find("zz")).toThrow(`tex.find() found 0 of "zz", not 1.`);
    expect(() => f.find("a", 2)).toThrow(`tex.find() found 1 of "a", not 2.`);
    expect(() => f.get("x")).toThrow(`tex.get() found no part named "x".`);
  });

  test("a TeX error throws with MathJax's message instead of drawing red text", () => {
    expect(() => tex(String.raw`\frac{`)).toThrow(
      /^tex\(\) could not parse .*: Missing close brace/,
    );
    expect(() => tex(String.raw`\foo`)).toThrow(/Undefined control sequence \\foo/);
  });

  test("bad options name the call and the value", () => {
    expect(() => tex("x", { fontSize: 0 })).toThrow(/tex\(\) needs finite coordinates/);
  });

  test("fractions, roots and sums come out as glyphs and bars", () => {
    const g = tex(String.raw`\frac{a}{b}+\sqrt{x}+\sum_{i=1}^n i`);
    expect(g.words.filter((w) => w.char === "rect")).toHaveLength(2);
    expect(g.words.map((w) => w.char)).toContain("∑");
  });

  test("\\color paints the part it wraps and leaves the rest to the theme", () => {
    const g = tex(String.raw`a \color{red}{b}`);
    expect(g.words.map((w) => w.fill)).toEqual([undefined, "red"]);
  });

  test("a boxed or struck term draws its outline as shapes", () => {
    const g = tex(String.raw`\boxed{x}\cancel{y}`);
    expect(g.words.map((w) => w.char)).toEqual(["x", "rect", "y", "line"]);
  });

  test("text MathJax cannot find a glyph for fails loudly", () => {
    expect(() => tex("\\text{😀}")).toThrow(/cannot draw/);
  });

  test("a link's invisible hit box draws nothing", () => {
    expect(tex(String.raw`\href{http://example.com}{a}`).words.map((w) => w.char)).toEqual(["a"]);
  });

  test("what MathJax builds from clipped pieces, or a full-width table, is refused by name", () => {
    expect(() => tex(String.raw`\overbrace{a+b}^{n}`)).toThrow(/cannot draw a <svg> element/);
    expect(() => tex(String.raw`x \tag{1}`)).toThrow(/A \\tag draws a full-width table/);
  });

  test("the static node is one group per glyph, with the glyph's matrix on the path", () => {
    const out = svg(f.node);
    expect(out.match(/<path /g)).toHaveLength(f.words.length);
    expect(out).toMatch(/<g>\s*<path d="M[^"]+" transform="matrix\(0\.04 0 0 -0\.04 /);
  });

  test("color overrides the theme, and a \\color run overrides both", () => {
    const out = svg(tex(String.raw`a \color{red}{b}`, { color: "#123456" }).node);
    expect(out).toContain('fill="#123456"');
    expect(out).toContain('fill="red"');
  });
});

describe("morph over equations", () => {
  const a = tex(String.raw`(a+b)^2`, { x: 40, y: 80, fontSize: 40 });
  const b = tex(String.raw`a^2 + 2ab + b^2`, { x: 40, y: 80, fontSize: 40 });

  test("glyphs of the same character and size carry over, and the rest fade", () => {
    const out = svg(morph([a, b], { at: [1], over: 1 }).node);
    // a, +, b and the superscript 2 carry over. The full-size 2 is new, since a 2 cannot scale.
    expect(out.match(/<path /g)).toHaveLength(a.words.length + b.words.length - 4);
  });

  test("a carried glyph moves by the distance between its places, on the wrapping group", () => {
    const out = svg(morph([a, b], { at: [1], over: 1 }).node);
    const power = b.words.at(-1)!;
    const from = a.words.at(-1)!;
    expect(out).toContain(`translate:${power.x - from.x}px ${power.y - from.y}px`);
    expect(out).toMatch(/<g class="a m\d+">\s*<path d=/);
  });

  test("a version morphs back to itself, so a loop can close", () => {
    const m = morph([a, b, a], { at: [1, 3], over: 1 });
    expect(m.end).toBe(4);
    expect(() => svg(m.node)).not.toThrow();
  });
});

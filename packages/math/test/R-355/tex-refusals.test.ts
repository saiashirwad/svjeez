import { describe, expect, test } from "bun:test";
import { tex } from "../../src/index";

describe("tex", () => {
  test("a TeX error throws with MathJax's message instead of drawing red text", () => {
    expect(() => tex(String.raw`\frac{`)).toThrow(
      /^tex\(\) could not parse .*: Missing close brace/,
    );
    expect(() => tex(String.raw`\foo`)).toThrow(/Undefined control sequence \\foo/);
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
});

import { describe, expect, test } from "bun:test";
import { circle, g, linearGradient, node, raw, rect, serialize, stop, text, tspan } from "../src";

describe("svg tree", () => {
  test("escapes text and attribute values", () => {
    const output = serialize(
      g({ "aria-label": 'a "b" <c>' }, [text("1 < 2 & 3", { x: 0, y: 10 })]),
    );
    expect(output).toContain('aria-label="a &quot;b&quot; &lt;c&gt;"');
    expect(output).toContain("1 &lt; 2 &amp; 3");
  });

  test("normalizes camelCase attributes without breaking SVG camelCase names", () => {
    const output = serialize(
      node("svg", { viewBox: "0 0 10 10", strokeWidth: 2, pathLength: 1, stopColor: "#fff" }, [
        circle({ cx: 5, cy: 5, r: 4 }),
      ]),
    );
    expect(output).toContain('viewBox="0 0 10 10"');
    expect(output).toContain('stroke-width="2"');
    expect(output).toContain('pathLength="1"');
    expect(output).toContain('stop-color="#fff"');
  });

  test("joins class arrays and serializes style objects", () => {
    const output = serialize(
      rect({ class: ["a", false, "b", undefined], style: { animationDelay: ".2s", opacity: 0.5 }, width: 1 }),
    );
    expect(output).toContain('class="a b"');
    expect(output).toContain('style="animation-delay:.2s;opacity:0.5"');
  });

  test("drops whitespace between structural elements and keeps text inline", () => {
    const output = serialize(
      g({}, [
        "   ",
        rect({ width: 10 }),
        "  ",
        text(["Plain ", tspan("red", { fill: "#f00" })], { x: 0, y: 12 }),
      ]),
    );
    expect(output).toBe(
      '<g>\n  <rect width="10"/>\n  <text x="0" y="12">Plain <tspan fill="#f00">red</tspan></text>\n</g>',
    );
  });

  test("flattens fragments and supports raw content", () => {
    const output = serialize(g({}, [raw("<!-- x -->"), rect({ width: 1 })]));
    expect(output).toContain("<!-- x -->");
    expect(output).toContain("<rect");
    expect(output.split("<rect").length).toBe(2);
  });

  test("serializes gradients with stops", () => {
    const output = serialize(
      linearGradient({ id: "g", x1: 0, y1: 0, x2: 1, y2: 1 }, [
        stop({ offset: 0, stopColor: "#fff", stopOpacity: 0.5 }),
      ]),
    );
    expect(output).toContain('<linearGradient id="g" x1="0" y1="0" x2="1" y2="1">');
    expect(output).toContain('<stop offset="0" stop-color="#fff" stop-opacity="0.5"/>');
  });

  test("drops null, undefined and boolean children", () => {
    const output = serialize(g({}, [null, undefined, false, true, rect({ width: 1 })]));
    expect(output).toBe('<g>\n  <rect width="1"/>\n</g>');
  });
});

import { describe, expect, test } from "bun:test";
import { Icon, matchPaths, render, validateSvg, type IconData, code, morph } from "svjeez";
import { flatten } from "../src/ink/path";

const scene = (child: Parameters<typeof render>[1], comment?: string) =>
  render({ width: 100, height: 100, duration: 4, title: "t", comment }, child);

describe("float rounding in timings", () => {
  test("morph accepts a transition that starts exactly when the last one ends", () => {
    const [a, b, c] = [code([[["fn", "a"]]]), code([[["fn", "b"]]]), code([[["fn", "c"]]])];

    expect(() => morph([a, b, c], { at: [1.1, 1.9], over: 0.8 })).not.toThrow();
    expect(() => morph([a, b, c], { at: [1.1, 1.8], over: 0.8 })).toThrow(/starts before/);
  });
});

describe("packed arc flags", () => {
  test("matchPaths reads a5 5 0 1010 0 as flags 1 and 0, then 10 0", () => {
    const packed = matchPaths(["M0 0a5 5 0 1010 0z"]);
    const spaced = matchPaths(["M0 0a5 5 0 1 0 10 0z"]);

    expect(packed).toEqual(spaced);
  });

  test("Ink's flatten reads the same packed flags", () => {
    const packed = flatten("M0 0a5 5 0 1010 0")[0]!.points;
    const spaced = flatten("M0 0a5 5 0 1 0 10 0")[0]!.points;

    expect(packed).toEqual(spaced);
  });
});

describe("render escaping", () => {
  test("a comment with -- is refused", () => {
    expect(() => scene(<rect width={1} height={1} />, "x --> <script>")).toThrow(/comment/);
    expect(scene(<rect width={1} height={1} />, "plain note")).toContain("<!-- plain note -->");
  });

  test("Icon rounds its transform numbers", () => {
    const icon: IconData = { grid: 24, kind: "stroke", paths: ["M0 0h1"] };
    const svg = scene(<Icon icon={icon} x={0.1 + 0.2} y={1} size={20} />);

    expect(svg).toContain("translate(0.3 1) scale(0.8333)");
  });
});

describe("validateSvg attribute matching", () => {
  test("data-id is not an id", () => {
    const svg = '<svg viewBox="0 0 1 1"><rect data-id="a"/><rect data-id="a"/></svg>';

    expect(validateSvg(svg).errors).toEqual([]);
  });

  test("authored CSS does not stand in for the generated base class", () => {
    const rects = Array.from({ length: 41 }, () => '<rect class="a"/>').join("");

    const svg = `<svg viewBox="0 0 1 1"><style>.x{animation-duration:1s}.a{animation-duration:2s;animation-iteration-count:1}</style><g filter="url(#f)">${rects}</g><defs><filter id="f"/></defs></svg>`;

    expect(validateSvg(svg).warnings.join()).toContain("re-renders every frame");
  });
});

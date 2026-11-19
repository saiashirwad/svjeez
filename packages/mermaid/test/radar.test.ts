import { describe, expect, test } from "bun:test";
import { font, scene, span } from "svjeez";
import { SceneError, svg } from "svjeez/tools";
import type { Line } from "../src/errors.ts";
import { parseMermaid } from "../src/parse.ts";
import { drawRadar, parseRadar, type RadarDoc } from "../src/radar.ts";

const mono = await font.load(
  new URL("../../svjeez/tests/fixtures/JetBrainsMono.ttf", import.meta.url),
);

const parse = (text: string): RadarDoc => {
  const [header, ...body] = text
    .split("\n")
    .map((t, i): Line => ({ file: "r.mmd", line: i + 1, text: t.trim() }))
    .filter((l) => l.text !== "");

  return parseRadar(header!, body);
};

const message = (text: string): string => {
  try {
    parse(text);
  } catch (e) {
    if (e instanceof SceneError) return e.message;
    throw e;
  }

  throw new Error("parseRadar() did not throw");
};

const AXES = 'radar-beta\naxis a["A"], b, c["C"]\n';

describe("parse radar", () => {
  test("reads axes, both curve styles and every option", () => {
    const doc = parse(`radar-beta
      title Skills
      axis a["Alpha"], b, c["Gamma"]
      curve x["Ex"]{1, 2, 3}, y{4,5,6}
      curve z["Zed"]{c: 9, a: 7.5, b: 8}
      max 10
      min -1
      ticks 3
      graticule polygon
      showLegend false`);

    expect(doc.kind).toBe("radar");
    expect(doc.title).toBe("Skills");
    expect(doc.axes).toEqual([
      { id: "a", label: "Alpha" },
      { id: "b", label: "b" },
      { id: "c", label: "Gamma" },
    ]);
    expect(doc.curves.map((c) => [c.id, c.label, c.values])).toEqual([
      ["x", "Ex", [1, 2, 3]],
      ["y", "y", [4, 5, 6]],
      ["z", "Zed", [7.5, 8, 9]],
    ]);
    expect([doc.max, doc.min, doc.ticks, doc.graticule, doc.showLegend]).toEqual([
      10,
      -1,
      3,
      "polygon",
      false,
    ]);
  });

  test("defaults, and max left to the data", () => {
    const doc = parse(`${AXES}curve x{1, 2, 3}`);

    expect(doc.max).toBeUndefined();
    expect([doc.min, doc.ticks, doc.graticule, doc.showLegend]).toEqual([0, 5, "circle", true]);
    expect(parseMermaid(`${AXES}curve x{1, 2, 3}`).kind).toBe("radar");
  });

  test("errors name the line and say how to fix it", () => {
    expect(message(`${AXES}curve x{1, 2}`)).toContain("2 values for 3 axes");
    expect(message(`${AXES}curve x{a: 1, b: 2}`)).toContain("no value for the axis c");
    expect(message(`${AXES}curve x{a: 1, z: 2, c: 3}`)).toContain("axis z");
    expect(message(`${AXES}curve x{a: 1, 2, 3}`)).toContain("mixes");
    expect(message(`${AXES}curve x{1, two, 3}`)).toContain("not a number");
    expect(message(`${AXES}curve x{1, 2, 3`)).toContain("braces");
    expect(message(`${AXES}curve x{1,2,3}\ncurve x{1,2,3}`)).toContain("already there");
    expect(message(`${AXES}curve x{1,2,3}\ngraticule square`)).toContain("circle");
    expect(message(`${AXES}curve x{1,2,3}\nticks 0`)).toContain("1 to 32");
    expect(message(`${AXES}curve x{1,2,3}\nshowLegend maybe`)).toContain("true");
    expect(message(`${AXES}curve x{1,2,3}\nmax 0`)).toContain("not above min");
    expect(message(`${AXES}curve x{1,2,3}\nwobble 3`)).toContain("cannot read this line");
    expect(message("radar-beta\naxis a, b\ncurve x{1,2}")).toContain("at least 3 axes");
    expect(message(AXES)).toContain("no curves");
    expect(message("radar-beta\naxis a, a, b, c\ncurve x{1,2,3}")).toContain("already there");
  });
});

describe("draw radar", () => {
  test("draws a doc and reveals curves in order", () => {
    const doc = parse(`${AXES}title T\ncurve x["Ex"]{1, 2, 3}\ncurve y{3, 2, 1}`);
    const chart = drawRadar(doc, { font: mono, reveal: span(0.5, 0.5) });

    const out = svg.emit(
      scene({ size: [700, 500], duration: 4, title: "Radar", loop: false }, () => chart.node),
    );

    expect(chart.when("x")?.start).toBe(0.5);
    expect(chart.when("y")?.start).toBe(1);
    expect(out).toContain(">Ex<");
    expect(out).toContain(">C<");
  });
});

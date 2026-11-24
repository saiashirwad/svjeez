import { describe, expect, test } from "bun:test";
import { font, scene, span } from "svjeez";
import { SceneError, svg } from "svjeez/tools";
import type { Line } from "../src/errors.ts";
import { drawPie, parsePie, type PieDoc } from "../src/pie.ts";
import { fontFixture } from "../../../fixtures/fonts.ts";

const mono = await font.load(fontFixture("JetBrainsMono"));

const parse = (text: string): PieDoc => {
  const [header, ...body] = text
    .split("\n")
    .map((t, i): Line => ({ file: "p.mmd", line: i + 1, text: t.trim() }))
    .filter((l) => l.text !== "");

  return parsePie(header!, body);
};

const message = (text: string): string => {
  try {
    parse(text);
  } catch (e) {
    if (e instanceof SceneError) return e.message;
    throw e;
  }

  throw new Error("parsePie() did not throw");
};

describe("parse pie", () => {
  test("reads the header options, the title and every slice", () => {
    const doc = parse(`pie showData title Pets
      "Dogs" : 386
      'Cats' : 85.5
      "Big Rats" : .5`);

    expect(doc.kind).toBe("pie");
    expect(doc.showData).toBe(true);
    expect(doc.title).toBe("Pets");
    expect(doc.source).toEqual({ file: "p.mmd", line: 1 });
    expect(doc.slices).toEqual([
      { label: "Dogs", value: 386 },
      { label: "Cats", value: 85.5 },
      { label: "Big Rats", value: 0.5 },
    ]);
  });

  test("takes the title on its own line", () => {
    const doc = parse(`pie
      title Pets adopted
      "Dogs" : 1`);

    expect(doc.showData).toBe(false);
    expect(doc.title).toBe("Pets adopted");
  });

  test("errors name the line and say how to fix it", () => {
    expect(message('pie\n"Dogs" : -3')).toBe(
      'p.mmd:2: "\\"Dogs\\" : -3": the value -3 is negative. Slices share the circle by value, so write 0 or more.',
    );
    expect(message('pie\n"Dogs" : many')).toContain("is not a number");
    expect(message('pie\n"Dogs" : 1\n"Dogs" : 2')).toContain("already there");
    expect(message("pie\nDogs : 2")).toContain("cannot read this line as a slice");
    expect(message("pie")).toContain("no slices");
    expect(message('pie\n"A" : 0')).toContain("every slice is 0");
    expect(message('pie\naccTitle: x\n"A" : 1')).toContain("accessibility");
    expect(message('pie nope\n"A" : 1')).toContain("cannot read the pie header");
  });
});

describe("draw pie", () => {
  test("draws a doc, naming a slice by its label unless that cannot be a part id", () => {
    const doc = parse('pie\n"Dogs" : 3\n"2024" : 2\n"CI/CD" : 1');
    const chart = drawPie(doc, { font: mono, reveal: span(0, 0.5) });

    const out = svg.emit(
      scene({ size: [800, 500], duration: 4, title: "Pie", loop: false }, () => chart.node),
    );

    expect(chart.when("Dogs")?.start).toBe(0);
    expect(chart.when("slice-2")?.start).toBe(0.5);
    expect(chart.when("slice-3")?.start).toBe(1);
    expect(out).toContain("CI/CD");
  });
});

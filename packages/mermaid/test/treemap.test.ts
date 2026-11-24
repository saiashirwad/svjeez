import { describe, expect, test } from "bun:test";
import { font, scene, span } from "svjeez";
import { SceneError, svg } from "svjeez/tools";
import type { Line } from "../src/errors.ts";
import { parseMermaid } from "../src/parse.ts";
import { drawTreemap, parseTreemap, type TreemapDoc } from "../src/treemap.ts";
import { fontFixture } from "../../../fixtures/fonts.ts";

const mono = await font.load(fontFixture("JetBrainsMono"));

const lines = (text: string): Line[] =>
  text.split("\n").flatMap((raw, i): Line[] => {
    const t = raw.trim();

    return t === ""
      ? []
      : [{ file: "t.mmd", line: i + 1, text: t, indent: raw.length - raw.trimStart().length }];
  });

const parse = (text: string): TreemapDoc => {
  const [header, ...body] = lines(text);

  return parseTreemap(header!, body);
};

const message = (text: string): string => {
  try {
    parse(text);
  } catch (e) {
    if (e instanceof SceneError) return e.message;
    throw e;
  }

  throw new Error("parseTreemap() did not throw");
};

describe("parse treemap", () => {
  test("reads sections, leaves, nesting, classes and the title", () => {
    const doc = parse(`treemap-beta
      title Budget
      classDef big fill:#f00
      "Food"
        "Fruit": 1,200
        'Veg': 3.5
        "Meat":::big
          "Beef": 4
      "Rent": 900:::big`);

    expect(doc.kind).toBe("treemap");
    expect(doc.title).toBe("Budget");

    interface Shape {
      readonly 0: string;
      readonly 1: number | undefined;
      readonly 2: readonly Shape[];
    }

    const shape = (n: TreemapDoc["roots"][number]): Shape => [
      n.label,
      n.value,
      n.children.map(shape),
    ];

    expect(doc.roots.map(shape)).toEqual([
      [
        "Food",
        undefined,
        [
          ["Fruit", 1200, []],
          ["Veg", 3.5, []],
          ["Meat", undefined, [["Beef", 4, []]]],
        ],
      ],
      ["Rent", 900, []],
    ]);
    expect(doc.roots[0]!.children[0]!.source).toEqual({ file: "t.mmd", line: 5 });
  });

  test("accepts the plain `treemap` header through parseMermaid", () => {
    expect(parseMermaid('treemap\n"A": 1').kind).toBe("treemap");
  });

  test("errors name the line and say how to fix it", () => {
    expect(message('treemap-beta\n"A": 0')).toContain("not above 0");
    expect(message('treemap-beta\n"A": -2')).toContain("not above 0");
    expect(message('treemap-beta\n"A": 1\n  "B": 2')).toContain("is a leaf");
    expect(message('treemap-beta\n"A"')).toContain("holds nothing");
    expect(message('treemap-beta\n"A"\n  "B"')).toContain("holds nothing");
    expect(message("treemap-beta\nA: 1")).toContain("cannot read this line as a node");
    expect(message('treemap-beta\n"": 1')).toContain("needs a label");
    expect(message('treemap-beta\naccTitle: x\n"A": 1')).toContain("accessibility");
    expect(message("treemap-beta")).toContain("no nodes");
    expect(message('treemap-beta x\n"A": 1')).toContain("just `treemap-beta`");
  });
});

describe("draw treemap", () => {
  test("draws a doc and reveals nodes in document order", () => {
    const doc = parse(`treemap-beta
      title T
      "Food"
        "Fruit": 30
        "Veg": 10
      "Rent": 60`);

    const chart = drawTreemap(doc, { font: mono, reveal: span(0.5, 0.25) });

    const out = svg.emit(
      scene({ size: [800, 600], duration: 4, title: "Treemap", loop: false }, () => chart.node),
    );

    expect(chart.when("node-1")?.start).toBe(0.5);
    expect(chart.when("node-4")?.start).toBe(1.25);
    expect(out).toContain(">Rent<");
    expect(out).toContain(">Fruit<");
    expect(out).toContain(">T<");
  });
});

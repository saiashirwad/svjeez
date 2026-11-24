import { describe, expect, test } from "bun:test";
import { font, scene, span } from "svjeez";
import { SceneError, svg } from "svjeez/tools";
import type { Line } from "../src/errors.ts";
import { mermaid, parseMermaid } from "../src/index";
import { parseSankey, type SankeyDoc } from "../src/sankey.ts";
import { fontFixture } from "../../../fixtures/fonts.ts";

const mono = await font.load(fontFixture("JetBrainsMono"));

const parse = (text: string): SankeyDoc => {
  const [header, ...body] = text
    .split("\n")
    .map((t, i): Line => ({ file: "s.mmd", line: i + 1, text: t.trim() }))
    .filter((l) => l.text !== "");

  return parseSankey(header!, body);
};

const message = (text: string): string => {
  try {
    parse(text);
  } catch (e) {
    if (e instanceof SceneError) return e.message;
    throw e;
  }

  throw new Error("parseSankey() did not throw");
};

describe("parse sankey", () => {
  test("reads rows with quoted names, escaped quotes and decimals", () => {
    const doc = parse(`sankey-beta

      Coal,Power,40
      "Gas, natural",Power,20.5
      "Say ""hi""",Power,.5`);

    expect(doc.kind).toBe("sankey");
    expect(doc.source).toEqual({ file: "s.mmd", line: 1 });
    expect(doc.nodes).toEqual(["Coal", "Power", "Gas, natural", 'Say "hi"']);
    expect(doc.links).toEqual([
      { from: "Coal", to: "Power", value: 40 },
      { from: "Gas, natural", to: "Power", value: 20.5 },
      { from: 'Say "hi"', to: "Power", value: 0.5 },
    ]);
  });

  test("accepts both header words", () => {
    expect(parseMermaid("sankey\na,b,1").kind).toBe("sankey");
    expect(parseMermaid("sankey-beta\na,b,1").kind).toBe("sankey");
  });

  test("errors name the line and say how to fix it", () => {
    expect(message("sankey-beta\na,b,-3")).toContain("is negative");
    expect(message("sankey-beta\na,b,lots")).toContain("is not a number");
    expect(message("sankey-beta\na,b,0")).toContain("flow of 0");
    expect(message("sankey-beta\na,b")).toContain("3 fields");
    expect(message("sankey-beta\na,b,1,2")).toContain("found 4");
    expect(message('sankey-beta\n"a,b,1')).toContain("not closed");
    expect(message("sankey-beta\na,a,1")).toContain("flows into itself");
    expect(message("sankey-beta\n,b,1")).toContain("name for both ends");
    expect(message("sankey-beta\na,b,1\nb,c,1\nc,a,1")).toBe(
      's.mmd:4: "c,a,1": this link closes a loop between "c" and "a". Sankey flows run one way: remove the link that leads back.',
    );
    expect(message("sankey-beta")).toContain("no links");
    expect(message("sankey-beta nope\na,b,1")).toContain("cannot read the sankey header");
  });
});

describe("mermaid sankey", () => {
  test("draws the doc, naming a node by its name unless that cannot be a part id", () => {
    const chart = mermaid("sankey-beta\nCI/CD,Prod,3\nDev,CI/CD,3", {
      font: mono,
      reveal: span(0, 0.5),
    });

    const out = svg.emit(
      scene({ size: [800, 500], duration: 4, title: "Sankey", loop: false }, () => chart.node),
    );

    expect(chart.kind).toBe("sankey");
    expect(chart.when("node-1")).toBeDefined();
    expect(chart.when("Dev")).toBeDefined();
    expect(out).toContain("CI/CD");
  });

  test("rejects a direction", () => {
    expect(() => mermaid("sankey-beta\na,b,1", { font: mono, direction: "LR" })).toThrow(
      "A sankey diagram has no direction.",
    );
  });
});

import { describe, expect, test } from "bun:test";
import { font, scene, span } from "svjeez";
import { SceneError, svg } from "svjeez/tools";
import { parseBlock, type BlockDoc } from "../src/block.ts";
import type { Line } from "../src/errors.ts";
import { mermaid, parseMermaid } from "../src/index";
import { fontFixture } from "../../../fixtures/fonts.ts";

const mono = await font.load(fontFixture("JetBrainsMono"));

const parse = (text: string): BlockDoc => {
  const [header, ...body] = text
    .split("\n")
    .map((t, i): Line => ({ file: "b.mmd", line: i + 1, text: t.trim() }))
    .filter((l) => l.text !== "");

  return parseBlock(header!, body);
};

const message = (text: string): string => {
  try {
    parse(text);
  } catch (e) {
    if (e instanceof SceneError) return e.message;
    throw e;
  }

  throw new Error("parseBlock() did not throw");
};

describe("parse block", () => {
  test("reads columns, shapes, widths, spaces and several blocks on a line", () => {
    const doc = parse(`block-beta
      columns 3
      a["Alpha"] b:2 c
      d(["Stadium"]) space:2 e{"Pick"}
      f[("Db")] g((o)) h[[sub]] i("round")`);

    expect(doc.kind).toBe("block");
    expect(doc.columns).toBe(3);
    expect(doc.source).toEqual({ file: "b.mmd", line: 1 });
    expect(
      doc.items.map((i) => (i.kind === "node" ? [i.id, i.label, i.shape, i.span] : i)),
    ).toEqual([
      ["a", "Alpha", "rect", 1],
      ["b", "b", "rect", 2],
      ["c", "c", "rect", 1],
      ["d", "Stadium", "stadium", 1],
      { kind: "space", span: 2 },
      ["e", "Pick", "diamond", 1],
      ["f", "Db", "cylinder", 1],
      ["g", "o", "circle", 1],
      ["h", "sub", "subroutine", 1],
      ["i", "round", "round", 1],
    ]);
  });

  test("reads nested groups, each with its own columns", () => {
    const doc = parse(`block
      columns 2
      block:one:2
        columns 1
        a b
      end
      block
        c
      end`);

    const [one, anon] = doc.items;

    expect(one).toMatchObject({ kind: "group", id: "one", span: 2, columns: 1 });
    expect(one?.kind === "group" && one.items).toHaveLength(2);
    expect(anon).toMatchObject({ kind: "group", id: "group-1", span: 1 });
  });

  test("reads edges, labels, arrow forms and blocks declared inside them", () => {
    const doc = parse(`block-beta
      a space b
      a --> b
      a -- "via" --> b
      b -.-> c
      c ==> a
      a --- c`);

    expect(doc.items.filter((i) => i.kind === "node").map((i) => i.id)).toEqual(["a", "b", "c"]);
    expect(doc.edges).toEqual([
      { from: "a", to: "b", line: "solid", arrow: true },
      { from: "a", to: "b", label: "via", line: "solid", arrow: true },
      { from: "b", to: "c", line: "dotted", arrow: true },
      { from: "c", to: "a", line: "thick", arrow: true },
      { from: "a", to: "c", line: "solid", arrow: false },
    ]);
  });

  test("a block named again keeps its place and takes the new label", () => {
    const doc = parse(`block
      a b
      a("Start")-->b("Stop")`);

    expect(doc.items).toHaveLength(2);
    expect(doc.items[0]).toMatchObject({ id: "a", label: "Start", shape: "round" });
    expect(doc.edges).toHaveLength(1);
  });

  test("reads block arrows", () => {
    const doc = parse(`block
      go<["Go"]>(right) up<[" "]>(y)`);

    expect(doc.items[0]).toMatchObject({ id: "go", label: "Go", shape: "arrow-right" });
    expect(doc.items[1]).toMatchObject({ id: "up", shape: "arrow-y" });
  });

  test("accepts both header words", () => {
    expect(parseMermaid("block\na").kind).toBe("block");
    expect(parseMermaid("block-beta\na").kind).toBe("block");
  });

  test("errors name the line and say how to fix it", () => {
    expect(message("block-beta\nclassDef x fill:#fff")).toContain("classDef is not supported");
    expect(message("block-beta\nstyle a fill:#fff")).toContain("style is not supported");
    expect(message("block-beta\ncolumns 0\na")).toContain("columns needs");
    expect(message("block-beta\na{{x}}")).toContain("not supported");
    expect(message("block-beta\na[/x/]")).toContain("not supported");
    expect(message('block-beta\na["x')).toContain("not closed");
    expect(message("block-beta\na[x")).toContain("never closes");
    expect(message("block-beta\nblock\na")).toContain("never closed");
    expect(message("block-beta\nend")).toContain("none is open");
    expect(message("block-beta\nblock\nend")).toContain("empty");
    expect(message("block-beta\na:0")).toContain("1 or more");
    expect(message("block-beta\na --> a")).toContain("points back to itself");
    expect(message("block-beta\na -->")).toContain("needs a block after");
    expect(message("block-beta\na --x b")).toContain("expected a block id");
    expect(message("block-beta\nd<[x]>(up, down)")).toContain("one arrow per block");
    expect(message("block-beta\nd<[x]>")).toContain("needs a direction");
    expect(message("block-beta\nblock:a\nb\nend\nblock:a\nc\nend")).toContain("already used");
    expect(message("block-beta")).toContain("no blocks");
    expect(message("block-beta nope\na")).toContain("cannot read the block header");
  });
});

describe("mermaid block", () => {
  const text = `block-beta
    columns 2
    a b
    block:g:2
      c
    end
    a --> b
    b -- "x" --> c`;

  test("draws the doc with a part for each block, group and edge", () => {
    const chart = mermaid(text, { font: mono, reveal: span(0, 0.5) });

    const out = svg.emit(
      scene({ size: [800, 500], duration: 4, title: "Block", loop: false }, () => chart.node),
    );

    expect(chart.kind).toBe("block");
    expect(chart.when("a")?.start).toBe(0);
    expect(chart.when("g")).toBeDefined();
    expect(chart.when("b->c")).toBeDefined();
    expect(out).toContain(">x<");
  });

  test("rejects a direction", () => {
    expect(() => mermaid(text, { font: mono, direction: "LR" })).toThrow(
      "A block diagram has no direction.",
    );
  });
});

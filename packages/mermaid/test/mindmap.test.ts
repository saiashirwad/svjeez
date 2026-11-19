import { describe, expect, test } from "bun:test";
import { font, scene, span } from "svjeez";
import { SceneError, svg } from "svjeez/tools";
import type { Line } from "../src/errors.ts";
import { drawMindmap, parseMindmap, type MindmapDoc } from "../src/mindmap.ts";

const mono = await font.load(
  new URL("../../svjeez/tests/fixtures/JetBrainsMono.ttf", import.meta.url),
);

const lines = (text: string): Line[] =>
  text.split("\n").flatMap((raw, i): Line[] => {
    const text = raw.trim();

    return text === ""
      ? []
      : [{ file: "m.mmd", line: i + 1, text, indent: raw.length - raw.trimStart().length }];
  });

const parse = (text: string): MindmapDoc => {
  const [header, ...body] = lines(text);

  return parseMindmap(header!, body);
};

const message = (text: string): string => {
  try {
    parse(text);
  } catch (e) {
    if (e instanceof SceneError) return e.message;
    throw e;
  }

  throw new Error("parseMindmap() did not throw");
};

describe("parse mindmap", () => {
  test("builds the tree from indentation and reads every shape", () => {
    const doc = parse(`mindmap
      root((mindmap))
        Origins
          Long history
          Popularisation
        id1[Square]
        id2(Rounded)
        id4))Bang((
        id5)Cloud(
        id6{{Hexagon}}
        "Quoted (text)"
        Some words (aside)`);

    expect(doc.kind).toBe("mindmap");
    expect(doc.source).toEqual({ file: "m.mmd", line: 1 });
    expect([doc.root.label, doc.root.shape]).toEqual(["mindmap", "circle"]);
    expect(doc.root.children.map((c) => [c.label, c.shape])).toEqual([
      ["Origins", "default"],
      ["Square", "rect"],
      ["Rounded", "round"],
      ["Bang", "bang"],
      ["Cloud", "cloud"],
      ["Hexagon", "hex"],
      ["Quoted (text)", "default"],
      ["Some words (aside)", "default"],
    ]);
    expect(doc.root.children[0]!.children.map((c) => c.label)).toEqual([
      "Long history",
      "Popularisation",
    ]);
    expect(doc.root.children[0]!.children[1]!.source.line).toBe(5);
  });

  test("a line indented less than the previous one goes back up to its parent", () => {
    const doc = parse(`mindmap
  A
      B
          C
        D
      E`);

    expect(doc.root.children.map((c) => c.label)).toEqual(["B", "E"]);
    expect(doc.root.children[0]!.children.map((c) => c.label)).toEqual(["C", "D"]);
  });

  test("errors name the line and say how to fix it", () => {
    expect(message("mindmap\n  ::icon(fa fa-book)\n  A")).toContain("before the root");
    expect(message("mindmap\n  A\n  B")).toBe(
      'm.mmd:3: "B": there can be only one root, and "A" is it. Indent this line under a node.',
    );
    expect(message("mindmap")).toContain("no root");
    expect(message("mindmap\n  A\n    ()")).toContain("needs some text");
    expect(message("mindmap x")).toContain("just `mindmap`");
  });
});

describe("parse mindmap decorations", () => {
  test("accepts icon and class lines without drawing them", () => {
    const doc = parse(`mindmap
      root
        Books
        ::icon(fa fa-book)
        :::big wide
        Ideas:::big
        ::icon(mdi mdi-lightbulb)`);

    expect(doc.root.children.map((c) => c.label)).toEqual(["Books", "Ideas"]);
  });

  test("reads markdown strings as plain text", () => {
    const doc = parse(`mindmap
      root["\`**bold** and *soft*\`"]
        "\`plain __strong__ text\`"
        snake_case_name`);

    expect(doc.root.label).toBe("bold and soft");
    expect(doc.root.children.map((c) => c.label)).toEqual(["plain strong text", "snake_case_name"]);
  });
});

describe("draw mindmap", () => {
  test("numbers the ideas depth first, and reveals them outward", () => {
    const doc = parse("mindmap\n  Root\n    A\n      A1\n    B");
    const map = drawMindmap(doc, { font: mono, reveal: span(0, 1) });

    const out = svg.emit(
      scene({ size: [800, 400], duration: 4, title: "Mind", loop: false }, () => map.node),
    );

    expect(map.when("node-1")?.start).toBe(0);
    expect(map.when("node-2")?.start).toBe(1);
    expect(map.when("node-4")?.start).toBe(2);
    expect(map.when("node-3")?.start).toBe(3);
    expect(map.when("node-2->node-3")).toBeDefined();
    expect(out).toContain(">A1<");
  });
});

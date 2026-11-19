import { describe, expect, test } from "bun:test";
import { font, scene } from "svjeez";
import { SceneError, svg } from "svjeez/tools";
import { drawC4, parseC4, type C4Doc } from "../src/c4.ts";
import type { Line } from "../src/errors.ts";

const mono = await font.load(
  new URL("../../svjeez/tests/fixtures/JetBrainsMono.ttf", import.meta.url),
);

const lines = (text: string): Line[] =>
  text
    .split("\n")
    .map((t, i) => ({ file: "c4.mmd", line: i + 1, text: t.trim() }))
    .filter((l) => l.text !== "" && !l.text.startsWith("%%"));

const parse = (text: string, header = "C4Context"): C4Doc => {
  const [first, ...body] = lines(`${header}\n${text}`);

  return parseC4(first!, body);
};

const message = (text: string): string => {
  try {
    parse(text);
  } catch (e) {
    if (e instanceof SceneError) return e.message;

    throw e;
  }

  throw new Error("parseC4() did not throw");
};

describe("parse c4", () => {
  test("reads every header word", () => {
    for (const h of [
      "C4Context",
      "C4Container",
      "C4Component",
      "C4Dynamic",
      "C4Deployment",
    ] as const)
      expect(parse('System(a, "A")', h).header).toBe(h);
  });

  test("reads people, systems, containers and components with their variants", () => {
    const doc = parse(`
      title Banking
      Person(p, "P", "a person")
      Person_Ext(pe, "PE")
      System(s, "S", "descr")
      SystemDb_Ext(sd, "SD")
      SystemQueue(sq, "SQ")
      Container(c, "C", "Java", "a container")
      ContainerDb(cd, "CD", $techn="PostgreSQL", $descr="rows")
      Component_Ext(ce, "CE", "Go")
      ComponentQueue(cq, "CQ")`);

    expect(doc.title).toBe("Banking");

    expect(doc.shapes.map((s) => [s.id, s.kind, s.shape, s.external])).toEqual([
      ["p", "person", "box", false],
      ["pe", "person", "box", true],
      ["s", "system", "box", false],
      ["sd", "system", "db", true],
      ["sq", "system", "queue", false],
      ["c", "container", "box", false],
      ["cd", "container", "db", false],
      ["ce", "component", "box", true],
      ["cq", "component", "queue", false],
    ]);
    expect(doc.shapes[0]).toMatchObject({ descr: "a person" });
    expect(doc.shapes[5]).toMatchObject({ techn: "Java", descr: "a container" });
    expect(doc.shapes[6]).toMatchObject({ techn: "PostgreSQL", descr: "rows" });
  });

  test("reads nested boundaries with the brace on the same or the next line", () => {
    const doc = parse(`
      Enterprise_Boundary(e, "Bank") {
        System_Boundary(s, "Online")
        {
          Container(a, "A")
        }
        Boundary(b, "Other", "custom") {
          System(x, "X")
        }
        Node(n, "Server", "Linux") {
          Container(y, "Y")
        }
      }`);

    expect(doc.boundaries.map((b) => [b.id, b.type, b.boundary])).toEqual([
      ["e", "Enterprise", undefined],
      ["s", "System", "e"],
      ["b", "custom", "e"],
      ["n", "Linux", "e"],
    ]);
    expect(doc.shapes.map((s) => [s.id, s.boundary])).toEqual([
      ["a", "s"],
      ["x", "b"],
      ["y", "n"],
    ]);
  });

  test("reads relationships, bidirectional ones and indexed ones", () => {
    const doc = parse(`
      System(a, "A")
      System(b, "B")
      Rel(a, b, "Uses", "HTTPS")
      BiRel(b, a, "Syncs")
      Rel_D(a, b, "Down")
      RelIndex(2, a, b, "Step", $techn="gRPC")`);

    expect(doc.relations.map((r) => [r.from, r.to, r.label, r.techn, r.both, r.index])).toEqual([
      ["a", "b", "Uses", "HTTPS", false, undefined],
      ["b", "a", "Syncs", undefined, true, undefined],
      ["a", "b", "Down", undefined, false, undefined],
      ["a", "b", "Step", "gRPC", false, "2"],
    ]);
  });

  test("keeps commas and brackets inside quoted text and ignores the Update statements", () => {
    const doc = parse(`
      System(a, "A, with (parens)", "one, two<br/>three")
      UpdateElementStyle(a, $bgColor="red")
      UpdateRelStyle(a, a, $offsetX="5")
      UpdateLayoutConfig($c4ShapeInRow="3")`);

    expect(doc.shapes[0]).toMatchObject({ label: "A, with (parens)", descr: "one, two three" });
  });
});

describe("parse c4 errors", () => {
  test("rejects what svjeez does not draw, with the reason", () => {
    expect(message("accTitle: x")).toContain("accessibility text");
    expect(message('System(a, "A") {\n}')).toContain("holds nothing");
    expect(message('Frobnicate(a, "A")')).toContain("is not a C4 statement");
    expect(message("direction RL")).toContain("top to bottom or left to right");
  });

  test("rejects bad arguments with a fix", () => {
    expect(message("System(a)")).toContain("needs label");
    expect(message('System(a, "A", "d", "s", "t", "l", "extra")')).toContain("at most 6");
    expect(message('System(a, "A", $color="red")')).toContain("no argument $color");
    expect(message('System(a, "A", $descr="x", $descr="y")')).toContain("given twice");
    expect(message('System(a, "A)')).toContain("quote is never closed");
    expect(message('System(a, "A")\nSystem(a, "B")')).toContain("already used");
  });

  test("rejects bad structure, reporting file and line", () => {
    expect(message('System_Boundary(b, "B") {\nSystem(a, "A")')).toContain(
      'boundary "b" is never closed',
    );
    expect(message("}")).toContain("closes nothing");
    expect(message('System_Boundary(b, "B") {\n}\nSystem(a, "A")')).toContain("is empty");
    expect(message('System(a, "A")\nRel(a, z, "x")')).toContain('"z" is not an element');
    expect(message('System_Boundary(b, "B") {\nSystem(a, "A")\n}\nRel(a, b, "x")')).toContain(
      "is a boundary",
    );
    expect(message("two words")).toMatch(/^c4\.mmd:2: "two words": cannot read this line/);
    expect(() => parse("")).toThrow("has no elements");
    expect(() => parse('System(a, "A")', "C4Nope")).toThrow("a C4 diagram header is one of");
  });
});

describe("drawC4", () => {
  test("draws elements, boundaries and relationships as parts", () => {
    const doc = parse(`
      title Shop
      System_Boundary(b, "Shop") {
        Container(web, "Web", "React", "The UI")
      }
      Person(u, "User")
      Rel(u, web, "Uses", "HTTPS")`);

    const diagram = drawC4(doc, { font: mono });

    const markup = svg.emit(
      scene({ size: [600, 600], duration: 1, title: "C4", loop: false }, () => diagram.node),
    );

    for (const part of ["web", "u", "b", "u->web"]) expect(() => diagram.part(part)).not.toThrow();

    for (const text of ["Shop", "[Container: React]", "The UI", "Uses", "[HTTPS]", "[Person]"])
      expect(markup).toContain(text);
  });
});

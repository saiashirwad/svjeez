import { describe, expect, test } from "bun:test";
import { font, scene } from "svjeez";
import { SceneError, svg } from "svjeez/tools";
import { drawEr, parseEr, type ErDoc } from "../src/er.ts";
import type { Line } from "../src/errors.ts";

const mono = await font.load(
  new URL("../../svjeez/tests/fixtures/JetBrainsMono.ttf", import.meta.url),
);

const lines = (text: string): Line[] =>
  text
    .split("\n")
    .map((t, i) => ({ file: "er.mmd", line: i + 1, text: t.trim() }))
    .filter((l) => l.text !== "" && !l.text.startsWith("%%"));

const parse = (text: string): ErDoc => {
  const [first, ...body] = lines(`erDiagram\n${text}`);

  return parseEr(first!, body);
};

const message = (text: string): string => {
  try {
    parse(text);
  } catch (e) {
    if (e instanceof SceneError) return e.message;

    throw e;
  }

  throw new Error("parseEr() did not throw");
};

describe("parse er", () => {
  test("reads entities with attribute tables, keys, comments and aliases", () => {
    const doc = parse(`
      CUSTOMER {
        string name PK "full name"
        string? middle
        int id pk, fk
        map~string,int~ extra
      }
      p[Person]
      "ORDER ITEM"`);

    expect(doc.entities.map((e) => [e.id, e.label])).toEqual([
      ["CUSTOMER", "CUSTOMER"],
      ["p", "Person"],
      ["ORDER ITEM", "ORDER ITEM"],
    ]);
    expect(doc.entities[0]!.attributes).toEqual([
      { type: "string", name: "name", keys: ["PK"], comment: "full name" },
      { type: "string?", name: "middle", keys: [] },
      { type: "int", name: "id", keys: ["PK", "FK"] },
      { type: "map<string,int>", name: "extra", keys: [] },
    ]);
  });

  test("reads every cardinality, line and label form, left end first", () => {
    const doc = parse(`
      A ||--o{ B : places
      B |o..|{ C : "is in"
      C }o--o| D : has
      D }|--|| "E F" : owns
      NAMED-DRIVER ||--|| A : is`);

    expect(doc.relations.map((r) => [r.from, r.to, r.fromCard, r.toCard, r.line, r.label])).toEqual(
      [
        ["A", "B", "one", "zero-many", "solid", "places"],
        ["B", "C", "zero-one", "one-many", "dashed", "is in"],
        ["C", "D", "zero-many", "zero-one", "solid", "has"],
        ["D", "E F", "one-many", "one", "solid", "owns"],
        ["NAMED-DRIVER", "A", "one", "one", "solid", "is"],
      ],
    );
    expect(doc.entities.map((e) => e.id)).toEqual(["A", "B", "C", "D", "E F", "NAMED-DRIVER"]);
  });

  test("reads direction", () => {
    expect(parse("direction LR\nA ||--|| B : x").direction).toBe("LR");
  });
});

describe("parse er errors", () => {
  test("rejects what svjeez does not draw, with the reason", () => {
    expect(message("A ||--o{ B")).toContain("needs a label");
    expect(message("CAR 1 to zero or more DRIVER : allows")).toContain("word cardinalities");
    expect(message("style A fill:#f9f")).toContain("style is not supported");
    expect(message("subgraph x")).toContain("subgraph is not supported");
    expect(message("direction RL")).toContain("top to bottom or left to right");
    expect(message("A:::cls")).toContain("`:::`");
  });

  test("reports bad attributes and unclosed entities with their file and line", () => {
    expect(message("A {\nonlyone\n}")).toMatch(/^er\.mmd:3: "onlyone": cannot read this attribute/);
    expect(message("A {\nint id")).toContain('entity "A" is never closed');
    expect(message("two words")).toContain("cannot read this line");
  });
});

describe("drawEr", () => {
  test("draws the doc as an ER diagram with a part per entity and relationship", () => {
    const doc = parse(`
      CUSTOMER ||--o{ ORDER : places
      ORDER {
        int id PK
      }`);

    const diagram = drawEr(doc, { font: mono });

    const markup = svg.emit(
      scene({ size: [600, 600], duration: 1, title: "Er", loop: false }, () => diagram.node),
    );

    expect(() => diagram.part("CUSTOMER->ORDER")).not.toThrow();
    expect(markup).toContain("<svg");
    expect(markup).toContain("places");
  });
});

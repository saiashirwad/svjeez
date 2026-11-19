import { describe, expect, test } from "bun:test";
import { font, scene } from "svjeez";
import { SceneError, svg } from "svjeez/tools";
import { drawClass, parseClass, type ClassDoc } from "../src/class.ts";
import type { Line } from "../src/errors.ts";

const mono = await font.load(
  new URL("../../svjeez/tests/fixtures/JetBrainsMono.ttf", import.meta.url),
);

const lines = (text: string): Line[] =>
  text
    .split("\n")
    .map((t, i) => ({ file: "class.mmd", line: i + 1, text: t.trim() }))
    .filter((l) => l.text !== "" && !l.text.startsWith("%%"));

const parse = (text: string): ClassDoc => {
  const [first, ...body] = lines(`classDiagram\n${text}`);

  return parseClass(first!, body);
};

const message = (text: string): string => {
  try {
    parse(text);
  } catch (e) {
    if (e instanceof SceneError) return e.message;

    throw e;
  }

  throw new Error("parseClass() did not throw");
};

describe("parse class", () => {
  test("reads classes, members, annotations and generics", () => {
    const doc = parse(`
      class Customer {
        +String name
        -int age
        +orders() List~Order~
      }
      class Payment {
        <<interface>>
        +authorise() bool
      }
      class Box~T~
      class Named["A label"]
      Customer : +email
      <<abstract>> Box`);

    expect(doc.classes.map((c) => c.id)).toEqual(["Customer", "Payment", "Box", "Named"]);
    expect(doc.classes[0]).toEqual({
      id: "Customer",
      label: "Customer",
      attributes: ["+String name", "-int age", "+email"],
      methods: ["+orders() List<Order>"],
    });
    expect(doc.classes[1]!.annotation).toBe("interface");
    expect(doc.classes[2]).toMatchObject({ label: "Box<T>", annotation: "abstract" });
    expect(doc.classes[3]!.label).toBe("A label");
  });

  test("reads every relationship marker and line", () => {
    const doc = parse(`
      A <|-- B
      C --|> D
      E *-- F
      G --o H
      I --> J
      K ..> L
      M ..|> N
      O -- P
      Q .. R
      S <|--|> T
      U "1" --> "*" V : places`);

    expect(doc.relations.map((r) => [r.from, r.to, r.start, r.end, r.line])).toEqual([
      ["A", "B", "triangle", "none", "solid"],
      ["C", "D", "none", "triangle", "solid"],
      ["E", "F", "diamond-filled", "none", "solid"],
      ["G", "H", "none", "diamond", "solid"],
      ["I", "J", "none", "arrow", "solid"],
      ["K", "L", "none", "arrow", "dashed"],
      ["M", "N", "none", "triangle", "dashed"],
      ["O", "P", "none", "none", "solid"],
      ["Q", "R", "none", "none", "dashed"],
      ["S", "T", "triangle", "triangle", "solid"],
      ["U", "V", "none", "arrow", "solid"],
    ]);
    expect(doc.relations.at(-1)).toMatchObject({ fromLabel: "1", toLabel: "*", label: "places" });
    expect(doc.classes.map((c) => c.id)).toContain("V");
  });

  test("reads namespaces and direction", () => {
    const doc = parse(`
      direction LR
      namespace Shapes {
        class Triangle
        class Rectangle {
          double width
        }
      }
      Triangle --> Rectangle`);

    expect(doc.direction).toBe("LR");
    expect(doc.namespaces).toEqual([{ id: "Shapes", classes: ["Triangle", "Rectangle"] }]);
    expect(doc.classes[1]!.attributes).toEqual(["double width"]);
  });
});

describe("parse class errors", () => {
  test("rejects what svjeez does not draw, with the reason and what is supported", () => {
    expect(message('note "hello"')).toContain("note is not supported: notes are not drawn");
    expect(message("classDef big fill:#f9f")).toContain("classDef is not supported");
    expect(message("class A:::big")).toContain("`:::` style classes are not supported");
    expect(message("Foo ()-- Bar")).toContain("lollipop");
    expect(message("direction UP")).toContain("not one of TB, LR, BT or RL");
    expect(message("class A {\n+run()*\n}")).toContain("abstract");
    expect(message("namespace A {\nnamespace B {")).toContain("nested namespaces");
    expect(message('click A href "x"')).toContain("click is not supported");
  });

  test("reports unclosed bodies and unreadable lines with their file and line", () => {
    expect(message("class A {\n+x")).toContain("class A is never closed");
    expect(message("namespace N {\nclass A")).toContain("namespace N is never closed");
    expect(message("this is nonsense")).toMatch(/^class\.mmd:2: "this is nonsense": cannot read/);
    expect(message("namespace N {\n}")).toContain("has no classes");
  });
});

describe("drawClass", () => {
  test("draws the doc as a class diagram with a part per class and relation", () => {
    const doc = parse(`
      class Animal {
        +int age
      }
      Animal <|-- Duck
      Duck "1" --> "*" Egg : lays`);

    const diagram = drawClass(doc, { font: mono });

    const markup = svg.emit(
      scene({ size: [600, 600], duration: 1, title: "Class", loop: false }, () => diagram.node),
    );

    expect(diagram.when("Duck->Egg")).toBeUndefined();
    expect(() => diagram.part("Animal->Duck")).not.toThrow();
    expect(markup).toContain("<svg");
    expect(markup).toContain("lays");
  });
});

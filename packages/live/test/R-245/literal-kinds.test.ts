import { describe, expect, test } from "bun:test";
import { ease } from "svjeez";
import { parse } from "../../src/source";
import { keysScene, plane } from "../helpers/live-source";

describe("literals", () => {
  test("each literal has its exact range, its value and where it sits", () => {
    const source = parse(plane);
    const r = source.literals.find((l) => l.role.kind === "attribute" && l.role.name === "r")!;

    expect(plane.slice(...r.range)).toBe("4");
    expect(r).toMatchObject({
      kind: "number",
      value: 4,
      role: { kind: "attribute", name: "r", tag: "circle" },
    });
    expect(source.literals.find((l) => l.kind === "color")).toMatchObject({ value: "#FFFFFF" });
  });

  test("an ease is one literal, named or bezier, and its numbers are not numbers of their own", () => {
    const source = parse(
      "const a = ease.bezier(0.2, -0.8, 0.2, 1); const b = ease.pop; const c = ease.hold;",
    );

    expect(source.literals.map((l) => l.kind)).toEqual(["ease", "ease"]);
    expect(source.literals[0]).toMatchObject({
      name: "bezier",
      value: ease.bezier(0.2, -0.8, 0.2, 1),
    });
    expect(source.literals[1]).toMatchObject({ name: "pop", value: ease.pop });
  });

  test("quoted attributes, eight-digit colors and numeric separators read as what they are", () => {
    const [fill, stroke, x] = parse(keysScene).literals.filter((l) => l.key.startsWith("default"));

    expect(fill).toMatchObject({
      kind: "color",
      value: "#3EE6D6",
      role: { kind: "attribute", name: "fill", tag: "rect" },
    });
    expect(stroke).toMatchObject({ kind: "color", value: "#181f2e8c" });
    expect(x).toMatchObject({ kind: "number", value: 30000 });
  });
});

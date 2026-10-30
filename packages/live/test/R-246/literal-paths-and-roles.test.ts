import { describe, expect, test } from "bun:test";
import { literalAt, parse } from "../../src/source";
import { numbers, plane } from "../helpers/live-source";

describe("literals", () => {
  test("a path leads from a const through objects and arrays", () => {
    const source = parse(plane);

    expect(literalAt(source, ["launch"])).toMatchObject({
      value: 0.4,
      role: { kind: "const", name: "launch" },
    });
    expect(literalAt(source, ["legs", 1, "over"])).toMatchObject({ value: 1.2 });
    expect(literalAt(source, ["legs", 0, "to", 1])).toMatchObject({ text: "-80", value: -80 });
    expect(literalAt(source, ["legs", 0, "to", 1])!.role).toEqual({ kind: "other" });
    expect(
      source.literals.find((l) => l.text === "0" && l.role.kind === "other")?.path,
    ).toBeUndefined();
  });

  test("call arguments know the method and their place", () => {
    const at = numbers("motion({ y: 1 }).at(0.8 + i).to({ y: 0 }, 0.6);").map((l) => l.role);

    expect(at).toEqual([
      { kind: "property", name: "y" },
      { kind: "argument", callee: "at", index: 0 },
      { kind: "property", name: "y" },
      { kind: "argument", callee: "to", index: 1 },
    ]);
  });
});

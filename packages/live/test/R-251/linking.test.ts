import { describe, expect, test } from "bun:test";
import { callsIn, madeBy, parse } from "../../src/source";
import { meadow } from "../helpers/live-source";

describe("linking", () => {
  const source = parse(meadow);
  const at = (needle: string) => meadow.indexOf(needle);
  const tags = (offset: number) => madeBy(source, offset).map((e) => e.tag);

  test("an attribute shapes its own element", () => {
    expect(tags(at("cx={360}"))).toEqual(["circle"]);
  });

  test("a param shapes every element that reads it", () => {
    expect(tags(at("sky: color"))).toEqual(["rect"]);
    expect(tags(at("grass: color"))).toEqual(["path", "path"]);
    expect(tags(at("flowers: count"))).toEqual(["g"]);
  });

  test("a const shapes what its uses shape", () => {
    expect(tags(at("const pulse"))).toEqual(["circle"]);
  });

  test("an element's motion steps follow animation={name} to the const", () => {
    const sun = source.elements.find(
      (e) => e.tag === "circle" && e.attributes.some((a) => a.ref === "sun"),
    )!;

    const steps = callsIn(source, sun, "to").map(([from]) => source.lineAt(from));

    expect(steps.length).toBe(2);
    expect(steps.every((n) => source.text.split("\n")[n - 1]!.includes("const sunrise"))).toBe(
      true,
    );

    const flower = source.elements.find(
      (e) => e.tag === "g" && e.attributes.some((a) => a.name === "animation"),
    )!;

    expect(callsIn(source, flower, "label").length).toBe(1);
    expect(callsIn(source, flower, "to").length).toBe(2);
  });
});

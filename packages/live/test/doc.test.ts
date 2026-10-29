import { describe, expect, test } from "bun:test";
import { ease } from "svjeez";
import { choice, color, easing, number } from "svjeez/params";
import { open } from "../src/doc";

const text = `import { choice, color, easing, number } from "svjeez/params";

export const params = {
  length: number(190, { min: 80, max: 240, step: 1 }),
  swing: number(30.5, { min: 10, max: 50, step: 0.5, unit: "°" }),
  fill: color("#F2B84B"),
  cap: choice("round", ["round", "square"]),
  rise: easing(ease.pop),
};

export default () => null;
`;

const params = {
  length: number(190, { min: 80, max: 240, step: 1 }),
  swing: number(30.5, { min: 10, max: 50, step: 0.5, unit: "°" }),
  fill: color("#F2B84B"),
  cap: choice("round", ["round", "square"]),
  rise: easing(ease.pop),
};

describe("open", () => {
  test("a document starts as the file with the values it declares", () => {
    const doc = open(text, params);

    expect(doc.source).toBe(text);
    expect(doc.values).toEqual({
      length: 190,
      swing: 30.5,
      fill: "#F2B84B",
      cap: "round",
      rise: ease.pop,
    });
  });

  test("set rewrites exactly the literal that declares the value", () => {
    const doc = open(text, params).set("length", 200);

    expect(doc.source).toBe(text.replace("number(190", "number(200"));
    expect(doc.values.length).toBe(200);
  });

  test("set fits a number to its param's range and step", () => {
    const doc = open(text, params);

    expect(doc.set("swing", 41.3).values.swing).toBe(41.5);
    expect(doc.set("length", 9000).source).toContain("number(240,");
    expect(doc.set("length", -5).values.length).toBe(80);
  });

  test("set leaves the earlier document as it was", () => {
    const doc = open(text, params);
    doc.set("length", 200);

    expect(doc.source).toBe(text);
    expect(doc.values.length).toBe(190);
  });

  test("set to the value held returns the same document", () => {
    const doc = open(text, params);

    expect(doc.set("length", 190.2)).toBe(doc);
    expect(doc.set("cap", "round")).toBe(doc);
  });

  test("edits to several values all land, and setting one back restores its text", () => {
    const doc = open(text, params)
      .set("fill", "#FF0000")
      .set("cap", "square")
      .set("rise", ease.out)
      .set("length", 120);

    expect(doc.source).toBe(
      text
        .replace('color("#F2B84B")', 'color("#FF0000")')
        .replace('choice("round"', 'choice("square"')
        .replace("easing(ease.pop)", "easing(ease.out)")
        .replace("number(190", "number(120"),
    );
    expect(doc.set("length", 190).set("fill", "#F2B84B").source).toBe(
      doc.source.replace("number(120", "number(190").replace('"#FF0000"', '"#F2B84B"'),
    );
  });

  test("a param the file declares some other way is an error", () => {
    expect(() => open(text.replace("number(190", "number(LENGTH"), params)).toThrow(
      "params.length is not declared with a number literal.",
    );
  });
});

import { describe, expect, test } from "bun:test";
import { derive } from "../../src/index";
import { svg } from "../helpers/dynamics";

describe("derive", () => {
  const steps = [String.raw`2x + 4 = 10`, { tex: String.raw`x + 2 = 5`, note: String.raw`\div 2` }];

  test("every line puts its equals sign on the same x", () => {
    const d = derive(steps, { at: 0, x: 200 });

    for (const line of d.lines) {
      const sign = line.words.find((g) => g.char === "=")!;
      expect(sign.bounds.x + sign.bounds.w / 2).toBeCloseTo(200, 0);
    }
  });

  test("stack puts each line lower, in place keeps them level", () => {
    const stacked = derive(steps, { at: 0, stack: true, lineHeight: 70 });
    expect(stacked.lines[1]!.bounds.y - stacked.lines[0]!.bounds.y).toBeCloseTo(70, 0);
    const level = derive(steps, { at: 0 });
    expect(level.lines[1]!.bounds.y).toBeCloseTo(level.lines[0]!.bounds.y, 0);
    expect(level.end).toBeCloseTo(2.5 + 0.9, 5);
  });

  test("in place, one morphing line carries the notes and renders", () => {
    const out = svg(derive(steps, { at: 0, every: 3 }).node);
    expect(out).toContain("<path");
  });

  test("aligns on a named part", () => {
    const d = derive([String.raw`a \cssId{k}{+} b = c`, String.raw`aaaa \cssId{k}{+} b = c`], {
      at: 0,
      align: "k",
      x: 100,
    });

    for (const line of d.lines) {
      const part = line.get("k");
      expect(part.x + part.w / 2).toBeCloseTo(100, 0);
    }
  });

  test("errors", () => {
    expect(() => derive(["x + 1"], { at: 0 })).toThrow('found no "="');
    expect(() => derive([], { at: 0 })).toThrow("derive() needs a step");
  });
});

import { describe, expect, test } from "bun:test";
import { render } from "svjeez";
import { derive, epicycles, counter, tex } from "../src/index";

const svg = (...children: Parameters<typeof render>[1][]) =>
  render({ width: 600, height: 400, duration: 10, title: "dynamics" }, children);

describe("epicycles", () => {
  const square = [
    [100, 100],
    [300, 100],
    [300, 300],
    [100, 300],
  ] as const;

  test("a square closes into a trace that stays near its corners", () => {
    const e = epicycles(square, { at: 0, over: 4, terms: 60 });
    const xs = [...e.d.matchAll(/[ML](-?[\d.]+) /g)].map((m) => +m[1]!);
    expect(Math.min(...xs)).toBeGreaterThan(85);
    expect(Math.max(...xs)).toBeLessThan(315);
    expect(e.d.endsWith("Z")).toBe(true);
  });

  test("center and size move and scale the outline", () => {
    const e = epicycles(square, { at: 0, over: 4, center: [500, 50], size: 100 });
    const xs = [...e.d.matchAll(/[ML](-?[\d.]+) /g)].map((m) => +m[1]!);
    expect((Math.min(...xs) + Math.max(...xs)) / 2).toBeCloseTo(500, 0);
    expect(Math.max(...xs) - Math.min(...xs)).toBeLessThan(115);
  });

  test("a glyph goes in through its matrix and draws upright", () => {
    const pi = tex(String.raw`\pi`, { fontSize: 100 });
    const e = epicycles(pi.words, { at: 0, over: 4 });
    const ys = [...e.d.matchAll(/[ML]-?[\d.]+ (-?[\d.]+)/g)].map((m) => +m[1]!);
    expect(Math.min(...ys)).toBeGreaterThan(pi.bounds.y - 5);
    expect(Math.max(...ys)).toBeLessThan(pi.bounds.y + pi.bounds.h + 5);
  });

  test("a trace that draws in sync, with rings that spin", () => {
    const out = svg(epicycles(square, { at: 1, over: 4, terms: 20 }).node);
    expect(out).toContain("rotate");
    expect(out).toContain("stroke-dasharray");
  });

  test("errors name the fix", () => {
    expect(() => epicycles(square, { at: 0, over: 0 })).toThrow("epicycles() needs a finite start");
    expect(() => epicycles("M0 0A5 5 0 0 1 10 0", { at: 0, over: 1 })).toThrow('"A" path command');
  });
});

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

describe("counter", () => {
  test("one glyph per place per distinct digit, however often the number changes", () => {
    const counting = counter((t) => Math.floor(t * 10) % 10, { duration: 10, step: 0.1 });
    expect(svg(counting.node).match(/<path /g)).toHaveLength(10);
  });

  test("digits fix the places", () => {
    const r = counter(
      [
        { at: 0, value: 1 },
        { at: 3, value: 3.14 },
      ],
      { digits: 2 },
    );

    expect(svg(r.node).match(/<path /g)).toHaveLength(7);
  });

  test("a rolling digit moves as it fades", () => {
    const r = counter(
      [
        { at: 0, value: 1 },
        { at: 2, value: 2 },
      ],
      { roll: 0.3 },
    );
    expect(svg(r.node)).toContain("translate");
  });

  test("a negative value gets a sign place", () => {
    const r = counter([
      { at: 0, value: 5 },
      { at: 1, value: -5 },
    ]);

    expect(r.width).toBeGreaterThan(counter([{ at: 0, value: 5 }]).width);
  });

  test("errors", () => {
    expect(() =>
      counter(
        [
          { at: 0, value: 1 },
          { at: 0.1, value: 2 },
        ],
        { roll: 0.5 },
      ),
    ).toThrow("changes faster");
    expect(() => counter([])).toThrow("at least one value");
  });
});

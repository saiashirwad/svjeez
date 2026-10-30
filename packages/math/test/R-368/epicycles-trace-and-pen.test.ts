import { describe, expect, test } from "bun:test";
import { openScene } from "svjeez/frames";
import { epicycles, tex } from "../../src/index";
import { svg } from "../helpers/dynamics";

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

  test("the pen rides the trace it draws", async () => {
    const e = epicycles(square, { at: 0, over: 4, terms: 20 });

    const trace = [...e.d.matchAll(/[ML](-?[\d.]+) (-?[\d.]+)/g)].map((m): [number, number] => [
      +m[1]!,
      +m[2]!,
    ]);

    const scene = await openScene(svg(e.node), { colorScheme: "light" });

    try {
      for (const u of [0.2, 0.45, 0.7]) {
        await scene.capture(4 * u);

        const pen = await scene.evaluate(() => {
          const box = document.querySelector('circle[r="4"]')!.getBoundingClientRect();

          return [box.x + box.width / 2, box.y + box.height / 2];
        }, null);

        const [x, y] = trace[Math.round(u * (trace.length - 1))]!;
        expect(Math.hypot(pen[0]! - x, pen[1]! - y)).toBeLessThan(3);
      }
    } finally {
      await scene.close();
    }
  });

  test("errors name the fix", () => {
    expect(() => epicycles(square, { at: 0, over: 0 })).toThrow("epicycles() needs a finite start");
    expect(() => epicycles("M0 0A5 5 0 0 1 10 0", { at: 0, over: 1 })).toThrow('"A" path command');
  });
});

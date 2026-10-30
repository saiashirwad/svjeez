import { describe, expect, test } from "bun:test";
import { el, rect, render, validateSvg, type SvgNode } from "svjeez";
import { Arrow, Brace, Camera, Underline, flow } from "svjeez/extras";

describe("timed components render valid SVG that moves only inside their span", () => {
  const [span, box, duration] = [{ at: 2, over: 3 }, rect(10, 10, 30, 20), 10];

  const scene = (node: SvgNode) =>
    render({ width: 100, height: 100, duration, title: "timing" }, node);

  /** When the first and last keyframe stop fall inside the loop, in seconds. The 0% and 100% stops are the loop's own. */
  const window = (svg: string): [number, number] => {
    const stops = [...svg.matchAll(/@keyframes [\w-]+\{((?:[^{}]*\{[^}]*\})*)\}/g)]
      .flatMap(([, body]) =>
        [...body!.matchAll(/([\d.%,]+)\{[^}]*\}/g)].flatMap(([, percents]) =>
          percents!.split(",").map(parseFloat),
        ),
      )
      .flatMap((percent) => (percent > 0 && percent < 100 ? [(percent * duration) / 100] : []));

    return [Math.min(...stops), Math.max(...stops)];
  };

  const items = {
    flow: [
      flow(
        [
          { x: 0, y: 0 },
          { x: 50, y: 0 },
        ],
        { at: span.at, over: span.over },
      ).node,
      [2, 5],
    ],
    Arrow: [Arrow({ from: { x: 0, y: 0 }, to: { x: 50, y: 50 }, during: span }), [2, 5]],
    Brace: [Brace({ target: box, during: span }), [2, 5]],
    Underline: [Underline({ target: box, during: span }), [2, 5]],
    Camera: [
      Camera({
        frame: rect(0, 0, 100, 100),
        stops: [{ during: span, target: box }],
        over: 0.5,
        children: el.rect({ width: 5, height: 5 }),
      }),
      [2, 2.5],
    ],
  } satisfies Record<string, [SvgNode, [number, number]]>;

  for (const [name, [node, [start, end]]] of Object.entries(items)) {
    test(name, () => {
      const svg = scene(node);
      expect(validateSvg(svg).errors).toEqual([]);
      const [first, last] = window(svg);
      expect(first).toBeCloseTo(start, 6);
      expect(last).toBeCloseTo(end, 6);
    });
  }
});

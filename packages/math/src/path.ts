import { round } from "./matrix.ts";

/** The number of coordinates each absolute command takes. MathJax's font only uses the first six. */
const ARITY = new Map([
  ["M", 2],
  ["L", 2],
  ["H", 1],
  ["V", 1],
  ["Q", 4],
  ["T", 2],
  ["C", 6],
  ["S", 4],
  ["Z", 0],
]);

/**
 * Every endpoint and control point of an absolute path, in order. A Bezier curve stays inside the hull of
 * these points, so their box is a safe stand-in for the glyph's box.
 */
export function pathPoints(d: string): [number, number][] {
  const points: [number, number][] = [];
  let [x, y] = [0, 0];

  for (const [, command, body] of d.matchAll(/([A-Za-z])([^A-Za-z]*)/g)) {
    const arity = ARITY.get(command!);

    if (arity === undefined)
      throw new Error(
        `tex() met a "${command}" path command, and only absolute commands are drawn.`,
      );
    const n = (body!.match(/-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gi) ?? []).map(Number);

    for (let i = 0; i < n.length; i += arity) {
      if (command === "H") x = n[i]!;
      else if (command === "V") y = n[i]!;
      else {
        for (let k = 0; k < arity; k += 2) points.push([n[i + k]!, n[i + k + 1]!]);
        [x, y] = [n[i + arity - 2]!, n[i + arity - 1]!];
        continue;
      }

      points.push([x, y]);
    }
  }

  return points;
}

/** A closed box as path data. */
export const boxPath = (x: number, y: number, w: number, h: number): string =>
  `M${round(x)} ${round(y)}H${round(x + w)}V${round(y + h)}H${round(x)}Z`;

/** The same box wound the other way, so that two of them make a hole under the nonzero rule. */
export const holePath = (x: number, y: number, w: number, h: number): string =>
  `M${round(x)} ${round(y)}V${round(y + h)}H${round(x + w)}V${round(y)}Z`;

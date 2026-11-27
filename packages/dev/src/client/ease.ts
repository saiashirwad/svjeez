import type { LaneEase } from "../workspace.ts";

/*
 * Curves for the page to draw: a lane's ease inside its bar, a literal ease beside the code that names it, and the
 * presets the ease picker offers.
 */

export type Bezier = readonly [number, number, number, number];

/** The named curves, as svjeez defines them. */
export const NAMED = new Map<string, Bezier>([
  ["ease.linear", [0, 0, 1, 1]],
  ["ease.in", [0.55, 0.06, 0.68, 0.19]],
  ["ease.out", [0.23, 1, 0.32, 1]],
  ["ease.inOut", [0.77, 0, 0.175, 1]],
  ["ease.pop", [0.34, 1.56, 0.64, 1]],
]);

/** The bezier an ease literal is written as, `ease.out` or `ease.bezier(0.2, 0, 0, 1)`; undefined for any other text. */
export const bezierOf = (text: string): Bezier | undefined => {
  const named = NAMED.get(text.trim());

  if (named) return named;
  const numbers = /^ease\.bezier\(([^)]*)\)$/.exec(text.trim())?.[1]?.split(",").map(Number);

  if (numbers?.length !== 4 || !numbers.every(Number.isFinite)) return undefined;
  const [x1 = 0, y1 = 0, x2 = 1, y2 = 1] = numbers;

  return [x1, y1, x2, y2];
};

/** The literal for a bezier, as short as its numbers allow. */
export const bezierText = (points: Bezier): string => {
  const named = [...NAMED].find(([, curve]) => curve.every((n, i) => n === points[i]));

  return named ? named[0] : "ease.bezier(" + points.map((n) => String(round(n))).join(", ") + ")";
};

const round = (n: number): number => Math.round(n * 100) / 100;

/**
 * The SVG path of a curve in a `width` × `height` box, rising from bottom left to top right. Overshoot (`ease.pop`)
 * goes past the top, so the box should leave it room.
 */
export const curvePath = (ease: LaneEase | Bezier, width: number, height: number): string => {
  const at = (x: number, y: number) => (x * width).toFixed(2) + " " + ((1 - y) * height).toFixed(2);

  if (isBezier(ease))
    return (
      "M" + at(0, 0) + "C" + at(ease[0], ease[1]) + " " + at(ease[2], ease[3]) + " " + at(1, 1)
    );

  switch (ease.kind) {
    case "linear":
      return "M" + at(0, 0) + "L" + at(1, 1);
    case "bezier": {
      const [x1, y1, x2, y2] = ease.points;

      return "M" + at(0, 0) + "C" + at(x1, y1) + " " + at(x2, y2) + " " + at(1, 1);
    }

    case "steps": {
      const parts = ["M" + at(0, 0)];

      for (let i = 1; i <= ease.count; i++)
        parts.push(
          "H" + ((i / ease.count) * width).toFixed(2),
          "V" + ((1 - i / ease.count) * height).toFixed(2),
        );

      return parts.join("");
    }
  }
};

const isBezier = (ease: LaneEase | Bezier): ease is Bezier => Array.isArray(ease);

const SVG = "http://www.w3.org/2000/svg";

/** A small inline picture of a curve: a box, a faint diagonal for reference, and the curve. */
export const curveGlyph = (
  ease: LaneEase | Bezier,
  size: number,
  className: string,
): SVGSVGElement => {
  const svg = document.createElementNS(SVG, "svg");
  const pad = size * 0.18;
  const inner = size - pad * 2;
  const path = document.createElementNS(SVG, "path");

  svg.setAttribute("class", className);
  svg.setAttribute("viewBox", -pad + " " + -pad + " " + size + " " + size);
  svg.setAttribute("width", String(size));
  svg.setAttribute("height", String(size));
  svg.setAttribute("aria-hidden", "true");
  path.setAttribute("d", curvePath(ease, inner, inner));
  svg.append(path);

  return svg;
};

import type { Point } from "./fourier";

export interface Preset {
  readonly name: string;
  readonly points: () => Point[];
}

const loop = (count: number, f: (t: number) => Point): Point[] =>
  Array.from({ length: count }, (_, i) => f((2 * Math.PI * i) / count));

/** Points along path data, read by the browser so arcs and curves come out exact. */
const along = (d: string, count = 600, flip = false): Point[] => {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  svg.style.position = "absolute";
  svg.style.inlineSize = "0";
  path.setAttribute("d", d);
  svg.append(path);
  document.body.append(svg);
  const total = path.getTotalLength();
  const points = Array.from({ length: count }, (_, i): Point => {
    const p = path.getPointAtLength((total * i) / count);
    return [p.x, flip ? -p.y : p.y];
  });
  svg.remove();
  return points;
};

/** The chick from the favicon: body, then up the stalk and once around the ball. */
const CHICK =
  "M104 60C140 60 170 94 170 150C170 158 165 162 157 162H51C43 162 38 158 38 150C38 94 68 60 104 60V47A9 9 0 0 1 104 29A9 9 0 0 1 104 47V60";

/** MathJax's π, y up, as tex() reads it. */
const PI =
  "M132 -11Q98 -11 98 22V33L111 61Q186 219 220 334L228 358H196Q158 358 142 355T103 336Q92 329 81 318T62 297T53 285Q51 284 38 284Q19 284 19 294Q19 300 38 329T93 391T164 429Q171 431 389 431Q549 431 553 430Q573 423 573 402Q573 371 541 360Q535 358 472 358H408L405 341Q393 269 393 222Q393 170 402 129T421 65T431 37Q431 20 417 5T381 -10Q370 -10 363 -7T347 17T331 77Q330 86 330 121Q330 170 339 226T357 318T367 358H269L268 354Q268 351 249 275T206 114T175 17Q164 -11 132 -11Z";

export const PRESETS: readonly Preset[] = [
  {
    name: "heart",
    points: () =>
      loop(400, (t) => [
        16 * Math.sin(t) ** 3,
        -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)),
      ]),
  },
  { name: "chick", points: () => along(CHICK) },
  {
    name: "star",
    points: () =>
      Array.from({ length: 10 }, (_, i): Point => {
        const a = -Math.PI / 2 + (Math.PI * i) / 5;
        const r = i % 2 ? 0.4 : 1;
        return [r * Math.cos(a), r * Math.sin(a)];
      }),
  },
  { name: "pi", points: () => along(PI, 600, true) },
  {
    name: "squiggle",
    points: () =>
      loop(900, (t) => [
        Math.cos(t) * 2.4 + 0.42 * Math.cos(7 * t + 0.6),
        Math.sin(2 * t) * 0.45 + 0.42 * Math.sin(7 * t + 0.6),
      ]),
  },
];

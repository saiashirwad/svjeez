import { num, type PathData } from "svjeez";
import { channels, clear, mapPaint, opaque } from "../paint.ts";
import type { Box, Paint, Radii, Rect, Shadow } from "../tree.ts";
import { grow, growRadii, paddingBox, rounded, union } from "./geometry.ts";

// A blurred shadow is drawn as nine gradient-filled pieces instead of through a filter. A filter on a moving shape
// re-blurs every frame at the zoomed size, which is what made zooming in stutter; gradients stay smooth at any size.
//
// CSS blurs a shadow's shape with a Gaussian of half the blur radius, so an edge fades across blur on either side of
// it. Each edge is a strip with a linear gradient along that fade, each corner a square with a radial one about its
// arc's center, and the middle is solid. A corner rounder than the blur keeps its radius; a sharper one is drawn with
// the blur as its radius, which is about where a blurred square corner's half-way line runs.

/** How many stops trace the fade. Seven keep the straight lines between them within about 1% of the curve. */
const STOPS = 7;

/** The standard normal distribution below `x`, through Abramowitz and Stegun's erf 7.1.26, good to 1.5e-7. */
export const normal = (x: number): number => {
  const z = Math.abs(x) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * z);
  const tail =
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
    t *
    Math.exp(-z * z);

  return x >= 0 ? 1 - tail / 2 : tail / 2;
};

/** Top, right, bottom and left for a strip; top-left, top-right, bottom-right and bottom-left for a corner. */
export type Side = 0 | 1 | 2 | 3;

/**
 * How a piece is painted in the shadow's color. Gradients run from the shape's inside out, and their stops are
 * opacities at even steps: a radial one starts at `from` of its radius, so its middle is solid.
 */
export type Fill =
  | { readonly kind: "solid"; readonly opacity: number }
  | { readonly kind: "linear"; readonly side: Side; readonly stops: readonly number[] }
  | {
      readonly kind: "radial";
      readonly corner: Side;
      readonly from: number;
      readonly stops: readonly number[];
    };

export interface Piece {
  readonly d: PathData;
  /** The rectangle around it. */
  readonly bounds: Rect;
  readonly fill: Fill;
  /** Has no area: drawn only when the other side of a tween has some. */
  readonly empty?: boolean;
  readonly evenodd?: boolean;
}

const square = (x0: number, y0: number, x1: number, y1: number): PathData =>
  `M${num(x0)} ${num(y0)}H${num(x1)}V${num(y1)}H${num(x0)}Z`;

const box = (x0: number, y0: number, x1: number, y1: number) => ({
  d: square(x0, y0, x1, y1),
  bounds: { x: x0, y: y0, width: x1 - x0, height: y1 - y0 },
  empty: x1 - x0 <= 0 || y1 - y0 <= 0 ? true : undefined,
});

/**
 * Corner radii for the blurred shape: at least `inner`, so corners never reach into the strips, and cut back where
 * two on one side would overlap.
 */
const cornersFor = (radii: Radii, inner: number, w: number, h: number): number[] => {
  const r = radii.map((k) => Math.max(k, inner));

  for (const [i, j, length] of [
    [0, 1, w],
    [1, 2, h],
    [2, 3, w],
    [3, 0, h],
  ] as const) {
    let excess = r[i]! + r[j]! - length;

    for (const k of r[i]! >= r[j]! ? [i, j] : [j, i]) {
      const cut = Math.min(Math.max(excess, 0), r[k]! - inner);

      r[k]! -= cut;
      excess -= cut;
    }
  }

  return r;
};

/**
 * A shape blurred by `blur`, as pieces. An inset shadow paints everything but the blurred shape: its pieces fade the
 * other way, its middle is clear, and `around` is filled outside them.
 */
export const softPieces = (rect: Rect, radii: Radii, blur: number, around?: Rect): Piece[] => {
  const { x, y, width: w, height: h } = rect;
  const sigma = blur / 2;
  // How far in from the edge the fade starts: the blur, or the middle of a shape narrower than twice that.
  const inner = Math.min(blur, w / 2, h / 2);
  // A shape narrower than the blur never reaches full strength, even in its middle.
  const reach = (2 * normal(w / blur) - 1) * (2 * normal(h / blur) - 1);
  const peak = reach > 0.999 ? 1 : reach;
  const low = normal(-2);
  const high = normal(inner / sigma);
  const strength = (f: number) => Math.round((around ? 1 - peak * f : peak * f) * 1000) / 1000;

  // The fade from `inner` inside the edge to `blur` outside it, scaled to run from exactly full to nothing.
  const stops = Array.from({ length: STOPS }, (_, k) => {
    const d = -inner + (k / (STOPS - 1)) * (blur + inner);

    return strength((normal(-d / sigma) - low) / (high - low));
  });

  const [tl, tr, br, bl] = cornersFor(radii, inner, w, h) as [number, number, number, number];
  const [l, t, r, b] = [x, y, x + w, y + h];

  const corner = (
    c: Side,
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    radius: number,
  ): Piece => ({
    ...box(x0, y0, x1, y1),
    fill: {
      kind: "radial",
      corner: c,
      // Three places, so corners of nearly the same shape share a gradient.
      from: Math.round(((radius - inner) / (radius + blur)) * 1000) / 1000,
      stops,
    },
  });

  const strip = (side: Side, x0: number, y0: number, x1: number, y1: number): Piece => ({
    ...box(x0, y0, x1, y1),
    fill: { kind: "linear", side, stops },
  });

  const middle = strength(1);
  const pieces: Piece[] = [
    corner(0, l - blur, t - blur, l + tl, t + tl, tl),
    strip(0, l + tl, t - blur, r - tr, t + inner),
    corner(1, r - tr, t - blur, r + blur, t + tr, tr),
    strip(1, r - inner, t + tr, r + blur, b - br),
    corner(2, r - br, b - br, r + blur, b + blur, br),
    strip(2, l + bl, b - inner, r - br, b + blur),
    corner(3, l - blur, b - bl, l + bl, b + blur, bl),
    strip(3, l - blur, t + tl, l + inner, b - bl),
  ];

  if (middle > 0) {
    const points = [
      [l + tl, t + inner],
      [r - tr, t + inner],
      [r - tr, t + tr],
      [r - inner, t + tr],
      [r - inner, b - br],
      [r - br, b - br],
      [r - br, b - inner],
      [l + bl, b - inner],
      [l + bl, b - bl],
      [l + inner, b - bl],
      [l + inner, t + tl],
      [l + tl, t + tl],
    ];

    pieces.push({
      d: `M${points.map(([px, py]) => `${num(px!)} ${num(py!)}`).join("L")}Z`,
      bounds: { x: l + inner, y: t + inner, width: w - 2 * inner, height: h - 2 * inner },
      fill: { kind: "solid", opacity: middle },
      empty: w - 2 * inner <= 0 || h - 2 * inner <= 0 ? true : undefined,
    });
  }

  if (around)
    pieces.push({
      d: `${square(around.x, around.y, around.x + around.width, around.y + around.height)}${square(l - blur, t - blur, r + blur, b + blur)}`,
      bounds: around,
      fill: { kind: "solid", opacity: 1 },
      evenodd: true,
    });

  return pieces;
};

/** A paint at `opacity` of its own alpha. */
export const fainter = (color: Paint, opacity: number): Paint =>
  opacity === 1
    ? color
    : mapPaint(color, (c) => {
        const [r, g, b, a] = channels(c);

        return `rgba(${r},${g},${b},${Math.round(a * opacity * 1000) / 1000})`;
      });

/** Shadows that can morph into each other: the same blur and spread, so only color and offset change. */
const alike = (a: Shadow, b: Shadow) => a.blur === b.blur && a.spread === b.spread;

/**
 * Both lists at the same length: the shorter one padded with clear copies of the other's, placed where most of its
 * shadows line up with alike ones. A focus ring added in front of a shadow then leaves that shadow paired with itself.
 */
const evened = (a: readonly Shadow[], b: readonly Shadow[]): [Shadow[], Shadow[]] => {
  const flip = a.length > b.length;
  const [short, long] = flip ? [b, a] : [a, b];
  let best = 0;
  let most = -1;

  for (let k = 0; k <= long.length - short.length; k++) {
    const hits = short.filter((s, i) => alike(s, long[k + i]!)).length;

    if (hits > most) [best, most] = [k, hits];
  }

  const padded = long.map((s, j) => short[j - best] ?? { ...s, color: clear(s.color) });

  return flip ? [[...long], padded] : [padded, [...long]];
};

/** Both boxes with the same number of outer shadows, so each one morphs. */
export const padShadows = (a: Box, b: Box): [Box, Box] => {
  const [sa, sb] = evened(a.shadows, b.shadows);

  return [
    { ...a, shadows: sa },
    { ...b, shadows: sb },
  ];
};

/** Both boxes with the same number of inset shadows. */
export const padInsets = (a: Box, b: Box): [Box, Box] => {
  const [ia, ib] = evened(a.insets ?? [], b.insets ?? []);

  return [
    { ...a, insets: ia },
    { ...b, insets: ib },
  ];
};

/** Whether `r` lies inside the rounded box: each of its corners does, since the box is convex. */
const within = (r: Rect, { box, radii }: Box): boolean =>
  [
    [r.x, r.y],
    [r.x + r.width, r.y],
    [r.x + r.width, r.y + r.height],
    [r.x, r.y + r.height],
  ].every(([px, py], i) => {
    const k = radii[i]!;
    const cx = i === 0 || i === 3 ? box.x + k : box.x + box.width - k;
    const cy = i < 2 ? box.y + k : box.y + box.height - k;
    const outX = i === 0 || i === 3 ? px! < cx : px! > cx;
    const outY = i < 2 ? py! < cy : py! > cy;

    return (
      px! >= box.x &&
      px! <= box.x + box.width &&
      py! >= box.y &&
      py! <= box.y + box.height &&
      (!outX || !outY || Math.hypot(px! - cx, py! - cy) <= k)
    );
  });

/**
 * An outer shadow as pieces: one solid shape when it is sharp. Pieces an opaque box hides are marked empty, so they
 * are left out but keep their place for a tween.
 */
export const outerPieces = (b: Box, s: Shadow): Piece[] => {
  const rect = grow(b.box, s.spread, s.x, s.y);
  const radii = growRadii(b.radii, s.spread);

  if (s.blur <= 0)
    return [{ d: rounded(rect, radii), bounds: rect, fill: { kind: "solid", opacity: 1 } }];

  const pieces = softPieces(rect, radii, s.blur);

  return opaque(b.background)
    ? pieces.map((p) => (within(p.bounds, b) ? { ...p, empty: true } : p))
    : pieces;
};

/** An inset shadow as pieces: inside the padding box, around a hole the shadow doesn't reach. */
export const insetPieces = (b: Box, s: Shadow): Piece[] => {
  const { rect, radii } = paddingBox(b);
  const hole = grow(rect, -s.spread, s.x, s.y);
  const holeRadii = growRadii(radii, -s.spread);

  if (s.blur > 0)
    return softPieces(hole, holeRadii, s.blur, grow(union([rect, grow(hole, s.blur)])!, 1));

  return [
    {
      d: `${rounded(rect, radii)}${rounded(hole, holeRadii)}`,
      bounds: rect,
      fill: { kind: "solid", opacity: 1 },
      evenodd: true,
    },
  ];
};

/** Where outer shadows may show: `region` less the border box, since CSS draws them only outside it. */
export const outside = (b: Box, region: Rect): PathData =>
  `${rounded(region, [0, 0, 0, 0])}${rounded(b.box, b.radii)}`;

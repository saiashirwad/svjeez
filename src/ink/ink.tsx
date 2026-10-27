import type { Paint } from "../attributes";
import { def, type Ref } from "../defs";
import { ease as easing, motion, type Ease, type Span, type Stack } from "../motion";
import { draw as drawOn } from "../recipes";
import type { SvgNode } from "../svg";
import { flatten, type Pt } from "./path";

/**
 * A drawing tool: how wide the mark is at each point. `t` runs 0 to 1 along one stroke, `s` is px along it,
 * `angle` is the direction of travel in radians. Widths are in px.
 */
export interface Tool {
  readonly width: (t: number, s: number, angle: number) => number;
  /** Sideways drift of the line in px, for a hand that does not quite follow the path. */
  readonly drift?: (s: number) => number;
  /** The widest the tool ever draws, for reveal masks. */
  readonly size: number;
}

/** Seeded 1D value noise in -1..1, smooth between integer knots. */
const noise = (seed: number) => {
  const knot = (i: number) => {
    let h = Math.imul(i ^ (seed * 0x9e3779b1), 0x85ebca6b);
    h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
    return (((h ^ (h >>> 16)) >>> 0) / 4294967295) * 2 - 1;
  };
  return (x: number) => {
    const i = Math.floor(x);
    const f = x - i;
    const u = f * f * (3 - 2 * f);
    return knot(i) * (1 - u) + knot(i + 1) * u;
  };
};

const smoothstep = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));

/** 1 in the middle of a stroke, easing toward `tip` at both ends over `taper` of its length. */
const envelope = (t: number, taper: number, tip: number) => (taper <= 0 ? 1 : tip + (1 - tip) * Math.min(smoothstep(t / taper), smoothstep((1 - t) / taper)));

export interface PenOptions {
  /** Line width in px. Default 1.5. */
  readonly size?: number;
  /** Share of each end that thins out. Default 0.08. */
  readonly taper?: number;
  readonly seed?: number;
}

/** A technical or ballpoint pen: an even line with slightly thinned ends. */
export const pen = ({ size = 1.5, taper = 0.08, seed = 1 }: PenOptions = {}): Tool => {
  const wobble = noise(seed);
  return { size: size * 1.1, width: (t, s) => size * envelope(t, taper, 0.45) * (1 + 0.06 * wobble(s / 18)) };
};

export interface BrushOptions {
  /** Widest width in px. Default 6. */
  readonly size?: number;
  /** Share of each end that tapers to a point. Default 0.3. */
  readonly taper?: number;
  /** How much the width swells and thins along the stroke, 0 to 1. Default 0.35. */
  readonly pressure?: number;
  /** Sideways wander in px. Default size × 0.12. */
  readonly wobble?: number;
  readonly seed?: number;
}

/** A round brush: pressed down in the middle, lifting to a point at both ends, uneven along the way. */
export const brush = ({ size = 6, taper = 0.3, pressure = 0.35, wobble, seed = 1 }: BrushOptions = {}): Tool => {
  const press = noise(seed);
  const wander = noise(seed + 101);
  const drift = wobble ?? size * 0.12;
  return {
    size,
    width: (t, s) => size * envelope(t, taper, 0.04) * (1 - pressure * (0.5 + 0.5 * press(s / 40))),
    drift: (s) => drift * wander(s / 60),
  };
};

export interface NibOptions {
  /** Width of the nib in px, the thickest line it draws. Default 5. */
  readonly size?: number;
  /** Angle of the nib in degrees, from the x axis. 30 to 45 is a classic italic hand. Default 35. */
  readonly angle?: number;
  /** The thinnest line, as a share of `size`. Default 0.12. */
  readonly thin?: number;
}

/** A broad calligraphy nib: thick across the nib's edge, thin along it. Downstrokes swell and crossbars stay fine. */
export const nib = ({ size = 5, angle = 35, thin = 0.12 }: NibOptions = {}): Tool => {
  const edge = (angle * Math.PI) / 180;
  return { size, width: (_, __, direction) => size * (thin + (1 - thin) * Math.abs(Math.sin(direction - edge))) };
};

export interface PencilOptions {
  /** Line width in px. Default 1.2. */
  readonly size?: number;
  readonly seed?: number;
}

/** A pencil: a fine line whose width flickers with the grain of the paper. */
export const pencil = ({ size = 1.2, seed = 1 }: PencilOptions = {}): Tool => {
  const grain = noise(seed);
  const shake = noise(seed + 7);
  return { size: size * 1.4, width: (t, s) => size * envelope(t, 0.05, 0.5) * (0.8 + 0.3 * grain(s / 3.5)), drift: (s) => size * 0.25 * shake(s / 14) };
};

const SPACING = 1.5;

/** Evenly spaced points along a polyline, so width changes stay smooth however the path was drawn. */
const resample = (points: readonly Pt[]): Pt[] => {
  const out: Pt[] = [points[0]!];
  let carry = 0;
  for (let i = 1; i < points.length; i++) {
    const [a, b] = [points[i - 1]!, points[i]!];
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    let at = SPACING - carry;
    while (at <= length) {
      out.push({ x: a.x + ((b.x - a.x) * at) / length, y: a.y + ((b.y - a.y) * at) / length });
      at += SPACING;
    }
    carry = length - (at - SPACING);
  }
  const last = points.at(-1)!;
  if (Math.hypot(last.x - out.at(-1)!.x, last.y - out.at(-1)!.y) > 0.2) out.push(last);
  return out;
};

/** Path data in tenths of a px, written as relative moves from rounded points, so it is short and never drifts. */
const writer = (first: Pt) => {
  const tenth = (v: number) => Math.round(v * 10);
  let at = { x: tenth(first.x), y: tenth(first.y) };
  const pair = (x: number, y: number) => `${x / 10}${y < 0 ? "" : " "}${y / 10}`;
  const step = (p: Pt) => {
    const next = { x: tenth(p.x), y: tenth(p.y) };
    const out = pair(next.x - at.x, next.y - at.y);
    at = next;
    return out;
  };
  return {
    start: `M${pair(at.x, at.y)}`,
    line: (points: readonly Pt[]) => (points.length ? `l${points.map(step).join(" ")}` : ""),
    curve: (control: Pt, end: Pt) => {
      const origin = at;
      const c = { x: tenth(control.x) - origin.x, y: tenth(control.y) - origin.y };
      return `q${pair(c.x, c.y)} ${step(end)}`;
    },
  };
};

/** The filled outline of one stroke: the left edge out, a round cap, the right edge back, a round cap. */
const outline = (points: readonly Pt[], tool: Tool): string => {
  const line = resample(points);
  if (line.length < 2) return "";
  const total = (line.length - 1) * SPACING;
  const left: Pt[] = [];
  const right: Pt[] = [];
  const caps: { half: number; normal: Pt }[] = [];
  line.forEach((p, i) => {
    const [a, b] = [line[Math.max(0, i - 1)]!, line[Math.min(line.length - 1, i + 1)]!];
    const angle = Math.atan2(b.y - a.y, b.x - a.x);
    const normal = { x: -Math.sin(angle), y: Math.cos(angle) };
    const s = i * SPACING;
    const shift = tool.drift?.(s) ?? 0;
    const center = { x: p.x + normal.x * shift, y: p.y + normal.y * shift };
    const half = Math.max(0.05, tool.width(s / total, s, angle)) / 2;
    left.push({ x: center.x + normal.x * half, y: center.y + normal.y * half });
    right.push({ x: center.x - normal.x * half, y: center.y - normal.y * half });
    caps.push({ half, normal });
  });
  const end = line.length - 1;
  /** A rounded end: one quadratic from one edge, out past the tip, to the other edge. */
  const cap = (i: number, sign: 1 | -1, from: Pt, to: Pt) => {
    const { half, normal } = caps[i]!;
    const out = { x: sign * normal.y * half * 2, y: -sign * normal.x * half * 2 };
    return half < 0.4 ? pen.line([to]) : pen.curve({ x: (from.x + to.x) / 2 + out.x, y: (from.y + to.y) / 2 + out.y }, to);
  };
  const pen = writer(left[0]!);
  return pen.start + pen.line(left.slice(1)) + cap(end, 1, left[end]!, right[end]!) + pen.line(right.slice(0, end).reverse()) + cap(0, -1, right[0]!, left[0]!) + "Z";
};

/** Path data drawn with a tool, as one filled outline per stroke. Fill it; do not stroke it. */
export const ink = (d: string, tool: Tool): string =>
  flatten(d)
    .map((line) => outline(line.points, tool))
    .join("");

export interface StrokeProps {
  /** The path the hand follows: the centerline of the mark. */
  readonly d: string;
  readonly tool: Tool;
  /** Ink color. */
  readonly color?: Paint;
  readonly opacity?: number;
  readonly class?: string;
  /** Ink the mark in along its path over this span, as a hand would. */
  readonly draw?: Span;
  /** Shapes the `draw` reveal. Default `ease.inOut`. */
  readonly ease?: Ease;
  /** Moves, scales or fades the whole mark. */
  readonly animation?: Stack<"x" | "y" | "scale" | "rotate" | "opacity">;
}

/** One symbol per path and tool, so a stroke drawn twice, or revealed and then shown plain, embeds its outline once. */
const outlines = new WeakMap<Tool, Map<string, Ref<"symbol">>>();

const outlineOf = (d: string, tool: Tool): Ref<"symbol"> => {
  const byPath = outlines.get(tool) ?? new Map<string, Ref<"symbol">>();
  outlines.set(tool, byPath);
  let symbol = byPath.get(d);
  if (!symbol) byPath.set(d, (symbol = def.symbol({ style: "overflow:visible" }, <path d={ink(d, tool)} />)));
  return symbol;
};

/**
 * A path inked with a pen, brush, nib or pencil. With `draw`, a mask with the path drawing on reveals the ink. A masked
 * shape costs a mask raster on every repaint, so once the reveal ends a plain copy takes over and the masked one hides.
 */
export function Stroke({ d, tool, color = "currentColor", opacity, class: className, draw, ease = easing.inOut, animation }: StrokeProps): SvgNode {
  const shape = outlineOf(d, tool);
  if (!draw) return <use href={shape} fill={color} opacity={opacity} class={className} animation={animation} />;
  const end = draw.at + draw.over;
  const reveal = def.mask({ maskUnits: "userSpaceOnUse", x: -1e4, y: -1e4, width: 2e4, height: 2e4 }, (
    <path d={d} fill="none" stroke="#fff" strokeWidth={tool.size * 2 + 2} strokeLinecap="round" strokeLinejoin="round" animation={drawOn(draw, ease)} />
  ));
  return (
    <g fill={color} opacity={opacity} class={className} animation={animation}>
      <use href={shape} mask={reveal} animation={motion({ opacity: 1 }).at(end).set({ opacity: 0 })} />
      <use href={shape} animation={motion({ opacity: 0 }).at(end).set({ opacity: 1 })} />
    </g>
  );
}

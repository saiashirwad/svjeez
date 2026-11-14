import { def, num, type Color, type Ref } from "svjeez";
import { jsx } from "svjeez/jsx-runtime";
import type { Gradient, Paint, Rect } from "../tree.ts";

/** A gradient's paint server, and the key two equal ones share. */
interface Server {
  readonly key: string;
  readonly ref: Ref<"linearGradient" | "radialGradient">;
}

/** Five places: bounding-box units span 0 to 1, so svjeez's usual three would shift a stripe. */
const fine = (k: number) => num(k, 5);

/** A linear gradient's line, rewritten in its box's units. */
const linear = (g: Extract<Gradient, { kind: "linear" }>, { x, y, width: w, height: h }: Rect) => {
  const ex = g.x2 - g.x1;
  const ey = g.y2 - g.y1;
  const e = ex * ex + ey * ey;

  if (!e) return undefined;

  // Where along the line a point falls, written over the box's units: a gradient with that slope and start.
  const a = (w * ex) / e;
  const b = (h * ey) / e;
  const c = ((x - g.x1) * ex + (y - g.y1) * ey) / e;
  const len = a * a + b * b;
  const x1 = (-c * a) / len;
  const y1 = (-c * b) / len;

  return {
    x1: fine(x1),
    y1: fine(y1),
    x2: fine(x1 + a / len),
    y2: fine(y1 + b / len),
    spreadMethod: g.repeat ? "repeat" : undefined,
  };
};

/** A radial gradient's center and radius in its box's units, stretched to an ellipse when its radii differ. */
const radial = (g: Extract<Gradient, { kind: "radial" }>, { x, y, width: w, height: h }: Rect) => {
  const cx = (g.cx - x) / w;
  const cy = (g.cy - y) / h;
  const k = g.ry / h / (g.rx / w);

  return {
    cx: fine(cx),
    cy: fine(cy),
    r: fine(g.rx / w),
    gradientTransform:
      Math.abs(k - 1) > 1e-4
        ? `translate(${fine(cx)} ${fine(cy)}) scale(1 ${fine(k)}) translate(${fine(-cx)} ${fine(-cy)})`
        : undefined,
    spreadMethod: g.repeat ? "repeat" : undefined,
  };
};

/**
 * Gradients as paint servers in their box's bounding-box units, so they ride along as the box moves and resizes. A
 * linear one is turned into those units whole, so its stripes stay square to its line however the box stretches.
 * Equal ones are one server.
 */
export const paintServers = (v: (color: Paint) => Color) => {
  const servers = new Map<string, Server["ref"]>();

  return (g: Gradient, box: Rect): Server | undefined => {
    if (box.width <= 0 || box.height <= 0) return undefined;

    const attrs = g.kind === "linear" ? linear(g, box) : radial(g, box);

    if (!attrs) return undefined;

    const stops = g.stops.map((s) => [num(s.offset, 4), v(s.color)] as const);
    const key = JSON.stringify([g.kind, attrs, stops]);
    let ref = servers.get(key);

    if (!ref) {
      const children = stops.map(([offset, color]) => jsx("stop", { offset, stopColor: color }));

      // SAFETY: the coordinates are text at five places, which svjeez writes as is; as numbers it would round them to three.
      ref =
        g.kind === "linear"
          ? def.linearGradient(attrs as never, children)
          : def.radialGradient(attrs as never, children);
      servers.set(key, ref);
    }

    return { key, ref };
  };
};

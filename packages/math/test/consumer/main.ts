import {
  plane,
  contours,
  tex,
  type Plane,
  type CalculusCurve,
  type Glyph,
  type Tex,
} from "@svjeez/math";
import { render, type Rect, morph } from "svjeez";

const square: Tex = tex(String.raw`(a+b)^2`, { x: 20, y: 20, fontSize: 40 });
const expanded: Tex = tex(String.raw`a^2 + \cssId{mid}{2ab} + b^2`, { x: 20, y: 20, fontSize: 40 });
const first: Glyph | undefined = expanded.words[0];

export const svg: string = render({ width: 400, height: 120, duration: 4, title: "Math" }, [
  morph([square, expanded], { at: [1], over: 1 }).node,
]);

export const cross: Rect = expanded.get("mid");
export const key: string | undefined = first?.text;

const graph: Plane = plane({
  x: [-3, 3],
  y: [-1, 9],
  width: 200,
  height: 100,
  at: { x: 10, y: 10 },
});

const curve: CalculusCurve = graph.parametric((t) => [t, t * t], [-3, 3]);

export const plotted: string = render({ width: 240, height: 120, duration: 2, title: "Graph" }, [
  graph.node,
  curve.node,
]);

export const ring = contours((x, y) => x * x + y * y, {
  levels: [1],
  bounds: { x: 0, y: 0, w: 100, h: 100 },
});

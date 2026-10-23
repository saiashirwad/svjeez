import { draw, ease, el, enter, motion, type Attrs, type Child, type Color, type Motion, type Span, type SvgNode } from "svg-motion";
import { float } from "./defs";
import { C } from "./theme";

export const ui = (size: number, fill: Color, extra: Attrs<"text"> = {}): Attrs<"text"> => ({
  class: "ui",
  fontSize: size,
  fill,
  ...extra,
});

export const mono = (size: number, fill: Color, extra: Attrs<"text"> = {}): Attrs<"text"> => ({
  class: "mono",
  fontSize: size,
  fill,
  ...extra,
});

export const serif = (size: number, fill: Color, extra: Attrs<"text"> = {}): Attrs<"text"> => ({
  class: "ser",
  fontSize: size,
  fill,
  ...extra,
});

type Reveal = Motion<"opacity" | "y">;

export interface TreeRowProps {
  animation: Reveal;
  x: number;
  y: number;
  bulletX: number;
  r: number;
  fill: Color;
  size?: number;
  color?: Color;
  weight?: number;
  children: Child;
}

export function TreeRow(props: TreeRowProps): SvgNode {
  return el.g({ animation: props.animation }, [
    el.circle({ cx: props.bulletX, cy: props.y - 5, r: props.r, fill: props.fill }),
    el.text({ x: props.x, y: props.y, ...ui(props.size ?? 14, props.color ?? C.text), fontWeight: props.weight }, props.children),
  ]);
}

export function AgentAvatar(props: {
  cx: number;
  cy: number;
  r: number;
  initial: string;
  color: Color;
  size?: number;
}): SvgNode {
  const size = props.size ?? 8;
  return el.g({}, [
    el.circle({ cx: props.cx, cy: props.cy, r: props.r, fill: props.color, fillOpacity: 0.13, stroke: props.color, strokeOpacity: 0.34 }),
    el.text({ x: props.cx, y: props.cy + size * 0.35, ...mono(size, props.color, { textAnchor: "middle" }) }, props.initial),
  ]);
}

export function MiniAvatar(props: {
  cx: number;
  cy: number;
  initial: string;
  color: Color;
}): SvgNode {
  return el.g({}, [
    el.circle({ cx: props.cx, cy: props.cy, r: 6.5, fill: props.color, fillOpacity: 0.12, stroke: props.color, strokeOpacity: 0.32 }),
    el.text({ x: props.cx, y: props.cy + 2.5, ...mono(7, props.color, { textAnchor: "middle" }) }, props.initial),
  ]);
}

export function CardHeader(props: {
  y: number;
  initial: string;
  name: string;
  role: string;
  meta: string;
  color: Color;
}): SvgNode {
  const { y, color } = props;
  return el.g({}, [
    <AgentAvatar cx={858} cy={y + 26} r={9.5} initial={props.initial} color={color} />,
    el.text({ x: 874, y: y + 24, ...ui(11.5, C.ink, { fontWeight: 600 }) }, props.name),
    el.text({ x: 874, y: y + 35, ...ui(8.5, C.dim) }, props.role),
    el.text({ x: 1104, y: y + 24, ...mono(7.5, C.faint, { textAnchor: "end" }) }, props.meta),
    el.line({ x1: 852, y1: y + 44, x2: 1104, y2: y + 44, stroke: C.lineSoft }),
  ]);
}

export function CardShell(props: {
  animation: Reveal;
  y: number;
  h: number;
  children: Child;
  stroke?: Color;
  x?: number;
  w?: number;
  r?: number;
}): SvgNode {
  return el.g({ animation: props.animation }, [
    el.rect({
      x: props.x ?? 836,
      y: props.y,
      width: props.w ?? 284,
      height: props.h,
      rx: props.r ?? 12,
      fill: C.card,
      stroke: props.stroke ?? C.lineSoft,
      filter: float,
    }),
    props.children,
  ]);
}

export function Thread(props: {
  d: string;
  endX: number;
  endY: number;
  color: Color;
  on: Span;
  off: Span;
  strokeOpacity?: number;
}): SvgNode {
  const { on, off } = props;
  return (
    <>
      {el.path({
        d: props.d,
        stroke: props.color,
        strokeOpacity: props.strokeOpacity ?? 0.38,
        strokeWidth: 1,
        fill: "none",
        animation: draw(on).at(off.at).to({ opacity: 0 }, off.over),
      })}
      {el.circle({
        cx: props.endX,
        cy: props.endY,
        r: 2.2,
        fill: props.color,
        fillOpacity: 0.7,
        animation: enter(on).at(off.at).to({ opacity: 0 }, off.over),
      })}
    </>
  );
}

const EASE_IN_OUT = ease.bezier(0.42, 0, 0.58, 1);

const pulse = (index: number) =>
  motion({ opacity: 0.22 })
    .at(index * 0.18)
    .to({ opacity: 1 }, 0.5075, EASE_IN_OUT)
    .to({ opacity: 0.22 }, 0.5075, EASE_IN_OUT)
    .loop(1.45);

export function PulseDots(props: {
  x: number;
  y: number;
  color: Color;
  count?: number;
  gap?: number;
  r?: number;
}): SvgNode {
  const count = props.count ?? 3;
  return (
    <>
      {Array.from({ length: count }, (_, index) =>
        el.circle({ cx: props.x + index * (props.gap ?? 7), cy: props.y, r: props.r ?? 1.7, fill: props.color, animation: pulse(index) }),
      )}
    </>
  );
}

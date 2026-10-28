import type { Color } from "../attributes";
import { el } from "../el";
import type { Edge, Point, Rect } from "../geometry";
import { motion, type Span } from "../motion";
import { textWidth, type FontValue } from "../font/font";
import { draw } from "../recipes";
import type { SvgNode } from "../svg";
import { defaultDark, type Base16 } from "./theme";
import { during } from "./timeline";

interface Common {
  readonly during: Span;
  /** Default `defaultDark`; `color` defaults to its `base09`. */
  readonly theme?: Base16;
  readonly color?: Color;
  /** On the root element, so fonts come from your CSS. */
  readonly class?: string;
}

const ink = (color: Color) =>
  ({
    fill: "none",
    stroke: color,
    strokeWidth: 1.5,
    strokeLinecap: "round",
    strokeLinejoin: "round",
  }) as const;

export function Arrow({
  from,
  to,
  bend = 0,
  during: span,
  theme = defaultDark,
  color = theme.base09,
  class: cls,
}: Common & { readonly from: Point; readonly to: Point; readonly bend?: number }): SvgNode {
  const [cx, cy] = [
    (from.x + to.x) / 2 - (to.y - from.y) * bend,
    (from.y + to.y) / 2 + (to.x - from.x) * bend,
  ];

  const angle = Math.atan2(to.y - cy, to.x - cx);
  const barb = (a: number) => `${to.x - 8 * Math.cos(angle + a)} ${to.y - 8 * Math.sin(angle + a)}`;
  const stroke = Math.min(0.6, span.over / 2);

  return el.g({ class: cls, animation: during(span, 0.2) }, [
    el.path({
      d: `M${from.x} ${from.y}Q${cx} ${cy} ${to.x} ${to.y}`,
      ...ink(color),
      animation: draw({ at: span.at, over: stroke }),
    }),
    el.path({
      d: `M${barb(0.45)}L${to.x} ${to.y}L${barb(-0.45)}`,
      ...ink(color),
      animation: motion({ opacity: 0, scale: 0.5 })
        .at(span.at + stroke)
        .to({ opacity: 1, scale: 1 }, Math.min(0.15, span.over - stroke)),
    }),
  ]);
}

/** A note box beside `target`, joined to it by a short leader. `columns` is the line length in characters. With `font`, the box fits the measured lines. */
export function Callout({
  target,
  side = "right",
  during: span,
  children,
  theme = defaultDark,
  color = theme.base09,
  fontSize = 14,
  font,
  columns = 24,
  class: cls,
}: Common & {
  readonly target: Rect;
  readonly side?: Edge;
  readonly children: string;
  readonly fontSize?: number;
  readonly font?: FontValue;
  readonly columns?: number;
}): SvgNode {
  const lines = children
    .split(/\s+/)
    .filter(Boolean)
    .reduce<string[]>((out, word) => {
      if (out.length > 0 && out.at(-1)!.length + 1 + word.length <= columns)
        out[out.length - 1] += ` ${word}`;
      else out.push(word);

      return out;
    }, []);

  const lineWidth = (line: string) => textWidth(line, fontSize, font);

  const [w, h, gap] = [
    Math.max(0, ...lines.map(lineWidth)) + 20,
    lines.length * fontSize * 1.4 + 16,
    20,
  ];

  const x =
    side === "left"
      ? target.x - w - gap
      : side === "right"
        ? target.x + target.w + gap
        : target.center.x - w / 2;

  const y =
    side === "top"
      ? target.y - h - gap
      : side === "bottom"
        ? target.y + target.h + gap
        : target.center.y - h / 2;

  const [start, end] = [
    target.side(side, 0.5),
    {
      x: x + (side === "left" ? w : side === "right" ? 0 : w / 2),
      y: y + (side === "top" ? h : side === "bottom" ? 0 : h / 2),
    },
  ];

  return el.g({ class: cls, fontFamily: font, animation: during(span, 0.2) }, [
    el.path({ d: `M${end.x} ${end.y}L${start.x} ${start.y}`, ...ink(color), strokeOpacity: 0.6 }),
    el.rect({
      x,
      y,
      width: w,
      height: h,
      rx: 6,
      fill: color,
      fillOpacity: 0.08,
      stroke: color,
      strokeOpacity: 0.4,
    }),
    lines.map((line, i) =>
      el.text({ x: x + 10, y: y + 8 + fontSize + i * fontSize * 1.4, fontSize, fill: color }, line),
    ),
  ]);
}

export function Brace({
  target,
  side = "left",
  label,
  fontSize = 12,
  during: span,
  theme = defaultDark,
  color = theme.base09,
  class: cls,
}: Common & {
  readonly target: Rect;
  /** `above` and `below` run the brace along the top or bottom of `target`, for an equation term. */
  readonly side?: "left" | "right" | "above" | "below";
  readonly label?: string;
  readonly fontSize?: number;
}): SvgNode {
  const along = side === "above" || side === "below";
  const dir = side === "left" || side === "above" ? -1 : 1;

  const [edge, mid] = along
    ? [dir < 0 ? target.y - 8 : target.y + target.h + 8, target.center.x]
    : [dir < 0 ? target.x - 8 : target.x + target.w + 8, target.center.y];

  const d = along
    ? `M${target.x} ${edge}q0 ${dir * 8} 8 ${dir * 8}H${mid - 8}q8 0 8 ${dir * 8}q0 ${-dir * 8} 8 ${-dir * 8}H${target.x + target.w - 8}q8 0 8 ${-dir * 8}`
    : `M${edge} ${target.y}q${dir * 8} 0 ${dir * 8} 8V${mid - 8}q0 8 ${dir * 8} 8q${-dir * 8} 0 ${-dir * 8} 8V${target.y + target.h - 8}q0 8 ${-dir * 8} 8`;

  return el.g({ class: cls, animation: during(span, 0.2) }, [
    el.path({ d, ...ink(color) }),
    label &&
      el.text(
        along
          ? {
              x: mid,
              y: edge + (dir < 0 ? -4 - fontSize : 10 + fontSize),
              textAnchor: "middle",
              fontSize,
              fill: color,
            }
          : {
              x: edge + dir * 20,
              y: mid + fontSize / 3,
              textAnchor: side === "left" ? "end" : "start",
              fontSize,
              fill: color,
            },
        label,
      ),
  ]);
}

export function Underline({
  target: r,
  variant = "straight",
  during: span,
  theme = defaultDark,
  color = theme.base09,
  class: cls,
}: Common & { readonly target: Rect; readonly variant?: "straight" | "squiggle" }): SvgNode {
  const [y, count] = [r.y + r.h - 2, Math.max(1, Math.ceil(r.w / 8))];

  const d =
    variant === "straight"
      ? `M${r.x} ${y}h${r.w}`
      : `M${r.x} ${y}${`l${r.w / count / 2} -2l${r.w / count / 2} 2`.repeat(count)}`;

  return el.path({
    d,
    ...ink(color),
    class: cls,
    animation: [during(span, 0.2), draw({ at: span.at, over: Math.min(0.5, span.over / 2) })],
  });
}

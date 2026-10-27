import { el } from "../el";
import { draw } from "../recipes";
import { motion, type Motion, type Span } from "../motion";
import type { Point, Rect } from "../geometry";
import type { Color } from "../attributes";
import type { SvgNode } from "../svg";

const visible = (span: Span): Motion<"opacity"> => {
  const fade = Math.min(0.2, span.over / 2);
  if (!Number.isFinite(span.at) || span.at < 0 || !(fade > 0)) throw new Error("Annotation needs a valid span.");
  return motion({ opacity: 0 }).at(span.at).to({ opacity: 1 }, fade).at(span.at + span.over - fade).to({ opacity: 0 }, fade);
};
interface Timed { readonly during: Span; readonly color?: Color }
export function Arrow({ from, to, bend = 0, during, color = "#f6c96b" }: Timed & { readonly from: Point; readonly to: Point; readonly bend?: number }): SvgNode {
  const dx = to.x - from.x, dy = to.y - from.y;
  const cx = (from.x + to.x) / 2 - dy * bend, cy = (from.y + to.y) / 2 + dx * bend;
  const angle = Math.atan2(to.y - cy, to.x - cx), size = 8;
  const p = (a: number) => `${to.x - size * Math.cos(angle + a)} ${to.y - size * Math.sin(angle + a)}`;
  const duration = Math.min(0.6, during.over / 2);
  return el.g({ animation: visible(during) }, [
    el.path({ d: `M${from.x} ${from.y} Q${cx} ${cy} ${to.x} ${to.y}`, fill: "none", stroke: color, strokeWidth: 1.5, strokeLinecap: "round", animation: draw({ at: during.at, over: duration }) }),
    el.path({ d: `M${p(0.45)} L${to.x} ${to.y} L${p(-0.45)}`, fill: "none", stroke: color, strokeWidth: 1.5, strokeLinecap: "round", strokeLinejoin: "round", animation: motion({ opacity: 0, scale: 0.5 }).at(during.at + duration).to({ opacity: 1, scale: 1 }, Math.min(0.15, during.over - duration)) }),
  ]);
}
export function Callout({ target, side = "right", during, children, color = "#f6c96b", fontSize = 14, width = 24 }: Timed & { readonly target: Rect; readonly side?: "left" | "right" | "top" | "bottom"; readonly children: string; readonly fontSize?: number; readonly width?: number }): SvgNode {
  if (!Number.isInteger(width) || width < 1) throw new Error("Callout width must be a positive character count.");
  const lines: string[] = [];
  for (const word of children.split(/\s+/)) {
    const last = lines.length - 1;
    if (last >= 0 && lines[last]!.length + 1 + word.length <= width) lines[last] += ` ${word}`; else lines.push(word);
  }
  const w = Math.max(...lines.map(s => s.length), 0) * fontSize * 0.6 + 20, h = lines.length * fontSize * 1.4 + 16;
  const x = side === "left" ? target.x - w - 20 : side === "right" ? target.x + target.w + 20 : target.center.x - w / 2;
  const y = side === "top" ? target.y - h - 20 : side === "bottom" ? target.y + target.h + 20 : target.center.y - h / 2;
  return el.g({ animation: visible(during) }, [el.rect({ x, y, width: w, height: h, rx: 6, fill: color, fillOpacity: 0.08, stroke: color, strokeOpacity: 0.4 }), ...lines.map((line, i) => el.text({ x: x + 10, y: y + 10 + fontSize + i * fontSize * 1.4, fontFamily: "monospace", fontSize, fill: color }, line))]);
}
export function Brace({ lines, side = "left", label, during, color = "#f6c96b" }: Timed & { readonly lines: Rect; readonly side?: "left" | "right"; readonly label?: string }): SvgNode {
  const x = side === "left" ? lines.x - 8 : lines.x + lines.w + 8, dir = side === "left" ? -1 : 1, mid = lines.center.y;
  return el.g({ animation: visible(during) }, [el.path({ d: `M${x} ${lines.y} q${dir * 8} 0 ${dir * 8} 8 V${mid - 8} q0 8 ${dir * 8} 8 q${-dir * 8} 0 ${-dir * 8} 8 V${lines.y + lines.h - 8} q0 8 ${-dir * 8} 8`, fill: "none", stroke: color, strokeWidth: 1.5, strokeLinecap: "round" }), label && el.text({ x: x + dir * 20, y: mid, textAnchor: side === "left" ? "end" : "start", fontFamily: "monospace", fontSize: 12, fill: color }, label)]);
}
export function Underline({ rect: r, style = "straight", during, color = "#f6c96b" }: Timed & { readonly rect: Rect; readonly style?: "straight" | "squiggle" }): SvgNode {
  const y = r.y + r.h - 2;
  const count = Math.max(1, Math.ceil(r.w / 8));
  const d = style === "straight" ? `M${r.x} ${y} h${r.w}` : `M${r.x} ${y} ` + Array.from({ length: count }, () => `l${r.w / count / 2} -2 l${r.w / count / 2} 2`).join(" ");
  return el.path({ d, fill: "none", stroke: color, strokeWidth: 1.5, strokeLinecap: "round", animation: [visible(during), draw({ at: during.at, over: Math.min(0.5, during.over / 2) })] });
}

import type { Color } from "../../attributes";
import { el } from "../../el";
import { textWidth, type FontValue } from "../../font/font";
import { rect, type Edge, type Point, type Rect } from "../../geometry";
import type { Box, Size } from "../../layout/box";
import { ease, motion, type Motion, type Seconds, type Stack } from "../../motion";
import { draw, enter } from "../../recipes";
import type { Child, SvgNode } from "../../svg";
import { defaultDark, type Base16, type Slot } from "../theme";
import { curve } from "./curve";

/** What a node is, so the theme can draw it. */
export type NodeRole = "task" | "input" | "output" | "tool" | "decision" | "store";

export interface Diagram<Id extends string> {
  readonly node: SvgNode;
  /** A node's box; for a group, a lane or an actor head, its box. */
  get(id: Id): Rect;
  /** Everything drawn, labels included. */
  readonly bounds: Rect;
}

/** Which point of `bounds` lands on `x`, `y`: a corner, the center, or the middle of an edge. */
export type Anchor = "top-left" | "center" | Edge;

export interface DiagramOptions {
  /** Default `defaultDark`. */
  readonly theme?: Base16;
  /** Where `anchor` of `bounds` lands. */
  readonly x?: number;
  readonly y?: number;
  /** Default `"top-left"`. */
  readonly anchor?: Anchor;
  /** Default 14. */
  readonly fontSize?: number;
  /** Embedded on the root element, and labels are sized by measuring them in it. */
  readonly font?: FontValue;
  /** On the root element, so fonts can come from your CSS. */
  readonly class?: string;
}

export type Labelled = string | { readonly label: string; readonly role?: NodeRole };

export const labelOf = (spec: Labelled): { readonly label: string; readonly role: NodeRole } =>
  typeof spec === "string" ? { label: spec, role: "task" } : { label: spec.label, role: spec.role ?? "task" };

const SLOT: Record<NodeRole, Slot> = { task: "base0D", input: "base0B", output: "base0C", tool: "base08", decision: "base0A", store: "base0E" };

export const tintOf = (theme: Base16, role: NodeRole): Color => theme[SLOT[role]];

/** The box a role needs around `label`. */
export const sizeOf = (role: NodeRole, label: string, fontSize: number, font?: FontValue): Size => {
  const [w, h] = [textWidth(label, fontSize, font) + fontSize * 2.2, Math.round(fontSize * 2.8)];
  switch (role) {
    case "input":
      return { w: w + h * 0.7, h };
    case "output":
      return { w: w + h * 0.4, h };
    case "tool":
      return { w: w + 16, h };
    case "decision":
      return { w: textWidth(label, fontSize, font) * 1.45 + fontSize * 4, h: Math.round(fontSize * 4.4) };
    case "store":
      return { w, h: h + 10 };
    case "task":
      return { w, h };
  }
};

/** The pop-in of a node that appears at `at`. It rises a few pixels rather than scaling, because browsers can keep a layer
 * that once animated `scale` rasterized at the smaller size, which leaves the label blurry long after it settles. */
export const popIn = (at: Seconds): Motion<"opacity" | "y"> => enter({ at, over: 0.35 }, { opacity: 0, y: 6 }, ease.out);

const SKEW = 0.35;
const LID = 5;

/** Moves an edge's end from the box border onto the shape's own outline, along the edge's last segment. */
export const onShape = (role: NodeRole, b: Box, end: Point, toward: Point): Point => {
  const [cx, cy] = [b.x + b.w / 2, b.y + b.h / 2];
  const vertical = end.x === toward.x;
  switch (role) {
    case "decision": {
      if (vertical) return { x: end.x, y: cy + Math.sign(end.y - cy) * (b.h / 2) * (1 - Math.min(1, Math.abs(end.x - cx) / (b.w / 2))) };
      return { x: cx + Math.sign(end.x - cx) * (b.w / 2) * (1 - Math.min(1, Math.abs(end.y - cy) / (b.h / 2))), y: end.y };
    }
    case "input": {
      if (vertical) return end;
      const s = b.h * SKEW * (1 - (end.y - b.y) / b.h);
      return { x: end.x < cx ? b.x + s : b.x + b.w - b.h * SKEW + s, y: end.y };
    }
    case "output": {
      const r = b.h / 2;
      if (vertical) {
        const dx = Math.max(0, Math.abs(end.x - cx) - (b.w / 2 - r));
        return { x: end.x, y: cy + Math.sign(end.y - cy) * Math.sqrt(Math.max(0, r * r - dx * dx)) };
      }
      return { x: cx + Math.sign(end.x - cx) * (b.w / 2 - r + Math.sqrt(Math.max(0, r * r - (end.y - cy) ** 2))), y: end.y };
    }
    case "store": {
      if (!vertical) return end;
      const curve = LID * Math.sqrt(Math.max(0, 1 - ((end.x - cx) / (b.w / 2)) ** 2));
      return { x: end.x, y: end.y < cy ? b.y + LID - curve : b.y + b.h - LID + curve };
    }
    case "task":
    case "tool":
      return end;
  }
};

export const outline = (role: NodeRole, { x, y, w, h }: Box): string => {
  switch (role) {
    case "input": {
      const s = h * SKEW;
      return `M${x + s} ${y}H${x + w}L${x + w - s} ${y + h}H${x}Z`;
    }
    case "output":
      return `M${x + h / 2} ${y}H${x + w - h / 2}A${h / 2} ${h / 2} 0 0 1 ${x + w - h / 2} ${y + h}H${x + h / 2}A${h / 2} ${h / 2} 0 0 1 ${x + h / 2} ${y}Z`;
    case "decision":
      return `M${x + w / 2} ${y}L${x + w} ${y + h / 2}L${x + w / 2} ${y + h}L${x} ${y + h / 2}Z`;
    case "store":
      return `M${x} ${y + LID}A${w / 2} ${LID} 0 0 1 ${x + w} ${y + LID}V${y + h - LID}A${w / 2} ${LID} 0 0 1 ${x} ${y + h - LID}Z`;
    case "tool":
    case "task": {
      const r = role === "tool" ? 3 : 8;
      return `M${x + r} ${y}H${x + w - r}Q${x + w} ${y} ${x + w} ${y + r}V${y + h - r}Q${x + w} ${y + h} ${x + w - r} ${y + h}H${x + r}Q${x} ${y + h} ${x} ${y + h - r}V${y + r}Q${x} ${y} ${x + r} ${y}Z`;
    }
  }
};

export interface Look {
  readonly theme: Base16;
  readonly fontSize: number;
}

/** What every diagram reads from its options: the theme and sizes with defaults applied, a `Look` at both sizes, and the root group that carries the class and font. */
export const look = (options: DiagramOptions) => {
  const { theme = defaultDark, fontSize = 14, font, class: cls } = options;
  const small = fontSize * 0.85;
  return {
    theme,
    fontSize,
    font,
    small,
    smallLook: { theme, fontSize: small } satisfies Look,
    root: (children: Child): SvgNode => el.g({ class: cls, fontFamily: font }, children),
  };
};

/** A role's shape with its label centered inside. `extra` draws over the fill, under the label. */
export const shape = (role: NodeRole, b: Box, label: string, look: Look, animation?: Stack<"opacity" | "scale" | "x" | "y">, extra?: SvgNode): SvgNode => {
  const { theme, fontSize } = look;
  const tint = tintOf(theme, role);
  const details =
    role === "tool"
      ? el.path({ d: `M${b.x + 8} ${b.y}V${b.y + b.h}M${b.x + b.w - 8} ${b.y}V${b.y + b.h}`, stroke: tint, strokeOpacity: 0.7, fill: "none" })
      : role === "store"
        ? el.path({ d: `M${b.x} ${b.y + LID}A${b.w / 2} ${LID} 0 0 0 ${b.x + b.w} ${b.y + LID}`, stroke: tint, fill: "none" })
        : undefined;
  return el.g({ animation }, [
    el.path({ d: outline(role, b), fill: theme.base00 }),
    el.path({ d: outline(role, b), fill: tint, fillOpacity: 0.14, stroke: tint, strokeWidth: 1.5, strokeLinejoin: "round" }),
    details,
    extra,
    el.text({ x: b.x + b.w / 2, y: b.y + b.h / 2 + (role === "store" ? LID / 2 : 0) + fontSize * 0.35, fontSize, textAnchor: "middle", fill: theme.base05 }, label),
  ]);
};

const HEAD = 8;

/** An orthogonal route drawn as a smooth curve ending in a filled arrowhead along its last run. With `at`, the line draws on over `over` and the head lands as it finishes. */
export const arrow = (points: readonly Point[], look: Look & { readonly color?: Color; readonly dashed?: boolean; readonly at?: Seconds; readonly over?: Seconds }): SvgNode => {
  const color = look.color ?? look.theme.base04;
  const [a, b] = [points.at(-2)!, points.at(-1)!];
  const length = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  const [ux, uy] = [(b.x - a.x) / length, (b.y - a.y) / length];
  const trimmed = [...points.slice(0, -1), { x: b.x - ux * (HEAD - 1), y: b.y - uy * (HEAD - 1) }];
  const head = `M${b.x} ${b.y}L${b.x - ux * HEAD - uy * HEAD * 0.5} ${b.y - uy * HEAD + ux * HEAD * 0.5}L${b.x - ux * HEAD + uy * HEAD * 0.5} ${b.y - uy * HEAD - ux * HEAD * 0.5}Z`;
  const { at, over = 0.4 } = look;
  return el.g({}, [
    el.path({
      d: curve(trimmed).d,
      fill: "none",
      stroke: color,
      strokeWidth: 1.5,
      strokeLinejoin: "round",
      strokeDasharray: look.dashed ? "5 4" : undefined,
      animation: at === undefined ? undefined : look.dashed ? motion({ opacity: 0 }).at(at).to({ opacity: 1 }, over) : draw({ at, over }),
    }),
    el.path({ d: head, fill: color, animation: at === undefined ? undefined : motion({ opacity: 0 }).at(at + over * 0.85).to({ opacity: 1 }, over * 0.15) }),
  ]);
};

/** A text label on a knockout of the background color, so the line it sits on breaks around it. */
export const chip = (b: Box, text: string, look: Look & { readonly fill?: Color; readonly ground?: Color | "none" }, animation?: Stack<"opacity">): SvgNode =>
  el.g({ animation }, [
    el.rect({ x: b.x, y: b.y, width: b.w, height: b.h, rx: 3, fill: look.ground ?? look.theme.base00 }),
    el.text({ x: b.x + b.w / 2, y: b.y + b.h / 2 + look.fontSize * 0.35, fontSize: look.fontSize, textAnchor: "middle", fill: look.fill ?? look.theme.base04 }, text),
  ]);

/** The knockout box an inline edge label needs. */
export const labelSize = (text: string, fontSize: number, font?: FontValue): Size => ({ w: textWidth(text, fontSize, font) + 10, h: Math.round(fontSize * 1.5) });

/** The top-left corner that puts `anchor` of a `w` by `h` box on `(x, y)`. */
export const corner = (w: number, h: number, { x = 0, y = 0, anchor = "top-left" }: { readonly x?: number; readonly y?: number; readonly anchor?: Anchor }): Point => {
  const point = anchor === "top-left" ? { x: 0, y: 0 } : anchor === "center" ? rect(0, 0, w, h).center : rect(0, 0, w, h)[anchor];
  return { x: x - point.x, y: y - point.y };
};

/** Shifts layout geometry so `bounds` lands where `options` place it. */
export const placer = (bounds: Box, options: { readonly x?: number; readonly y?: number; readonly anchor?: Anchor }) => {
  const { x, y } = corner(bounds.w, bounds.h, options);
  const [dx, dy] = [x - bounds.x, y - bounds.y];
  return {
    box: (b: Box): Rect => rect(b.x + dx, b.y + dy, b.w, b.h),
    point: (p: Point): Point => ({ x: p.x + dx, y: p.y + dy }),
    bounds: rect(x, y, bounds.w, bounds.h),
  };
};

export const lookup = <Id extends string>(what: string, boxes: ReadonlyMap<string, Rect>) =>
  (id: Id): Rect => {
    const b = boxes.get(id);
    if (!b) throw new Error(`${what} has no ${JSON.stringify(id)}.`);
    return b;
  };

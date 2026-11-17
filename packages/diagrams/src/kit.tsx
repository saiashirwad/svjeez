/** @jsxImportSource svjeez */
import {
  type Color,
  textWidth,
  type FontValue,
  type Edge,
  type Point,
  type Rect,
  type Box,
  type Drawn,
  type Part,
  type Size,
  ease,
  motion,
  type Motion,
  type Seconds,
  type Span,
  type Spanned,
  span,
  stagger,
  type Beats,
  type Stack,
  draw,
  enter,
  type Child,
  type SvgNode,
  defaultDark,
  type Base16,
  type Slot,
} from "svjeez";
import { rect } from "svjeez/geometry";
import { curve } from "./curve.ts";

/** What a node is, so the theme can draw it. */
export type NodeRole = "task" | "input" | "output" | "tool" | "decision" | "store";

/**
 * A laid-out diagram. Its parts are its nodes, and a flowchart's groups, a sequence's actor heads and the lanes of
 * `lanes()`, by the ids the spec gave them. A part's `span` is when it appears, or the instant 0 when it is there from
 * the start, as everything is without `play`. `span` runs from the first reveal to the end of the last, and `bounds`
 * covers everything drawn, labels included.
 */
export type Diagram<Id extends string> = Drawn<Part<Id>>;

/**
 * When a diagram's items appear: a start, after which they follow `step` apart in the diagram's own order; one time per
 * item, in that order; or a time per node id, in any order, which leaves the nodes it does not name there from the start.
 */
export type PlayAt<Id extends string> = Beats | Readonly<Partial<Record<Id, Seconds>>>;

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
  /** The color each role is drawn in, over the defaults. A scene that wants two or three hues maps its roles onto them. */
  readonly tints?: Partial<Record<NodeRole, Color>>;
}

export type Labelled = string | { readonly label: string; readonly role?: NodeRole };

export const isBareLabel = (spec: string | { readonly label: string }): spec is string =>
  typeof spec === "string";

export const labelOf = (spec: Labelled): { readonly label: string; readonly role: NodeRole } =>
  isBareLabel(spec)
    ? { label: spec, role: "task" }
    : { label: spec.label, role: spec.role ?? "task" };

const SLOT: Record<NodeRole, Slot> = {
  task: "base0D",
  input: "base0B",
  output: "base0C",
  tool: "base08",
  decision: "base0A",
  store: "base0E",
};

export const tintOf = (
  theme: Base16,
  role: NodeRole,
  tints?: Partial<Record<NodeRole, Color>>,
): Color => tints?.[role] ?? theme[SLOT[role]];

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
      return {
        w: textWidth(label, fontSize, font) * 1.45 + fontSize * 4,
        h: Math.round(fontSize * 4.4),
      };
    case "store":
      return { w, h: h + 10 };
    case "task":
      return { w, h };
  }
};

/** Seconds a node takes to pop in. */
export const POP = 0.35;

/** The pop-in of a node that appears at `at`. It rises a few pixels rather than scaling, because browsers can keep a layer
 * that once animated `scale` rasterized at the smaller size, which leaves the label blurry long after it settles. */
export const popIn = (at: Seconds): Motion<"opacity" | "y"> =>
  enter({ at, over: POP }, { opacity: 0, y: 6 }, ease.out);

const isBeats = (at: PlayAt<string>): at is Beats => typeof at === "number" || Array.isArray(at);

export const INSTANT: Spanned = span(0, 0);

/**
 * When each node appears, `-Infinity` for one there from the start. A start or a list follows `order`, the diagram's
 * own, which leaves out the nodes there from the start; a record names its nodes from `all`.
 */
export const schedule = (
  at: PlayAt<string>,
  order: readonly string[],
  all: readonly string[],
  step: Seconds,
  what: string,
): Map<string, Seconds> => {
  const shown = new Map(all.map((id) => [id, -Infinity]));

  if (isBeats(at)) {
    slots(at, order.length, step, what).forEach((s, i) => shown.set(order[i]!, s.at));

    return shown;
  }

  for (const [id, t] of Object.entries(at)) {
    if (!shown.has(id))
      throw new Error(
        `${what} names ${JSON.stringify(id)}, which is not a node. Its nodes are ${all.map((n) => JSON.stringify(n)).join(", ")}.`,
      );

    if (t === undefined) continue;

    if (!(Number.isFinite(t) && t >= 0))
      throw new Error(`${what} needs a time of 0 or later for ${JSON.stringify(id)}, got ${t}.`);

    shown.set(id, t);
  }

  return shown;
};

/** The span from the earliest start to the latest end of `reveals`, or the instant 0 when nothing reveals. */
export const spanOfReveals = (reveals: readonly Span[]): Spanned => {
  if (reveals.length === 0) return span(0, 0);

  const first = Math.min(...reveals.map((r) => r.at));
  const last = Math.max(...reveals.map((r) => r.at + r.over));

  return span(first, last - first);
};

/**
 * Each item's slot on a `play` timeline: from when it appears until the next one does, the last one `step` long. From a
 * start the items follow `step` apart; a list gives one time each, in order, to keep two diagrams in step.
 */
const isStart = (at: Beats): at is Seconds => typeof at === "number";

export const slots = (at: Beats, count: number, step: Seconds, what: string): Spanned[] => {
  if (isStart(at)) {
    if (!(at >= 0)) throw new Error(`${what} needs a non-negative start, got ${at}.`);

    return stagger(span(at, step), count, step);
  }

  if (at.length !== count) throw new Error(`${what} needs ${count} times, got ${at.length}.`);

  if (at.some((t, i) => !(t >= 0) || (i > 0 && t < at[i - 1]!)))
    throw new Error(`${what} needs non-negative times in order, got ${at.join(", ")}.`);

  return at.map((t, i) => span(t, i + 1 < at.length ? at[i + 1]! - t : step));
};

const SKEW = 0.35;
const LID = 5;

/** Moves an edge's end from the box border onto the shape's own outline, along the edge's last segment. */
export const onOutline = (role: NodeRole, b: Box, end: Point, toward: Point): Point => {
  const [cx, cy] = [b.x + b.w / 2, b.y + b.h / 2];
  const vertical = end.x === toward.x;

  switch (role) {
    case "decision": {
      if (vertical)
        return {
          x: end.x,
          y:
            cy +
            Math.sign(end.y - cy) * (b.h / 2) * (1 - Math.min(1, Math.abs(end.x - cx) / (b.w / 2))),
        };

      return {
        x:
          cx +
          Math.sign(end.x - cx) * (b.w / 2) * (1 - Math.min(1, Math.abs(end.y - cy) / (b.h / 2))),
        y: end.y,
      };
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

        return {
          x: end.x,
          y: cy + Math.sign(end.y - cy) * Math.sqrt(Math.max(0, r * r - dx * dx)),
        };
      }

      return {
        x:
          cx +
          Math.sign(end.x - cx) * (b.w / 2 - r + Math.sqrt(Math.max(0, r * r - (end.y - cy) ** 2))),
        y: end.y,
      };
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
  readonly tints?: Partial<Record<NodeRole, Color>>;
}

/** What every diagram reads from its options: the theme and sizes with defaults applied, a `Look` at both sizes, and the root group that carries the class and font. */
export const look = (options: DiagramOptions) => {
  const { theme = defaultDark, fontSize = 14, font, class: cls, tints } = options;
  const small = fontSize * 0.85;

  return {
    theme,
    fontSize,
    font,
    small,
    tints,
    smallLook: { theme, fontSize: small, tints } satisfies Look,
    root: (children: Child): SvgNode => (
      <g class={cls} fontFamily={font}>
        {children}
      </g>
    ),
  };
};

/** A role's shape with its label centered inside. `extra` draws over the fill, under the label. */
export const drawNode = (
  role: NodeRole,
  b: Box,
  label: string,
  look: Look,
  animation?: Stack<"opacity" | "scale" | "x" | "y">,
  extra?: SvgNode,
): SvgNode => {
  const { theme, fontSize } = look;
  const tint = tintOf(theme, role, look.tints);

  const details =
    role === "tool" ? (
      <path
        d={`M${b.x + 8} ${b.y}V${b.y + b.h}M${b.x + b.w - 8} ${b.y}V${b.y + b.h}`}
        stroke={tint}
        strokeOpacity={0.5}
        strokeWidth={1.5}
        fill="none"
      />
    ) : role === "store" ? (
      <path
        d={`M${b.x} ${b.y + LID}A${b.w / 2} ${LID} 0 0 0 ${b.x + b.w} ${b.y + LID}`}
        stroke={tint}
        fill="none"
      />
    ) : undefined;

  return (
    <g animation={animation}>
      <path d={outline(role, b)} fill={theme.base00} />
      <path d={outline(role, b)} fill={tint} fillOpacity={0.22} stroke={tint} strokeWidth={1.5} />
      {details}
      {extra}
      <text
        x={b.x + b.w / 2}
        y={b.y + b.h / 2 + (role === "store" ? LID / 2 : 0) + fontSize * 0.35}
        fontSize={fontSize}
        textAnchor="middle"
        fontWeight={600}
        fill={theme.base05}
      >
        {label}
      </text>
    </g>
  );
};

const HEAD = 8;

/** An orthogonal route drawn as a smooth curve ending in a filled arrowhead along its last run. With `at`, the line draws on over `over` and the head lands as it finishes. */
export const arrow = (
  points: readonly Point[],
  look: Look & {
    readonly color?: Color;
    readonly dashed?: boolean;
    readonly at?: Seconds;
    readonly over?: Seconds;
  },
): SvgNode => {
  const color = look.color ?? look.theme.base04;
  const [a, b] = [points.at(-2)!, points.at(-1)!];
  const length = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  const [ux, uy] = [(b.x - a.x) / length, (b.y - a.y) / length];
  const trimmed = [...points.slice(0, -1), { x: b.x - ux * (HEAD - 1), y: b.y - uy * (HEAD - 1) }];
  const head = `M${b.x} ${b.y}L${b.x - ux * HEAD - uy * HEAD * 0.5} ${b.y - uy * HEAD + ux * HEAD * 0.5}L${b.x - ux * HEAD + uy * HEAD * 0.5} ${b.y - uy * HEAD - ux * HEAD * 0.5}Z`;
  const { at, over = 0.4 } = look;

  return (
    <g>
      <path
        d={curve(trimmed).d}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeDasharray={look.dashed ? "5 4" : undefined}
        animation={
          at === undefined
            ? undefined
            : look.dashed
              ? motion({ opacity: 0 }).to({ opacity: 1 }, span(at, over))
              : draw({ at, over })
        }
      />
      <path
        d={head}
        fill={color}
        animation={
          at === undefined
            ? undefined
            : motion({ opacity: 0 }).to({ opacity: 1 }, span(at + over * 0.85, over * 0.15))
        }
      />
    </g>
  );
};

/** A text label on a knockout of the background color, so the line it sits on breaks around it. */
export const chip = (
  b: Box,
  text: string,
  look: Look & { readonly fill?: Color; readonly ground?: Color | "none" },
  animation?: Stack<"opacity">,
): SvgNode => (
  <g animation={animation}>
    <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={3} fill={look.ground ?? look.theme.base00} />
    <text
      x={b.x + b.w / 2}
      y={b.y + b.h / 2 + look.fontSize * 0.35}
      fontSize={look.fontSize}
      textAnchor="middle"
      fill={look.fill ?? look.theme.base04}
    >
      {text}
    </text>
  </g>
);

export const labelSize = (text: string, fontSize: number, font?: FontValue): Size => ({
  w: textWidth(text, fontSize, font) + 10,
  h: Math.round(fontSize * 1.5),
});

export const corner = (
  w: number,
  h: number,
  {
    x = 0,
    y = 0,
    anchor = "top-left",
  }: { readonly x?: number; readonly y?: number; readonly anchor?: Anchor },
): Point => {
  const point =
    anchor === "top-left"
      ? { x: 0, y: 0 }
      : anchor === "center"
        ? rect(0, 0, w, h).center
        : rect(0, 0, w, h)[anchor];

  return { x: x - point.x, y: y - point.y };
};

export const placer = (
  bounds: Box,
  options: { readonly x?: number; readonly y?: number; readonly anchor?: Anchor },
) => {
  const { x, y } = corner(bounds.w, bounds.h, options);
  const [dx, dy] = [x - bounds.x, y - bounds.y];

  return {
    box: (b: Box): Rect => rect(b.x + dx, b.y + dy, b.w, b.h),
    point: (p: Point): Point => ({ x: p.x + dx, y: p.y + dy }),
    bounds: rect(x, y, bounds.w, bounds.h),
  };
};

/**
 * The id of the edge from `F` to `T` as a part, such as `"pr->post"`. An edge from a list of edges in the spec gets
 * one id per pair, so TypeScript checks `part("pr->post")` against the edges written.
 */
export type EdgeId<E> = E extends readonly [
  infer F extends string,
  infer T extends string,
  ...unknown[],
]
  ? `${F}->${T}`
  : never;

export const edgeId = (from: string, to: string): string => `${from}->${to}`;

/** The box around a line's points, and around its label when it has one. */
export const lineBox = (points: readonly Point[], label?: Box): Rect => {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const [left, top] = [Math.min(...xs), Math.min(...ys)];
  const box = rect(left, top, Math.max(...xs) - left, Math.max(...ys) - top);

  return label ? box.union(rect(label.x, label.y, label.w, label.h)) : box;
};

/**
 * A part for each box, in order, appearing during `when(id)`, and `part(id)` over them. Two parts may share an id, as
 * two edges between the same nodes do; `part(id)` finds the first.
 */
export const partsOf = <Id extends string>(
  what: string,
  boxes: Iterable<readonly [string, Rect]>,
  when: (id: string, index: number) => Spanned = () => INSTANT,
) => {
  // SAFETY: the boxes are keyed by the spec's ids, which the diagram's signature types as Id
  const parts = [...boxes].map(([id, box], i): Part<Id> => ({
    id: id as Id,
    box,
    span: when(id, i),
  }));

  return {
    parts,
    part: (id: Id): Part<Id> => {
      const found = parts.find((p) => p.id === id);

      if (!found)
        throw new Error(
          `${what} has no ${JSON.stringify(id)}. Its parts are ${parts
            .slice(0, 6)
            .map((p) => JSON.stringify(p.id))
            .join(", ")}${parts.length > 6 ? ", …" : ""}.`,
        );

      return found;
    },
  };
};

/** @jsxImportSource svjeez */
import {
  type Color,
  textWidth,
  type Point,
  type Box,
  type Direction,
  type Seconds,
  type Span,
  type SvgNode,
  flow,
  type FlowOptions,
  show,
  type Beats,
  type Drawn,
  type Part,
} from "svjeez";
import { pathLength } from "svjeez/geometry";
import { span as spanOf } from "svjeez";
import { layered } from "./layout/layered.ts";
import { curve } from "./curve.ts";
import {
  arrow,
  chip,
  isBareLabel,
  labelSize,
  edgeId,
  INSTANT,
  lineBox,
  look,
  partsOf,
  placer,
  slots,
  tintOf,
  type Diagram,
  type DiagramOptions,
  type EdgeId,
  type NodeRole,
} from "./kit.tsx";

/** A label, or a state with options; `states` makes it a composite with its own `initial`. */
export type StateSpec =
  | string
  | { readonly label: string; readonly final?: boolean; readonly role?: NodeRole }
  | {
      readonly label: string;
      readonly final?: boolean;
      readonly role?: NodeRole;
      readonly states: Record<string, StateSpec>;
      readonly initial: string;
    };

type StateIds<S> = {
  [K in keyof S & string]: K | (S[K] extends { readonly states: infer I } ? StateIds<I> : never);
}[keyof S & string];

type Checked<S> = {
  readonly [K in keyof S]: S[K] extends { readonly states: infer I }
    ? S[K] & { readonly initial: keyof I & string; readonly states: Checked<I> }
    : S[K];
};

export type StateTransition<S extends string> =
  | readonly [from: S, to: S]
  | readonly [from: S, to: S, label: string];

export interface StateMachineOptions extends DiagramOptions {
  readonly direction?: Direction;
}

/**
 * Parts are the legs of the path, by id such as `"idle->busy"`; a leg's span is when the token is on it. A repeated
 * leg makes two parts with one id; `part()` finds the first.
 */
export interface Walk<S extends string> extends Drawn<Part<`${S}->${S}`>> {
  readonly spans: Record<S, readonly Span[]>;
}

export type WalkToken = Omit<FlowOptions, "at" | "over" | "speed">;

/**
 * Parts are the states (nested included), then transitions by id such as `"idle->busy"`, all there from the start;
 * `walk()` plays. Transitions between the same states share an id; `part()` finds the first.
 */
export interface StateMachine<S extends string, T extends string = `${S}->${S}`> extends Diagram<
  S | T
> {
  edge(from: S, to: S): Point[];
  /**
   * Lights each state of `path` in turn, running a token along a transition between them. Throws if there is no such
   * way. From a start `at`, each state stays lit for `dwell` and the token moves at `speed`; with one time per state,
   * each lights at its time.
   */
  walk(
    path: readonly S[],
    options: {
      readonly at: Beats;
      readonly dwell?: Seconds;
      readonly speed?: number;
      readonly token?: WalkToken;
    },
  ): Walk<S>;
}

interface Node {
  readonly id: string;
  readonly label: string;
  readonly final: boolean;
  readonly role?: NodeRole;
  readonly parent?: string;
  readonly depth: number;
  readonly inner?: Scope;
}

interface Scope {
  readonly owner?: string;
  readonly depth: number;
  readonly nodes: readonly Node[];
  readonly initial: string;
}

interface Run {
  readonly from: string;
  readonly to: string;
  readonly points: Point[];
  readonly depth: number;
}

type Line =
  | (Run & { readonly of: number; readonly label?: Box })
  | (Run & { readonly of: "start" | "end" });

const isTransitionLine = (l: Line): l is Run & { readonly of: number; readonly label?: Box } =>
  typeof l.of === "number";

const isSingleStart = (at: Beats): at is Seconds => typeof at === "number";

const relocate = (l: Line, point: (p: Point) => Point, box: (b: Box) => Box): Line => {
  const points = l.points.map(point);

  return isTransitionLine(l) ? { ...l, points, label: l.label && box(l.label) } : { ...l, points };
};

interface Local {
  readonly w: number;
  readonly h: number;
  readonly boxes: Map<string, Box>;
  readonly lines: Line[];
  readonly dots: Box[];
  readonly ends: Box[];
}

const START = "\u0000start";
const END = "\u0000end";
const DOT = 14;
const RING = 18;
const PAD = 16;

const shift = (b: Box, dx: number, dy: number): Box => ({
  x: b.x + dx,
  y: b.y + dy,
  w: b.w,
  h: b.h,
});

export function stateMachine<
  const S extends Record<string, StateSpec>,
  const T extends readonly StateTransition<NoInfer<StateIds<S>>>[],
>(
  spec: {
    readonly states: Checked<S>;
    readonly initial: NoInfer<keyof S & string>;
    readonly transitions: T;
  },
  options: StateMachineOptions = {},
): StateMachine<StateIds<S>, EdgeId<T[number]>> {
  type Id = StateIds<S>;

  const { direction } = options;
  const base = look(options);
  const { theme, fontSize, font, small } = base;
  const header = Math.round(fontSize * 2.6);
  const nodes = new Map<string, Node>();
  const claimed = new Set<string>();

  const scope = (
    states: Record<string, StateSpec>,
    initial: string,
    depth: number,
    owner?: string,
  ): Scope => {
    const list = Object.entries(states).map(([id, s]): Node => {
      if (nodes.has(id) || claimed.has(id))
        throw new Error(`stateMachine() has two states named ${JSON.stringify(id)}.`);

      claimed.add(id);

      const node: Node = isBareLabel(s)
        ? { id, label: s, final: false, parent: owner, depth }
        : {
            id,
            label: s.label,
            final: s.final ?? false,
            role: s.role,
            parent: owner,
            depth,
            inner: "states" in s ? scope(s.states, s.initial, depth + 1, id) : undefined,
          };

      nodes.set(id, node);

      return node;
    });

    if (!list.some((n) => n.id === initial))
      throw new Error(
        `stateMachine() initial ${JSON.stringify(initial)} is not one of its scope's states.`,
      );

    return { owner, depth, nodes: list, initial };
  };

  // SAFETY: Checked<S> only adds initial and states to S's composites, which StateSpec already admits
  const root = scope(spec.states as Record<string, StateSpec>, spec.initial, 0);

  const chain = (id: string): string[] => {
    const node = nodes.get(id);

    if (!node) throw new Error(`stateMachine() has no state ${JSON.stringify(id)}.`);

    return node.parent === undefined ? [id] : [...chain(node.parent), id];
  };

  const home = (from: string, to: string) => {
    const [a, b] = [chain(from), chain(to)];
    let k = 0;

    while (k < a.length - 1 && k < b.length - 1 && a[k] === b[k]) k++;

    if (from !== to && (a.includes(to) || b.includes(from)))
      throw new Error(
        `stateMachine() cannot draw a transition between ${JSON.stringify(from)} and ${JSON.stringify(to)}, because one holds the other. Draw it from a sibling of the composite, or from one of its inner states.`,
      );

    return { owner: k === 0 ? undefined : a[k - 1], from: a[k]!, to: b[k]! };
  };

  const transitions = spec.transitions.map(([from, to, label]: StateTransition<string>, i) => ({
    i,
    label,
    ...home(from, to),
    source: from,
    target: to,
  }));

  const lay = (s: Scope): Local => {
    const inner = new Map(s.nodes.flatMap((n) => (n.inner ? [[n.id, lay(n.inner)] as const] : [])));

    const size = (n: Node) => {
      const own = {
        w: textWidth(n.label, fontSize, font) + fontSize * 2.4,
        h: Math.round(fontSize * 2.8),
      };

      const box = inner.get(n.id);

      return box ? { w: Math.max(own.w, box.w + 2 * PAD), h: header + box.h + 2 * PAD } : own;
    };

    const mine = transitions.filter((t) => t.owner === s.owner);
    const finals = s.nodes.filter((n) => n.final);

    const out = layered({
      direction,
      nodes: [
        { id: START, w: DOT, h: DOT },
        ...s.nodes.map((n) => ({ id: n.id, ...size(n) })),
        ...(finals.length > 0 ? [{ id: END, w: RING, h: RING }] : []),
      ],
      edges: [
        { from: START, to: s.initial },
        ...mine.map((t) => ({
          from: t.from,
          to: t.to,
          label: t.label === undefined ? undefined : labelSize(t.label, small, font),
        })),
        ...finals.map((n) => ({ from: n.id, to: END })),
      ],
    });

    const [dx, dy] = [-out.bounds.x, -out.bounds.y];
    const boxes = new Map([...out.nodes].map(([id, b]) => [id, shift(b, dx, dy)]));

    const lines: Line[] = out.edges.map((e, k): Line => {
      const run = {
        from: e.from,
        to: e.to,
        points: e.points.map((p) => ({ x: p.x + dx, y: p.y + dy })),
        depth: s.depth,
      };

      if (k === 0) return { ...run, of: "start" };

      if (k > mine.length) return { ...run, of: "end" };

      return { ...run, of: mine[k - 1]!.i, label: e.label && shift(e.label, dx, dy) };
    });

    const dots = [boxes.get(START)!];
    const ends = finals.length > 0 ? [boxes.get(END)!] : [];

    for (const [id, local] of inner) {
      const b = boxes.get(id)!;
      const [ix, iy] = [b.x + (b.w - local.w) / 2, b.y + header + PAD];

      for (const [k, v] of local.boxes) boxes.set(k, shift(v, ix, iy));
      lines.push(
        ...local.lines.map((l) =>
          relocate(
            l,
            (p) => ({ x: p.x + ix, y: p.y + iy }),
            (b) => shift(b, ix, iy),
          ),
        ),
      );
      dots.push(...local.dots.map((d) => shift(d, ix, iy)));
      ends.push(...local.ends.map((d) => shift(d, ix, iy)));
    }

    return { w: out.bounds.w, h: out.bounds.h, boxes, lines, dots, ends };
  };

  const local = lay(root);
  const at = placer({ x: 0, y: 0, w: local.w, h: local.h }, options);
  const boxes = new Map([...nodes.keys()].map((id) => [id, at.box(local.boxes.get(id)!)]));
  const lines = local.lines.map((l) => relocate(l, at.point, at.box));
  const [dots, ends] = [local.dots.map(at.box), local.ends.map(at.box)];
  const ground = (depth: number): Color => (depth % 2 === 0 ? theme.base00 : theme.base01);

  const drawn = (n: Node): SvgNode => {
    const b = boxes.get(n.id)!;
    const fill = ground(n.depth + 1);
    const tint = n.role && tintOf(theme, n.role, base.tints);

    const frame = (
      <g>
        <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={n.inner ? 10 : 8} fill={fill} />
        <rect
          x={b.x}
          y={b.y}
          width={b.w}
          height={b.h}
          rx={n.inner ? 10 : 8}
          fill={tint || "none"}
          fillOpacity={n.inner ? 0.1 : 0.22}
          stroke={tint || theme.base03}
          strokeWidth={tint ? 1.5 : undefined}
        />
      </g>
    );

    const title = (y: number) => (
      <text
        x={b.center.x}
        y={y + fontSize * 0.35}
        fontSize={fontSize}
        textAnchor="middle"
        fill={theme.base05}
      >
        {n.label}
      </text>
    );

    if (!n.inner)
      return (
        <g>
          {frame}
          {title(b.center.y)}
        </g>
      );

    return (
      <g>
        {frame}
        <path d={`M${b.x} ${b.y + header}h${b.w}`} stroke={tint || theme.base03} />
        {title(b.y + header / 2)}
      </g>
    );
  };

  const node = base.root([
    [...nodes.values()].sort((a, b) => a.depth - b.depth).map(drawn),
    lines.map((l) => arrow(l.points, base)),
    dots.map(({ center: { x, y } }) => <circle cx={x} cy={y} r={DOT / 2} fill={theme.base05} />),
    ends.map(({ center: { x: cx, y: cy } }) => (
      <g>
        <circle cx={cx} cy={cy} r={RING / 2} fill="none" stroke={theme.base05} strokeWidth={1.5} />
        <circle cx={cx} cy={cy} r={RING / 2 - 4} fill={theme.base05} />
      </g>
    )),
    lines.map(
      (l) =>
        isTransitionLine(l) &&
        l.label &&
        chip(l.label, transitions[l.of]!.label!, {
          ...base.smallLook,
          fill: theme.base05,
          ground: ground(l.depth),
        }),
    ),
  ]);

  const line = (pred: (l: (typeof lines)[number]) => boolean) => lines.find(pred);

  const edge = (from: Id, to: Id): Point[] => {
    const found = line(
      (l) =>
        isTransitionLine(l) &&
        transitions[l.of]!.source === from &&
        transitions[l.of]!.target === to,
    );

    if (!found)
      throw new Error(
        `stateMachine() has no transition from ${JSON.stringify(from)} to ${JSON.stringify(to)}.`,
      );

    return curve(found.points).samples;
  };

  const step = (a: string, b: string): Point[] => {
    for (const from of chain(a).reverse()) {
      const found = line(
        (l) =>
          isTransitionLine(l) &&
          transitions[l.of]!.source === from &&
          transitions[l.of]!.target === b,
      );

      if (found) return curve(found.points).samples;
    }

    const target = nodes.get(b)!;

    if (target.parent === a && nodes.get(a)!.inner!.initial === b) {
      const entry = line((l) => l.of === "start" && l.to === b)!;

      return curve(entry.points).samples;
    }

    throw new Error(`walk() has no way from ${JSON.stringify(a)} to ${JSON.stringify(b)}.`);
  };

  return {
    node,
    span: INSTANT,
    bounds: at.bounds,
    ...partsOf<Id | EdgeId<T[number]>>("stateMachine()", [
      ...boxes,
      ...transitions.map((t) => {
        const drawn = lines.find((l) => isTransitionLine(l) && l.of === t.i)!;

        return [
          edgeId(t.source, t.target),
          lineBox(drawn.points, isTransitionLine(drawn) ? drawn.label : undefined),
        ] as const;
      }),
    ]),
    edge,
    walk: (path, { at, dwell = 1, speed = 220, token = {} }) => {
      if (path.length === 0) throw new Error("walk() needs at least one state, got none.");

      for (const s of path)
        if (!nodes.has(s))
          throw new Error(
            `walk() has no state ${JSON.stringify(s)}. States are ${[...nodes.keys()].map((k) => JSON.stringify(k)).join(", ")}.`,
          );

      const legs = path.slice(1).map((next, k) => {
        const points = step(path[k]!, next);

        return { points, over: Math.max(0.35, pathLength(points) / speed) };
      });

      const arrive = isSingleStart(at)
        ? path.map(
            (_, k) => at + k * dwell + legs.slice(0, k).reduce((sum, leg) => sum + leg.over, 0),
          )
        : slots(at, path.length, 0, "walk()").map((s) => s.at);

      const runs = legs.map((leg, k) => {
        const over = isSingleStart(at)
          ? leg.over
          : Math.min(leg.over, (arrive[k + 1]! - arrive[k]!) / 2);

        return { points: leg.points, at: arrive[k + 1]! - over, over };
      });

      const lit = new Map<string, Span[]>();
      path.forEach((s, k) => {
        const until = runs[k]?.at ?? arrive[k]! + dwell;
        lit.set(s, [...(lit.get(s) ?? []), { at: arrive[k]!, over: until - arrive[k]! }]);
      });

      const tokens = runs.map(
        (run) =>
          run.over > 0 &&
          flow(run.points, { color: theme.base09, size: 5, ...token, at: run.at, over: run.over })
            .node,
      );

      const overlay = (
        <g>
          {[...lit].map(([s, spans]) => {
            const b = boxes.get(s)!.pad(4);

            return (
              <rect
                x={b.x}
                y={b.y}
                width={b.w}
                height={b.h}
                rx={nodes.get(s)!.inner ? 13 : 11}
                fill="none"
                stroke={theme.base09}
                strokeWidth={2}
                animation={show(spans, { fade: 0.15 })}
              />
            );
          })}
          {tokens}
        </g>
      );

      // SAFETY: nodes.keys() are exactly the ids of S, and each one gets an entry (empty when never lit)
      const spans = Object.fromEntries(
        [...nodes.keys()].map((s) => [s, lit.get(s) ?? []]),
      ) as Record<Id, Span[]>;

      const end = arrive.at(-1)! + dwell;

      const glows = [...lit.keys()].map((s) => boxes.get(s)!.pad(5));

      const moves = runs.map((run, k): Part<`${Id}->${Id}`> => ({
        id: `${path[k]!}->${path[k + 1]!}`,
        box: lineBox(run.points),
        span: spanOf(run.at, run.over),
      }));

      return {
        node: overlay,
        spans,
        span: spanOf(arrive[0]!, end - arrive[0]!),
        bounds: [...glows, ...moves.map((l) => l.box)].reduce((a, b) => a.union(b)),
        parts: moves,
        part: (id) => {
          const found = moves.find((l) => l.id === id);

          if (!found)
            throw new Error(
              `walk() has no leg ${JSON.stringify(id)}. Its legs are ${moves.map((l) => JSON.stringify(l.id)).join(", ") || "none: the path has one state"}.`,
            );

          return found;
        },
      };
    },
  };
}

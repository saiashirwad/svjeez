import type { Color } from "../../attributes";
import { el } from "../../el";
import { rect, type Point, type Rect } from "../../geometry";
import type { Box, Direction } from "../../layout/box";
import { layered } from "../../layout/layered";
import type { Seconds, Span } from "../../motion";
import type { SvgNode } from "../../svg";
import { flow, type FlowOptions } from "../flow";
import { beats, visible, type Beats } from "../timeline";
import { curve } from "./curve";
import { arrow, chip, corner, labelSize, look, lookup, textWidth, type Diagram, type DiagramOptions } from "./kit";

/** A label, or a state with options; `states` makes it a composite with its own `initial`. */
export type StateSpec =
  | string
  | { readonly label: string; readonly final?: boolean }
  | { readonly label: string; readonly final?: boolean; readonly states: Record<string, StateSpec>; readonly initial: string };

/** Every state id in `S`, nested ones included. */
export type StateIds<S> = {
  [K in keyof S & string]: K | (S[K] extends { readonly states: infer I } ? StateIds<I> : never);
}[keyof S & string];

/** Holds each composite's `initial` to its own states. */
export type Checked<S> = {
  readonly [K in keyof S]: S[K] extends { readonly states: infer I } ? S[K] & { readonly initial: keyof I & string; readonly states: Checked<I> } : S[K];
};

export type Transition<S extends string> = readonly [from: S, to: S] | readonly [from: S, to: S, label: string];

export interface StateOptions extends DiagramOptions {
  readonly direction?: Direction;
}

export interface Walk<S extends string> {
  readonly node: SvgNode;
  /** When each state is lit. */
  readonly spans: Record<S, readonly Span[]>;
  /** When the last state goes dark. */
  readonly end: Seconds;
}

/** How the walk's token looks; `at` and timing come from the walk. */
export type WalkToken = Omit<FlowOptions, "at" | "over" | "speed">;

export interface StateMachine<S extends string> extends Diagram<S> {
  /** The drawn line of the first transition `from` → `to`, sampled along its curve. */
  edge(from: S, to: S): Point[];
  /**
   * An overlay that lights each state of `path` in turn, running a token to the next along a transition from it or
   * from a composite holding it, or into a composite's initial state. Throws if there is no such way.
   *
   * From a start `at`, each state stays lit for `dwell` and the token moves at `speed`. With one time per state, each
   * state lights at its time, the token arriving just then; the last stays lit for `dwell`.
   */
  walk(path: readonly S[], options: { readonly at: Beats; readonly dwell?: Seconds; readonly speed?: number; readonly token?: WalkToken }): Walk<S>;
}

interface Node {
  readonly id: string;
  readonly label: string;
  readonly final: boolean;
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

interface Line {
  /** Index into the transitions, or the scope's start or end marker. */
  readonly of: number | "start" | "end";
  readonly from: string;
  readonly to: string;
  readonly points: Point[];
  readonly label?: Box;
  readonly depth: number;
}

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

const shift = (b: Box, dx: number, dy: number): Box => ({ x: b.x + dx, y: b.y + dy, w: b.w, h: b.h });

/**
 * A layered state machine. A dot marks each scope's initial state; final states lead to a bullseye. A composite is
 * laid out inside first, then sized to fit and laid out with its siblings as one node; transitions attach to the
 * nearest ancestors that share a scope.
 */
export function stateMachine<const S extends Record<string, StateSpec>>(
  spec: { readonly states: Checked<S>; readonly initial: NoInfer<keyof S & string>; readonly transitions: readonly Transition<NoInfer<StateIds<S>>>[] },
  options: StateOptions = {},
): StateMachine<StateIds<S>> {
  type Id = StateIds<S>;
  const { direction } = options;
  const l0 = look(options);
  const { theme, fontSize, font, small } = l0;
  const header = Math.round(fontSize * 2.6);
  const nodes = new Map<string, Node>();
  const scope = (states: Record<string, StateSpec>, initial: string, depth: number, owner?: string): Scope => {
    const list = Object.entries(states).map(([id, s]): Node => {
      if (nodes.has(id)) throw new Error(`stateMachine() has two states named ${JSON.stringify(id)}.`);
      const node: Node =
        typeof s === "string"
          ? { id, label: s, final: false, parent: owner, depth }
          : { id, label: s.label, final: s.final ?? false, parent: owner, depth, inner: "states" in s ? scope(s.states, s.initial, depth + 1, id) : undefined };
      nodes.set(id, node);
      return node;
    });
    if (!list.some((n) => n.id === initial)) throw new Error(`stateMachine() initial ${JSON.stringify(initial)} is not one of its scope's states.`);
    return { owner, depth, nodes: list, initial };
  };
  const root = scope(spec.states as Record<string, StateSpec>, spec.initial, 0);
  const chain = (id: string): string[] => {
    const node = nodes.get(id);
    if (!node) throw new Error(`stateMachine() has no state ${JSON.stringify(id)}.`);
    return node.parent === undefined ? [id] : [...chain(node.parent), id];
  };
  /** The scope owner a transition lives in, and its two ends as that scope's direct members. */
  const home = (from: string, to: string) => {
    const [a, b] = [chain(from), chain(to)];
    let k = 0;
    while (k < a.length - 1 && k < b.length - 1 && a[k] === b[k]) k++;
    return { owner: k === 0 ? undefined : a[k - 1], from: a[k]!, to: b[k]! };
  };
  const transitions = spec.transitions.map(([from, to, label], i) => ({ i, label, ...home(from, to), source: from as string, target: to as string }));

  const lay = (s: Scope): Local => {
    const inner = new Map(s.nodes.flatMap((n) => (n.inner ? [[n.id, lay(n.inner)] as const] : [])));
    const size = (n: Node) => {
      const own = { w: textWidth(n.label, fontSize, font) + fontSize * 2.4, h: Math.round(fontSize * 2.8) };
      const box = inner.get(n.id);
      return box ? { w: Math.max(own.w, box.w + 2 * PAD), h: header + box.h + 2 * PAD } : own;
    };
    const mine = transitions.filter((t) => t.owner === s.owner);
    const finals = s.nodes.filter((n) => n.final);
    const out = layered({
      direction,
      nodes: [{ id: START, w: DOT, h: DOT }, ...s.nodes.map((n) => ({ id: n.id, ...size(n) })), ...(finals.length > 0 ? [{ id: END, w: RING, h: RING }] : [])],
      edges: [
        { from: START, to: s.initial },
        ...mine.map((t) => ({ from: t.from, to: t.to, label: t.label === undefined ? undefined : labelSize(t.label, small, font) })),
        ...finals.map((n) => ({ from: n.id, to: END })),
      ],
    });
    const [dx, dy] = [-out.bounds.x, -out.bounds.y];
    const boxes = new Map([...out.nodes].map(([id, b]) => [id, shift(b, dx, dy)]));
    const of = (k: number): Line["of"] => (k === 0 ? "start" : k <= mine.length ? mine[k - 1]!.i : "end");
    const lines: Line[] = out.edges.map((e, k) => ({ of: of(k), from: e.from, to: e.to, points: e.points.map((p) => ({ x: p.x + dx, y: p.y + dy })), label: e.label && shift(e.label, dx, dy), depth: s.depth }));
    const dots = [boxes.get(START)!];
    const ends = finals.length > 0 ? [boxes.get(END)!] : [];
    for (const [id, local] of inner) {
      const b = boxes.get(id)!;
      const [ix, iy] = [b.x + (b.w - local.w) / 2, b.y + header + PAD];
      for (const [k, v] of local.boxes) boxes.set(k, shift(v, ix, iy));
      lines.push(...local.lines.map((l) => ({ ...l, points: l.points.map((p) => ({ x: p.x + ix, y: p.y + iy })), label: l.label && shift(l.label, ix, iy) })));
      dots.push(...local.dots.map((d) => shift(d, ix, iy)));
      ends.push(...local.ends.map((d) => shift(d, ix, iy)));
    }
    return { w: out.bounds.w, h: out.bounds.h, boxes, lines, dots, ends };
  };
  const local = lay(root);
  const { x: ox, y: oy } = corner(local.w, local.h, options);
  const boxes = new Map([...nodes.keys()].map((id) => [id, toRect(shift(local.boxes.get(id)!, ox, oy))]));
  const lines = local.lines.map((l) => ({ ...l, points: l.points.map((p) => ({ x: p.x + ox, y: p.y + oy })), label: l.label && toRect(shift(l.label, ox, oy)) }));
  const ground = (depth: number): Color => (depth % 2 === 0 ? theme.base00 : theme.base01);

  const drawn = (n: Node): SvgNode => {
    const b = boxes.get(n.id)!;
    const fill = ground(n.depth + 1);
    const frame = el.rect({ x: b.x, y: b.y, width: b.w, height: b.h, rx: n.inner ? 10 : 8, fill, stroke: theme.base03 });
    const title = (y: number) => el.text({ x: b.center.x, y: y + fontSize * 0.35, fontSize, textAnchor: "middle", fill: theme.base05 }, n.label);
    if (!n.inner) return el.g({}, [frame, title(b.center.y)]);
    return el.g({}, [frame, el.path({ d: `M${b.x} ${b.y + header}h${b.w}`, stroke: theme.base03 }), title(b.y + header / 2)]);
  };
  const node = l0.root([
    [...nodes.values()].sort((a, b) => a.depth - b.depth).map(drawn),
    lines.map((l) => arrow(l.points, l0)),
    local.dots.map((d) => el.circle({ cx: d.x + ox + d.w / 2, cy: d.y + oy + d.h / 2, r: DOT / 2, fill: theme.base05 })),
    local.ends.map((d) => {
      const [cx, cy] = [d.x + ox + d.w / 2, d.y + oy + d.h / 2];
      return el.g({}, [el.circle({ cx, cy, r: RING / 2, fill: "none", stroke: theme.base05, strokeWidth: 1.5 }), el.circle({ cx, cy, r: RING / 2 - 4, fill: theme.base05 })]);
    }),
    lines.map((l) => l.label && chip(l.label, transitions[l.of as number]!.label!, { ...l0.smallLook, fill: theme.base05, ground: ground(l.depth) })),
  ]);

  const line = (pred: (l: (typeof lines)[number]) => boolean) => lines.find(pred);
  const edge = (from: Id, to: Id): Point[] => {
    const found = line((l) => typeof l.of === "number" && transitions[l.of]!.source === from && transitions[l.of]!.target === to);
    if (!found) throw new Error(`stateMachine() has no transition from ${JSON.stringify(from)} to ${JSON.stringify(to)}.`);
    return curve(found.points).samples;
  };
  /** How a walk gets from `a` to `b`: a transition from `a` or a composite holding it, or into a composite's initial state. */
  const step = (a: string, b: string): Point[] => {
    for (const from of chain(a).reverse()) {
      const found = line((l) => typeof l.of === "number" && transitions[l.of]!.source === from && transitions[l.of]!.target === b);
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
    bounds: rect(ox, oy, local.w, local.h),
    get: lookup("stateMachine()", boxes),
    edge,
    walk: (path, { at, dwell = 1, speed = 220, token = {} }) => {
      if (path.length === 0) throw new Error("walk() needs at least one state, got none.");
      const legs = path.slice(1).map((next, k) => {
        const points = step(path[k]!, next);
        const length = points.slice(1).reduce((sum, p, i) => sum + Math.hypot(p.x - points[i]!.x, p.y - points[i]!.y), 0);
        return { points, over: Math.max(0.35, length / speed) };
      });
      const arrive =
        typeof at === "number"
          ? path.map((_, k) => at + k * dwell + legs.slice(0, k).reduce((sum, leg) => sum + leg.over, 0))
          : beats(at, path.length, 0, "walk()");
      const runs = legs.map((leg, k) => {
        const over = typeof at === "number" ? leg.over : Math.min(leg.over, (arrive[k + 1]! - arrive[k]!) / 2);
        return { points: leg.points, at: arrive[k + 1]! - over, over };
      });
      const lit = new Map<string, Span[]>();
      path.forEach((s, k) => {
        const until = runs[k]?.at ?? arrive[k]! + dwell;
        lit.set(s, [...(lit.get(s) ?? []), { at: arrive[k]!, over: until - arrive[k]! }]);
      });
      const tokens = runs.map((run) => run.over > 0 && flow(run.points, { color: theme.base09, size: 5, ...token, at: run.at, over: run.over }).node);
      const overlay = el.g({}, [
        [...lit].map(([s, spans]) => {
          const b = boxes.get(s)!.pad(4);
          return el.rect({ x: b.x, y: b.y, width: b.w, height: b.h, rx: nodes.get(s)!.inner ? 13 : 11, fill: "none", stroke: theme.base09, strokeWidth: 2, animation: visible(spans) });
        }),
        tokens,
      ]);
      const spans = Object.fromEntries([...nodes.keys()].map((s) => [s, lit.get(s) ?? []])) as Record<Id, Span[]>;
      return { node: overlay, spans, end: arrive.at(-1)! + dwell };
    },
  };
}

const toRect = (b: Box): Rect => rect(b.x, b.y, b.w, b.h);

/** @jsxImportSource svjeez */
import {
  Group,
  Shape,
  Text,
  circle,
  line,
  polygon,
  rect,
  sampled,
  span,
  track,
  type SceneElement,
  type Span,
  type Vec,
} from "svjeez";
import { SceneError, type Child, type Color } from "svjeez/tools";
import { layered } from "./layout/layered.ts";
import { DIRECTIONS, type Box, type Point } from "./layout/box.ts";
import {
  Route,
  checkIds,
  Chip,
  Edge,
  checkDraws,
  drawnBy,
  edgeKey,
  isBare,
  keyed,
  known,
  labelSize,
  look,
  mix,
  type Look,
  partsOf,
  spanOf,
  type Diagram,
  type DiagramOptions,
  type EdgeId,
} from "./kit.tsx";
import type { Direction, NodeRole, StateNote, StateSpec, StateTransition } from "./types.ts";

type StateIds<S> = {
  [K in keyof S & string]:
    | K
    | (S[K] extends {
        readonly states: infer I;
      }
        ? StateIds<I>
        : never)
    | (S[K] extends { readonly parallel: readonly (infer R)[] }
        ? R extends { readonly states: infer J }
          ? StateIds<J>
          : never
        : never);
}[keyof S & string];

type Checked<S> = {
  readonly [K in keyof S]: S[K] extends {
    readonly states: infer I;
  }
    ? S[K] & {
        readonly initial: keyof I & string;
        readonly states: Checked<I>;
      }
    : S[K];
};

export interface StateMachineOptions extends DiagramOptions {
  readonly direction?: Direction;
}

export interface WalkOptions {
  readonly at: Span | readonly Span[];
  readonly speed?: number;
}

export interface Walk<S extends string> {
  readonly node: SceneElement;
  readonly span: Span;
  readonly spans: Readonly<Record<S, readonly Span[]>>;
}

export interface StateMachine<S extends string, T extends string = `${S}->${S}`> extends Diagram<
  S | T
> {
  edge(from: S, to: S): Route;
  walk(path: readonly S[], options: WalkOptions): Walk<S>;
}

interface Node {
  readonly id: string;
  readonly label: string;
  readonly final: boolean;
  readonly kind: "state" | "choice" | "bar";
  readonly detail: readonly string[];
  readonly role?: NodeRole;
  readonly parent?: string;
  readonly region: number;
  readonly depth: number;
  readonly inner?: readonly Scope[];
}

interface Note {
  readonly name: string;
  readonly of: string;
  readonly side: "left" | "right";
  readonly lines: readonly string[];
  readonly w: number;
  readonly h: number;
}

interface StateBoxProps {
  readonly key: string;
  readonly look: Look;
  readonly node: Node;
  readonly box: Box;
  readonly header: number;
  readonly ground: Color;
}

const StateBox = ({ look: l, node: n, box: b, header, ground }: StateBoxProps): SceneElement => {
  if (n.kind === "choice")
    return (
      <Shape
        key={n.id}
        geometry={polygon([b.w / 2, 0], [b.w, b.h / 2], [b.w / 2, b.h], [0, b.h / 2])}
        at={[b.x, b.y]}
        fill={l.colors.text}
      />
    );

  if (n.kind === "bar")
    return (
      <Shape
        key={n.id}
        geometry={rect(b.w, b.h, { radius: 2 })}
        at={[b.x, b.y]}
        fill={l.colors.text}
      />
    );

  const tint = n.role && l.tint(n.role);
  const radius = n.inner ? 10 : 8;
  const split = n.inner || n.detail.length > 0;
  const rule = tint ?? l.colors.line;

  return (
    <Group key={n.id} offset={[b.x, b.y]}>
      <Shape
        key="shape"
        geometry={rect(b.w, b.h, { radius })}
        fill={n.role ? mix(l.tint(n.role), ground, n.inner ? 0.1 : 0.22) : ground}
        stroke={{ color: rule, width: tint ? 1.5 : 1 }}
      />
      {split && (
        <Shape
          key="rule"
          geometry={line([0, header], [b.w, header])}
          stroke={{ color: rule, width: 1 }}
        />
      )}
      <Text
        key="label"
        font={l.font}
        size={l.size}
        weight={l.weight}
        fill={l.colors.text}
        anchor="center"
        at={[b.w / 2, split ? header / 2 : b.h / 2]}
      >
        {n.label}
      </Text>
      {n.detail.map((text, k) => (
        <Text
          key={`detail-${k + 1}`}
          font={l.font}
          size={l.small}
          fill={l.colors.muted}
          anchor="left"
          at={[l.size, header + l.size * 0.4 + l.small * 1.5 * (k + 0.5)]}
        >
          {text}
        </Text>
      ))}
    </Group>
  );
};

interface NoteBoxProps {
  readonly key: string;
  readonly look: Look;
  readonly note: Note;
  readonly box: Box;
  readonly ground: Color;
}

const NoteBox = ({ look: l, note, box: b, ground }: NoteBoxProps): SceneElement => (
  <Group key={note.name} offset={[b.x, b.y]}>
    <Shape
      key="shape"
      geometry={rect(b.w, b.h, { radius: 3 })}
      fill={mix(l.tint("decision"), ground, 0.16)}
      stroke={{ color: l.tint("decision"), width: 1 }}
    />
    {note.lines.map((text, k) => (
      <Text
        key={`line-${k + 1}`}
        font={l.font}
        size={l.small}
        fill={l.colors.text}
        anchor="left"
        at={[NOTE_PAD, NOTE_PAD + l.small * 0.75 + l.small * 1.4 * k]}
      >
        {text}
      </Text>
    ))}
  </Group>
);

interface Scope {
  readonly owner?: string;
  readonly region: number;
  readonly direction: Direction;
  readonly depth: number;
  readonly nodes: readonly Node[];
  readonly initial: string;
}

interface Line {
  readonly from: string;
  readonly to: string;
  readonly points: Point[];
  readonly depth: number;
  readonly of: number | "start" | "end";
  readonly label?: Box;
}

interface Local {
  readonly w: number;
  readonly h: number;
  readonly boxes: Map<string, Box>;
  readonly lines: Line[];
  readonly dots: Box[];
  readonly ends: Box[];
  readonly rules: Point[][];
  readonly notes: Placed[];
}

interface Placed {
  readonly i: number;
  readonly box: Box;
  readonly lr: boolean;
}

const WHAT = "stateMachine()";
const START = "\u0000start";
const END = "\u0000end";
const DOT = 14;
const RING = 18;
const PAD = 16;
const NOTE_PAD = 8;
const NOTE_GAP = 28;
const NOTE_STACK = 8;
const CHOICE = 28;
const BAR = [80, 8] as const;
const SPLIT = PAD * 2;

const isTransition = (
  line: Line,
): line is Line & {
  readonly of: number;
} => typeof line.of === "number";

const isList = (at: Span | readonly Span[]): at is readonly Span[] => Array.isArray(at);

const shift = (b: Box, dx: number, dy: number): Box => ({
  x: b.x + dx,
  y: b.y + dy,
  w: b.w,
  h: b.h,
});

const moved = (l: Line, dx: number, dy: number): Line => ({
  ...l,
  points: l.points.map((p) => ({ x: p.x + dx, y: p.y + dy })),
  ...(l.label && { label: shift(l.label, dx, dy) }),
});

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

const centerOf = (b: Box): Vec => [b.x + b.w / 2, b.y + b.h / 2];

export function stateMachine<
  const S extends Record<string, StateSpec>,
  const T extends readonly StateTransition<NoInfer<StateIds<S>>>[],
>(
  spec: {
    readonly states: Checked<S>;
    readonly initial: NoInfer<keyof S & string>;
    readonly transitions: T;
    readonly notes?: readonly StateNote<NoInfer<StateIds<S>>>[];
  },
  options: StateMachineOptions,
): StateMachine<StateIds<S>, EdgeId<T[number]>> {
  type Id = StateIds<S>;

  const l = look(options, WHAT);
  const { direction = "TB" } = options;

  if (!DIRECTIONS.includes(direction))
    throw new SceneError(
      `${WHAT} takes direction "TB", "LR", "BT" or "RL", got "${String(direction)}".`,
    );
  const header = Math.round(l.size * 2.6);
  const nodes = new Map<string, Node>();

  const scope = (
    r: { readonly states: Readonly<Record<string, StateSpec>>; readonly initial: string },
    depth: number,
    heading: Direction,
    region: number,
    owner?: string,
  ): Scope => {
    checkIds(Object.keys(r.states), owner ? `${WHAT} state "${owner}"` : WHAT, "state");

    const list = Object.entries(r.states).map(([id, s]): Node => {
      if (nodes.has(id))
        throw new SceneError(
          `${WHAT} has two states named "${id}".`,
          "Give each state its own name, inner states too.",
        );

      const none: readonly string[] = [];
      const base = { id, parent: owner, region, depth, detail: none };

      const node: Node = isBare(s)
        ? { ...base, label: s, final: false, kind: "state" }
        : "kind" in s
          ? { ...base, label: "", final: false, kind: s.kind }
          : {
              ...base,
              label: s.label,
              final: s.final ?? false,
              role: s.role,
              kind: "state",
              detail: "detail" in s ? (s.detail ?? []) : [],
              inner:
                "states" in s
                  ? [s, ...(s.parallel ?? [])].map((x, k) =>
                      scope(x, depth + 1, s.direction ?? heading, k, id),
                    )
                  : undefined,
            };

      nodes.set(id, node);

      return node;
    });

    known(
      r.initial,
      list.map((n) => n.id),
      WHAT,
      "state",
      owner ? `state "${owner}"'s initial` : "initial",
    );

    return { owner, region, direction: heading, depth, nodes: list, initial: r.initial };
  };

  const root = scope(
    // SAFETY: Checked<S> only adds initial and states to S's composites, which StateSpec already admits
    { states: spec.states as Readonly<Record<string, StateSpec>>, initial: spec.initial },
    0,
    direction,
    0,
  );

  const ids = [...nodes.keys()];

  const chain = (id: string): string[] => {
    const node = nodes.get(id)!;

    return node.parent === undefined ? [id] : [...chain(node.parent), id];
  };

  const home = (from: string, to: string) => {
    const [a, b] = [chain(from), chain(to)];
    let k = 0;

    while (k < a.length - 1 && k < b.length - 1 && a[k] === b[k]) k++;

    if (from !== to && (a.includes(to) || b.includes(from)))
      throw new SceneError(
        `${WHAT} can't draw a transition between "${from}" and "${to}", because one holds the other.`,
        "Draw it from a sibling of the composite, or from one of its inner states.",
      );

    const region = nodes.get(a[k]!)!.region;

    if (region !== nodes.get(b[k]!)!.region)
      throw new SceneError(
        `${WHAT} can't draw a transition between "${from}" and "${to}", because they sit in concurrent regions.`,
        "Regions run side by side: draw transitions inside a region, or to the composite.",
      );

    return { owner: k === 0 ? undefined : a[k - 1], region, from: a[k]!, to: b[k]! };
  };

  const transitions = spec.transitions.map(([from, to, label]: StateTransition<string>, i) => ({
    i,
    label,
    ...home(
      known(from, ids, WHAT, "state", `transition ${i + 1}`),
      known(to, ids, WHAT, "state", `transition ${i + 1}`),
    ),
    source: from,
    target: to,
  }));

  const notes = (spec.notes ?? []).map((n: StateNote, i): Note => {
    const lines = n.text.split("\n").map((x) => x.trim());

    if (lines.every((x) => x === "")) throw new SceneError(`${WHAT} note ${i + 1} has no text.`);

    known(n.of, ids, WHAT, "state", `note ${i + 1}`);

    if (nodes.get(n.of)!.kind !== "state")
      throw new SceneError(
        `${WHAT} note ${i + 1} is attached to "${n.of}", a ${nodes.get(n.of)!.kind}.`,
        "Attach notes to ordinary states.",
      );

    return {
      name: `note-${i + 1}`,
      of: n.of,
      side: n.side ?? "right",
      lines,
      w: Math.max(...lines.map((x) => l.measure(x, l.small))) + NOTE_PAD * 2,
      h: lines.length * l.small * 1.4 + NOTE_PAD * 2,
    };
  });

  const nodeSize = (n: Node, lr: boolean) => {
    if (n.kind === "choice") return { w: CHOICE, h: CHOICE };

    if (n.kind === "bar") return lr ? { w: BAR[1], h: BAR[0] } : { w: BAR[0], h: BAR[1] };

    const lead = l.measure(n.label, l.size, l.weight);
    const w = Math.max(lead, ...n.detail.map((x) => l.measure(x, l.small) + l.size * 0.4));

    return {
      w: w + l.size * 2.4,
      h: n.detail.length
        ? header + l.size * 0.8 + n.detail.length * l.small * 1.5
        : Math.round(l.size * 2.8),
    };
  };

  const empty = (w: number, h: number): Local => ({
    w,
    h,
    boxes: new Map(),
    lines: [],
    dots: [],
    ends: [],
    rules: [],
    notes: [],
  });

  const absorb = (into: Local, from: Local, dx: number, dy: number) => {
    for (const [k, v] of from.boxes) into.boxes.set(k, shift(v, dx, dy));
    into.lines.push(...from.lines.map((x) => moved(x, dx, dy)));
    into.dots.push(...from.dots.map((d) => shift(d, dx, dy)));
    into.ends.push(...from.ends.map((d) => shift(d, dx, dy)));
    into.rules.push(...from.rules.map((r) => r.map((p) => ({ x: p.x + dx, y: p.y + dy }))));
    into.notes.push(...from.notes.map((n) => ({ ...n, box: shift(n.box, dx, dy) })));
  };

  const join = (parts: readonly Local[], lr: boolean): Local => {
    const along = (x: Local) => (lr ? x.h : x.w);
    const across = (x: Local) => (lr ? x.w : x.h);
    const total = parts.reduce((t, x) => t + along(x), 0) + SPLIT * (parts.length - 1);

    const out = empty(
      lr ? Math.max(...parts.map(across)) : total,
      lr ? total : Math.max(...parts.map(across)),
    );

    let at = 0;

    parts.forEach((x, k) => {
      absorb(out, x, lr ? 0 : at, lr ? at : 0);
      at += along(x);

      if (k < parts.length - 1) {
        const mid = at + SPLIT / 2;

        out.rules.push(
          lr
            ? [
                { x: -PAD, y: mid },
                { x: out.w + PAD, y: mid },
              ]
            : [
                { x: mid, y: -PAD },
                { x: mid, y: out.h + PAD },
              ],
        );
      }

      at += SPLIT;
    });

    return out;
  };

  const lay = (s: Scope): Local => {
    const lr = s.direction === "LR";

    const inner = new Map(
      s.nodes.flatMap((n) =>
        n.inner ? [[n.id, join(n.inner.map(lay), n.inner[0]!.direction === "LR")] as const] : [],
      ),
    );

    const size = (n: Node) => {
      const own = nodeSize(n, lr);
      const box = inner.get(n.id);

      return box ? { w: Math.max(own.w, box.w + 2 * PAD), h: header + box.h + 2 * PAD } : own;
    };

    const room = (n: Node, own: { w: number; h: number }) => {
      const mine = notes.map((x, i) => ({ x, i })).filter(({ x }) => x.of === n.id);

      const stack = (side: Note["side"]) => {
        const row = mine.filter(({ x }) => x.side === side);

        return (
          row.reduce((t, { x }) => t + (lr ? x.w : x.h), 0) +
          NOTE_STACK * Math.max(0, row.length - 1)
        );
      };

      const gap = mine.length ? Math.max(...mine.map(({ x }) => (lr ? x.h : x.w))) + NOTE_GAP : 0;

      const long = Math.max(lr ? own.w : own.h, stack("left"), stack("right"));

      return {
        mine,
        gap,
        w: lr ? long : own.w + 2 * gap,
        h: lr ? own.h + 2 * gap : long,
      };
    };

    const slots = new Map(s.nodes.map((n) => [n.id, room(n, size(n))] as const));

    const mine = transitions.filter((t) => t.owner === s.owner && t.region === s.region);
    const finals = s.nodes.filter((n) => n.final);

    const out = layered({
      direction: s.direction,
      nodes: [
        { id: START, w: DOT, h: DOT },
        ...s.nodes.map((n) => ({ id: n.id, w: slots.get(n.id)!.w, h: slots.get(n.id)!.h })),
        ...(finals.length > 0 ? [{ id: END, w: RING, h: RING }] : []),
      ],
      edges: [
        { from: START, to: s.initial },
        ...mine.map((t) => ({
          from: t.from,
          to: t.to,
          label: t.label === undefined ? undefined : labelSize(l, t.label),
        })),
        ...finals.map((n) => ({ from: n.id, to: END })),
      ],
    });

    const [dx, dy] = [-out.bounds.x, -out.bounds.y];
    const result = empty(out.bounds.w, out.bounds.h);
    const slotBox = new Map([...out.nodes].map(([id, b]) => [id, shift(b, dx, dy)]));
    const boxes = new Map(slotBox);

    for (const n of s.nodes) {
      const [sb, own, slot] = [slotBox.get(n.id)!, size(n), slots.get(n.id)!];

      const b: Box = {
        x: sb.x + (sb.w - own.w) / 2,
        y: sb.y + (sb.h - own.h) / 2,
        ...own,
      };

      boxes.set(n.id, b);

      for (const side of ["left", "right"] as const) {
        const row = slot.mine.filter(({ x }) => x.side === side);

        const span =
          row.reduce((t, { x }) => t + (lr ? x.w : x.h), 0) +
          NOTE_STACK * Math.max(0, row.length - 1);

        let at = (lr ? b.x + b.w / 2 : b.y + b.h / 2) - span / 2;

        for (const { x, i } of row) {
          const sign = side === "left" ? -1 : 1;

          const box: Box = lr
            ? {
                x: at,
                y: sign < 0 ? b.y - NOTE_GAP - x.h : b.y + b.h + NOTE_GAP,
                w: x.w,
                h: x.h,
              }
            : {
                x: sign < 0 ? b.x - NOTE_GAP - x.w : b.x + b.w + NOTE_GAP,
                y: at,
                w: x.w,
                h: x.h,
              };

          result.notes.push({ i, box, lr });
          at += (lr ? x.w : x.h) + NOTE_STACK;
        }
      }
    }

    const keep = (points: Point[], id: string, end: 0 | -1): Point[] => {
      const [b, sb] = [boxes.get(id)!, slotBox.get(id)!];

      if (b.x === sb.x && b.y === sb.y && b.w === sb.w && b.h === sb.h) return points;
      const flat = (p: Point): Point => (lr ? { x: p.y, y: p.x } : p);
      const [lo, hi] = lr ? [b.y + 6, b.y + b.h - 6] : [b.x + 6, b.x + b.w - 6];
      const [tip, next] = end === 0 ? [points[0]!, points[1]!] : [points.at(-1)!, points.at(-2)!];
      const [t, n] = [flat(tip), flat(next)];
      const now = clamp(t.x, lo, hi);

      if (now === t.x) return points;
      const mid = (t.y + n.y) / 2;
      const back = (x: number, y: number): Point => (lr ? { x: y, y: x } : { x, y });
      const jog = [back(now, t.y), back(now, mid), back(t.x, mid)];

      return end === 0 ? [...jog, ...points.slice(1)] : [...points.slice(0, -1), ...jog.reverse()];
    };

    const lines = out.edges.map((e, k): Line => {
      const base = e.points.map((p) => ({ x: p.x + dx, y: p.y + dy }));
      const first = e.from === START ? base : keep(base, e.from, 0);

      return {
        from: e.from,
        to: e.to,
        points: e.to === END ? first : keep(first, e.to, -1),
        depth: s.depth,
        of: k === 0 ? "start" : k > mine.length ? "end" : mine[k - 1]!.i,
        ...(k > 0 && k <= mine.length && e.label && { label: shift(e.label, dx, dy) }),
      };
    });

    result.lines.push(...lines);
    result.dots.push(slotBox.get(START)!);

    if (finals.length > 0) result.ends.push(slotBox.get(END)!);

    for (const [k, v] of boxes) result.boxes.set(k, v);

    for (const [id, local] of inner) {
      const b = boxes.get(id)!;

      absorb(result, local, b.x + (b.w - local.w) / 2, b.y + header + PAD);
    }

    return result;
  };

  const local = lay(root);
  const boxes = new Map(ids.map((id) => [id, local.boxes.get(id)!]));

  const ground = (depth: number): Color =>
    depth === 0 ? l.colors.background : mix(l.colors.line, l.colors.background, 0.08 * depth);

  const transitionKeys = keyed(transitions.map((t) => edgeKey(t.source, t.target)));

  const lineKeys = local.lines.map((x) =>
    isTransition(x)
      ? transitionKeys[x.of]!
      : x.of === "start"
        ? `start->${x.to}`
        : `${x.from}->end`,
  );

  checkDraws(options.draw, lineKeys, WHAT);

  const parts = new Map<string, Span | undefined>([
    ...ids.map((id) => [id, undefined] as const),
    ...transitionKeys.map((key) => [key, undefined] as const),
  ]);

  const handle = partsOf<Id | EdgeId<T[number]>>(WHAT, parts);

  const draw = (between?: Child): SceneElement => (
    <Group ref={handle.ref}>
      {[...nodes.values()]
        .sort((a, b) => a.depth - b.depth)
        .map((n) => (
          <StateBox
            key={n.id}
            look={l}
            node={n}
            box={boxes.get(n.id)!}
            header={header}
            ground={ground(n.depth + 1)}
          />
        ))}
      {local.rules.map((r, k) => (
        <Shape
          key={`divider-${k + 1}`}
          geometry={line([r[0]!.x, r[0]!.y], [r[1]!.x, r[1]!.y])}
          stroke={{ color: l.colors.line, width: 1, dash: [6, 4] }}
        />
      ))}
      {local.notes.map(({ i, box, lr }) => {
        const b = boxes.get(notes[i]!.of)!;
        const side = notes[i]!.side;

        return (
          <Shape
            key={`note-${i + 1}:link`}
            geometry={
              lr
                ? line(
                    [
                      clamp(box.x + box.w / 2, b.x + 6, b.x + b.w - 6),
                      side === "left" ? box.y + box.h : box.y,
                    ],
                    [
                      clamp(box.x + box.w / 2, b.x + 6, b.x + b.w - 6),
                      side === "left" ? b.y : b.y + b.h,
                    ],
                  )
                : line(
                    [
                      side === "left" ? box.x + box.w : box.x,
                      clamp(box.y + box.h / 2, b.y + 6, b.y + b.h - 6),
                    ],
                    [
                      side === "left" ? b.x : b.x + b.w,
                      clamp(box.y + box.h / 2, b.y + 6, b.y + b.h - 6),
                    ],
                  )
            }
            stroke={{ color: l.colors.line, width: 1, dash: [3, 3] }}
          />
        );
      })}
      {local.notes.map(({ i, box }) => (
        <NoteBox
          key={`note-${i + 1}`}
          look={l}
          note={notes[i]!}
          box={box}
          ground={ground(nodes.get(notes[i]!.of)!.depth)}
        />
      ))}
      {local.lines.map((x, i) => (
        <Edge
          key={lineKeys[i]!}
          look={l}
          points={x.points}
          draw={drawnBy(options.draw, lineKeys[i]!, undefined, WHAT)}
        />
      ))}
      {local.dots.map((d, k) => (
        <Shape
          key={`initial-${k + 1}`}
          geometry={circle(DOT / 2)}
          anchor="center"
          at={centerOf(d)}
          fill={l.colors.text}
        />
      ))}
      {local.ends.map((d, k) => (
        <Group key={`final-${k + 1}`} offset={centerOf(d)}>
          <Shape
            geometry={circle(RING / 2)}
            anchor="center"
            at={[0, 0]}
            stroke={{ color: l.colors.text, width: 1.5 }}
          />
          <Shape geometry={circle(RING / 2 - 4)} anchor="center" at={[0, 0]} fill={l.colors.text} />
        </Group>
      ))}
      {between}
      {local.lines.map(
        (x) =>
          isTransition(x) &&
          x.label && (
            <Chip
              key={`${transitionKeys[x.of]!}:label`}
              look={l}
              box={x.label}
              text={transitions[x.of]!.label!}
              fill={l.colors.text}
              ground={ground(x.depth)}
            />
          ),
      )}
    </Group>
  );

  const find = (from: string, to: string) =>
    local.lines.find(
      (x) =>
        isTransition(x) && transitions[x.of]!.source === from && transitions[x.of]!.target === to,
    );

  const step = (a: string, b: string): Route => {
    for (const from of chain(a).reverse()) {
      const found = find(from, b);

      if (found) return new Route([found.points]);
    }

    const target = nodes.get(b)!;

    if (target.parent === a && nodes.get(a)!.inner![target.region]!.initial === b)
      return new Route([local.lines.find((x) => x.of === "start" && x.to === b)!.points]);
    throw new SceneError(
      `walk() has no way from "${a}" to "${b}".`,
      "Each next state needs a transition from the one before, or is the initial state inside it.",
    );
  };

  return {
    node: draw(),
    with: draw,
    size: [Math.ceil(local.w), Math.ceil(local.h)],
    span: undefined,
    ...handle,
    edge: (from, to) => {
      const found = find(
        known(from, ids, WHAT, "state", "edge()"),
        known(to, ids, WHAT, "state", "edge()"),
      );

      if (!found) throw new SceneError(`${WHAT} has no transition from "${from}" to "${to}".`);

      return new Route([found.points]);
    },
    walk: (path, { at, speed = 220 }) => {
      if (path.length === 0) throw new SceneError("walk() needs at least one state, got none.");

      for (const s of path) known(s, ids, "walk()", "state", "its path");

      if (!(speed > 0 && Number.isFinite(speed)))
        throw new SceneError(`walk() needs a speed above 0, got ${speed}.`);

      const legs = path.slice(1).map((next, k) => {
        const route = step(path[k]!, next);

        return { route, over: Math.max(0.35, route.length / speed) };
      });

      const list = isList(at) ? at : undefined;

      if (list && list.length !== path.length)
        throw new SceneError(
          `walk() has ${list.length} spans for a path of ${path.length} states.`,
          "Give one span per state, or one span for the first state to start from.",
        );
      const first = isList(at) ? undefined : spanOf(at, "walk() at");
      const lit: Span[] = [];

      const runs: {
        readonly route: Route;
        readonly when: Span;
      }[] = [];

      path.forEach((_, k) => {
        if (list) {
          lit.push(spanOf(list[k], `walk() at for state ${k + 1}`));

          if (k > 0) {
            const gap = lit[k]!.start - (lit[k - 1]!.start + lit[k - 1]!.over);

            const over = Math.max(
              0.05,
              Math.min(legs[k - 1]!.over, gap > 0 ? gap : lit[k]!.start - lit[k - 1]!.start) /
                (gap > 0 ? 1 : 2),
            );

            runs.push({ route: legs[k - 1]!.route, when: span(lit[k]!.start - over, over) });
          }

          return;
        }

        const start = k === 0 ? first!.start : runs[k - 1]!.when.start + runs[k - 1]!.when.over;
        lit.push(span(start, first!.over));

        if (k < legs.length)
          runs.push({ route: legs[k]!.route, when: span(start + first!.over, legs[k]!.over) });
      });

      if (list)
        for (let k = 1; k < lit.length; k++) {
          const prev = lit[k - 1]!;

          if (prev.start + prev.over > runs[k - 1]!.when.start)
            lit[k - 1] = span(prev.start, Math.max(0.05, runs[k - 1]!.when.start - prev.start));
        }

      const byState = new Map<string, Span[]>();
      path.forEach((s, k) => byState.set(s, [...(byState.get(s) ?? []), lit[k]!]));

      const highlights = [...byState].map(([s, spans]) => {
        const b = boxes.get(s)!;

        const opacity = spans.reduce((t, x) => {
          const edge = Math.min(0.15, x.over / 2);

          return t.to(1, span(x.start, edge)).to(0, span(x.start + x.over - edge, edge));
        }, track(0));

        const pad = 6;
        const radius = (nodes.get(s)!.inner ? 10 : 8) + pad;

        return (
          <Shape
            key={s}
            geometry={rect(b.w + 2 * pad, b.h + 2 * pad, { radius })}
            at={[b.x - pad, b.y - pad]}
            stroke={{ color: l.colors.highlight, width: 2 }}
            opacity={opacity}
          />
        );
      });

      const end = lit.at(-1)!.start + lit.at(-1)!.over;
      const whole = span(lit[0]!.start, end - lit[0]!.start);

      const token =
        runs.length > 0 &&
        (() => {
          const [from, to] = [
            runs[0]!.when.start,
            runs.at(-1)!.when.start + runs.at(-1)!.when.over,
          ];

          const where = (t: number): Vec => {
            const now = from + t;
            const run = runs.find((r) => now <= r.when.start + r.when.over + 1e-9) ?? runs.at(-1)!;
            const share = (now - run.when.start) / run.when.over;

            return run.route.at(Math.min(1, Math.max(0, share)));
          };

          const opacity = runs.reduce(
            (t, r) => t.set(1, r.when).set(0, span(r.when.start + r.when.over)),
            track(0),
          );

          return (
            <Shape
              key="token"
              geometry={circle(5)}
              anchor="center"
              at={sampled(where, span(from, to - from), { tolerance: 0.5 })}
              fill={l.colors.highlight}
              opacity={opacity}
            />
          );
        })();
      // SAFETY: ids are exactly the states of S, and each gets an entry, empty when the walk never lights it

      const spans = Object.fromEntries(ids.map((s) => [s, byState.get(s) ?? []])) as Record<
        Id,
        Span[]
      >;

      return {
        node: (
          <Group>
            {highlights}
            {token}
          </Group>
        ),
        span: whole,
        spans,
      };
    },
  };
}

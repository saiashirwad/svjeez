import {
  Group,
  Shape,
  Text,
  circle,
  line,
  rect,
  sampled,
  span,
  track,
  type SceneElement,
  type Span,
  type Vec,
} from "svjeez";
import { SceneError, type Child, type Color, type Spanned } from "svjeez/tools";
import { layered } from "./layout/layered.ts";
import type { Box, Point } from "./layout/box.ts";
import {
  Route,
  checkIds,
  drawChip,
  drawEdge,
  edgeKey,
  isBare,
  keyed,
  known,
  labelSize,
  look,
  mix,
  partsOf,
  spanOf,
  type Diagram,
  type DiagramOptions,
  type EdgeId,
} from "./kit.tsx";
import type { Direction, NodeRole, StateSpec, StateTransition } from "./types.ts";

type StateIds<S> = {
  [K in keyof S & string]: K | (S[K] extends { readonly states: infer I } ? StateIds<I> : never);
}[keyof S & string];

type Checked<S> = {
  readonly [K in keyof S]: S[K] extends { readonly states: infer I }
    ? S[K] & { readonly initial: keyof I & string; readonly states: Checked<I> }
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
  readonly span: Spanned;
  readonly spans: Readonly<Record<S, readonly Spanned[]>>;
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
}

const WHAT = "stateMachine()";
const START = "\u0000start";
const END = "\u0000end";
const DOT = 14;
const RING = 18;
const PAD = 16;

const isTransition = (line: Line): line is Line & { readonly of: number } =>
  typeof line.of === "number";

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

const centerOf = (b: Box): Vec => [b.x + b.w / 2, b.y + b.h / 2];

export function stateMachine<
  const S extends Record<string, StateSpec>,
  const T extends readonly StateTransition<NoInfer<StateIds<S>>>[],
>(
  spec: {
    readonly states: Checked<S>;
    readonly initial: NoInfer<keyof S & string>;
    readonly transitions: T;
  },
  options: StateMachineOptions,
): StateMachine<StateIds<S>, EdgeId<T[number]>> {
  type Id = StateIds<S>;

  const l = look(options, WHAT);
  const { direction = "TB" } = options;

  if (direction !== "TB" && direction !== "LR")
    throw new SceneError(`${WHAT} takes direction "TB" or "LR", got "${String(direction)}".`);
  const header = Math.round(l.size * 2.6);
  const nodes = new Map<string, Node>();

  const scope = (
    states: Readonly<Record<string, StateSpec>>,
    initial: string,
    depth: number,
    owner?: string,
  ): Scope => {
    checkIds(Object.keys(states), owner ? `${WHAT} state "${owner}"` : WHAT, "state");

    const list = Object.entries(states).map(([id, s]): Node => {
      if (nodes.has(id))
        throw new SceneError(
          `${WHAT} has two states named "${id}".`,
          "Give each state its own name, inner states too.",
        );

      const node: Node = isBare(s)
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

    known(
      initial,
      list.map((n) => n.id),
      WHAT,
      "state",
      owner ? `state "${owner}"'s initial` : "initial",
    );

    return { owner, depth, nodes: list, initial };
  };

  // SAFETY: Checked<S> only adds initial and states to S's composites, which StateSpec already admits
  const root = scope(spec.states as Readonly<Record<string, StateSpec>>, spec.initial, 0);
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

    return { owner: k === 0 ? undefined : a[k - 1], from: a[k]!, to: b[k]! };
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

  const lay = (s: Scope): Local => {
    const inner = new Map(s.nodes.flatMap((n) => (n.inner ? [[n.id, lay(n.inner)] as const] : [])));

    const size = (n: Node) => {
      const own = {
        w: l.measure(n.label, l.size, l.weight) + l.size * 2.4,
        h: Math.round(l.size * 2.8),
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
          label: t.label === undefined ? undefined : labelSize(l, t.label),
        })),
        ...finals.map((n) => ({ from: n.id, to: END })),
      ],
    });

    const [dx, dy] = [-out.bounds.x, -out.bounds.y];
    const boxes = new Map([...out.nodes].map(([id, b]) => [id, shift(b, dx, dy)]));

    const lines = out.edges.map((e, k): Line => ({
      from: e.from,
      to: e.to,
      points: e.points.map((p) => ({ x: p.x + dx, y: p.y + dy })),
      depth: s.depth,
      of: k === 0 ? "start" : k > mine.length ? "end" : mine[k - 1]!.i,
      ...(k > 0 && k <= mine.length && e.label && { label: shift(e.label, dx, dy) }),
    }));

    const dots = [boxes.get(START)!];
    const ends = finals.length > 0 ? [boxes.get(END)!] : [];

    for (const [id, local] of inner) {
      const b = boxes.get(id)!;
      const [ix, iy] = [b.x + (b.w - local.w) / 2, b.y + header + PAD];

      for (const [k, v] of local.boxes) boxes.set(k, shift(v, ix, iy));
      lines.push(...local.lines.map((x) => moved(x, ix, iy)));
      dots.push(...local.dots.map((d) => shift(d, ix, iy)));
      ends.push(...local.ends.map((d) => shift(d, ix, iy)));
    }

    return { w: out.bounds.w, h: out.bounds.h, boxes, lines, dots, ends };
  };

  const local = lay(root);
  const boxes = new Map(ids.map((id) => [id, local.boxes.get(id)!]));

  const ground = (depth: number): Color =>
    depth === 0 ? l.colors.background : mix(l.colors.line, l.colors.background, 0.08 * depth);

  const transitionKeys = keyed(transitions.map((t) => edgeKey(t.source, t.target)));

  const parts = new Map<string, Spanned | undefined>([
    ...ids.map((id) => [id, undefined] as const),
    ...transitionKeys.map((key) => [key, undefined] as const),
  ]);

  const handle = partsOf<Id | EdgeId<T[number]>>(WHAT, options.name ?? "state", parts);

  const drawState = (n: Node): SceneElement => {
    const b = boxes.get(n.id)!;
    const tint = n.role && l.tint(n.role);
    const radius = n.inner ? 10 : 8;

    return (
      <Group key={n.id} at={[b.x, b.y]}>
        <Shape
          key="shape"
          geometry={rect(b.w, b.h, { radius })}
          fill={
            n.role
              ? mix(l.tint(n.role), ground(n.depth + 1), n.inner ? 0.1 : 0.22)
              : ground(n.depth + 1)
          }
          stroke={{ color: tint ?? l.colors.line, width: tint ? 1.5 : 1 }}
        />
        {n.inner && (
          <Shape
            key="rule"
            geometry={line([0, header], [b.w, header])}
            stroke={{ color: tint ?? l.colors.line, width: 1 }}
          />
        )}
        <Text
          key="label"
          font={l.font}
          size={l.size}
          weight={l.weight}
          fill={l.colors.text}
          anchor="center"
          at={[b.w / 2, n.inner ? header / 2 : b.h / 2]}
        >
          {n.label}
        </Text>
      </Group>
    );
  };

  const draw = (between?: Child): SceneElement => (
    <Group ref={handle.ref}>
      {[...nodes.values()].sort((a, b) => a.depth - b.depth).map(drawState)}
      {local.lines.map((x) =>
        drawEdge(l, {
          key: isTransition(x)
            ? transitionKeys[x.of]!
            : x.of === "start"
              ? `start->${x.to}`
              : `${x.from}->end`,
          points: x.points,
        }),
      )}
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
        <Group key={`final-${k + 1}`} at={centerOf(d)}>
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
          x.label &&
          drawChip(l, {
            key: `${transitionKeys[x.of]!}:label`,
            box: x.label,
            text: transitions[x.of]!.label!,
            fill: l.colors.text,
            ground: ground(x.depth),
          }),
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

    if (target.parent === a && nodes.get(a)!.inner!.initial === b)
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
      const lit: Spanned[] = [];
      const runs: { readonly route: Route; readonly when: Span }[] = [];

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

      const byState = new Map<string, Spanned[]>();
      path.forEach((s, k) => byState.set(s, [...(byState.get(s) ?? []), lit[k]!]));

      const highlights = [...byState].map(([s, spans]) => {
        const b = boxes.get(s)!;

        const opacity = spans.reduce((t, x) => {
          const edge = Math.min(0.15, x.over / 2);

          return t.to(1, span(x.start, edge)).to(0, span(x.start + x.over - edge, edge));
        }, track(0));

        return (
          <Shape
            key={s}
            geometry={rect(b.w + 8, b.h + 8, { radius: nodes.get(s)!.inner ? 13 : 11 })}
            at={[b.x - 4, b.y - 4]}
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
            (t, r) => t.set(1, r.when.start).set(0, r.when.start + r.when.over),
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
        Spanned[]
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

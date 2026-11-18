import { named, whereOf } from "./names";
import { num } from "../model/format";
import { EPSILON, type Seconds } from "../model/time";
import { checkWindow, isWhen, span, type Span, type Spanned, type When } from "./span";
import type { Animated, Box, Source, Vec } from "../model/ir";
import { caller } from "../svg/traced";
import { sourceFrom } from "./identity";
import { SceneError, located } from "../model/scene-error";
import type { SceneElement } from "./nodes";
import { Anchor, placeIn, type Place, type Ref } from "./refs";
import { blendVec, valueAt } from "../model/sample";
import { outward, type Aim, type Notes } from "./settle";
import { ease, isSpring, type Curve } from "./spring";
import { laneOf, mapped, mixVec, type Timing } from "../model/steps";
import { isDerived, type Derived } from "./derived";
import { isTrack, passageOf, track, type Track } from "./track";
import type { Geometry, Paint } from "./values";

export interface StrokeMoves {
  readonly color?: Paint;
  readonly width?: number;
}

export interface Moves {
  readonly at?: Vec | Anchor;
  readonly rotate?: number;
  readonly scale?: number | Vec;
  readonly opacity?: number;
  readonly fill?: Paint;
  readonly stroke?: StrokeMoves;
  readonly trim?: Vec;
  readonly geometry?: Geometry;
}

type Prop = Exclude<keyof Moves, "stroke"> | "stroke" | "strokeWidth";

const NAMES: readonly (keyof Moves)[] = [
  "at",
  "rotate",
  "scale",
  "opacity",
  "fill",
  "stroke",
  "trim",
  "geometry",
];

type Value = Vec | number | Paint | Geometry;

const isName = (name: string): name is keyof Moves => NAMES.some((known) => known === name);

export type Point = Place | Vec;

/** Which keyed parts a verb on this node moves, per prop: { trim: "line", stroke: ["line", "head"] }. */
export type Forward = { readonly [K in keyof Moves]?: string | readonly string[] };

const propsOf = (name: keyof Moves): readonly Prop[] =>
  name === "stroke" ? ["stroke", "strokeWidth"] : [name];

const routesOf = (forward: Forward, where: string): ReadonlyMap<Prop, readonly string[]> => {
  const routes = new Map<Prop, readonly string[]>();

  for (const [name, parts] of Object.entries(forward)) {
    if (!isName(name))
      throw new SceneError(
        `${where} forwards "${name}", which no verb moves. It forwards ${NAMES.join(", ")}.`,
      );
    const paths = [parts ?? []].flat();

    if (paths.length === 0 || paths.some((path) => path.split("/").includes("")))
      throw new SceneError(
        `${where} forwards ${name} to ${JSON.stringify(parts)}. Name the parts by key, joined by "/" for a deeper one, as in forward={{ ${name}: "line" }}.`,
      );

    for (const prop of propsOf(name)) routes.set(prop, paths);
  }

  return routes;
};

export interface MoveOptions {
  readonly point?: Point;
}

type Goal =
  | { readonly kind: "value"; readonly value: Value }
  | { readonly kind: "anchor"; readonly anchor: Anchor; readonly point: Point };

export interface Move {
  readonly target: Ref;
  readonly prop: Prop;
  readonly start: Seconds;
  readonly over: Seconds;
  readonly curve: Curve;
  readonly goal: Goal;
  readonly verb: string;
  readonly source?: Source;
}

const flatValues = (values: Moves, verb: string): (readonly [Prop, Value | Anchor])[] => {
  const unknown = Object.keys(values).find((name) => !isName(name));

  if (unknown !== undefined)
    throw new SceneError(`${verb} can't move "${unknown}". It moves ${NAMES.join(", ")}.`);

  return Object.keys(values)
    .filter(isName)
    .flatMap((name): (readonly [Prop, Value | Anchor])[] => {
      if (name !== "stroke") {
        const value = values[name];

        return value === undefined ? [] : [[name, value]];
      }

      const { stroke } = values;

      if (stroke === undefined) return [];

      if (!isStrokeMoves(stroke))
        throw new SceneError(
          `${verb} takes stroke as the prop does, an object: { stroke: { color: …, width: … } }.`,
        );

      return [
        ...(stroke.color === undefined ? [] : [["stroke", stroke.color] as const]),
        ...(stroke.width === undefined ? [] : [["strokeWidth", stroke.width] as const]),
      ];
    });
};

const isStrokeMoves = (stroke: StrokeMoves | Paint): stroke is StrokeMoves =>
  typeof stroke === "object" && !Array.isArray(stroke) && !("kind" in stroke);

const isPoint = (to: Vec | Anchor | Ref): to is Vec => Array.isArray(to);

let open: Move[] | undefined;

const timed = (when: When | undefined, verb: string, cut: boolean): Span => {
  if (!isWhen(when))
    throw new SceneError(
      cut
        ? `${verb} takes when the cut happens as a span, got ${String(when)}. Write ${verb.slice(0, -1)}…, span(at)).`
        : `${verb} takes a span, got ${String(when)}. Write ${verb.slice(0, -1)}…, span(start, over)); a step right after another is before.next(over).`,
    );

  if (cut) {
    checkWindow(when.start, 1, verb);

    return { start: when.start, over: 0 };
  }

  if (when.over === undefined || !(when.over > 0))
    throw new SceneError(
      `${verb} needs a span with a positive length, got ${when.over === undefined ? "an open span" : `${when.over}s`}. Use set() for a cut.`,
    );
  checkWindow(when.start, when.over, verb);

  return { start: when.start, over: when.over };
};

const record = (
  target: Ref,
  name: string,
  moves: readonly Omit<Move, "target" | "verb" | "source">[],
  when: Span,
): Spanned => {
  const verb = `${target.label}.${name}()`;

  if (!open)
    throw new SceneError(
      `${verb} is only known while scene()'s callback runs. Call it there, or in a component the scene renders.`,
    );
  const at = caller();
  const source = at && sourceFrom(at);

  for (const move of moves) open.push({ ...move, target, verb, ...(source && { source }) });

  return span(when.start, when.over);
};

const values = (target: Ref, name: string, given: Moves, when: Span, curve: Curve): Spanned =>
  record(
    target,
    name,
    flatValues(given, `${target.label}.${name}()`).map(([prop, value]) => ({
      prop,
      start: when.start,
      over: when.over,
      curve,
      goal:
        value instanceof Anchor
          ? { kind: "anchor", anchor: value, point: [0, 0] }
          : { kind: "value", value },
    })),
    when,
  );

export const verbs = {
  to: (target: Ref, given: Moves, when: Span, curve: Curve = ease.out): Spanned =>
    values(target, "to", given, timed(when, `${target.label}.to()`, false), curve),
  set: (target: Ref, given: Moves, when: When): Spanned =>
    values(target, "set", given, timed(when, `${target.label}.set()`, true), ease.hold),
  move: (
    target: Ref,
    to: Vec | Anchor | Ref,
    when: Span,
    curve: Curve = ease.out,
    options: MoveOptions = {},
  ): Spanned => {
    const verb = `${target.label}.move()`;
    const at = timed(when, verb, false);

    if (isPoint(to)) {
      if (options.point !== undefined)
        throw new SceneError(
          `${verb} lands a point of the node on an anchor, such as card.left, but ${JSON.stringify(to)} is a point in the parent. Move the node's at there without a point, or give an anchor.`,
        );

      return values(target, "move", { at: to }, at, curve);
    }

    const anchor = to instanceof Anchor ? to : to.center;
    const goal: Goal = { kind: "anchor", anchor, point: options.point ?? [0, 0] };

    return record(
      target,
      "move",
      [{ prop: "at", start: at.start, over: at.over, curve, goal }],
      at,
    );
  },
};

export type NodeElement = Exclude<
  SceneElement,
  { readonly type: "fragment" | "sequence" | "morph" | "run" }
>;

const FOR_ALL: readonly NodeElement["type"][] = ["group", "shape", "text", "image", "instance"];

const KINDS: Readonly<Record<Prop, readonly NodeElement["type"][]>> = {
  at: FOR_ALL,
  rotate: FOR_ALL,
  scale: FOR_ALL,
  opacity: FOR_ALL,
  fill: ["shape", "text", "group"],
  stroke: ["shape", "group"],
  strokeWidth: ["shape"],
  trim: ["shape"],
  geometry: ["shape"],
};

const UNWRITTEN: Readonly<Partial<Record<Prop, Value>>> = {
  rotate: 0,
  scale: 1,
  opacity: 1,
  trim: [0, 1],
  strokeWidth: 1,
};

type Written = Value | Anchor | Track<Value> | Derived<Value> | undefined;

type Start = Value | Track<Value>;

const writtenOf = (el: NodeElement, prop: Prop): Written => {
  switch (prop) {
    case "at":
      return framed(el) ? el.props.offset : el.props.at;
    case "rotate":
    case "scale":
    case "opacity":
      return el.props[prop];
    case "fill":
      return el.type === "shape" || el.type === "text" || el.type === "group"
        ? el.props.fill
        : undefined;
    case "stroke":
      return el.type === "shape" || el.type === "group" ? el.props.stroke?.color : undefined;
    case "strokeWidth":
      return el.type === "shape" ? el.props.stroke?.width : undefined;
    case "trim":
    case "geometry":
      return el.type === "shape" ? el.props[prop] : undefined;
  }
};

const framed = (el: NodeElement): el is NodeElement & { readonly type: "group" | "instance" } =>
  (el.type === "group" || el.type === "instance") && el.props.offset !== undefined;

const end = (move: Move): Seconds => move.start + move.over;

const names = (target: Ref, el: NodeElement, key: string, refs: Notes["refs"]): boolean => {
  if (!target.within) return el.props.ref === target;
  const owner = refs.get(target.within.ref);

  return owner !== undefined && key === `${owner}/${target.within.path.join("/")}`;
};

const written = (
  initial: Start,
  moves: readonly Move[],
  goal: (move: Move, before: Value) => Value,
): Track<Value> => {
  let out = isTrack(initial) ? initial : track<Value>(initial);
  let before = isTrack(initial) ? passageOf(initial).data.initial.value! : initial;

  for (const move of moves) {
    const value = goal(move, before);

    out =
      move.over === 0
        ? out.set(value, span(move.start))
        : out.to(value, span(move.start, move.over), move.curve);
    before = value;
  }

  return out;
};

const isVec = (value: Value): value is Vec =>
  Array.isArray(value) && value.length === 2 && value.every(Number.isFinite);

const isPlace = (point: Point): point is Place => typeof point === "string";

const pointIn = (point: Point, box: Box, home: Vec, verb: string): Vec =>
  isPlace(point) ? placeIn(box, point, [0, 0], verb) : [home[0] + point[0], home[1] + point[1]];

export class Cues {
  readonly #moves: readonly Move[];
  readonly #met = new Set<Move>();
  readonly #forwarded = new Map<string, Move[]>();
  readonly #routed = new Map<string, { readonly from: string; readonly path: string }>();
  readonly #reached = new Set<string>();
  readonly applied: { verb: string; key: string; start: Seconds; over: Seconds }[] = [];
  get refs(): readonly Ref[] {
    return this.#moves.map((item) => item.target.within?.ref ?? item.target);
  }

  constructor(moves: readonly Move[]) {
    this.#moves = moves;
  }

  apply(el: NodeElement, key: string, timing: Timing, notes: Notes, parent: string): NodeElement {
    const owned = this.#moves.filter((item) => names(item.target, el, key, notes.refs));
    let mine = [...owned, ...(this.#forwarded.get(key) ?? [])];

    this.#reached.add(key);

    if (el.type === "group" && el.props.forward) {
      const routes = routesOf(el.props.forward, named(key));

      for (const item of mine) {
        const paths = routes.get(item.prop);

        if (!paths) continue;

        for (const path of paths) {
          const part = `${key}/${path}`;

          this.#forwarded.set(part, [...(this.#forwarded.get(part) ?? []), item]);
          this.#routed.set(part, { from: key, path });
        }

        this.#met.add(item);
      }

      mine = mine.filter((item) => !routes.has(item.prop));
    }

    if (mine.length === 0) return el;

    for (const item of mine) {
      this.#met.add(item);
      this.applied.push({
        verb: item.verb,
        key,
        start: timing.clock.offset + item.start,
        over: item.over,
      });
    }

    const byProp = new Map<Prop, Move[]>();

    for (const item of mine) byProp.set(item.prop, [...(byProp.get(item.prop) ?? []), item]);

    const tracks = new Map<Prop, Track<Value>>();

    for (const [prop, list] of byProp) {
      const moves = [...list].sort((a, b) => a.start - b.start || a.over - b.over);
      const initial = this.#initial(el, prop, moves[0]!, key, notes, parent);

      conflicts(moves, prop, key, timing.clock.offset);

      if (initial !== undefined && isTrack(initial))
        takesTurns(moves, initial, prop, key, timing.clock.offset);
      const onAnchor = moves.some((move) => move.goal.kind === "anchor");

      if (prop === "at" && onAnchor) notes.onAnchor.add(key);
      else if (prop === "at") notes.onAnchor.delete(key);

      if (prop === "at" && (onAnchor || initial === undefined)) {
        notes.aims.set(key, (read, self) => {
          try {
            return aimed(read, self);
          } catch (error) {
            throw error instanceof Error ? located(error, whereOf(key)) : error;
          }
        });

        const aimed: Aim = (read, self) => {
          const seen = new Map<Anchor, Animated<Vec>>();

          const land = (move: Move): Value => {
            const { goal } = move;

            if (goal.kind === "value") return goal.value;

            const t = timing.clock.offset + end(move);
            const lane = seen.get(goal.anchor) ?? read(goal.anchor);

            seen.set(goal.anchor, lane);
            const [x, y] = valueAt(lane, t, blendVec);
            const node = self();

            const [dx, dy] = outward(
              pointIn(goal.point, node.box, node.home, move.verb),
              [0, 0],
              node.origin,
              node.layers,
              t,
            );

            return [x - dx + node.home[0], y - dy + node.home[1]];
          };

          const { data } = passageOf(written(initial ?? self().home, moves, land));

          const lane = mapped(data, "value", (value): Vec => {
            if (!isVec(value))
              throw new SceneError(`at on ${named(key)} needs a point, got ${String(value)}.`);

            return value;
          });

          return laneOf(lane, lane.initial.value!, timing, mixVec, `at on ${named(key)}`, true);
        };

        continue;
      }

      tracks.set(
        prop,
        written(initial!, moves, (move, before) =>
          move.goal.kind === "value" ? move.goal.value : before,
        ),
      );
    }

    return withTracks(el, tracks);
  }

  #initial(
    el: NodeElement,
    prop: Prop,
    first: Move,
    key: string,
    notes: Notes,
    parent: string,
  ): Start | undefined {
    const { verb } = first;

    const painted = prop === "fill" || prop === "stroke";

    if (!KINDS[prop].includes(el.type) || (el.type === "group" && painted && !el.paints))
      throw new SceneError(
        `${verb} moves ${prop} on ${named(key)}, which has none. Only ${KINDS[prop].map((kind) => (kind === "group" && painted ? "container" : kind)).join(" or ")} nodes have ${prop}.`,
      );
    const value = writtenOf(el, prop);

    if (isDerived(value))
      throw new SceneError(
        `${verb} moves ${prop} on ${named(key)}, which follows other tracks through map() or with(). A verb can't add to a value worked out from others: move what it follows, or give the prop a track of its own.`,
      );

    if (isTrack(value)) {
      const { data } = passageOf(value);

      if (data.period !== undefined)
        throw new SceneError(
          `${verb} moves ${prop} on ${named(key)}, whose track loops forever, so there is no time left for a verb.`,
          `End the loop with repeat({ until }), or put the loop in a motion layer, which adds on top of the prop.`,
        );

      if (data.rewind)
        throw new SceneError(
          `${verb} moves ${prop} on ${named(key)}, whose track rewinds at the end of the clock.`,
          `Drop rewind() and end with a step back to the start, so the verb can take its turn.`,
        );
    }

    if (value instanceof Anchor)
      throw new SceneError(
        `${verb} moves ${named(key)}, which is placed at ${value.label}. Place it at a point and move() it to the anchor instead.`,
      );
    const container = notes.nodes.get(parent)?.settle;

    if (prop === "at" && container?.kind === "arrange")
      throw new SceneError(
        `${verb} moves ${named(key)}, but the ${container.label} it sits in places it. Wrap it in a <Group> for the container to place, and move the node inside.`,
      );

    if (prop === "at") return value;
    const start: Start | undefined = value ?? UNWRITTEN[prop];

    if (start === undefined)
      throw new SceneError(
        prop === "fill"
          ? `${verb} changes the fill of ${named(key)}, which has none to start from. Give it fill={…}.`
          : `${verb} changes the stroke of ${named(key)}, which has none. Give it stroke={{ color: … }}.`,
      );

    if (
      (prop === "stroke" || prop === "strokeWidth") &&
      (el.type === "shape" || el.type === "group") &&
      !el.props.stroke
    )
      throw new SceneError(
        `${verb} changes the stroke of ${named(key)}, which has none. Give it stroke={{ color: … }}.`,
      );

    return start;
  }

  finish(): void {
    for (const [part, { from, path }] of this.#routed)
      if (!this.#reached.has(part))
        throw new SceneError(
          `${named(from)} forwards a verb to its part "${path}", but no node inside it is keyed "${path}".`,
          "Key the part, or fix the path in forward={…}.",
          whereOf(from),
        );

    for (const item of this.#moves) {
      if (this.#met.has(item)) continue;
      const { target } = item;

      throw target.within
        ? new SceneError(
            `${item.verb} names ${target.label}, but no node is keyed "${target.within.path.join("/")}" inside the node ref={${target.within.ref.key}} is on.`,
            undefined,
            item.source && { source: item.source },
          )
        : new SceneError(
            `${item.verb} moves the ref "${target.key}", which is on no node.`,
            "Give one node ref={…} with it.",
            item.source && { source: item.source },
          );
    }
  }
}

const when = (move: Move, offset: Seconds): string =>
  move.over === 0
    ? `at ${num(offset + move.start)}s`
    : `from ${num(offset + move.start)}s to ${num(offset + end(move))}s`;

const collision = (a: Move, b: Move, prop: Prop, key: string, offset: Seconds): SceneError => {
  const [cut, running] = a.over === 0 ? [a, b] : b.over === 0 ? [b, a] : [undefined, undefined];
  const source = b.source ?? a.source;
  const where = { ...whereOf(key), ...(source && { source }) };

  if (cut && running)
    return new SceneError(
      `${cut.verb} sets ${prop} on ${named(key)} ${when(cut, offset)}, while ${running.verb} is still moving it ${when(running, offset)}.`,
      `Set it once ${running.verb} ends, at ${num(offset + end(running))}s or later, or end ${running.verb} by ${num(offset + cut.start)}s.`,
      where,
    );

  const [first, second] = a.start <= b.start ? [a, b] : [b, a];

  return new SceneError(
    `${first.verb} moves ${prop} on ${named(key)} ${when(first, offset)}, and ${second.verb} moves it too ${when(second, offset)}, before the first one ends.`,
    `Start ${second.verb} at ${num(offset + end(first))}s or later (the first one's span.next(over) starts where it ends), or move both props in one to().`,
    where,
  );
};

const conflicts = (moves: readonly Move[], prop: Prop, key: string, offset: Seconds): void => {
  moves.forEach((a, i) => {
    for (const b of moves.slice(i + 1)) {
      const overlap = a.start < end(b) - EPSILON && b.start < end(a) - EPSILON;
      const cut = isSpring(a.curve) && a.start < b.start - EPSILON;

      if (overlap && !cut) throw collision(a, b, prop, key, offset);
    }
  });
};

const takesTurns = (
  moves: readonly Move[],
  written: Track<Value>,
  prop: Prop,
  key: string,
  offset: Seconds,
): void => {
  for (const step of passageOf(written).data.steps) {
    const stop = Math.min(step.start + step.over, step.until ?? Infinity);

    for (const move of moves) {
      const overlap =
        step.over === 0 && move.over === 0
          ? Math.abs(step.start - move.start) <= EPSILON
          : move.start < stop - EPSILON && step.start < end(move) - EPSILON;

      const cut =
        (isSpring(step.ease) && step.start < move.start - EPSILON) ||
        (isSpring(move.curve) && move.start < step.start - EPSILON);

      if (!overlap || cut) continue;

      const theirs =
        step.over === 0
          ? `at ${num(offset + step.start)}s`
          : `from ${num(offset + step.start)}s to ${num(offset + stop)}s`;

      throw new SceneError(
        `${move.verb} moves ${prop} on ${named(key)} ${when(move, offset)}, while the track written on it moves it ${theirs}.`,
        `A verb and a track take turns on one prop: start ${move.verb} at ${num(offset + stop)}s or later, or end it by ${num(offset + step.start)}s.`,
        { ...whereOf(key), ...(move.source && { source: move.source }) },
      );
    }
  }
};

const withTracks = (el: NodeElement, tracks: ReadonlyMap<Prop, Track<Value>>): NodeElement => {
  if (tracks.size === 0) return el;

  const own = Object.fromEntries(
    [...tracks].flatMap(([prop, value]) =>
      prop === "stroke" || prop === "strokeWidth"
        ? []
        : [[prop === "at" && framed(el) ? "offset" : prop, value] as const],
    ),
  );

  const color = tracks.get("stroke");
  const width = tracks.get("strokeWidth");

  const stroke =
    (el.type === "shape" || el.type === "group") && el.props.stroke && (color || width)
      ? { stroke: { ...el.props.stroke, ...(color && { color }), ...(width && { width }) } }
      : undefined;

  // SAFETY: each track starts from the value the node wrote for its prop and goes to values of that prop's type.
  return { ...el, props: { ...el.props, ...own, ...stroke } } as NodeElement;
};

export const collect = (build: () => SceneElement): readonly [SceneElement, Cues] => {
  const outer = open;
  const made: Move[] = [];

  open = made;

  try {
    return [build(), new Cues(made)];
  } finally {
    open = outer;
  }
};

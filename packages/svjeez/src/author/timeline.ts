import { named, whereOf } from "./names";
import { num } from "../model/format";
import { EPSILON, type Seconds } from "../model/time";
import { span, type Span, type Spanned } from "./span";
import type { Animated, Box, Source, Vec } from "../model/ir";
import { caller } from "../svg/traced";
import { sourceFrom } from "./identity";
import { SceneError, located } from "../model/scene-error";
import type { SceneElement } from "./nodes";
import { Anchor, placeIn, type Place, type Ref } from "./refs";
import { blendVec, valueAt } from "../model/sample";
import { outward, type Aim, type Notes } from "./settle";
import { Spring, ease, isSpring, type Curve } from "./spring";
import { laneOf, mapped, mixVec, type Clock, type Timing } from "../model/steps";
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

export interface MoveOptions {
  readonly point?: Point;
}

type Goal =
  | { readonly kind: "value"; readonly value: Value }
  | { readonly kind: "by"; readonly by: Vec }
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

export interface Rewind {
  readonly target: Ref;
  readonly over: Seconds;
  readonly curve: Curve;
  readonly verb: string;
  readonly source?: Source;
}

export class Action {
  readonly length: Seconds;
  readonly moves: readonly Move[];
  readonly rewinds: readonly Rewind[];
  readonly labels: ReadonlyMap<string, Span>;

  constructor(
    length: Seconds,
    moves: readonly Move[] = [],
    rewinds: readonly Rewind[] = [],
    labels: ReadonlyMap<string, Span> = new Map(),
  ) {
    this.length = length;
    this.moves = moves;
    this.rewinds = rewinds;
    this.labels = labels;
  }

  as(name: string): Action {
    if (name === "") throw new SceneError("as() needs a name.");

    if (this.labels.has(name))
      throw new SceneError(
        `Two spans in one action are both named "${name}". Give one another name.`,
      );

    return new Action(
      this.length,
      this.moves,
      this.rewinds,
      new Map([...this.labels, [name, { start: 0, over: this.length }]]),
    );
  }
}

const isAction = (value: Action | Seconds | undefined): value is Action => value instanceof Action;

const actions = (list: readonly Action[], what: string): readonly Action[] => {
  list.forEach((action, i) => {
    if (!isAction(action))
      throw new SceneError(
        `${what} takes actions, such as win.move([10, 20], 1) or wait(0.5), but argument ${i + 1} is not one.`,
      );
  });

  return list;
};

const together = (placed: readonly (readonly [Action, Seconds])[], length?: Seconds): Action => {
  const labels = new Map<string, Span>();

  for (const [action, at] of placed)
    for (const [name, { start, over }] of action.labels) {
      if (labels.has(name))
        throw new SceneError(
          `Two spans in one timeline are both named "${name}". Give one another name.`,
        );
      labels.set(name, { start: at + start, over });
    }

  return new Action(
    length ?? Math.max(0, ...placed.map(([action, at]) => at + action.length)),
    placed.flatMap(([action, at]) =>
      action.moves.map((move) => ({ ...move, start: at + move.start })),
    ),
    placed.flatMap(([action]) => action.rewinds),
    labels,
  );
};

export const seq = (...list: readonly Action[]): Action => {
  let at = 0;

  return together(
    actions(list, "seq()").map((action): readonly [Action, Seconds] => {
      const start = at;

      at += action.length;

      return [action, start];
    }),
    at,
  );
};

export const par = (...list: readonly Action[]): Action =>
  together(actions(list, "par()").map((action) => [action, 0]));

export const wait = (seconds: Seconds): Action => {
  if (!(seconds >= 0 && Number.isFinite(seconds)))
    throw new SceneError(`wait() needs a finite number of seconds of 0 or more, got ${seconds}.`);

  return new Action(seconds);
};

export const stagger = (step: Seconds, ...list: readonly Action[]): Action => {
  if (!Number.isFinite(step))
    throw new SceneError(
      "stagger() takes a step in seconds and then actions, such as stagger(0.1, a.show(0.3), b.show(0.3)). For spans a step apart, write span(…).cascade(count, step).",
    );

  return together(actions(list, "stagger()").map((action, i) => [action, i * step]));
};

const length = (over: Seconds, verb: string): Seconds => {
  if (!(over > 0 && Number.isFinite(over)))
    throw new SceneError(
      `${verb} needs a positive number of seconds, got ${over}. Use set() for a cut.`,
    );

  return over;
};

const DEFAULT_CURVE: Curve = ease.out;

export type Over = Seconds | Spring;

const timed = (over: Over, curve: Curve | undefined, verb: string): readonly [Seconds, Curve] => {
  if (!(over instanceof Spring)) return [length(over, verb), curve ?? DEFAULT_CURVE];

  if (curve !== undefined)
    throw new SceneError(
      `${verb} is given a spring for its length and a curve as well.`,
      `A spring sets its own length: pass it once, as in ${verb.slice(0, -1)}…, spring).`,
    );

  return [over.settle, over];
};

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

const one = (target: Ref, verb: string, values: Moves, over: Seconds, curve: Curve): Action =>
  new Action(
    over,
    flatValues(values, verb).map(([prop, value]): Move => {
      const goal: Goal =
        value instanceof Anchor
          ? { kind: "anchor", anchor: value, point: [0, 0] }
          : { kind: "value", value };

      return { target, prop, start: 0, over, curve, goal, verb };
    }),
  );

const label = (target: Ref, name: string): string => `${target.label}.${name}()`;

const isPoint = (to: Vec | Anchor | Ref): to is Vec => Array.isArray(to);

const isStrokeMoves = (stroke: StrokeMoves | Paint): stroke is StrokeMoves =>
  typeof stroke === "object" && !Array.isArray(stroke) && !("kind" in stroke);

const site = (): Source | undefined => {
  const at = caller();

  return at && sourceFrom(at);
};

const stamped = <V extends Record<string, (...args: never[]) => Action>>(all: V): V => {
  const out: Record<string, (...args: never[]) => Action> = {};

  for (const [name, verb] of Object.entries(all))
    out[name] = (...args) => {
      const action = verb(...args);
      const source = site();

      return source
        ? new Action(
            action.length,
            action.moves.map((move) => ({ ...move, source })),
            action.rewinds.map((rewind) => ({ ...rewind, source })),
            action.labels,
          )
        : action;
    };

  // SAFETY: out holds every verb of all under its own name, each taking and returning what it did.
  return out as V;
};

export const verbs = stamped({
  to: (target: Ref, values: Moves, over: Over, curve?: Curve): Action => {
    const verb = label(target, "to");

    return one(target, verb, values, ...timed(over, curve, verb));
  },
  set: (target: Ref, values: Moves): Action =>
    one(target, label(target, "set"), values, 0, ease.hold),
  move: (
    target: Ref,
    to: Vec | Anchor | Ref,
    over: Over,
    curve?: Curve,
    options: MoveOptions = {},
  ): Action => {
    const verb = label(target, "move");
    const [seconds, shape] = timed(over, curve, verb);

    if (isPoint(to)) {
      if (options.point !== undefined)
        throw new SceneError(
          `${verb} lands a point of the node on an anchor, such as card.left, but ${JSON.stringify(to)} is a point in the parent. Move the node's at there without a point, or give an anchor.`,
        );

      return one(target, verb, { at: to }, seconds, shape);
    }

    const anchor = to instanceof Anchor ? to : to.center;
    const goal: Goal = { kind: "anchor", anchor, point: options.point ?? [0, 0] };

    return new Action(seconds, [
      { target, prop: "at", start: 0, over: seconds, curve: shape, goal, verb },
    ]);
  },
  moveBy: (target: Ref, by: Vec, over: Over, curve?: Curve): Action => {
    const verb = label(target, "moveBy");
    const [seconds, shape] = timed(over, curve, verb);

    return new Action(seconds, [
      { target, prop: "at", start: 0, over: seconds, curve: shape, goal: { kind: "by", by }, verb },
    ]);
  },
  rotate: (target: Ref, to: number, over: Over, curve?: Curve): Action => {
    const verb = label(target, "rotate");

    return one(target, verb, { rotate: to }, ...timed(over, curve, verb));
  },
  scale: (target: Ref, to: number | Vec, over: Over, curve?: Curve): Action => {
    const verb = label(target, "scale");

    return one(target, verb, { scale: to }, ...timed(over, curve, verb));
  },
  show: (target: Ref, over: Over, curve?: Curve): Action => {
    const verb = label(target, "show");

    return one(target, verb, { opacity: 1 }, ...timed(over, curve, verb));
  },
  hide: (target: Ref, over: Over, curve?: Curve): Action => {
    const verb = label(target, "hide");

    return one(target, verb, { opacity: 0 }, ...timed(over, curve, verb));
  },
  fill: (target: Ref, to: Paint, over: Over, curve?: Curve): Action => {
    const verb = label(target, "fill");

    return one(target, verb, { fill: to }, ...timed(over, curve, verb));
  },
  stroke: (target: Ref, to: StrokeMoves, over: Over, curve?: Curve): Action => {
    const verb = label(target, "stroke");

    return one(target, verb, { stroke: to }, ...timed(over, curve, verb));
  },
  draw: (target: Ref, over: Over, curve?: Curve): Action => {
    const verb = label(target, "draw");
    const [seconds, shape] = timed(over, curve, verb);

    return new Action(seconds, [
      ...one(target, verb, { trim: [0, 0] }, 0, ease.hold).moves,
      ...one(target, verb, { trim: [0, 1] }, seconds, shape).moves,
    ]);
  },
  rewind: (target: Ref, over: Seconds, curve: Curve = DEFAULT_CURVE): Action => {
    const verb = label(target, "rewind");

    return new Action(0, [], [{ target, over: length(over, verb), curve, verb }]);
  },
});

export class Timeline {
  readonly action: Action;

  constructor(action: Action) {
    this.action = action;
  }

  get end(): Seconds {
    return this.action.length;
  }

  span(name: string): Spanned {
    const found = this.action.labels.get(name);

    if (!found) {
      const known = [...this.action.labels.keys()];

      throw new SceneError(
        `The timeline has no span named "${name}". ${known.length > 0 ? `It has ${known.map((n) => `"${n}"`).join(", ")}.` : "Name one with action.as(name)."}`,
      );
    }

    return span(found.start, found.over);
  }
}

let open: Timeline[] | undefined;

export const timeline = (...list: readonly Action[]): Timeline => {
  if (!open)
    throw new SceneError(
      "timeline() is only known while scene()'s callback runs. Call it there, or in a component the scene renders.",
    );
  const made = new Timeline(seq(...actions(list, "timeline()")));

  open.push(made);

  return made;
};

export type NodeElement = Exclude<
  SceneElement,
  { readonly type: "fragment" | "sequence" | "morph" | "run" }
>;

const FOR_ALL: readonly NodeElement["type"][] = ["group", "shape", "text", "image", "instance"];

const DRAWN: ReadonlySet<Prop> = new Set(["trim", "stroke", "strokeWidth"]);

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

const writtenOf = (el: NodeElement, prop: Prop): Written => {
  switch (prop) {
    case "at":
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

const end = (move: Move): Seconds => move.start + move.over;

const clockName = (clock: Clock): string => clock.clips.at(-1)?.label ?? "the scene";

interface Placed<T> {
  readonly timeline: Timeline;
  readonly item: T;
}

const names = (target: Ref, el: NodeElement, key: string, refs: Notes["refs"]): boolean => {
  if (!target.within) return el.props.ref === target;
  const owner = refs.get(target.within.ref);

  return owner !== undefined && key === `${owner}/${target.within.path.join("/")}`;
};

const walk = (el: SceneElement, visit: (el: SceneElement) => void): void => {
  visit(el);

  if (el.type === "fragment" || el.type === "group" || el.type === "sequence")
    for (const child of el.children) walk(child, visit);
};

const written = (
  initial: Value,
  moves: readonly Move[],
  goal: (move: Move, before: Value) => Value,
  rewind: Rewind | undefined,
): Track<Value> => {
  let out = track<Value>(initial);
  let before = initial;

  for (const move of moves) {
    const value = goal(move, before);

    out =
      move.over === 0
        ? out.set(value, move.start)
        : out.to(value, span(move.start, move.over), move.curve);
    before = value;
  }

  return rewind ? out.rewind(rewind.over, rewind.curve) : out;
};

const isVec = (value: Value): value is Vec =>
  Array.isArray(value) && value.length === 2 && value.every(Number.isFinite);

const plus = (before: Value, by: Vec, move: Move): Vec => {
  if (!isVec(before))
    throw new SceneError(`${move.verb} moves by a point, so the node needs a point to start from.`);

  return [before[0] + by[0], before[1] + by[1]];
};

const isPlace = (point: Point): point is Place => typeof point === "string";

const pointIn = (point: Point, box: Box, home: Vec, verb: string): Vec =>
  isPlace(point) ? placeIn(box, point, [0, 0], verb) : [home[0] + point[0], home[1] + point[1]];

export class Cues {
  readonly #moves: readonly Placed<Move>[];
  readonly #rewinds: readonly Placed<Rewind>[];
  readonly #claimed = new Set<Timeline>();
  readonly #clocks = new Map<Timeline, Clock>();
  readonly #met = new Set<Move | Rewind>();
  readonly #forwarded = new Map<string, readonly Placed<Move>[]>();
  readonly applied: { verb: string; key: string; start: Seconds; over: Seconds }[] = [];
  get refs(): readonly Ref[] {
    return [...this.#moves, ...this.#rewinds].map(
      ({ item }) => item.target.within?.ref ?? item.target,
    );
  }

  constructor(timelines: readonly Timeline[], top: SceneElement) {
    this.#moves = timelines.flatMap((timeline) =>
      timeline.action.moves.map((item) => ({ timeline, item })),
    );
    this.#rewinds = timelines.flatMap((timeline) =>
      timeline.action.rewinds.map((item) => ({ timeline, item })),
    );

    walk(top, (el) => {
      if (el.type !== "sequence" || !el.timeline) return;

      if (this.#claimed.has(el.timeline))
        throw new SceneError(
          "One timeline is given to two <Sequence>s. Make one for each with timeline().",
        );
      this.#claimed.add(el.timeline);
    });
  }

  claim(timeline: Timeline, clock: Clock): void {
    if (!this.#claimed.has(timeline))
      throw new SceneError(
        "A <Sequence> inside a symbol is given a timeline, but a symbol is drawn once for every instance. Give the timeline to a <Sequence> in the scene's own tree.",
      );
    this.#clocks.set(timeline, clock);
  }

  #clockOf(timeline: Timeline, key: string, verb: string): Clock | undefined {
    if (!this.#claimed.has(timeline)) return undefined;
    const clock = this.#clocks.get(timeline);

    if (!clock)
      throw new SceneError(
        `${verb} moves ${named(key)}, which sits outside the <Sequence> its timeline is given to. A timeline moves only nodes on its own clock.`,
      );

    return clock;
  }

  #onClock(timeline: Timeline, key: string, verb: string, timing: Timing): void {
    const clock = this.#clockOf(timeline, key, verb);
    const here = timing.clock;
    const same = clock ? clock === here : here.clips.length === 0;

    if (same) return;

    throw new SceneError(
      clock
        ? `${verb} moves ${named(key)}, which runs on ${clockName(here)}'s clock, but its timeline runs on ${clockName(clock)}'s. A timeline moves only nodes on its own clock.`
        : `${verb} moves ${named(key)}, which sits inside ${clockName(here)}, but its timeline runs on the scene's clock. Give the timeline to that sequence: <Sequence start={…} timeline={…}>.`,
    );
  }

  #keyOf(target: Ref, refs: Notes["refs"]): string | undefined {
    if (!target.within) return refs.get(target);
    const owner = refs.get(target.within.ref);

    return owner === undefined ? undefined : `${owner}/${target.within.path.join("/")}`;
  }

  apply(
    el: NodeElement,
    key: string,
    timing: Timing,
    notes: Notes,
    parent: string,
    home: () => Vec = () => [0, 0],
  ): NodeElement {
    const owned = this.#moves.filter(({ item }) => names(item.target, el, key, notes.refs));
    let mine = [...owned, ...(this.#forwarded.get(key) ?? [])];

    if (el.type === "group" && el.settle?.kind === "connect") {
      const passed = mine.filter(({ item }) => DRAWN.has(item.prop));

      mine = mine.filter((each) => !passed.includes(each));
      this.#forwarded.set(`${key}/shaft`, passed);
      this.#forwarded.set(
        `${key}/head`,
        passed.filter(({ item }) => item.prop !== "trim"),
      );
    }

    if (mine.length === 0) return el;

    const back = this.#rewinds.filter(({ item }) => {
      if (names(item.target, el, key, notes.refs)) return true;
      const owner = this.#keyOf(item.target, notes.refs);

      return owner !== undefined && key.startsWith(`${owner}/`);
    });

    for (const { timeline, item } of [...mine, ...back]) {
      this.#onClock(timeline, key, item.verb, timing);
      this.#met.add(item);
    }

    for (const { item } of mine)
      this.applied.push({
        verb: item.verb,
        key,
        start: timing.clock.offset + item.start,
        over: item.over,
      });

    const [rewind, twice] = back.map(({ item }) => item);

    if (twice)
      throw new SceneError(
        `${rewind!.verb} and ${twice.verb} both rewind ${named(key)}. Rewind it once.`,
      );

    const byProp = new Map<Prop, Move[]>();

    for (const { item } of mine) byProp.set(item.prop, [...(byProp.get(item.prop) ?? []), item]);

    const tracks = new Map<Prop, Track<Value>>();

    for (const [prop, list] of byProp) {
      const moves = [...list].sort((a, b) => a.start - b.start || a.over - b.over);
      const initial = this.#initial(el, prop, moves[0]!, key, notes, parent, home);

      conflicts(moves, prop, key, timing.clock.offset);

      if (moves.some((move) => move.goal.kind === "anchor")) {
        notes.aims.set(key, (read, self) => {
          try {
            return aimed(read, self);
          } catch (error) {
            throw error instanceof Error ? located(error, whereOf(key)) : error;
          }
        });

        const aimed: Aim = (read, self) => {
          const seen = new Map<Anchor, Animated<Vec>>();

          const land = (move: Move, before: Value): Value => {
            const { goal } = move;

            if (goal.kind === "value") return goal.value;

            if (goal.kind === "by") return plus(before, goal.by, move);

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

          const { data } = passageOf(written(initial, moves, land, rewind));

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
        written(
          initial,
          moves,
          (move, before) => {
            const { goal } = move;

            return goal.kind === "by"
              ? plus(before, goal.by, move)
              : goal.kind === "value"
                ? goal.value
                : before;
          },
          rewind,
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
    home: () => Vec,
  ): Value {
    const { verb } = first;

    const painted = prop === "fill" || prop === "stroke";

    if (!KINDS[prop].includes(el.type) || (el.type === "group" && painted && !el.paints))
      throw new SceneError(
        `${verb} moves ${prop} on ${named(key)}, which has none. Only ${KINDS[prop].map((kind) => (kind === "group" && painted ? "container" : kind)).join(" or ")} nodes have ${prop}.`,
      );
    const value = writtenOf(el, prop);

    if (isTrack(value) || isDerived(value))
      throw new SceneError(
        `${verb} moves ${prop} on ${named(key)}, which a track already moves. Move it in one place: write the track's steps as actions, or the actions as track steps.`,
      );

    if (value instanceof Anchor)
      throw new SceneError(
        `${verb} moves ${named(key)}, which is placed at ${value.label}. Place it at a point and move() it to the anchor instead.`,
      );
    const container = notes.nodes.get(parent)?.settle;

    if (prop === "at" && container?.kind === "arrange")
      throw new SceneError(
        `${verb} moves ${named(key)}, but the ${container.label} it sits in places it. Wrap it in a <Group> for the container to place, and move the node inside.`,
      );
    const start = value ?? (prop === "at" ? home() : UNWRITTEN[prop]);

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

  finish(notes: Notes): void {
    for (const { item } of this.#rewinds) {
      const owner = this.#keyOf(item.target, notes.refs);

      if (!this.#met.has(item) && owner !== undefined)
        throw new SceneError(
          `${item.verb} rewinds ${named(owner)}, but no timeline moves it or anything inside it.`,
          "Move it, or something inside it, before the rewind, or drop the rewind.",
          { ...whereOf(owner), ...(item.source && { source: item.source }) },
        );
    }

    for (const { item } of [...this.#moves, ...this.#rewinds]) {
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
    `Start ${second.verb} at ${num(offset + end(first))}s or later (seq() plays actions one after another), or move both props in one to().`,
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

const withTracks = (el: NodeElement, tracks: ReadonlyMap<Prop, Track<Value>>): NodeElement => {
  if (tracks.size === 0) return el;

  const own = Object.fromEntries(
    [...tracks].filter(([prop]) => prop !== "stroke" && prop !== "strokeWidth"),
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
  const made: Timeline[] = [];

  open = made;

  try {
    const top = build();

    return [top, new Cues(made, top)];
  } finally {
    open = outer;
  }
};

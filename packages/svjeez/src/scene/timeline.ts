import { num } from "../format";
import { EPSILON, type Seconds } from "../motion";
import { span, type Span, type Spanned } from "./span";
import type { Animated, Box, Vec } from "./ir";
import type { SceneElement } from "./nodes";
import { Anchor, placeIn, type Place, type Ref } from "./refs";
import { blendVec, valueAt } from "./sample";
import { outward, type Notes } from "./settle";
import { ease, isSpring, type Curve } from "./spring";
import { laneOf, mapped, mixVec, type Clock, type Timing } from "./steps";
import { isDerived, type Derived } from "./derived";
import { isTrack, passageOf, track, type Track } from "./track";
import type { Geometry, Paint } from "./values";

/**
 * Choreography: motion written as actions on refs, played one after another or together, instead of as a track on
 * each prop. An action is plain data with a length; `timeline()` places it on a clock, and lowering writes each
 * (node, property) it moves as the one track a hand-written `track()` would be, starting from the node's own value.
 */

/** A shape's stroke as a verb moves it: its color, its width, or both. */
export interface StrokeMoves {
  readonly color?: Paint;
  readonly width?: number;
}

/** What an action can move on a node, and the value each one goes to: the props of the same names. */
export interface Moves {
  /** Where the node goes in its parent, as its own `at` says it: a point, or an anchor its `at` point lands on. */
  readonly at?: Vec | Anchor;
  /** Degrees, clockwise. */
  readonly rotate?: number;
  readonly scale?: number | Vec;
  readonly opacity?: number;
  /** A shape's or a text's fill. */
  readonly fill?: Paint;
  /** A shape's stroke: the parts of it named. */
  readonly stroke?: StrokeMoves;
  readonly trim?: Vec;
  readonly geometry?: Geometry;
}

/** One property a move writes: a stroke's color and width are two. */
type Prop = Exclude<keyof Moves, "stroke"> | "stroke" | "strokeWidth";

/** The names `Moves` takes. */
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

/** A value one of `Moves` takes, once anchors are read. */
type Value = Vec | number | Paint | Geometry;

const isName = (name: string): name is keyof Moves => NAMES.some((known) => known === name);

/** The point of a node that `move` lands on an anchor: a place on its box, or a point measured from its `at` point. */
export type Point = Place | Vec;

export interface MoveOptions {
  /**
   * Which point of the node lands on an anchor: a place on its box, or a point measured from the one its `at`
   * places. Default `[0, 0]`: the point its `at` places, its box's top-left unless its `anchor` says.
   */
  readonly point?: Point;
}

type Goal =
  | { readonly kind: "value"; readonly value: Value }
  | { readonly kind: "by"; readonly by: Vec }
  | { readonly kind: "anchor"; readonly anchor: Anchor; readonly point: Point };

/** One property of one node going to a goal: a transition, or a cut when `over` is 0. */
export interface Move {
  readonly target: Ref;
  readonly prop: Prop;
  readonly start: Seconds;
  readonly over: Seconds;
  readonly curve: Curve;
  readonly goal: Goal;
  /** How it reads in code, for errors: `win.move()`. */
  readonly verb: string;
}

/** Every property a timeline moves on a node, gliding back to where it started over the clock's last `over` seconds. */
export interface Rewind {
  readonly target: Ref;
  readonly over: Seconds;
  readonly curve: Curve;
  readonly verb: string;
}

/**
 * Something that happens to refs over `length` seconds, counted from its own start. Actions are values: combine
 * them with `seq`, `par` and `stagger`, and write verbs of your own as functions that return them.
 */
export class Action {
  readonly length: Seconds;
  readonly moves: readonly Move[];
  readonly rewinds: readonly Rewind[];
  /** Named spans inside it, from its own start. */
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

  /** The same action, its span named `name`: a timeline reads it back with `.span(name)`. */
  as(name: string): Action {
    if (name === "") throw new Error("as() needs a name.");

    if (this.labels.has(name))
      throw new Error(`Two spans in one action are both named "${name}". Give one another name.`);

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
      throw new Error(
        `${what} takes actions, such as win.move([10, 20], 1) or wait(0.5), but argument ${i + 1} is not one.`,
      );
  });

  return list;
};

/** Actions placed at their starts, as one: its length is `length`, or where the last one ends. */
const together = (placed: readonly (readonly [Action, Seconds])[], length?: Seconds): Action => {
  const labels = new Map<string, Span>();

  for (const [action, at] of placed)
    for (const [name, { start, over }] of action.labels) {
      if (labels.has(name))
        throw new Error(
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

/** One action after another, each starting as the one before ends. */
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

/** Actions that start together. It lasts as long as the longest. */
export const par = (...list: readonly Action[]): Action =>
  together(actions(list, "par()").map((action) => [action, 0]));

/** Nothing for `seconds`: a pause in a `seq`. */
export const wait = (seconds: Seconds): Action => {
  if (!(seconds >= 0 && Number.isFinite(seconds)))
    throw new Error(`wait() needs a finite number of seconds of 0 or more, got ${seconds}.`);

  return new Action(seconds);
};

/**
 * Actions that start `step` seconds apart. It lasts until the last one ends. For spans that start a step apart, use
 * `span.cascade(count, step)`.
 */
export const stagger = (step: Seconds, ...list: readonly Action[]): Action => {
  if (!Number.isFinite(step))
    throw new Error(
      "stagger() takes a step in seconds and then actions, such as stagger(0.1, a.show(0.3), b.show(0.3)). For spans a step apart, write span(…).cascade(count, step).",
    );

  return together(actions(list, "stagger()").map((action, i) => [action, i * step]));
};

/** A positive length for a transition, or the error that says how to write a cut. */
const length = (over: Seconds, verb: string): Seconds => {
  if (!(over > 0 && Number.isFinite(over)))
    throw new Error(
      `${verb} needs a positive number of seconds, got ${over}. Use set() for a cut.`,
    );

  return over;
};

const DEFAULT_CURVE: Curve = ease.out;

/** Each property `values` names, with the value it goes to: a stroke's color and width apart. */
const flatValues = (values: Moves, verb: string): (readonly [Prop, Value | Anchor])[] => {
  const unknown = Object.keys(values).find((name) => !isName(name));

  if (unknown !== undefined)
    throw new Error(`${verb} can't move "${unknown}". It moves ${NAMES.join(", ")}.`);

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
        throw new Error(
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

/** Whether a verb was given a stroke as the prop writes it, not a bare paint. */
const isStrokeMoves = (stroke: StrokeMoves | Paint): stroke is StrokeMoves =>
  typeof stroke === "object" && !Array.isArray(stroke) && !("kind" in stroke);

/** The verbs every ref has, as functions of the ref: `Ref`'s methods call these. */
export const verbs = {
  to: (target: Ref, values: Moves, over: Seconds, curve: Curve = DEFAULT_CURVE): Action => {
    const verb = label(target, "to");

    return one(target, verb, values, length(over, verb), curve);
  },
  set: (target: Ref, values: Moves): Action =>
    one(target, label(target, "set"), values, 0, ease.hold),
  move: (
    target: Ref,
    to: Vec | Anchor | Ref,
    over: Seconds,
    curve: Curve = DEFAULT_CURVE,
    options: MoveOptions = {},
  ): Action => {
    const verb = label(target, "move");

    if (isPoint(to)) {
      if (options.point !== undefined)
        throw new Error(
          `${verb} lands a point of the node on an anchor, such as card.left, but ${JSON.stringify(to)} is a point in the parent. Move the node's at there without a point, or give an anchor.`,
        );

      return one(target, verb, { at: to }, length(over, verb), curve);
    }

    const anchor = to instanceof Anchor ? to : to.center;
    const goal: Goal = { kind: "anchor", anchor, point: options.point ?? [0, 0] };

    return new Action(length(over, verb), [
      { target, prop: "at", start: 0, over, curve, goal, verb },
    ]);
  },
  moveBy: (target: Ref, by: Vec, over: Seconds, curve: Curve = DEFAULT_CURVE): Action => {
    const verb = label(target, "moveBy");

    return new Action(length(over, verb), [
      { target, prop: "at", start: 0, over, curve, goal: { kind: "by", by }, verb },
    ]);
  },
  rotate: (target: Ref, to: number, over: Seconds, curve: Curve = DEFAULT_CURVE): Action => {
    const verb = label(target, "rotate");

    return one(target, verb, { rotate: to }, length(over, verb), curve);
  },
  scale: (target: Ref, to: number | Vec, over: Seconds, curve: Curve = DEFAULT_CURVE): Action => {
    const verb = label(target, "scale");

    return one(target, verb, { scale: to }, length(over, verb), curve);
  },
  show: (target: Ref, over: Seconds, curve: Curve = DEFAULT_CURVE): Action => {
    const verb = label(target, "show");

    return one(target, verb, { opacity: 1 }, length(over, verb), curve);
  },
  hide: (target: Ref, over: Seconds, curve: Curve = DEFAULT_CURVE): Action => {
    const verb = label(target, "hide");

    return one(target, verb, { opacity: 0 }, length(over, verb), curve);
  },
  fill: (target: Ref, to: Paint, over: Seconds, curve: Curve = DEFAULT_CURVE): Action => {
    const verb = label(target, "fill");

    return one(target, verb, { fill: to }, length(over, verb), curve);
  },
  stroke: (target: Ref, to: StrokeMoves, over: Seconds, curve: Curve = DEFAULT_CURVE): Action => {
    const verb = label(target, "stroke");

    return one(target, verb, { stroke: to }, length(over, verb), curve);
  },
  draw: (target: Ref, over: Seconds, curve: Curve = DEFAULT_CURVE): Action => {
    const verb = label(target, "draw");

    return new Action(length(over, verb), [
      ...one(target, verb, { trim: [0, 0] }, 0, ease.hold).moves,
      ...one(target, verb, { trim: [0, 1] }, over, curve).moves,
    ]);
  },
  rewind: (target: Ref, over: Seconds, curve: Curve = DEFAULT_CURVE): Action => {
    const verb = label(target, "rewind");

    return new Action(0, [], [{ target, over: length(over, verb), curve, verb }]);
  },
};

/** A choreography placed on a clock: the scene's, or the `<Sequence timeline={…}>` it is given to. */
export class Timeline {
  readonly action: Action;

  constructor(action: Action) {
    this.action = action;
  }

  /** When the last action ends, on the timeline's clock. A rewind runs at the end of the clock, after this. */
  get end(): Seconds {
    return this.action.length;
  }

  /** The span of the action named `name` with `.as(name)`, on the timeline's clock: line other things up with it. */
  span(name: string): Spanned {
    const found = this.action.labels.get(name);

    if (!found) {
      const known = [...this.action.labels.keys()];

      throw new Error(
        `The timeline has no span named "${name}". ${known.length > 0 ? `It has ${known.map((n) => `"${n}"`).join(", ")}.` : "Name one with action.as(name)."}`,
      );
    }

    return span(found.start, found.over);
  }
}

let open: Timeline[] | undefined;

/**
 * Plays actions one after another on the scene's clock, or on a `<Sequence>`'s when given to it as
 * `<Sequence start={…} timeline={…}>`. Call it inside `scene()`'s callback or a component the scene renders. Every
 * node it moves must sit on that clock.
 */
export const timeline = (...list: readonly Action[]): Timeline => {
  if (!open)
    throw new Error(
      "timeline() is only known while scene()'s callback runs. Call it there, or in a component the scene renders.",
    );
  const made = new Timeline(seq(...actions(list, "timeline()")));

  open.push(made);

  return made;
};

/** A node element: what lowering gives a key. */
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
  fill: ["shape", "text"],
  stroke: ["shape"],
  strokeWidth: ["shape"],
  trim: ["shape"],
  geometry: ["shape"],
};

/** What a prop is when the node doesn't write it. `at` is where the node is, which lowering knows. */
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
      return el.type === "shape" || el.type === "text" ? el.props.fill : undefined;
    case "stroke":
      return el.type === "shape" ? el.props.stroke?.color : undefined;
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

/** Whether `target` names the node keyed `key`, given the keys of the refs lowered so far. */
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

/** The track a hand-written prop would be: the node's own value, then each move in time order, then the rewind. */
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
    throw new Error(`${move.verb} moves by a point, so the node needs a point to start from.`);

  return [before[0] + by[0], before[1] + by[1]];
};

const isPlace = (point: Point): point is Place => typeof point === "string";

/** `point` in the node's own frame, given its box and the point of it that its `at` places. */
const pointIn = (point: Point, box: Box, home: Vec, verb: string): Vec =>
  isPlace(point) ? placeIn(box, point, [0, 0], verb) : [home[0] + point[0], home[1] + point[1]];

/**
 * The timelines of one scene, as lowering applies them. Lowering asks for each node in turn; every node a timeline
 * moves gets its tracks, and at the end each ref a timeline names must have been found.
 */
export class Cues {
  readonly #moves: readonly Placed<Move>[];
  readonly #rewinds: readonly Placed<Rewind>[];
  readonly #claimed = new Set<Timeline>();
  readonly #clocks = new Map<Timeline, Clock>();
  readonly #met = new Set<Move | Rewind>();
  /** Each move applied, on the scene's clock, with the key of the node it moved. */
  readonly applied: { verb: string; key: string; start: Seconds; over: Seconds }[] = [];
  /** Each ref a timeline names, whether or not a node has it. */
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
        throw new Error(
          "One timeline is given to two <Sequence>s. Make one for each with timeline().",
        );
      this.#claimed.add(el.timeline);
    });
  }

  /** A `<Sequence timeline={…}>` is lowered: that timeline runs on its clock. */
  claim(timeline: Timeline, clock: Clock): void {
    if (!this.#claimed.has(timeline))
      throw new Error(
        "A <Sequence> inside a symbol is given a timeline, but a symbol is drawn once for every instance. Give the timeline to a <Sequence> in the scene's own tree.",
      );
    this.#clocks.set(timeline, clock);
  }

  #clockOf(timeline: Timeline, key: string, verb: string): Clock | undefined {
    if (!this.#claimed.has(timeline)) return undefined;
    const clock = this.#clocks.get(timeline);

    if (!clock)
      throw new Error(
        `${verb} moves "${key}", which sits outside the <Sequence> its timeline is given to. A timeline moves only nodes on its own clock.`,
      );

    return clock;
  }

  #onClock(timeline: Timeline, key: string, verb: string, timing: Timing): void {
    const clock = this.#clockOf(timeline, key, verb);
    const here = timing.clock;
    const same = clock ? clock === here : here.clips.length === 0;

    if (same) return;

    throw new Error(
      clock
        ? `${verb} moves "${key}", which runs on ${clockName(here)}'s clock, but its timeline runs on ${clockName(clock)}'s. A timeline moves only nodes on its own clock.`
        : `${verb} moves "${key}", which sits inside ${clockName(here)}, but its timeline runs on the scene's clock. Give the timeline to that sequence: <Sequence start={…} timeline={…}>.`,
    );
  }

  /**
   * The element with the tracks the timelines give it, or as it is when none moves it. `home` is where its `at` is
   * when it writes none.
   */
  apply(
    el: NodeElement,
    key: string,
    timing: Timing,
    notes: Notes,
    parent: string,
    home: () => Vec = () => [0, 0],
  ): NodeElement {
    const mine = this.#moves.filter(({ item }) => names(item.target, el, key, notes.refs));
    const back = this.#rewinds.filter(({ item }) => names(item.target, el, key, notes.refs));

    if (mine.length === 0 && back.length === 0) return el;

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
      throw new Error(`${rewind!.verb} and ${twice.verb} both rewind "${key}". Rewind it once.`);

    if (rewind && mine.length === 0)
      throw new Error(`${rewind.verb} rewinds "${key}", but no timeline moves it.`);

    const byProp = new Map<Prop, Move[]>();

    for (const { item } of mine) byProp.set(item.prop, [...(byProp.get(item.prop) ?? []), item]);

    const tracks = new Map<Prop, Track<Value>>();

    for (const [prop, list] of byProp) {
      const moves = [...list].sort((a, b) => a.start - b.start || a.over - b.over);
      const initial = this.#initial(el, prop, moves[0]!, key, notes, parent, home);

      conflicts(moves, prop, key);

      if (moves.some((move) => move.goal.kind === "anchor")) {
        notes.aims.set(key, (read, self) => {
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

            // As every other goal, in the node's placement: the point its `at` names, not its frame's origin.
            return [x - dx + node.home[0], y - dy + node.home[1]];
          };

          const { data } = passageOf(written(initial, moves, land, rewind));

          const lane = mapped(data, "value", (value): Vec => {
            if (!isVec(value))
              throw new Error(`at on "${key}" needs a point, got ${String(value)}.`);

            return value;
          });

          return laneOf(lane, lane.initial.value!, timing, mixVec, `at on "${key}"`, true);
        });

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

    if (!KINDS[prop].includes(el.type))
      throw new Error(
        `${verb} moves ${prop} on "${key}", a ${el.type}, which has none. Only ${KINDS[prop].join(" or ")} nodes have ${prop}.`,
      );
    const value = writtenOf(el, prop);

    if (isTrack(value) || isDerived(value))
      throw new Error(
        `${verb} moves ${prop} on "${key}", which a track already moves. Move it in one place: write the track's steps as actions, or the actions as track steps.`,
      );

    if (value instanceof Anchor)
      throw new Error(
        `${verb} moves "${key}", which is placed at ${value.label}. Place it at a point and move() it to the anchor instead.`,
      );
    const container = notes.nodes.get(parent)?.settle;

    if (prop === "at" && container?.kind === "arrange")
      throw new Error(
        `${verb} moves "${key}", but the ${container.label} it sits in places it. Wrap it in a <Group> for the container to place, and move the node inside.`,
      );
    const start = value ?? (prop === "at" ? home() : UNWRITTEN[prop]);

    if (start === undefined)
      throw new Error(
        prop === "fill"
          ? `${verb} changes the fill of "${key}", which has none to start from. Give it fill={…}.`
          : `${verb} changes the stroke of "${key}", which has none. Give it stroke={{ color: … }}.`,
      );

    if ((prop === "stroke" || prop === "strokeWidth") && el.type === "shape" && !el.props.stroke)
      throw new Error(
        `${verb} changes the stroke of "${key}", which has none. Give it stroke={{ color: … }}.`,
      );

    return start;
  }

  /** Every ref a timeline names was on a node it could move. */
  finish(): void {
    for (const { item } of [...this.#moves, ...this.#rewinds]) {
      if (this.#met.has(item)) continue;
      const { target } = item;

      throw new Error(
        target.within
          ? `${item.verb} names ${target.label}, but no node is keyed "${target.within.path.join("/")}" inside the node ref={${target.within.ref.key}} is on.`
          : `${item.verb} moves the ref "${target.key}", which is on no node. Give one node ref={…} with it.`,
      );
    }
  }
}

/** Two moves of one property that overlap, unless the first is a spring that the second cuts. */
const conflicts = (moves: readonly Move[], prop: Prop, key: string): void => {
  moves.forEach((a, i) => {
    for (const b of moves.slice(i + 1)) {
      const overlap = a.start < end(b) - EPSILON && b.start < end(a) - EPSILON;
      const cut = isSpring(a.curve) && a.start < b.start - EPSILON;

      if (overlap && !cut)
        throw new Error(
          `${a.verb} and ${b.verb} both move ${prop} on "${key}" between ${num(Math.max(a.start, b.start))}s and ${num(Math.min(end(a), end(b)))}s. Play them one after another with seq(), or move both in one to().`,
        );
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
    el.type === "shape" && el.props.stroke && (color || width)
      ? { stroke: { ...el.props.stroke, ...(color && { color }), ...(width && { width }) } }
      : undefined;

  // SAFETY: each track starts from the value the node wrote for its prop and goes to values of that prop's type.
  return { ...el, props: { ...el.props, ...own, ...stroke } } as NodeElement;
};

/** Runs a scene's build with timelines open, and gives back what it built and the timelines it made. */
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

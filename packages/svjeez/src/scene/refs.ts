import type { Seconds } from "../motion";
import type { Box, Vec } from "./ir";
import type { Curve } from "./spring";
import { verbs, type Action, type MoveOptions, type Moves, type StrokeMoves } from "./timeline";
import type { Paint } from "./values";

/** A side of a box. */
export type Edge = "left" | "right" | "top" | "bottom";

/** Where a point sits in a box, from 0 to 1 across and down. */
type Fraction = readonly [across: number, down: number];

const SIDES: Readonly<Record<Edge, (t: number) => Fraction>> = {
  left: (t) => [0, t],
  right: (t) => [1, t],
  top: (t) => [t, 0],
  bottom: (t) => [t, 1],
};

const at = (box: Box, [u, v]: Fraction): Vec => [box.x + box.width * u, box.y + box.height * v];

/**
 * A point on a node's box, read once the node is lowered: it can name a node that comes later in the tree or sits in
 * another group. Lowering resolves it into the frame of whoever uses it, and when anything between the two moves, the
 * point follows as a lane.
 */
export class Anchor {
  /** The ref whose box it is on, or the canvas. */
  readonly of: Ref | "canvas";
  /** How it reads in code, for errors: `card.right`. */
  readonly label: string;
  readonly #point: (box: Box) => Vec;

  constructor(of: Ref | "canvas", label: string, point: (box: Box) => Vec) {
    this.of = of;
    this.label = label;
    this.#point = point;
  }

  /** The point, given the box it is on, in that box's frame. */
  on(box: Box): Vec {
    return this.#point(box);
  }

  /** Another point, `fn` of this one in the frame of the box it is on: `card.right.map(([x, y]) => [x + 8, y])`. */
  map(fn: (point: Vec) => Vec): Anchor {
    return new Anchor(this.of, `${this.label}.map(…)`, (box) => fn(this.#point(box)));
  }
}

export const isAnchor = (value: unknown): value is Anchor => value instanceof Anchor;

const fraction = (t: number, what: string): number => {
  if (!Number.isFinite(t))
    throw new Error(`${what} needs a finite fraction of the edge, got ${t}.`);

  return t;
};

/**
 * The handle code holds for a node: give it to one node as `ref`, then point at that node from anywhere. Anchors
 * (`.center`, `.right`, `.topLeft`, `.side(edge, t)`) are points on its box, and `.part(key)` is the ref of a node
 * inside it.
 */
export class Ref {
  /** The key the node it is on takes, unless the node has a `key` of its own. */
  readonly key: string;
  /** For a part: the ref it is inside, and the keys down to it. */
  readonly within: { readonly ref: Ref; readonly path: readonly string[] } | undefined;

  constructor(key: string, within?: { readonly ref: Ref; readonly path: readonly string[] }) {
    if (key === "" || key.includes("/"))
      throw new Error(`A ref needs a key with no "/" in it, got "${key}".`);
    this.key = key;
    this.within = within;
  }

  /** How it reads in code, for errors. */
  get label(): string {
    return this.within
      ? `${this.within.ref.label}.part("${this.within.path.join("/")}")`
      : this.key;
  }

  /** The node keyed `key` inside this one. A path such as `"body/title"` goes further down. */
  part(key: string): Ref {
    const path = key.split("/");

    if (path.some((step) => step === ""))
      throw new Error(`${this.label}.part() needs keys joined by "/", got "${key}".`);
    const root = this.within?.ref ?? this;

    return new Ref(path.at(-1)!, { ref: root, path: [...(this.within?.path ?? []), ...path] });
  }

  /** The point a fraction `t` of the way along an edge: from the top for a left or right edge, from the left for the others. */
  side(edge: Edge, t = 0.5): Anchor {
    const along = fraction(t, `${this.label}.side()`);
    const place = SIDES[edge];

    if (!place)
      throw new Error(`${this.label}.side() takes left, right, top or bottom, got "${edge}".`);

    return new Anchor(this, `${this.label}.side("${edge}", ${along})`, (box) =>
      at(box, place(along)),
    );
  }

  #corner(name: string, where: Fraction): Anchor {
    return new Anchor(this, `${this.label}.${name}`, (box) => at(box, where));
  }

  get center(): Anchor {
    return this.#corner("center", [0.5, 0.5]);
  }

  get left(): Anchor {
    return this.#corner("left", [0, 0.5]);
  }

  get right(): Anchor {
    return this.#corner("right", [1, 0.5]);
  }

  get top(): Anchor {
    return this.#corner("top", [0.5, 0]);
  }

  get bottom(): Anchor {
    return this.#corner("bottom", [0.5, 1]);
  }

  get topLeft(): Anchor {
    return this.#corner("topLeft", [0, 0]);
  }

  get topRight(): Anchor {
    return this.#corner("topRight", [1, 0]);
  }

  get bottomLeft(): Anchor {
    return this.#corner("bottomLeft", [0, 1]);
  }

  get bottomRight(): Anchor {
    return this.#corner("bottomRight", [1, 1]);
  }

  /*
   * Motion verbs: each returns an action for a timeline and writes the track of the prop it names, starting from the
   * node's own value. Each takes what, then how long, then the curve, which defaults to ease.out and may be a spring.
   */

  /** Every prop in `values` goes to its value over `over` seconds: the general form of the verbs below. */
  to(values: Moves, over: Seconds, curve?: Curve): Action {
    return verbs.to(this, values, over, curve);
  }

  /** A cut: every prop in `values` jumps to it. It takes no time. */
  set(values: Moves): Action {
    return verbs.set(this, values);
  }

  /**
   * The node's `at` goes to `to`: a point in its parent's frame, or an anchor (a ref is its center) where that anchor
   * is when the move ends, whatever moves it. On an anchor, `options.point` is the point of the node that lands there:
   * `[0, 0]` unless you say.
   */
  move(to: Vec | Anchor | Ref, over: Seconds, curve?: Curve, options?: MoveOptions): Action {
    return verbs.move(this, to, over, curve, options);
  }

  /** The node moves by `by` from where the move before left it. */
  moveBy(by: Vec, over: Seconds, curve?: Curve): Action {
    return verbs.moveBy(this, by, over, curve);
  }

  /** Turns to `to` degrees, clockwise. */
  rotate(to: number, over: Seconds, curve?: Curve): Action {
    return verbs.rotate(this, to, over, curve);
  }

  scale(to: number | Vec, over: Seconds, curve?: Curve): Action {
    return verbs.scale(this, to, over, curve);
  }

  /** Opacity to 1. For another opacity, `to({ opacity }, over)`. */
  show(over: Seconds, curve?: Curve): Action {
    return verbs.show(this, over, curve);
  }

  /** Opacity to 0. */
  hide(over: Seconds, curve?: Curve): Action {
    return verbs.hide(this, over, curve);
  }

  /** A shape's or a text's fill to `to`. */
  fill(to: Paint, over: Seconds, curve?: Curve): Action {
    return verbs.fill(this, to, over, curve);
  }

  /** A shape's stroke to `to`: its color, its width, or both, as the `stroke` prop names them. */
  stroke(to: StrokeMoves, over: Seconds, curve?: Curve): Action {
    return verbs.stroke(this, to, over, curve);
  }

  /** Strokes the outline on from nothing, as `trim={draw(when)}` does: the trim cuts to `[0, 0]` and goes to `[0, 1]`. */
  draw(over: Seconds, curve?: Curve): Action {
    return verbs.draw(this, over, curve);
  }

  /**
   * Everything the timeline moves on this node glides back to where it started over the last `over` seconds of the
   * timeline's clock. It takes no time in a `seq`: it always runs at the end.
   */
  rewind(over: Seconds, curve?: Curve): Action {
    return verbs.rewind(this, over, curve);
  }
}

let declared: Ref[] | undefined;

/** A ref to give one node, as `ref={win}`. Its key is the node's key unless the node has its own. */
export const ref = (key: string): Ref => {
  const made = new Ref(key);

  declared?.push(made);

  return made;
};

/** Runs a scene's build, and gives back what it built and the refs made while it ran. */
export const declaring = <T>(build: () => T): readonly [T, readonly Ref[]] => {
  const outer = declared;
  const made: Ref[] = [];

  declared = made;

  try {
    return [build(), made];
  } finally {
    declared = outer;
  }
};

/** Where a placement lands in a box: a corner, the middle of an edge, or the center. */
export type Place =
  | "center"
  | "top"
  | "bottom"
  | "left"
  | "right"
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right";

const PLACES: Readonly<Record<Place, Fraction>> = {
  center: [0.5, 0.5],
  top: [0.5, 0],
  bottom: [0.5, 1],
  left: [0, 0.5],
  right: [1, 0.5],
  "top-left": [0, 0],
  "top-right": [1, 0],
  "bottom-left": [0, 1],
  "bottom-right": [1, 1],
};

export const fractionOf = (place: Place, what: string): Fraction => {
  const where = PLACES[place];

  if (!where)
    throw new Error(
      `${what} takes a place such as "center", "top" or "bottom-right", got "${String(place)}".`,
    );

  return where;
};

/** The point at `place` in `box`, moved `inset` toward the box's middle. */
export const placeIn = (box: Box, place: Place, inset: Vec, what: string): Vec => {
  const [u, v] = fractionOf(place, what);
  const [x, y] = at(box, [u, v]);

  return [
    x + inset[0] * (u === 0 ? 1 : u === 1 ? -1 : 0),
    y + inset[1] * (v === 0 ? 1 : v === 1 ? -1 : 0),
  ];
};

/** A point on the canvas, in the scene's own frame. */
export const canvasAnchor = (label: string, point: (box: Box) => Vec): Anchor =>
  new Anchor("canvas", label, point);

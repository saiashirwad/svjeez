import { SceneError } from "../model/scene-error";
import type { Seconds } from "../model/time";
import type { Box, Vec } from "../model/ir";
import type { Curve } from "./spring";
import {
  verbs,
  type Action,
  type MoveOptions,
  type Moves,
  type Over,
  type StrokeMoves,
} from "./timeline";
import { PLACE_LIST, PLACES } from "./pin";
import type { Paint } from "./values";

export type Edge = "left" | "right" | "top" | "bottom";

type Fraction = readonly [across: number, down: number];

const SIDES: Readonly<Record<Edge, (t: number) => Fraction>> = {
  left: (t) => [0, t],
  right: (t) => [1, t],
  top: (t) => [t, 0],
  bottom: (t) => [t, 1],
};

const at = (box: Box, [u, v]: Fraction): Vec => [box.x + box.width * u, box.y + box.height * v];

export class Anchor {
  readonly of: Ref | "canvas";
  readonly label: string;
  readonly #point: (box: Box) => Vec;

  constructor(of: Ref | "canvas", label: string, point: (box: Box) => Vec) {
    this.of = of;
    this.label = label;
    this.#point = point;
  }

  on(box: Box): Vec {
    return this.#point(box);
  }

  map(fn: (point: Vec) => Vec): Anchor {
    return new Anchor(this.of, `${this.label}.map(…)`, (box) => fn(this.#point(box)));
  }
}

export const isAnchor = (value: unknown): value is Anchor => value instanceof Anchor;

const fraction = (t: number, what: string): number => {
  if (!Number.isFinite(t))
    throw new SceneError(`${what} needs a finite fraction of the edge, got ${t}.`);

  return t;
};

export class Ref {
  readonly key: string;
  readonly within: { readonly ref: Ref; readonly path: readonly string[] } | undefined;

  constructor(key: string, within?: { readonly ref: Ref; readonly path: readonly string[] }) {
    if (key === "" || key.includes("/"))
      throw new SceneError(`A ref needs a key with no "/" in it, got "${key}".`);
    this.key = key;
    this.within = within;
  }

  get label(): string {
    return this.within
      ? `${this.within.ref.label}.part("${this.within.path.join("/")}")`
      : this.key;
  }

  part(key: string): Ref {
    const path = key.split("/");

    if (path.some((step) => step === ""))
      throw new SceneError(`${this.label}.part() needs keys joined by "/", got "${key}".`);
    const root = this.within?.ref ?? this;

    return new Ref(path.at(-1)!, { ref: root, path: [...(this.within?.path ?? []), ...path] });
  }

  side(edge: Edge, t = 0.5): Anchor {
    const along = fraction(t, `${this.label}.side()`);
    const place = SIDES[edge];

    if (!place)
      throw new SceneError(`${this.label}.side() takes left, right, top or bottom, got "${edge}".`);

    return new Anchor(this, `${this.label}.side("${edge}", ${along})`, (box) =>
      at(box, place(along)),
    );
  }

  #place(place: Place): Anchor {
    const where = PLACES[place];
    const name = place.replace(/-(\w)/g, (_, letter: string) => letter.toUpperCase());

    return new Anchor(this, `${this.label}.${name}`, (box) => at(box, where));
  }

  get center(): Anchor {
    return this.#place("center");
  }

  get left(): Anchor {
    return this.#place("left");
  }

  get right(): Anchor {
    return this.#place("right");
  }

  get top(): Anchor {
    return this.#place("top");
  }

  get bottom(): Anchor {
    return this.#place("bottom");
  }

  get topLeft(): Anchor {
    return this.#place("top-left");
  }

  get topRight(): Anchor {
    return this.#place("top-right");
  }

  get bottomLeft(): Anchor {
    return this.#place("bottom-left");
  }

  get bottomRight(): Anchor {
    return this.#place("bottom-right");
  }

  to(values: Moves, over: Over, curve?: Curve): Action {
    return verbs.to(this, values, over, curve);
  }

  set(values: Moves): Action {
    return verbs.set(this, values);
  }

  move(to: Vec | Anchor | Ref, over: Over, curve?: Curve, options?: MoveOptions): Action {
    return verbs.move(this, to, over, curve, options);
  }

  moveBy(by: Vec, over: Over, curve?: Curve): Action {
    return verbs.moveBy(this, by, over, curve);
  }

  rotate(to: number, over: Over, curve?: Curve): Action {
    return verbs.rotate(this, to, over, curve);
  }

  scale(to: number | Vec, over: Over, curve?: Curve): Action {
    return verbs.scale(this, to, over, curve);
  }

  show(over: Over, curve?: Curve): Action {
    return verbs.show(this, over, curve);
  }

  hide(over: Over, curve?: Curve): Action {
    return verbs.hide(this, over, curve);
  }

  fill(to: Paint, over: Over, curve?: Curve): Action {
    return verbs.fill(this, to, over, curve);
  }

  stroke(to: StrokeMoves, over: Over, curve?: Curve): Action {
    return verbs.stroke(this, to, over, curve);
  }

  draw(over: Over, curve?: Curve): Action {
    return verbs.draw(this, over, curve);
  }

  rewind(over: Seconds, curve?: Curve): Action {
    return verbs.rewind(this, over, curve);
  }
}

let declared: Ref[] | undefined;

export const ref = (key: string): Ref => {
  const made = new Ref(key);

  declared?.push(made);

  return made;
};

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

export const fractionOf = (place: Place, what: string): Fraction => {
  const where = Object.hasOwn(PLACES, place) ? PLACES[place] : undefined;

  if (!where)
    throw new SceneError(`${what} takes a place, one of ${PLACE_LIST}, got "${String(place)}".`);

  return where;
};

export const placeIn = (box: Box, place: Place, inset: Vec, what: string): Vec => {
  const [u, v] = fractionOf(place, what);
  const [x, y] = at(box, [u, v]);

  return [
    x + inset[0] * (u === 0 ? 1 : u === 1 ? -1 : 0),
    y + inset[1] * (v === 0 ? 1 : v === 1 ? -1 : 0),
  ];
};

export const canvasAnchor = (label: string, point: (box: Box) => Vec): Anchor =>
  new Anchor("canvas", label, point);

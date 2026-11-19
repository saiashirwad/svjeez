import { SceneError } from "../model/scene-error";
import type { Box, Source, Vec } from "../model/ir";
import { caller } from "../svg/traced";
import { sourceFrom } from "./identity";
import { PLACE_LIST, PLACES } from "./pin";

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
  readonly source: Source | undefined;
  readonly within: { readonly ref: Ref; readonly path: readonly string[] } | undefined;

  constructor(
    source: Source | undefined,
    within?: { readonly ref: Ref; readonly path: readonly string[] },
  ) {
    this.source = source;
    this.within = within;
  }

  get label(): string {
    return this.within ? `ref().part("${this.within.path.join("/")}")` : "ref()";
  }

  part(key: string): Ref {
    const path = key.split("/");

    if (path.some((step) => step === ""))
      throw new SceneError(`${this.label}.part() needs keys joined by "/", got "${key}".`);
    const root = this.within?.ref ?? this;

    return new Ref(root.source, { ref: root, path: [...(this.within?.path ?? []), ...path] });
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
}

export const ref = (): Ref => {
  const at = caller();

  return new Ref(at && sourceFrom(at));
};

export type Place = keyof typeof PLACES;

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

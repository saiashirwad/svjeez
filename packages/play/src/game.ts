import type { Point } from "svjeez";
import type { Sheet } from "./sheet.tsx";
import type { Area, Terrain } from "./walk.ts";

/** A rendered scene to play in, and where walking stops. A game adds what else it needs to know: places, plots, doors. */
export interface World {
  /** What `render()` returned. It marks its layers with `data-layer`: `ground`, `things` and `effects`. */
  readonly svg: string;
  readonly width: number;
  readonly height: number;
  /** The side of one art pixel, for a pixel art world. The runtime then zooms only to sizes that keep every pixel square. */
  readonly grid?: number;
  readonly solids: readonly Area[];
}

/** The whole world as terrain: its edges, and its solids. */
export const terrainOf = ({ width, height, solids }: World): Terrain => ({
  bounds: { x: 0, y: 0, width, height },
  solids,
});

/** A frame of play: the seconds since the last one, and where the held direction keys point, at most 1 long. */
export interface Tick {
  readonly type: "tick";
  readonly dt: number;
  readonly axis: Point;
}

/** What the runtime tells a game: time passing, an action's key going down, and a click on the world. */
export type Input<Action extends string> =
  | Tick
  | { readonly type: "press"; readonly action: Action }
  | { readonly type: "point"; readonly at: Point };

/** Something for the runtime to do that an update cannot: an update only returns the next model. */
export type Effect =
  /** Play a sheet once at a point, above everything that stands, and take it away after `seconds`. */
  | { readonly type: "flash"; readonly sheet: Sheet; readonly at: Point; readonly seconds: number }
  /** Keep a string under a key in the browser, for the next visit. */
  | { readonly type: "store"; readonly key: string; readonly value: string };

/** One sprite in a frame. The runtime keeps the element for a `key` from frame to frame, so its motion keeps its place. */
export interface SpriteView {
  readonly key: string;
  readonly sheet: Sheet;
  /** Which of the sheet's states shows. Default its first. */
  readonly state?: string;
  /** Where its anchor stands. Sprites are drawn in order of `y`, among the world's things. */
  readonly at: Point;
  /** Mirrored about its anchor: a sheet drawn facing right, turned to face left. */
  readonly mirror?: boolean;
}

/** A flat patch of color on the ground, under everything that stands: wet soil, a marked square. */
export interface Patch {
  readonly key: string;
  readonly area: Area;
  readonly fill: string;
  readonly opacity?: number;
}

/** Everything on screen for one model. A view is a function from a model to this, with nothing left over. */
export interface Frame<Hud> {
  /** The world point at the middle of the screen. The runtime eases toward it and stops at the world's edges. */
  readonly camera: Point;
  readonly sprites: readonly SpriteView[];
  readonly patches?: readonly Patch[];
  /** The world's clock, in seconds: the world's own motions show this moment. Left out, they play by themselves. */
  readonly time?: number;
  /** Whatever the page around the world draws: counts, hints, dialog. The runtime hands it to the hud it was given. */
  readonly hud: Hud;
}

/** The keys for each action, by `KeyboardEvent.code`. The arrow keys and WASD are always the direction. */
export type Keys<Action extends string> = { readonly [K in Action]: readonly string[] };

/** A model, and what the runtime should do on the way to it. */
export type Next<Model> = readonly [model: Model, effects: readonly Effect[]];

/**
 * A game: a model, the one function that changes it, and the one function that draws it. Both are pure, so a game runs
 * the same in a test as on a page, and a model can be saved, compared and replayed. The model must be an object, not
 * an array, since an update returns either a model or a model with effects.
 */
export interface Game<Model, Msg, Hud, Action extends string, Where extends World> {
  readonly world: Where;
  readonly keys: Keys<Action>;
  init(world: Where): Model;
  update(model: Model, msg: Msg | Input<Action>, world: Where): Model | Next<Model>;
  view(model: Model, world: Where): Frame<Hud>;
}

/** Declare a game. It returns what it was given: this is where the types are worked out. */
export const game = <Model, Msg, Hud, Action extends string, Where extends World>(
  rules: Game<Model, Msg, Hud, Action, Where>,
): Game<Model, Msg, Hud, Action, Where> => rules;

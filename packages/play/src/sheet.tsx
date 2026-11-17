import { render, type Child, type Point } from "svjeez";

/**
 * A sprite sheet with no pixels: one rendered scene holding a group for each state a sprite can be in. The runtime shows
 * one group at a time, and every group's motions loop on the scene's clock.
 */
export interface Sheet {
  readonly svg: string;
  readonly width: number;
  readonly height: number;
  /** The point of the picture that sits on the sprite's position: the feet of a villager, the root of a crop. */
  readonly anchor: Point;
  /** The side of one art pixel, for pixel art: a sprite of this sheet only ever stands on whole pixels. */
  readonly grid?: number;
}

export interface SheetOptions {
  readonly width: number;
  readonly height: number;
  readonly anchor: Point;
  /** A length every loop in the sheet divides, or how long a sheet that plays once runs. */
  readonly duration: number;
  /** False plays once and holds: an effect. Default true. */
  readonly loop?: boolean;
  /** The side of one art pixel, when the pictures are pixel art. */
  readonly grid?: number;
  /** Put in front of every generated name. Default one no other sheet has, so sheets can share a page. */
  readonly prefix?: string;
}

export type States = readonly (readonly [name: string, picture: Child])[];

let made = 0;

/** Render states into one sheet. A sprite shows the first state until told otherwise. */
export const sheet = (
  { prefix, width, height, anchor, duration, loop, grid }: SheetOptions,
  states: States,
): Sheet => {
  const name = prefix ?? `s${made++}-`;

  return {
    width,
    height,
    anchor,
    grid,
    svg: render(
      { width, height, duration, prefix: name, loop, title: name, reducedMotion: false },
      states.map(([state, picture]) => <g data-state={state}>{picture}</g>),
    ),
  };
};

/**
 * Remember what a function made for each input, by a name for the input. A view runs every frame, so it asks for a
 * sheet by what it should show, and the sheet is rendered the first time only.
 */
export const memo = <Input, Made>(
  make: (input: Input) => Made,
  nameOf: (input: Input) => string,
): ((input: Input) => Made) => {
  const kept = new Map<string, Made>();

  return (input) => {
    const name = nameOf(input);
    const found = kept.get(name);

    if (found !== undefined) return found;
    const fresh = make(input);

    kept.set(name, fresh);

    return fresh;
  };
};

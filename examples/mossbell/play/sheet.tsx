/** @jsxImportSource svjeez */
import { render, type Child, type Point } from "svjeez";

/**
 * A sprite sheet with no pixels: one rendered scene holding a group for each state a sprite can be in. The page shows
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
  /** Unique on the page: it keeps this sheet's keyframes apart from every other scene's. */
  readonly prefix: string;
  readonly width: number;
  readonly height: number;
  readonly anchor: Point;
  /** A length every loop in the sheet divides, or how long a sheet that plays once runs. */
  readonly duration: number;
  /** False plays once and holds: an effect. Default true. */
  readonly loop?: boolean;
  /** The side of one art pixel, when the pictures are pixel art. */
  readonly grid?: number;
}

export type States = readonly (readonly [name: string, picture: Child])[];

/** Render states into one sheet. A sprite shows the first state until told otherwise. */
export const sheet = (
  { prefix, width, height, anchor, duration, loop, grid }: SheetOptions,
  states: States,
): Sheet => ({
  width,
  height,
  anchor,
  grid,
  svg: render(
    { width, height, duration, prefix, loop, title: prefix, reducedMotion: false },
    states.map(([name, picture]) => <g data-state={name}>{picture}</g>),
  ),
});

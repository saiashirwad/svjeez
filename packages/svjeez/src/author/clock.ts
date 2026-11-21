import { SceneError } from "../model/scene-error";
import type { Seconds } from "../model/time";
import { checkWindow, isWhen, type Interval } from "./span";

/** A clock that page code can drive: a part of the scene that counts its own `over` seconds, and plays at `start` in the static file. */
export interface Clock {
  readonly name: string;
  readonly start: Seconds;
  readonly over: Seconds;
}

class Named implements Clock {
  constructor(
    readonly name: string,
    readonly start: Seconds,
    readonly over: Seconds,
  ) {}
}

const NAME = /^[A-Za-z][A-Za-z0-9_-]*$/;

export const isClock = (value: unknown): value is Clock => value instanceof Named;

/** A clock named `name` that runs `demo.over` seconds, and plays at `demo.start` in the plain SVG. */
export const clock = (name: string, demo: Interval): Clock => {
  if (!NAME.test(name))
    throw new SceneError(
      `clock() needs a name of letters, digits, - and _ that starts with a letter, got ${JSON.stringify(name)}.`,
      'Name it as in clock("open", span(1, 0.4)).',
    );

  if (!isWhen(demo) || demo.over === undefined)
    throw new SceneError(
      `clock("${name}") needs the span it plays at in the static file, with a length, got ${String(demo)}.`,
      `Write it as clock("${name}", span(1, 0.4)).`,
    );

  checkWindow(demo.start, demo.over, `clock("${name}")`);

  return new Named(name, demo.start, demo.over);
};

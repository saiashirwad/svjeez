import type { Point } from "svjeez";
import type { Effect, Game, Input, Next, Tick, World } from "./game.ts";

/** A model after some messages, and every effect they asked for, in order. */
export interface Played<Model> {
  readonly model: Model;
  readonly effects: readonly Effect[];
}

const isNext = <Model>(result: Model | Next<Model>): result is Next<Model> => Array.isArray(result);

/** Send one message to a model. */
export const step = <Model, Msg, Hud, Action extends string, Where extends World>(
  game: Game<Model, Msg, Hud, Action, Where>,
  model: Model,
  msg: Msg | Input<Action>,
): Played<Model> => {
  const result = game.update(model, msg, game.world);

  return isNext(result) ? { model: result[0], effects: result[1] } : { model: result, effects: [] };
};

/**
 * Play a game with no page: send messages in order, from a model or from the start. It is how a test, or an agent,
 * finds out what a game does.
 */
export const run = <Model, Msg, Hud, Action extends string, Where extends World>(
  game: Game<Model, Msg, Hud, Action, Where>,
  msgs: readonly (Msg | Input<Action>)[],
  from: Model = game.init(game.world),
): Played<Model> => {
  let model = from;
  const effects: Effect[] = [];

  for (const msg of msgs) {
    const next = step(game, model, msg);

    model = next.model;
    effects.push(...next.effects);
  }

  return { model, effects };
};

/** Ticks that add up to some seconds, sixty a second, with the direction keys held one way or not at all. */
export const ticks = (seconds: number, axis: Point = { x: 0, y: 0 }): Tick[] =>
  Array.from({ length: Math.round(seconds * 60) }, () => ({ type: "tick", dt: 1 / 60, axis }));

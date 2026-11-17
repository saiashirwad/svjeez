import { game, run, ticks, type Input, type World } from "@svjeez/play";

const world: World = { svg: "<svg/>", width: 100, height: 100, solids: [] };

interface Model {
  readonly seconds: number;
}

export const clock = game({
  world,
  keys: { reset: ["KeyR"] },
  init: (): Model => ({ seconds: 0 }),
  update: (model: Model, msg: Input<"reset">): Model =>
    msg.type === "tick"
      ? { seconds: model.seconds + msg.dt }
      : msg.type === "press"
        ? { seconds: 0 }
        : model,
  view: (model) => ({ camera: { x: 50, y: 50 }, sprites: [], hud: model.seconds }),
});

export const after: number = run(clock, ticks(2)).model.seconds;

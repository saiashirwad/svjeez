import assert from "node:assert/strict";
import { game, run, sheet, ticks } from "@svjeez/play";
import { jsx } from "svjeez/jsx-runtime";

const world = { svg: "<svg/>", width: 100, height: 100, solids: [] };

const clock = game({
  world,
  keys: { reset: ["KeyR"] },
  init: () => ({ seconds: 0 }),
  update: (model, msg) =>
    msg.type === "tick"
      ? { seconds: model.seconds + msg.dt }
      : msg.type === "press"
        ? { seconds: 0 }
        : model,
  view: (model) => ({ camera: { x: 50, y: 50 }, sprites: [], hud: model.seconds }),
});

const { model } = run(clock, [...ticks(2), { type: "press", action: "reset" }, ...ticks(1)]);

assert.ok(Math.abs(model.seconds - 1) < 1e-9);

const dot = sheet({ width: 10, height: 10, anchor: { x: 5, y: 5 }, duration: 1 }, [
  ["on", jsx("circle", { cx: 5, cy: 5, r: 4 })],
]);

assert.match(dot.svg, /data-state="on"/);

console.log(`ran a game for ${model.seconds.toFixed(1)}s and rendered a sheet`);

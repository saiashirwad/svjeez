# @svjeez/play

Small games on [svjeez](https://www.npmjs.com/package/svjeez) scenes. svjeez draws the world and every sprite; this package plays them. A game is a model, one pure function that changes it, and one pure function that says what is on screen. The runtime sends the keys and the clock in, and draws what comes out.

[Mossbell](https://github.com/saiashirwad/svjeez/tree/main/examples/mossbell), a small farming game, is built on it.

## Install

```sh
npm i @svjeez/play svjeez
```

## Use

```tsx
import { game, mount, sheet, terrainOf, walk, type Input } from "@svjeez/play";

const hero = sheet({ width: 48, height: 64, anchor: { x: 24, y: 60 }, duration: 6 }, [
  ["idle", <Hero gait="idle" />],
  ["walk", <Hero gait="walk" />],
]);

interface Model {
  readonly at: Point;
  readonly walking: boolean;
  readonly coins: number;
}

const valley = game({
  world,                                  // what render() returned, plus solids
  keys: { act: ["KeyE", "Space"] },
  init: (): Model => ({ at: { x: 100, y: 100 }, walking: false, coins: 0 }),

  update(model: Model, msg: Input<"act">, world) {
    if (msg.type === "tick") {
      const by = { x: msg.axis.x * 120 * msg.dt, y: msg.axis.y * 120 * msg.dt };

      return { ...model, at: walk(model.at, by, terrainOf(world)), walking: by.x !== 0 || by.y !== 0 };
    }

    return msg.type === "press" ? { ...model, coins: model.coins + 1 } : model;
  },

  view: (model) => ({
    camera: model.at,
    sprites: [{ key: "hero", sheet: hero, state: model.walking ? "walk" : "idle", at: model.at }],
    hud: { coins: model.coins },
  }),
});

mount(valley, document.querySelector("#game")!, { view: { width: 860, height: 540 } });
```

## The parts

- `sheet(options, states)` renders named states into one scene: a sprite sheet with no pixels. A sprite shows one state at a time, and each state's motions loop. `memo(make, nameOf)` keeps one sheet per input, since a view runs every frame.
- A **world** is `{ svg, width, height, solids, grid? }`, where `svg` is a rendered scene that marks its layers with `data-layer`: `ground`, `things` and `effects`. Children of `things` carry `data-y`, where they meet the ground, so sprites sort among them and walk behind trees. A game adds its own fields: places, plots, doors.
- `update(model, msg, world)` returns the next model, or `[model, effects]`. The runtime sends `tick` (with `dt` and the direction the arrow keys or WASD point), `press` (an action from `keys`) and `point` (a click on the world). Anything else is a message of your own, sent by the hud.
- **Effects** are what an update cannot do itself: `flash` plays a sheet once at a point, `store` keeps a string in the browser.
- `view(model, world)` returns a frame: the `camera`, the `sprites` by key, `patches` of color on the ground, the world's `time`, and `hud` data. With `time`, the world's own motions show that moment, so day and night follow the model and stop when the game does.
- `mount(game, host, { view, hud })` plays it. `hud(host, send)` builds the page around the world once and returns a function that paints a frame's `hud`.
- `walk(from, by, terrain)` slides along solids, `within(area, point)` tests a square, and `roll(seed)` is a pure random number with the next seed, so a model carries its own luck.

## Playing without a page

`update` and `view` are pure, so a test plays the game with no browser:

```ts
import { run, ticks } from "@svjeez/play";

const { model, effects } = run(valley, [...ticks(2, { x: 1, y: 0 }), { type: "press", action: "act" }]);

expect(model.coins).toBe(1);
expect(valley.view(model, valley.world).sprites[0]?.state).toBe("walk");
```

`run(game, msgs, from?)` sends messages in order and returns the model and every effect asked for. `ticks(seconds, axis?)` is that much time at sixty ticks a second. The same messages always give the same model.

## Pixel art

Give a sheet and the world a `grid`, the side of one art pixel in world px. Sprites then stand only on whole pixels, and the runtime zooms only to sizes that keep every pixel square.

## Limits

The runtime draws into the page as SVG, which suits a few hundred moving parts, not thousands. There is no sound, no physics beyond `walk`, and no pathfinding.

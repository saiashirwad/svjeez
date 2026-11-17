# Games with @svjeez/play

`@svjeez/play` is a separate package: `npm i @svjeez/play`. svjeez draws the world and every sprite; play runs them in a page. Unlike a scene, a game ships JavaScript: svjeez itself runs in the browser and renders sprites as they are needed.

A game is three things: a model, `update(model, msg, world)` that returns the next model, and `view(model, world)` that returns what is on screen as data. Both are pure. Never keep state anywhere but the model, and never touch the page from `update` or `view`.

```tsx
import { game, mount, sheet, terrainOf, walk, type Input } from "@svjeez/play";

const hero = sheet({ width: 48, height: 64, anchor: { x: 24, y: 60 }, duration: 6 }, [
  ["idle", <Hero gait="idle" />],
  ["walk", <Hero gait="walk" />],
]);

const valley = game({
  world,
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

## Sheets

`sheet({ width, height, anchor, duration, loop?, grid? }, states)` renders `[name, picture]` pairs into one scene with a group for each state. A sprite shows one state at a time. Write every motion in a state as a loop that divides `duration`, so a state can play forever. `anchor` is the point of the picture that stands on the sprite's position: the feet. Draw a sheet facing right and set `mirror` on the sprite for left.

A view runs every frame, so never call `sheet` in it directly. Wrap the maker in `memo(make, nameOf)`, which keeps one sheet per name:

```tsx
const villager = memo((look: Look) => sheet(options, poses(look)), (look) => JSON.stringify(look));
```

An effect is a sheet with `loop: false` and one state. Its motions play once.

## The world

A world is `{ svg, width, height, solids, grid? }`. `svg` is a rendered scene with three groups directly under the root: `<g data-layer="ground">` for what lies flat, `<g data-layer="things">` for what stands, and an empty `<g data-layer="effects">`. Give each child of `things` `data-y`, the y where it meets the ground, and sort them by it. Sprites are placed among them by their own y, so a villager walks behind a tree. `solids` are the boxes nobody walks through. Add your own fields for the game to read: places, plots, doors.

## Messages and effects

The runtime sends three messages. `{ type: "tick", dt, axis }` comes every frame, with the direction the arrow keys or WASD point, at most 1 long. `{ type: "press", action }` comes when a key in `keys` goes down. `{ type: "point", at }` is a click on the world. Any other message is your own, sent by the hud.

An update returns a model, or `[model, effects]`. `{ type: "flash", sheet, at, seconds }` plays an effect sheet at a point. `{ type: "store", key, value }` keeps a string in the browser. The model must be an object, not an array.

For luck, keep a seed in the model and call `roll(seed)`, which returns a number from 0 up to 1 and the next seed. `Math.random()` in an update breaks replay and tests.

## The frame

`view` returns `{ camera, sprites, patches?, time?, hud }`. Each sprite has a `key` that stays the same from frame to frame, a `sheet`, a `state`, where it stands (`at`) and `mirror`. A new key makes a new element, so a crop that should pop out of the soil at each stage gets its stage in its key. `patches` are flat rectangles on the ground. `time` is the world's clock in seconds: with it, the world's own motions show that moment, so a day and night cycle follows the model.

`hud` is any data. `mount(game, host, { view, hud })` takes `hud(host, send)`, which builds the page around the world once and returns a function that paints that data. It runs every frame, so change the page only where the data changed. Buttons there call `send` with a message of your own.

## Check a game without a page

```ts
import { run, ticks } from "@svjeez/play";

const { model, effects } = run(valley, [...ticks(2, { x: 1, y: 0 }), { type: "press", action: "act" }]);
```

`run(game, msgs, from?)` plays messages in order and returns the model and the effects. `ticks(seconds, axis?)` is that much time at sixty ticks a second. Write a test for each thing the game promises, such as "a planted, watered seed is ripe after twelve seconds". Then look at the game: frames of each sheet with `svjeez frames`, and the page itself.

## Pixel art

Pass `grid`, the side of one art pixel in world px, to each sheet and on the world. Sprites then stand on whole pixels and the runtime zooms only to sizes that keep pixels square. Use `ease.steps(n)` and `.set()` for motion. A loop inside a `<Clip>` cannot cut a `steps()` transition, so give such motions their own offsets.

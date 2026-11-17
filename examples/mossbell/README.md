# Mossbell

A small farming game drawn entirely with svjeez, to find out what the library needs before agents can make games with it.

```sh
cd examples && bun run mossbell   # then open the URL it prints
```

Walk with WASD or the arrow keys, or click the ground. `E` does whatever the hint says: plant, water, pull a crop, talk, pet a hen, sell at the bin, or open the wardrobe at the cottage door. `1` `2` `3` pick the seed.

## How it is put together

- `art/` is svjeez and nothing else: the villager, the world, crops, effects. `index.tsx` renders the world alone, so `examples/dist/mossbell.svg` is the same valley as one animated SVG with no script.
- `play/` is the part that could become a package. It knows nothing about farms:
  - `sheet()` renders named states into one scene, a sprite sheet with no pixels.
  - `createSprite()` shows one state at a time and moves it.
  - `createStage()` mounts a world, sorts sprites among its things by depth, plays one-shot effects and runs the camera.
  - `walk()` slides a walker along solids, and `createInput()` reads the keys.
- `game/` is Mossbell's own rules: the wardrobe, the plot, the neighbors and the HUD.

svjeez runs in the page. The wardrobe renders a new villager on every click, and each crop stage and effect is rendered when it is needed.

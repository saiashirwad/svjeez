# Mossbell

A small farming game drawn with svjeez and played by `@svjeez/play`. It is live at [seedy.texoport.in](https://seedy.texoport.in).

```sh
cd examples && bun run mossbell   # then open the URL it prints
```

Walk with WASD or the arrow keys, or click the ground. `E` does whatever the hint says: plant, water, pull a crop, talk, pet a hen, sell at the bin, or open the wardrobe at the cottage door. `1` `2` `3` pick the seed.

## How it is put together

- `art/` is svjeez and nothing else. `pixel.tsx` is a pixel canvas that compiles to rectangles, and the villager, the world, crops and effects are drawn on it. `index.tsx` renders the world alone, so `examples/dist/mossbell.svg` is the same valley as one animated SVG with no script.
- `game/rules.ts` is the whole game: a model, `update` and `view`, all pure. `examples/tests/mossbell.test.ts` plays it with no page.
- `game/sheets.tsx` turns the art into sheets, `game/hud.ts` and `game/wardrobe.ts` are the page around the world, and `game/main.ts` mounts it.

svjeez runs in the page. The wardrobe renders a new villager on every click, and each crop stage and effect is rendered the first time it is needed.

`bun run mossbell:deploy` builds it with Vite and deploys it through Alchemy (`alchemy.run.ts`).

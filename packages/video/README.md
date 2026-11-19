# @svjeez/video

Render a `svjeez` scene or SVG to MP4 or WebM using headless Chromium and Mediabunny.

```sh
npm i -D @svjeez/video@next svjeez@next playwright-core
npx playwright-core install chromium-headless-shell
```

## CLI

```sh
npx svjeez video scene.tsx --out scene.mp4 --loops 2 --scale 2
npx svjeez video scene.tsx --out scene.webm --background transparent
```

Use WebM with `--background transparent` to preserve alpha.

## Programmatic API

```ts
import { readFile, writeFile } from "node:fs/promises";
import { video } from "@svjeez/video";

const svg = await readFile("scene.svg", "utf8");
const { bytes } = await video(svg, { fps: 30, loops: 2, scale: 2 });
await writeFile("scene.mp4", bytes);
```

`video()` returns `{ bytes, format, codec, duration, frames }`. Available codecs depend on your Chromium build; switch codecs, use WebM, or point to a local Chrome executable if an encoder is unavailable.

[API reference](https://github.com/saiashirwad/svjeez/blob/next/packages/svjeez/skills/svjeez/references/render.md)

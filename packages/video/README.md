# @svjeez/video

Encode a svjeez scene to MP4 or WebM using headless Chromium and Mediabunny.

```sh
npm i -D @svjeez/video@next svjeez@next playwright-core
npx playwright-core install chromium-headless-shell
```

```sh
npx svjeez video scene.tsx --out scene.mp4 --loops 2 --scale 2
npx svjeez video scene.tsx --out scene.webm --background transparent
```

Pass a scene module or compiled SVG to the CLI. For a TypeScript scene on Node, follow the [core setup](https://github.com/saiashirwad/svjeez/tree/next#quickstart). Use WebM with `--background transparent` to keep alpha.

```ts
import { readFile, writeFile } from "node:fs/promises";
import { video } from "@svjeez/video";

const svg = await readFile("scene.svg", "utf8");
const { bytes } = await video(svg, { fps: 30, loops: 2, scale: 2 });
await writeFile("scene.mp4", bytes);
```

`video()` returns the encoded bytes, format, codec, duration and frame count. Codec availability depends on Chromium. Choose another codec, WebM or a Chrome executable if the requested encoder is unavailable.

[API reference](https://github.com/saiashirwad/svjeez/blob/next/packages/svjeez/skills/svjeez/references/render.md)

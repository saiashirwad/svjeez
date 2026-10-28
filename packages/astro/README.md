# @svjeez/astro

An Astro integration for [svjeez](https://www.npmjs.com/package/svjeez) scenes, built on [`@svjeez/vite`](https://www.npmjs.com/package/@svjeez/vite). Put a scene into a page, and the integration compiles it to an animated SVG with poster stills.

## Install

```sh
npx astro add @svjeez/astro
npm i -D svjeez
```

Posters need `playwright-core` and a Chromium build:

```sh
npm i -D playwright-core
npx playwright-core install chromium-headless-shell
```

## Use

Add the integration to `astro.config.mjs`:

```js
import svjeez from "@svjeez/astro";
import { defineConfig } from "astro/config";

export default defineConfig({ integrations: [svjeez()] });
```

Astro compiles a page's imports with the project's JSX settings, so a scene that a page imports needs svjeez's JSX. Start the scene with `/** @jsxImportSource svjeez */`, or set `"jsxImportSource": "svjeez"` in `tsconfig.json`.

Show a scene with `<Scene>`:

```astro
---
import { Scene } from "svjeez:astro";
import hero from "../scenes/hero.tsx";
---

<Scene scene={hero} />
```

`getScene()` gives the SVG's URL, size, text, and source while the page renders. Pass `posters` to get a still frame per color scheme:

```astro
---
import { getScene } from "svjeez:astro";
import hero from "../scenes/hero.tsx";

const image = getScene(hero, { posters: { scale: 2 } });
const { light, dark } = image.posters!;
---

<picture>
  <source srcset={dark} media="(prefers-color-scheme: dark)" />
  <img src={light} width={image.width} height={image.height} alt={image.desc} />
</picture>
```

A page can also import a scene with `?svjeez`, as described in `@svjeez/vite`.

The dev server serves each file under `/_svjeez/`, named by its content. The build writes them to the same path. Posters are cached in Astro's cache directory.

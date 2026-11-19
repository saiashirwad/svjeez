# @svjeez/astro

Compile and embed `svjeez` scenes as static SVG assets in Astro 7, with optional light and dark poster stills.

```sh
npm i -D @svjeez/astro@next svjeez@next
```

```js
// astro.config.mjs
import svjeez from "@svjeez/astro";
import { defineConfig } from "astro/config";

export default defineConfig({ integrations: [svjeez()] });
```

Import scenes with `?svjeez` and render them with `<Scene>`:

```astro
---
import Scene from "@svjeez/astro/Scene.astro";
import hero from "../scenes/hero.tsx?svjeez";
import board from "../scenes/board.film.tsx?svjeez";
---

<Scene scene={hero} />
<Scene scene={board} alt="The board, filmed" />
```

A `?svjeez` import is compiled by `@svjeez/vite` in its own JSX environment, so scene files need no pragma, and a [`@svjeez/dom` film](../vite/README.md#films) works the same way. `<Scene>` and `getScene(scene, { posters: { scale: 2 } })` from `@svjeez/astro/scene` also take a scene file's default export, imported without `?svjeez`; Astro compiles that file itself, so it needs `/** @jsxImportSource svjeez */`. Poster generation requires `playwright-core` and `npx playwright-core install chromium-headless-shell`.

[Example Astro app](https://github.com/saiashirwad/svjeez/tree/next/packages/astro/test/consumer) · [API reference](https://github.com/saiashirwad/svjeez/blob/next/packages/svjeez/skills/svjeez/references/web.md)

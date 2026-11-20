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

A `?svjeez` import is compiled by `@svjeez/vite` in its own JSX environment, so scene files need no pragma, and a [`@svjeez/dom` film](../vite/README.md#films) works the same way. `getScene(scene, { posters: { widths: [600, 1200] } })` from `@svjeez/astro/scene` takes a `?svjeez` import (films too) and returns its URL, size, markup, gzip size and posters. A scene with posters renders as a `<picture>` whose poster viewers get under reduced motion; `<Scene poster={{ sizes }}>` shows the poster first, for `player()` from `svjeez/page` to play. `<Scene>` and `getScene` also take a scene file's default export, imported without `?svjeez`; Astro compiles that file itself, so it needs `/** @jsxImportSource svjeez */`. Poster generation requires `playwright-core` and `npx playwright-core install chromium-headless-shell`.

[Example Astro app](https://github.com/saiashirwad/svjeez/tree/next/packages/astro/test/consumer) · [API reference](https://github.com/saiashirwad/svjeez/blob/next/packages/svjeez/skills/svjeez/references/web.md)

## Link previews

Put a card beside its page, as `_about.og.tsx` for `about.astro` (or `_default.og.tsx` in a folder as a fallback for pages beneath it): its default export is a scene (or, for a dynamic page, a function from `{ params, props, url }` to one), written with `ogScene` from [`@svjeez/og`](../og/README.md). The integration adds `og:image` and `twitter:image` tags to that page, rendered at build time. In `astro dev`, `/_og` shows every page with its card, file size and safe-zone overlays.

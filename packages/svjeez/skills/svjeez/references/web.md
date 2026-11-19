# Vite and Astro

Both compile a scene into an SVG asset in dev and at build time, with the same core the CLI uses, so `svjeez check` and `frames` see exactly what the page ships. A `?svjeez` import compiles the scene with svjeez's JSX whatever the app uses, so it runs with no pragma; for `tsc`, start scene files with `/** @jsxImportSource svjeez */` unless the project's `tsconfig.json` sets `"jsxImportSource": "svjeez"`.

## Vite (`@svjeez/vite`)

```ts
import svjeez from "@svjeez/vite";
import { defineConfig } from "vite";

export default defineConfig({ plugins: [svjeez()] });
```

Add `/// <reference types="@svjeez/vite/client" />` to `src/vite-env.d.ts`, then import a scene in app code:

```tsx
import hero from "./scenes/hero.tsx?svjeez";

<img src={hero.src} width={hero.width} height={hero.height} alt={hero.desc || hero.title} />;
```

The app receives a URL, the size and the scene's `title` and `desc` as accessible text (server code, such as SSR or an Astro page, also gets the markup as `svg`). The plugin compiles the scene in its own JSX environment and reloads when a scene dependency changes. A file that imports `@svjeez/dom/vite` is a `@svjeez/dom` film (`export default await film(component(Card, props), script, { cache: "states.json" })`): the same import films it with the nearest `vite.config.*` above it, again on change in dev, and from its states cache in a build; `cursor: true` draws the mouse the script moves. Add `&posters` to the query for light and dark WebP stills; configure them with `svjeez({ posters: { scale, quality, background } })`. Posters need `playwright-core` and `npx playwright-core install chromium-headless-shell`.

## Astro (`@svjeez/astro`, Astro 7)

```js
import svjeez from "@svjeez/astro";
import { defineConfig } from "astro/config";

export default defineConfig({ integrations: [svjeez()] });
```

```astro
---
import Scene from "@svjeez/astro/Scene.astro";
import hero from "../scenes/hero.tsx?svjeez";
---

<Scene scene={hero} />
```

`getScene(scene, { posters: { scale: 2 } })` from `@svjeez/astro/scene` (asset URL, size, accessible text, markup, gzip size and poster URLs, for custom markup) takes a `?svjeez` import, film files included. `<Scene>` and `getScene` also take a scene's default export imported without `?svjeez`; Astro compiles that file, so it needs the pragma. Import a film with `?svjeez`, never directly.

## Scrubbing and stills

The compiled SVG is the same file `svjeez svg` writes ([render.md](render.md)): use it in `<img>`, or inline for scroll-driven playback with `seek()` and `restyle()` from `svjeez/page`.

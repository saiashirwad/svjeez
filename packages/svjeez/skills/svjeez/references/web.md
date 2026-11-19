# Vite and Astro

Both compile a scene into an SVG asset at build time, with the same core the CLI uses, so `svjeez check` and `frames` see exactly what the page ships. Scene files start with `/** @jsxImportSource svjeez */` unless the project's `tsconfig.json` sets `"jsxImportSource": "svjeez"`.

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

The app receives a URL, the size and the scene's `title` and `desc` as accessible text. The plugin compiles the scene in its own JSX environment and reloads when a scene dependency changes. Add `&posters` to the query for light and dark WebP stills; configure them with `svjeez({ posters: { scale, quality, background } })`. Posters need `playwright-core` and `npx playwright-core install chromium-headless-shell`.

## Astro (`@svjeez/astro`, Astro 7)

```js
import svjeez from "@svjeez/astro";
import { defineConfig } from "astro/config";

export default defineConfig({ integrations: [svjeez()] });
```

```astro
---
import Scene from "@svjeez/astro/Scene.astro";
import hero from "../scenes/hero.tsx";
---

<Scene scene={hero} />
```

For custom markup or poster URLs, `getScene(scene, { posters: { scale: 2 } })` from `@svjeez/astro/scene` returns the asset URL, the size, the accessible text and the poster URLs.

## Scrubbing and stills

The compiled SVG is the same file `svjeez svg` writes ([render.md](render.md)): use it in `<img>`, or inline for scroll-driven playback with `seek()` and `restyle()` from `svjeez/page`.

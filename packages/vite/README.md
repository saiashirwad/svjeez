# @svjeez/vite

Compile `svjeez` scenes into static SVG assets during Vite dev and build.

```sh
npm i -D @svjeez/vite@next svjeez@next
```

```ts
// vite.config.ts
import svjeez from "@svjeez/vite";
import { defineConfig } from "vite";

export default defineConfig({ plugins: [svjeez()] });
```

Add `/// <reference types="@svjeez/vite/client" />` to `src/vite-env.d.ts`, then import scenes with `?svjeez`:

```tsx
import hero from "./scenes/hero.tsx?svjeez";

<img src={hero.src} width={hero.width} height={hero.height} alt={hero.desc || hero.title} />;
```

- Compiles scenes in their own JSX environment (`svjeez`), so a React app needs no pragma to run them; for `tsc`, start scene files with `/** @jsxImportSource svjeez */` when the app's tsconfig uses React's JSX.
- Hot reloads when the scene or anything it imports changes.
- Append `&posters` to generate light and dark WebP stills (configure via `svjeez({ posters: { scale, quality, background } })`; requires `playwright-core` and `chromium-headless-shell`).

## Films

A file that imports `@svjeez/dom/vite` is a [`@svjeez/dom`](../dom/README.md) film, and the same import films it:

```tsx
// card.film.tsx
import { film } from "@svjeez/dom";
import { component } from "@svjeez/dom/vite";
import Card from "./Card.tsx";

export default await film(component(Card, { title: "Ship it", done: false }), async ({ snap, update }) => {
  await snap("todo");
  await update({ done: true });
  await snap("done", { over: 0.4 });
}, { cache: "card.states.json" });
```

```tsx
import card from "./card.film.tsx?svjeez";
```

The film runs through the nearest `vite.config.*` above it (your React or Svelte plugins), in dev and in `vite build`. With `cache`, a build reuses the recorded states while the sources are unchanged, so it needs no Chromium; in dev, editing the film, the component or the app films it again. Install `@svjeez/dom` and `playwright-core`.

[Example app](https://github.com/saiashirwad/svjeez/tree/next/packages/vite/test/app) · [API reference](https://github.com/saiashirwad/svjeez/blob/next/packages/svjeez/skills/svjeez/references/web.md)

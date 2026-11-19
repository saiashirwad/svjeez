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

- Compiles scenes in an isolated JSX environment with hot reload on dependency changes.
- Append `&posters` to generate light and dark WebP stills (configure via `svjeez({ posters: { scale, quality, background } })`; requires `playwright-core` and `chromium-headless-shell`).

[Example app](https://github.com/saiashirwad/svjeez/tree/next/packages/vite/test/app) · [API reference](https://github.com/saiashirwad/svjeez/blob/next/packages/svjeez/skills/svjeez/references/web.md)

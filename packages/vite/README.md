# @svjeez/vite

Compile svjeez scenes into SVG assets when a Vite app builds. The app receives a URL, dimensions and accessible text.

```sh
npm i -D @svjeez/vite@next svjeez@next
```

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

The plugin compiles the scene in its own JSX environment and reloads when a scene dependency changes. Add `&posters` for light and dark WebP stills. Configure them with `svjeez({ posters: { scale, quality, background } })`. Posters need `playwright-core` and `npx playwright-core install chromium-headless-shell`.

[Example app](https://github.com/saiashirwad/svjeez/tree/next/packages/vite/test/app)

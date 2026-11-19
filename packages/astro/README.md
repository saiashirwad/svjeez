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

Add `/** @jsxImportSource svjeez */` at the top of scene files imported by Astro pages, then render with `<Scene>`:

```astro
---
import Scene from "@svjeez/astro/Scene.astro";
import hero from "../scenes/hero.tsx";
---

<Scene scene={hero} />
```

Use `getScene(scene, { posters: { scale: 2 } })` from `@svjeez/astro/scene` for custom markup or poster URLs. Poster generation requires `playwright-core` and `npx playwright-core install chromium-headless-shell`.

[Example Astro app](https://github.com/saiashirwad/svjeez/tree/next/packages/astro/test/consumer) · [API reference](https://github.com/saiashirwad/svjeez/blob/next/packages/svjeez/skills/svjeez/references/web.md)

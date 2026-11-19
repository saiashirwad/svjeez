# @svjeez/astro

Embed a svjeez scene in Astro 7. The integration compiles it to an SVG asset and can generate light and dark posters.

```sh
npm i -D @svjeez/astro@next svjeez@next
```

```js
import svjeez from "@svjeez/astro";
import { defineConfig } from "astro/config";

export default defineConfig({ integrations: [svjeez()] });
```

Start scene files imported by a page with `/** @jsxImportSource svjeez */`. Then use the supplied component:

```astro
---
import Scene from "@svjeez/astro/Scene.astro";
import hero from "../scenes/hero.tsx";
---

<Scene scene={hero} />
```

Use `getScene(scene, { posters: { scale: 2 } })` from `@svjeez/astro/scene` for custom markup or poster URLs. Posters need `playwright-core` and `npx playwright-core install chromium-headless-shell`.

[Example Astro app](https://github.com/saiashirwad/svjeez/tree/next/packages/astro/test/consumer)

[API reference](https://github.com/saiashirwad/svjeez/blob/next/packages/svjeez/skills/svjeez/references/web.md)

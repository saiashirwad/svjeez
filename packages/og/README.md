# @svjeez/og

Link-preview cards for `svjeez`: write an `og:image` as a scene, then render it to a JPEG or WebP in headless Chromium. Framework-free; [`@svjeez/astro`](../astro/README.md) is the Astro glue.

```sh
npm i svjeez@next @svjeez/og@next playwright-core
npx playwright-core install chromium-headless-shell
```

```tsx
// about.og.tsx: a card is a scene of the link-preview size (1200 × 630), complete at frame 0
import { ogScene } from "@svjeez/og";

export default ogScene({ title: "About", desc: "…", theme }, () => <Group>{/* your JSX */}</Group>);
```

```ts
import { ogResponse, renderOg } from "@svjeez/og/render";

const { bytes, type, width, height } = await renderOg(card, { format: "jpeg", quality: 0.9 });

// or, in an endpoint or route handler: export const GET = () => ogResponse(card);
```

`renderOg` takes a scene or SVG markup and an optional `time`, `scheme`, `format` (`"jpeg"` or `"webp"`), `quality` and `scale`. Renders are queued a few at a time, and kept in a folder when `settings.cache` is set. The browser closes itself after its last picture. Rendering needs Chromium, so use it at build time or in a Node route, not on an edge runtime.

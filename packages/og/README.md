# @svjeez/og

Link-preview cards for `svjeez`: write an `og:image` as a scene, then render it to a PNG, JPEG or WebP in headless Chromium (or a custom rasterizer). Framework-free; [`@svjeez/astro`](../astro/README.md) is the Astro glue.

```sh
npm i svjeez@next @svjeez/og@next playwright-core
npx playwright-core install chromium-headless-shell
```

```tsx
// about.og.tsx: a card is a scene of the link-preview size (1200 × 630 by default), complete at frame 0
import { ogScene } from "@svjeez/og";

export default ogScene({ title: "About", desc: "…", theme }, () => <Group>{/* your JSX */}</Group>);
```

```ts
import { ogResponse, renderOg } from "@svjeez/og/render";

const { bytes, type, width, height } = await renderOg(card, { format: "png" });

// or, in an endpoint or route handler: export const GET = () => ogResponse(card);
```

`renderOg` takes a scene or SVG markup and an optional `time`, `scheme`, `format` (`"png"`, `"jpeg"` or `"webp"`), `quality`, `scale` and `render` (a custom rasterizer, or set globally on `settings.render`). Renders are queued a few at a time, and kept in a folder when `settings.cache` is set. `ogResponse` sets `Content-Type`, a content-addressed `ETag` and `Cache-Control` (all overridable via `headers`). `renderStill(scene)` takes a PNG of a scene at its still moment (the one it holds, else 72% in), transparent and at 2x by default, to place inside a card with `picture()`. Pass `time` in seconds to take it at another moment.

The default renderer needs Chromium, so use it at build time or in a Node route (or supply a custom `render` function such as `resvg` for edge runtimes).

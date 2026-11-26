# `@svjeez/astro`

Astro 7+ integration built on `@svjeez/vite`: embed scenes with `<Scene>` (animated SVG + reduced-motion/dark posters + optional `player()` hooks) and generate per-route `og:image` meta tags from `_<page>.og.tsx` card scenes.

## Setup

```sh
npm install @svjeez/astro svjeez
```

Peers: `astro >=7`, `svjeez` (pulls `@svjeez/vite` and `@svjeez/og`; posters and OG cards need `playwright-core` + Chromium).

`astro.config.mjs`:

```js
import svjeez from "@svjeez/astro";
import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://example.com",
  integrations: [svjeez()],
});
```

- Set `site` so `og:image` URLs are absolute for social crawlers.
- The integration injects `@svjeez/astro/client` types automatically (covers `*?svjeez*` imports).

## Mental model

- **Two ways to pass a scene to `<Scene>`:**
  1. `import hero from "../scene.tsx?svjeez&posters"` (emitted to `/_astro/` on build).
  2. `import raw from "../scene"` (compiled in frontmatter and written to `/_svjeez/` at `astro:build:done`).
- **`<Scene>` output modes:**
  - Without posters → `<img src width height alt>` (`alt` defaults to `scene.desc || scene.title`).
  - With posters (`?svjeez&posters` or `getScene(raw, { posters })`), no `poster` prop → `<picture>` serving light/dark WebP stills under `prefers-reduced-motion: reduce`, and the animated SVG otherwise.
  - With posters AND `poster` (`true` or `{ sizes }`) → `<picture>` showing the poster initially with `data-svjeez='{"live":...,"posters":...}'` for `player()` from `svjeez/page` to swap in the live SVG on hover/visibility.
- **Automatic `og:image` by file convention:** Place `_<page>.og.tsx` next to `<page>.astro` (or `_default.og.tsx` in that folder or a parent inside `src/pages`). The leading `_` keeps Astro from routing it. Default-export an `OgCard` (`Scene` or `({ params, props, url }) => Scene | Promise<Scene>`, usually built with `ogScene` from `@svjeez/og`). Middleware rasterizes it once and injects `og:image`, `og:image:secure_url`, `og:image:type/width/height/alt`, `twitter:card`, and `twitter:image` before `</head>`—unless the page already contains `property="og:image"`. Your layout still provides `og:title` and `og:description`.
- **Explicit `<Og>` & dev gallery:** Use `<Og scene={card} still={{ format: "png", time: 1.5 }} alt="..." />` in `<head>` to override convention lookup. In dev, visit `/_og` to preview all route cards.

## API map

| Entry | Exports |
|---|---|
| `@svjeez/astro` | default `svjeez()` Astro integration |
| `@svjeez/astro/Scene.astro` | Props: `scene: SceneModule \| SceneSource`, `alt?`, `poster?: true \| { sizes?: string }`, plus `<img>` attributes |
| `@svjeez/astro/Og.astro` | Props: `scene: SceneSource`, `alt?`, `still?: StillOptions` |
| `@svjeez/astro/scene` | `getScene`, `getStill` (re-exported from `@svjeez/vite/scene`) |
| `@svjeez/astro/og` | Types `OgCard<Props>`, `OgContext<Props>` |

## Verified snippet

Page (`src/pages/index.astro`):

```astro
---
import Scene from "@svjeez/astro/Scene.astro";
import imported from "../scene.tsx?svjeez&posters";
import raw from "../scene";
---
<html lang="en">
  <head><title>Home</title></head>
  <body>
    <Scene scene={imported} />
    <Scene scene={raw} />
    <Scene scene={imported} poster={{ sizes: "320px" }} />
  </body>
</html>
```

Card beside the page (`src/pages/_index.og.tsx`, checkable with `svjeez check`):

```tsx
/** @jsxImportSource svjeez */
import { google } from "@svjeez/fonts";
import { ogScene } from "@svjeez/og";
import { Group, Shape, Text, ease, span, tokens, track } from "svjeez";

const geist = await google("Geist", { weight: 600 });
const theme = tokens({
  light: { background: "#FFFFFF", text: "#111111" },
  dark: { background: "#090A0C", text: "#F5F5F7" },
});
const t = span(0, 2);
const bob = track(0).to(-6, t, ease.inOut).to(0, t.next(2), ease.inOut).loop(4);

export default ogScene({ theme, title: "Home card", desc: "Home page link preview." }, (canvas) => (
  <Group>
    <Shape geometry={canvas.rect} fill={theme.background} />
    <Text font={geist} size={96} at={[600, 315]} anchor="center" fill={theme.text} motion={{ offset: bob.map((y): [number, number] => [0, y]) }}>
      Home
    </Text>
  </Group>
));
```

## Gotchas

- Page gets no `og:image` tags → Check that `_<page>.og.tsx` or `_default.og.tsx` lives inside `src/pages`, and remove any manual `property="og:image"` tag (which causes middleware to skip injection).
- `<Scene poster>` renders a plain `<img>` → Posters must be generated first via `?svjeez&posters` or `getScene(raw, { posters })`.
- `og:image` URL is relative → Set `site: "https://..."` in `astro.config.mjs`.
- `svjeez check` fails on a function card (`({ params, url }) => ogScene(...)`) with `Cannot destructure property 'params'` → Check the returned scene in a plain scene file.
- `static` warning on an `_index.og.tsx` card → Add a subtle returning loop (like the 4 s `bob` above) so frame 0 is complete and the scene is not static.

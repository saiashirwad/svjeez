# `@svjeez/vite`

Vite 8+ plugin that compiles `import scene from "./scene.tsx?svjeez"` (or a `@svjeez/dom` film) at build/dev time into static animated SVG assets (+ optional WebP posters) with zero svjeez runtime in the browser bundle.

## Setup

```sh
npm install -D @svjeez/vite svjeez
```

Peers: `vite >=8`, `svjeez`; optional `playwright-core` + Chromium (for `&posters` / `getStill`), `@svjeez/dom` (for `.film.tsx`).

`vite.config.ts`:

```ts
import svjeez from "@svjeez/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [svjeez({ posters: { scale: 0.5 } })],
});
```

Add `/// <reference types="@svjeez/vite/client" />` (or `"types": ["@svjeez/vite/client"]` in `tsconfig.json`) so `?svjeez` imports type-check. The plugin's scene runner configures JSX with `importSource: "svjeez"` automatically, even alongside `@vitejs/plugin-react`.

## Mental model

- **The import is an asset descriptor (`SceneModule`), not a component:** `{ src, width, height, title, desc, posters?, svg? }`. Render it with `<img src={scene.src} width={scene.width} height={scene.height} alt={scene.desc || scene.title} />`.
- **Query flags:** `?svjeez`, plus `&posters` and/or `&inline` in any order. An unknown flag throws an error naming the valid ones.
  - `&posters` renders light and dark WebP stills at the scene's still moment (`still`, else 72% of duration), returning `posters: { light: Poster[], dark: Poster[] }`.
  - `&inline` embeds prefixed SVG markup in `svg` (default prefix `s<hash>`, override via `export const prefix = "mine"` in the scene file) so multiple inline SVGs never collide. Films and raw SVG-string exports cannot be inlined.
  - Plain `?svjeez` includes `svg` only in server code (SSR / Astro frontmatter), never in the client bundle.
- **Dev vs build output:**
  - Dev: serves `/_svjeez/<hash>.svg` (`Cache-Control: no-store`), renders posters on first request, and triggers `full-reload` when the scene or its imports change.
  - Build: emits hashed `.svg` and `-light-<w>.webp` / `-dark-<w>.webp` files into `assets/`.
- **Films & Shaders:** Files importing `@svjeez/dom/vite` run automatically as films; `<Shader>` scenes load `unplugin-typegpu` automatically when `typegpu` and `unplugin-typegpu` are installed.
- **Server helpers (`@svjeez/vite/scene`):** `getScene(source, { posters?, prefix? })` and `getStill(source, StillOptions)` register `/_svjeez/` assets for SSR/Astro; call `writeScenes(distUrl)` at build end when not using `@svjeez/astro`.

## API map

| Entry | Exports |
|---|---|
| `@svjeez/vite` | default `svjeez({ posters?, cacheDir? })`, `ROUTE` (`"/_svjeez/"`), `writeScenes(dir)` |
| `@svjeez/vite/scene` | `getScene(source, opts?)`, `getStill(source, opts?)`, types `SceneModule`, `SceneSource`, `SceneImage`, `StillImage`, `Poster`, `PosterOptions`, `StillOptions` |
| `@svjeez/vite/client` | Ambient module declarations for `*?svjeez`, `*?svjeez&inline`, `*?svjeez&posters` |

## Verified snippet

```ts
/// <reference types="@svjeez/vite/client" />
import hero from "./scene.tsx?svjeez&posters";

document.body.innerHTML = `<picture>
  <source srcset="${hero.posters.dark[0]!.src}" media="(prefers-reduced-motion: reduce) and (prefers-color-scheme: dark)">
  <source srcset="${hero.posters.light[0]!.src}" media="(prefers-reduced-motion: reduce)">
  <img src="${hero.src}" width="${hero.width}" height="${hero.height}" alt="${hero.desc || hero.title}">
</picture>`;
```

## Gotchas

- `TS2307: Cannot find module './scene.tsx?svjeez'` → Add `/// <reference types="@svjeez/vite/client" />`.
- `[plugin svjeez] TypeError: scene is not a function` → Default-export a `scene()`, a function returning one, or an SVG string from the imported file.
- `getScene() got the ?svjeez import … without its markup` → Call `getScene()` in server/SSR code or import with `?svjeez&inline`.
- `is a film / exports SVG markup, which can't take a prefix` → Drop `&inline` and render via `<img src={scene.src}>`.
- `imports @svjeez/dom/vite … but @svjeez/dom did not load` → Install `@svjeez/dom`.

# Vite and Astro

Both compile a scene into an SVG asset in dev and at build time, with the same core the CLI uses, so `svjeez check` and `frames` see exactly what the page ships. A `?svjeez` import compiles the scene with svjeez's JSX whatever the app uses, so it runs with no pragma; for `tsc`, start scene files with `/** @jsxImportSource svjeez */` unless the project's `tsconfig.json` sets `"jsxImportSource": "svjeez"`.

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

The app receives a URL, the size and the scene's `title` and `desc` as accessible text (server code, such as SSR or an Astro page, also gets the markup as `svg`). The plugin compiles the scene in its own JSX environment and reloads when a scene dependency changes. A file that imports `@svjeez/dom/vite` is a `@svjeez/dom` film (`export default await film(component(Card, props), script, { cache: "states.json" })`): the same import films it with the nearest `vite.config.*` above it, again on change in dev, and from its states cache in a build; `cursor: true` draws the mouse the script moves. Add `&posters` to the query for light and dark WebP stills, each a list of `{ src, width }` from narrowest to widest; configure them with `svjeez({ posters: { scale, widths, quality, background } })` (`widths` makes one per width, for a `srcset`). Add `&inline` (`?svjeez&inline`) and the module also carries the markup as `svg` in the browser bundle, for inline SVG that `mount()` or `attach()` can drive (reference `@svjeez/vite/client` types cover it). Each inline scene gets a prefix of its own from its file path, so several share a page; a scene exporting `prefix` uses that. Posters need `playwright-core` and `npx playwright-core install chromium-headless-shell`.

## Astro (`@svjeez/astro`, Astro 7)

```js
import svjeez from "@svjeez/astro";
import { defineConfig } from "astro/config";

export default defineConfig({ integrations: [svjeez()] });
```

```astro
---
import Scene from "@svjeez/astro/Scene.astro";
import hero from "../scenes/hero.tsx?svjeez";
---

<Scene scene={hero} />
```

`getScene(scene, { posters: { widths: [600, 1200] } })` from `@svjeez/astro/scene` (asset URL, size, accessible text, markup, gzip size and posters, for custom markup) takes a `?svjeez` import, film files included. `<Scene>` and `getScene` also take a scene's default export imported without `?svjeez`; Astro compiles that file, so it needs the pragma. Import a film with `?svjeez`, never directly.

## Link previews

Put a card beside its page: `about.astro` takes `_about.og.tsx` (or `about.og.tsx`), whose default export is a scene, or `({ params, props, url }) => scene` for a dynamic page (`_[name].og.tsx` for `[name].astro`; type it `satisfies OgCard<Props>` from `@svjeez/astro/og`). The integration's middleware adds `og:image`, its size, type and alt (the scene's `desc`) and `twitter:image` to that page's `<head>`, drawing the card as a JPEG at build time. A page that writes its own `og:image` is left alone, and `<Og scene={card} />` from `@svjeez/astro/Og.astro` is the same thing as a component (`getStill(scene, { time, format, quality })` from `@svjeez/astro/scene` is the image without the tags).

Write the card with `ogScene({ title, desc, theme }, build)` from `@svjeez/og`: a `scene()` fixed at `OG_SIZE` (1200 × 630) with frame 0 held, built from small components of your own. `@svjeez/og` is framework-free: `renderOg(card)` and `ogResponse(card)` from `@svjeez/og/render` turn a card into a JPEG or a `Response` for an endpoint or route handler in any framework. In `astro dev`, `/_og` lists every page with the card it shares and flags a missing image or a wrong size.

## Posters and playing

A scene with posters (`?svjeez&posters`, or `getScene` with `posters`) is a `<picture>` in `<Scene>`: it plays, and viewers who asked for reduced motion get its poster. `<Scene scene poster={{ sizes }}>` shows the poster first (a dark `<source>`, a `srcset` and `sizes`) and writes the scene's URL and posters into the img's `data-svjeez`, for `player()` from `svjeez/page` to play:

```ts
import { hovered, player, seen } from "svjeez/page";

const scene = player(img, { look }); // look: (img) => ({ scheme, theme? }), what the scene must look like now
hovered(card)(scene);               // plays while the pointer rests on the card; seen() plays while it is on screen
addEventListener("themechange", () => scene.refresh()); // shows it again in a new scheme or palette
```

A player shows the poster, plays the plain SVG file, goes back to the poster on `stop()`, and keeps a playing scene's time when its look changes. When the look differs from the OS's scheme or the scene as built (Safari pins an `<img>` SVG to the OS's scheme; a palette is another `theme`), it plays a restyled copy instead. `img.dataset.state` is `"loading"`, `"live"` or `"still"`, for CSS. `player(img, { adopt: true })` is for an img that already plays its `src` from the HTML.

## Scrubbing and stills

The compiled SVG is the same file `svjeez svg` writes ([render.md](render.md)): use it in `<img>`, or inline for scroll-driven playback with `seek()` and `restyle()` from `svjeez/page`.

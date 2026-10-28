# @svjeez/vite

A Vite plugin for [svjeez](https://www.npmjs.com/package/svjeez) scenes. Import a scene with `?svjeez`, and the plugin compiles it while the app builds. The page gets the SVG's URL and size. The browser bundle never contains svjeez or the scene's code.

The plugin works with any framework that builds with Vite, such as React, Svelte, Vue, or Solid.

## Install

```sh
npm i -D @svjeez/vite svjeez
```

Posters need `playwright-core` and a Chromium build:

```sh
npm i -D playwright-core
npx playwright-core install chromium-headless-shell
```

## Use

Add the plugin to `vite.config.ts`:

```ts
import svjeez from "@svjeez/vite";
import { defineConfig } from "vite";

export default defineConfig({ plugins: [svjeez({ posters: { scale: 2 } })] });
```

Add the types to a declaration file, such as `src/vite-env.d.ts`:

```ts
/// <reference types="@svjeez/vite/client" />
```

Import a scene. Its default export is a function that returns `render()`'s SVG string.

```tsx
import hero from "./scenes/hero.tsx?svjeez";

<img src={hero.src} width={hero.width} height={hero.height} alt={hero.desc || hero.title} />;
```

An import gives `{ src, width, height, title, desc }`. `title` and `desc` come from the SVG's `<title>` and `<desc>`.

Add `&posters` to get a still frame per color scheme, for example as a fallback for `prefers-reduced-motion`:

```tsx
import hero from "./scenes/hero.tsx?svjeez&posters";

<picture>
  <source srcSet={hero.posters.dark} media="(prefers-color-scheme: dark)" />
  <img src={hero.posters.light} width={hero.width} height={hero.height} alt={hero.desc} />
</picture>;
```

## How it works

- The scene runs in Node, in a Vite environment of its own. That environment compiles JSX as svjeez, so a scene needs no JSX pragma, even in a React app. It resolves imports the way the app's server environment does, with the app's aliases.
- The dev server serves each file under `/_svjeez/`. It reloads the page when the scene, or any file the scene imports, changes.
- The build emits the SVG and the posters as assets, so they get hashed names in the build output.
- Posters render in headless Chromium and are cached in Vite's cache directory, under `svjeez/`.

## Options

| Option | Description |
| --- | --- |
| `posters.scale` | Device pixels per SVG pixel. Default `1`. |
| `posters.quality` | WebP quality from 0 to 1. Default `0.8`. |
| `posters.background` | CSS background behind the scene. Default `Canvas`, the page color of the scheme. |
| `cacheDir` | Where posters are kept between runs. Default `svjeez/` in Vite's cache directory. |

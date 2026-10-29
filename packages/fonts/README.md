# @svjeez/fonts

Google Fonts for [svjeez](https://www.npmjs.com/package/svjeez) scenes. Give it a family name and get back a svjeez `Font` that you can measure with, draw as glyph paths, or embed. The scene is still one file that loads nothing at view time.

<p align="center">
  <a href="https://github.com/saiashirwad/svjeez/tree/main/examples/fonts"><img src="https://raw.githubusercontent.com/saiashirwad/svjeez/main/examples/dist/fonts.svg" width="520" alt="The word Wave! draws on letter by letter as outlines, then fills. Below it, two lines of real text in an embedded font, centered by measuring them, with a rule that grows to the measured width." /></a>
  <br /><sub>Archivo Black and ABeeZee, loaded by name from Google Fonts</sub>
</p>

## Install

```sh
npm i -D @svjeez/fonts svjeez
```

## Use

```tsx
import { google } from "@svjeez/fonts";

const display = await google("Archivo Black");
const mono = await google("JetBrains Mono", { fallback: ["monospace"], ligatures: false });
const body = await google.family("ABeeZee", [400, { weight: 400, style: "italic" }]);
```

`google(family, options)` takes the options of svjeez's `font()` except `family`, `weight` and `style`, which it sets. `weight` defaults to 400 and `style` to `"normal"`. `google.family(family, faces, options)` loads several faces and groups them with `font.family()`. A face is a weight, or a `{ weight, style }` object.

Google serves a static TTF at the exact weight, even for a variable font, so `measure()`, `path()` and `<Glyphs>` work on it.

## Cache

Each file is downloaded once and kept in a folder shared by every project on the machine: `$SVJEEZ_FONTS_CACHE`, else `$XDG_CACHE_HOME/svjeez/fonts`, else `~/.cache/svjeez/fonts`. A cached font needs no network. Files are written through a temporary name and renamed, so an interrupted or parallel build never leaves a partial file.

## Errors

An unknown family or an unavailable weight makes Google answer HTTP 400. The error names the family and weight and carries Google's message. With no network and nothing cached, the error names the family and the cache path.

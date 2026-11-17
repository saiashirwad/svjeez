# @svjeez/fonts

Load Google Fonts by family name for measuring text, drawing glyph outlines or embedding font data in an SVG.

```sh
npm i -D @svjeez/fonts svjeez
```

```ts
import { google } from "@svjeez/fonts";

const display = await google("Archivo Black");
const mono = await google("JetBrains Mono", {
  fallback: ["monospace"],
  ligatures: false,
});
const body = await google.family("Geist", [{ weight: 400 }, { weight: 600 }]);
```

Pass a font to svjeez text, `Glyphs` or a component that accepts `font`. Weight defaults to 400 and style to normal. `google.family()` groups faces so text can choose a weight or style.

A build downloads a face on cache miss. Set `SVJEEZ_FONTS_CACHE` to share a cache in CI. It otherwise uses `$XDG_CACHE_HOME/svjeez/fonts` or `~/.cache/svjeez/fonts`.

[API reference](https://github.com/saiashirwad/svjeez/blob/main/packages/svjeez/skills/svjeez/references/images-fonts.md)

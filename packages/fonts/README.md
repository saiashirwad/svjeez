# @svjeez/fonts

Load Google Fonts by name at build time. Used by `svjeez` to measure text accurately, draw glyph outlines, and embed subset font data into the output SVG.

```sh
npm i -D @svjeez/fonts@next svjeez@next
```

```ts
import { google } from "@svjeez/fonts";

const display = await google("Archivo Black");
const mono = await google("JetBrains Mono", { fallback: ["monospace"], ligatures: false });
const body = await google.family("Geist", [{ weight: 400 }, { weight: 600 }]);
```

- Pass any loaded font or family to `<Text font={...}>`.
- `weight` defaults to `400` and `italic` to `false`. `google.family()` groups faces so `<Text>` and `<Run>` can switch weights or italics.
- Faces are cached on disk (`$XDG_CACHE_HOME/svjeez/fonts` or `~/.cache/svjeez/fonts`). Set `SVJEEZ_FONTS_CACHE` to share the cache in CI.

[API reference](https://github.com/saiashirwad/svjeez/blob/next/packages/svjeez/skills/svjeez/references/fonts-pictures.md)

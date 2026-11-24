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
- Google Fonts serves a TTF only to a script that sets its own user agent. Where it can't, as in StackBlitz, whose Node runs in the browser, Google serves WOFF2, and the face comes from Fontsource's TTF of the same font instead, with only its Latin characters.

## Handwriting

`@svjeez/fonts/handwriting` draws text as a pen would: a single-line SVG font (centerlines, not outlines) animated stroke by stroke.

```tsx
import { Lettering, casual, handwrite, strokeFont } from "@svjeez/fonts/handwriting";

const hand = await casual(); // or `strokeFont.load(new URL("./my-font.svg", import.meta.url))`

<Lettering font={hand} text="play with svjeez" width={420} y={128} from={0.3} ink="#222" />;

const { strokes, end } = handwrite(hand, "play with svjeez", { width: 420, y: 128 });
```

- `handwrite(font, text, { width, y, from?, size?, speed? })` centers `text` across `width` on a baseline at `y`, and returns each stroke's path data with when it starts (`at`) and how long it takes (`over`), plus `end`, when the last one is done. `size` defaults to `40` and `speed` to `600` units per second.
- `casual()` is the bundled EMS Casual Hand, read on first use. Any other `StrokeFont` works the same.

EMS Casual Hand is a single-line derivative of Covered By Your Grace by Sheldon B. Michaels (SVG conversion by Windell H. Oskay), under the SIL Open Font License 1.1. The licence ships beside it as `fonts/EMSCasualHand-OFL.txt`.

[API reference](https://github.com/saiashirwad/svjeez/blob/next/packages/svjeez/skills/svjeez/references/fonts-pictures.md)

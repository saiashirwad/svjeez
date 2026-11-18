# Images, symbols and fonts

## Fonts

Text is measured with its real font when the scene compiles, so every `<Text>` names a `font`, and the SVG embeds only the glyphs it draws.

```ts
import { google } from "@svjeez/fonts";
import { font } from "svjeez/scene";

const inter = await google("Inter");                                        // one face, 400
const geist = await google.family("Geist", [{ weight: 400 }, { weight: 600 }, { weight: 400, style: "italic" }]);
const mono = await google("JetBrains Mono", { ligatures: false });

const local = font.family(
  await font.load(new URL("./fonts/Geist-400.ttf", import.meta.url)),
  await font.load(new URL("./fonts/Geist-600.ttf", import.meta.url)),
);
```

- `@svjeez/fonts` (`npm i @svjeez/fonts@next`) downloads a Google font by family name once and caches it on disk (`SVJEEZ_FONTS_CACHE`, else `~/.cache/svjeez/fonts`). It is the only part of svjeez that uses the network.
- `font.load(path | URL)` reads a TTF or OTF from disk or http(s); `font(bytes)` takes the bytes. `font.family(...faces)` groups faces under the first one's family name. WOFF and WOFF2 embed but can't be measured: use TTF or OTF.
- `<Text weight={600} italic>` and `<Run weight={600}>` pick a face of the family. A face the family doesn't have is an error that lists the ones it has: the browser never makes up a bold or a slant.
- Options: `ligatures: false` (one glyph per character, so a coding font stays small), `subset: false` (embed the whole file), `fallback` (families a viewer without the embedded font sees), `family`, `weight`, `style`.
- A character a face lacks is a `missing-glyph` error; nothing falls back silently.
- Each face a scene uses costs its glyph subset, usually the largest part of a small SVG. Use one family, two weights.

The examples load Geist from `examples/fonts/` through `examples/style.ts`, so they work offline wherever the skill is installed.

## Images

```tsx
const logo = await picture.load("logo.png");      // PNG, JPEG, GIF, WebP or SVG; picture(bytes or svg string) works too

<Image src={logo} width={48} at={[16, 16]} motion={enter(span(0, 0.4))} />
```

The image fills its box from its top-left; with one of `width` and `height` the other follows its aspect ratio, with neither it is the picture's own size. It is placed, clipped, masked and moved like any node. A morph can move an image between states but not change its picture.

## Symbols

```tsx
const dot = symbol(() => <Shape geometry={circle(6)} fill={theme.blue} />);

<Stack direction="row" gap={8}>
  {[0, 1, 2].map((i) => <Instance of={dot} motion={enter(span(i * 0.2, 0.3))} />)}
</Stack>
```

`symbol(build)` is drawn once; each `<Instance of={…}>` places it, with its own `at`, `opacity`, `motion` and the rest. Tracks inside the symbol run on the scene's clock and are shared by every instance, so instances move in step: set them apart by moving the instances themselves. Use a symbol for content repeated many times (icons, dots, tiles), where it saves bytes.

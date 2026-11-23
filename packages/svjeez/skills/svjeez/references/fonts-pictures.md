# Fonts and pictures

## Fonts

Text is measured with its real font when the scene compiles, so every `<Text>` names a `font`, and the SVG embeds only the glyphs it draws. There is no default font and nothing is inherited: a `<Text>` with no `font` throws.

```ts
import { google } from "@svjeez/fonts";
import { font } from "svjeez";

const inter = await google("Inter");                                        // one face, 400
const geist = await google.family("Geist", [{ weight: 400 }, { weight: 600 }, { weight: 400, italic: true }]);
const mono = await google("JetBrains Mono", { ligatures: false });

const local = font.family(
  await font.load(new URL("./fonts/Geist-400.ttf", import.meta.url)),
  await font.load(new URL("./fonts/Geist-600.ttf", import.meta.url)),
);
```

- `@svjeez/fonts` (`npm i @svjeez/fonts@next`) downloads a Google font by family name once and caches it on disk (`SVJEEZ_FONTS_CACHE`, else `~/.cache/svjeez/fonts`). It is the only part of svjeez that uses the network.
- `font.load(path | URL)` reads a TTF or OTF from disk or http(s); `font(bytes)` takes the bytes. `font.family(...faces)` groups faces under the first one's family name; `family.face(weight, italic)` picks one. WOFF and WOFF2 embed but can't be measured: use TTF or OTF.
- `<Text weight={600} italic>` and `<Run weight={600}>` pick a face of the family. A face the family doesn't have is an error that lists the ones it has: the browser never makes up a bold or a slant.
- Options: `ligatures: false` (one glyph per character, so a coding font stays small), `subset: false` (embed the whole file), `fallback` (families a viewer without the embedded font sees), `family`, `weight`, `italic`.
- A character a face lacks is a `missing-glyph` error; nothing falls back silently.
- Each face a scene uses costs its glyph subset, usually the largest part of a small SVG. Use one family, two weights.

The skill's examples load Geist from `examples/fonts/` through `examples/style.ts`, so they work offline.

## Pictures

```tsx
const logo = await picture.load("logo.png");      // PNG, JPEG, GIF, WebP or SVG; picture(bytes or svg string) works too

<Picture src={logo} width={48} at={[16, 16]} motion={enter(span(0, 0.4))} />
```

The picture fills its box from its top-left; with one of `width` and `height` the other follows its aspect ratio, with neither it is the picture's own size. It is placed, clipped, masked and moved like any node. A morph can move a picture between states but not change its data.

With both `width` and `height`, `fit` decides what happens to a picture of another shape: `cover` (default) fills the box and crops, `contain` shows all of it, `fill` stretches it. `focus={[x, y]}` (fractions, default centre) is the part that stays in view, so a portrait in a landscape frame keeps the face: `focus={[0.5, 0.3]}`. Frame shapes are a `clip` in the box's own units:

```tsx
<Picture src={photo} width={110} height={150} focus={[0.5, 0.3]}
  clip={(own) => rect(own.width, own.height, { radius: [55, 55, 0, 0] })} />   // arch; { radius: 16 } rounds, circle(r) with width = height = 2r
```

### Embed or reference

`picture(bytes)` and `picture.load` embed the file as a data URI: about 4/3 of its size, and it works wherever the SVG goes (`<img>`, CSS background, email, GitHub). A phone photo is 3 to 8 MB, so resize to the drawn size times 2 (and re-encode to JPEG or WebP) before it gets here; `check` warns over 256 KB.

`picture.ref(url, { width, height })` writes the URL as `href` and embeds nothing. The SVG must be opened directly or inlined in HTML: an SVG shown through `<img>` or as a CSS background cannot fetch, so the image is blank there (`check` warns). Give the file's own pixel size, which an SVG cannot read from a URL.

In `@svjeez/live` a scene has no network or disk, so the host passes the image in as a param: a URL for `picture.ref(p.photo, { width: p.photoWidth, height: p.photoHeight })`, never bytes.

## Repeated drawings

There is nothing to declare: the SVG backend shares repeated still drawings itself (`<use>`), so a row of identical icons or dots costs one drawing and a placement each. Builds for an editor (`sources: true`) keep one element per node.

# Images and fonts

Both load as bytes and embed as data URIs, so the output stays one file. GitHub and Markdown show SVGs through `<img>`, which blocks external hrefs but allows `data:`.

## Images

```tsx
import { Picture, ease, fx, motion, picture } from "svjeez";

const photo = await picture.load(new URL("./harbor.jpg", import.meta.url)); // path, file: or http(s) URL
const logo = picture('<svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="18"/></svg>');   // bytes or SVG markup, sync

const framed = <Picture src={photo} x={20} y={20} width={240} radius={16} fit="cover" alt="A harbor at dusk" filter={fx.duotone({ dark: "#1b1464", light: "#ffb36b" })} />;
const kenBurns = <Picture src={logo} x={20} y={20} width={240} height={160} animation={motion({ scale: 1 }).to({ scale: 1.3 }, 6, ease.inOut)} />;
```

`picture()` sniffs the format from the bytes (svg, png, jpeg, gif, webp), never the extension, and reads the size from the header after EXIF rotation. It throws on anything else.

`<Picture>` takes `x` and `y` (default 0), `width` and `height` (one given derives the other; none uses the intrinsic size), `fit` (`cover` default, `contain`, `fill`), `radius`, `filter`, `opacity`, `class` and `alt`. Without `alt` the picture is `aria-hidden`. Its `animation` moves the image inside a fixed frame, so `scale` zooms about the frame's center, clipped to the frame. To animate the whole picture, wrap it in an animated `<g>`. Draw a picture as often as you like. Its bytes embed once.

Before you embed:

- Only SVG scales infinitely. Raster pixelates, so export it at 2x the drawn size.
- base64 adds about 33%, and the whole file downloads before the first frame. Keep each image under 100 KB. `validateSvg` warns past 256 KB.
- `<image href="photo.png">` loads in a page but not through `<img>`. `validateSvg` warns on it. Use `picture.load()`.
- An embedded SVG is sealed. Fonts, scripts and external refs do not load inside it, so outline its text. Its own CSS animations freeze on the first frame through `<img>`. Animate with `<Picture animation>` or a wrapping `<g>`.
- A filter over a large animated image re-renders every frame.
- You are redistributing the bytes. Check the license.

## Fonts

Load a TTF or OTF the way you load an image. Use it as real text, to measure text, or as outlines.

```tsx
import { Glyphs, draw, font } from "svjeez";

const display = await font.load(new URL("./ArchivoBlack-Regular.ttf", import.meta.url)); // or font(bytes), sync
const body = font.family(await font.load(new URL("./Body-Regular.ttf", import.meta.url)), await font.load(new URL("./Body-Bold.ttf", import.meta.url)));

const real = <text x={20} y={60} fontFamily={body} fontWeight="bold">Real, selectable text</text>; // also on <g>
const width = display.measure("Wave!", 96); // px, kerning and ligatures included
const title = <Glyphs font={display} text="Wave!" size={96} x={(400 - width) / 2} y={140} stroke="#FF5FA8" fill="none" animation={(glyph, i) => draw({ at: i * 0.15, over: 1 })} />;
```

- `font()` reads the format from the bytes (ttf, otf, woff, woff2) and the family, weight and style from the file. Pass `{ family, weight, style, fallback }` to override.
- `font.family(...faces)` groups faces under the first one's name. `family.face(weight, style)` picks like the browser.
- `fontFamily={font}` embeds each face the first time the tree uses it, once, and writes the fallback after it (`monospace` for a fixed-pitch font, else `sans-serif`).
- `measure(text, size)` and `path(text, { size, x, y })` match Chromium's layout, standard ligatures and pair kerning included. `path` returns `{ d, width, glyphs }`. `font.metrics` gives ascent, descent, cap height and x-height in em. `font.has(char)` tells you whether the font covers a character.
- `<Glyphs>` draws one path per visible glyph in a group labelled with the text. `animation` is a stack applied to every glyph, or a function of `(glyph, index)` for a stagger. To move the word as one, wrap it in an animated `<g>`.
- Extras take `font` too: `code(src, { font })` (monospaced only), every diagram, `Callout`, and `flow` packet labels. Their boxes are then sized by measuring, not by a 0.6em-per-character guess.

Before you embed:

- An embedded TrueType font is cut down to the glyphs the scene uses, often to a tenth of the file. Text that forms ligatures, or could meet other browser layout such as contextual alternates or combining marks, embeds the whole font. So do OTF with CFF outlines, WOFF and WOFF2. Pass `{ subset: false }` to embed the whole file.
- A coding font such as JetBrains Mono turns `=>` into a ligature. Load it with `{ ligatures: false }` to draw one glyph per character and keep the cut.
- `validateSvg` warns past 256 KB. For a short title, `<Glyphs>` embeds no font at all.
- Glyphs are outlines. They are not selectable, the group's `aria-label` is all assistive tech reads, and they lose hinting. Keep small body text as `<text>`.
- `measure` and `path` need the TTF or OTF file. WOFF and WOFF2 embed but throw. `path` reads TrueType outlines only, so an OTF with CFF outlines throws.
- Shaping is for Latin text: no bidi, no contextual alternates, no mark positioning.
- A character the font lacks draws from the fallback in `<text>` and as the `.notdef` box in `<Glyphs>`.
- A `.ttc` collection throws. Extract one face. Two files sharing a family, weight and style throw `Two different fonts claim …`. Rename one with `font(bytes, { family })`.
- You are redistributing the font. Check its license. OFL fonts allow embedding.

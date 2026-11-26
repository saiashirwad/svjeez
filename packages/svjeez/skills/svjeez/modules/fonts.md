# `@svjeez/fonts`

Load Google Fonts at build time (embedded as subsetted TTF `@font-face` data URIs) and draw stroke-based handwriting.

## Setup

```sh
npm install @svjeez/fonts svjeez
```

- Load fonts with top-level `await` at module scope (`scene()` callbacks are synchronous).
- First run fetches from Google Fonts and caches TTFs in `$SVJEEZ_FONTS_CACHE` → `$XDG_CACHE_HOME/svjeez/fonts` → `~/.cache/svjeez/fonts`. Subsequent runs work fully offline; cache entries do not expire.
- Handwriting (`@svjeez/fonts/handwriting`) ships its SVG font inside the package and needs no network.

## Mental model

- **No default or inherited font:** Every `<Text>`, `<Code>`, `<Chart>`, and diagram requires an explicit `Font` or `FontFamily` object (never a CSS string).
- **Exact face matching:** `google()` returns one `Font` (one weight × one slant). Use `google.family()` to load every weight and italic you use—weights are never synthesized. `<Text weight={700}>` requires an exact match in the family; `family.face(weight, italic)` picks the nearest loaded face.
- **Measurable TTF/OTF:** svjeez measures glyphs at build time. TTF/OTF files embed and measure; WOFF/WOFF2 and `font.system()` cannot be measured and require `<Run advances={[...oneNumberPerChar]}>`.
- **No glyph fallback:** Any character missing from the loaded face is a build error. Check availability with `font.has(char)`.
- **Handwriting is centerline strokes:** `casual()` loads EMS Casual Hand (`StrokeFont`). `<Lettering>` draws strokes at fixed width `3.4` centered across `width` at baseline `y`. Use `handwrite(font, text, opts)` to get `{ strokes: [{ d, at, over }], end }` for custom stroke styling and scheduling after `pen.end`.

## API map

| Entry | Exports |
|---|---|
| `@svjeez/fonts` | `google(family, { weight?, italic?, fallback?, subset?, ligatures?, features?, metrics? })`, `google.family(family, faces, sharedOptions?)` |
| `@svjeez/fonts/handwriting` | `casual()`, `strokeFont(svgMarkup)`, `strokeFont.load(url)`, `handwrite(font, text, { width, y, from?, size?, speed? })`, `<Lettering font text ink width y from? size? speed? />` |
| Core (`svjeez`) | `font(bytes \| () => bytes, opts)`, `font.load(pathOrUrl, opts)`, `font.system(family, opts)`, `font.family(...faces)` |

## Verified snippet

```tsx
/** @jsxImportSource svjeez */
import { google } from "@svjeez/fonts";
import { Lettering, casual, handwrite } from "@svjeez/fonts/handwriting";
import { Group, Run, Shape, Stack, Text, ease, enter, path, scene, span, tokens, track } from "svjeez";

const theme = tokens({
  light: { background: "#FFFFFF", text: "#111111", muted: "#555555", blue: "#0A6CFF", magenta: "#C2185B" },
  dark: { background: "#090A0C", text: "#F5F5F7", muted: "#98A0AD", blue: "#64D2FF", magenta: "#FF5CA8" },
});

const inter = await google.family("Inter", [{ weight: 400 }, { weight: 700 }]);
const hand = await casual();
const pen = handwrite(hand, "svjeez", { width: 360, y: 115, from: 0.9, size: 32 });

export default scene(
  { size: [360, 150], duration: 3, title: "Fonts", desc: "Inter weights above handwritten strokes.", theme, still: 2.8, loop: false },
  (canvas) => (
    <Group>
      <Shape geometry={canvas.rect} fill={theme.background} />
      <Stack direction="row" gap={8} at={[20, 16]}>
        <Text font={inter} size={18} fill={theme.text} motion={enter(span(0, 0.4))}>
          Regular and <Run weight={700}>bold</Run>
        </Text>
      </Stack>
      <Lettering font={hand} text="hello" width={360} y={76} size={32} ink={theme.blue} />
      {pen.strokes.map((s, i) => (
        <Shape
          key={`s${i}`}
          geometry={path.parse(s.d)}
          stroke={{ color: theme.magenta, width: 3, cap: "round", join: "round" }}
          draw={track(0).to(1, span(s.at, s.over), ease.linear)}
        />
      ))}
    </Group>
  ),
);
```

## Gotchas

- `asks for Inter 700, but its font is the one face Inter 400` → Load all needed faces with `google.family("Inter", [{ weight: 400 }, { weight: 700 }])`.
- `which has no glyph for "…"` → Switch to a font containing those codepoints or remove them; no fallback font fills in.
- `Could not load "…" … is not cached` → Run once online to populate the cache, or point `SVJEEZ_FONTS_CACHE` at a pre-populated cache directory.
- `Google Fonts has no "…" at weight W: HTTP 400` → Verify both the family spelling and that the family offers that exact weight/italic.
- `a font svjeez can't measure, and gave no advances for it` → Use a TTF/OTF font, or wrap `font.system()` / WOFF2 text in `<Run advances={[...]}>` with one number per character.
- `Two different fonts are both Inter 400` → Give one a distinct `{ family: "My Inter" }` option in `font()` / `font.load()`.
- `<Lettering>` clips or overflows → `width` centers the text horizontally rather than wrapping it; lower `size` or widen the canvas.

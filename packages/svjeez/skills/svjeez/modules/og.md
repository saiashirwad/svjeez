# `@svjeez/og`

Author 1200×630 Open Graph link-preview cards (`ogScene`) and rasterize any scene or SVG string to JPEG, PNG, or WebP (`renderOg`, `ogResponse`, `renderStill`).

## Setup

```sh
npm install @svjeez/og svjeez
npm install -D playwright-core
npx playwright-core install chromium-headless-shell
```

Keep the two entry points separate:
- `@svjeez/og`: scene authoring (`ogScene`, `OG_SIZE`)—safe inside scene files.
- `@svjeez/og/render`: Node/build/server rasterizer (uses `node:fs`, `node:crypto`, Playwright).
- `@svjeez/og/settings`: shared `settings` (`cache`, `limit`, `render` rasterizer override).

## Mental model

- **`ogScene(options, build)` is `scene()` with defaults `size: [1200, 630]`, `duration: 4`, `still: 0`.**
- **Frame 0 must be complete:** `renderOg` captures `time = 0` by default (what social crawlers see). Animate cards with a returning loop (e.g. `.to(-12, s).to(0, s.next(2)).loop(4)`) rather than `enter()` from opacity 0—otherwise frame 0 is blank and `check` warns `loop-seam`.
- **`renderOg(source, opts)`** accepts a `Scene` or SVG string. Defaults: `time: 0`, `scheme: "light"`, `format: "jpeg"`, `quality: 0.9`, `scale: 1`. Returns `{ bytes, type, width, height }`. JPEG fills transparency with white; pass `format: "png"` for alpha.
- **`ogResponse(source, opts)`** returns a web `Response` with `Content-Type`, deterministic `ETag` (`imageName`), and `Cache-Control: public, max-age=3600, stale-while-revalidate=86400`.
- **`renderStill(source, opts)`** captures a transparent `scale: 2` PNG at the scene's **still moment** (`stillTime`, or 72% of duration) and returns raw `Uint8Array` bytes—wrap with `picture(await renderStill(otherScene))` to embed a scene preview inside a card.
- **Caching & custom rasterizers:** Set `settings.cache = new URL("file:///path/to/cache/")` (trailing `/` required) to persist content-hashed renders across builds (max 4 concurrent renders). Replace Chromium on edge runtimes via `settings.render = async (svg, opts) => Uint8Array`.

## API map

| Entry | Exports |
|---|---|
| `@svjeez/og` | `ogScene(options, build)`, `OG_SIZE` (`[1200, 630]`), type `OgOptions` |
| `@svjeez/og/render` | `renderOg(src, opts?)`, `ogResponse(src, opts?)`, `renderStill(src, opts?)`, `imageName(svg, opts?)`, `imageType(opts?)`, `stillTime(svg, dur)`, `chromium`, `snapshot`, `cached`, `settings` |
| `@svjeez/og/settings` | `settings` (`{ cache?, limit?, render? }`) |

## Verified snippet

Card scene (`card.tsx`):

```tsx
/** @jsxImportSource svjeez */
import { google } from "@svjeez/fonts";
import { ogScene } from "@svjeez/og";
import { Align, Group, Shape, Stack, Text, circle, ease, span, tokens, track } from "svjeez";

const geist = await google.family("Geist", [{ weight: 400 }, { weight: 600 }]);
const theme = tokens({
  light: { background: "#FFFFFF", text: "#111111", muted: "#555A66", yellow: "#D97706" },
  dark: { background: "#090A0C", text: "#F5F5F7", muted: "#98A0AD", yellow: "#FBBF24" },
});

const bob = span(0, 2);
const bobbing = track(0).to(-12, bob, ease.inOut).to(0, bob.next(2), ease.inOut).loop(4);

export default ogScene({ theme, title: "Post card", desc: "A link preview with a title and bobbing dot." }, (canvas) => (
  <Group>
    <Shape geometry={canvas.rect} fill={theme.background} />
    <Shape geometry={circle(40)} at={[1000, 315]} anchor="center" fill={theme.yellow} motion={{ offset: bobbing.map((y): [number, number] => [0, y]) }} />
    <Align place="left" inset={80}>
      <Stack gap={20} align="start">
        <Text font={geist} weight={600} size={96} width={700} fill={theme.text}>My post title</Text>
        <Text font={geist} size={36} width={700} fill={theme.muted}>A short summary underneath.</Text>
      </Stack>
    </Align>
  </Group>
));
```

Rasterizing in server/build code:

```ts
import { ogResponse, renderOg } from "@svjeez/og/render";
import card from "./card.tsx";

const jpg = await renderOg(card);                                               // image/jpeg 1200x630
const png = await renderOg(card, { format: "png", scale: 2, scheme: "dark" });  // image/png 2400x1260
const res = await ogResponse(card, { format: "webp" });                         // Response + ETag
```

## Gotchas

- Blank element in rendered JPEG/PNG + `loop-seam` warning → Element used `enter()` at `0s` while `still` is `0`; make frame 0 complete with a returning `.loop(4)` or set `still: <seconds>`.
- `static` warning on a card (`ogScene({ duration: 0 })` errors) → Add a subtle returning loop (e.g. a small sway/bob) so the 4 s card is not static.
- `Cannot find package '@svjeez/og'` in `@svjeez/bin` or `@svjeez/live` → `@svjeez/og` is not carried by the single-file binary or live sandbox; run with an npm-installed `svjeez`.
- `renderOg() needs an <svg> root with numeric width and height` → Pass a `Scene` or an SVG string with numeric `width`/`height`/`viewBox`.
- Transparent background turned white → Default format is `"jpeg"`; pass `{ format: "png" }` for transparency.
- Passing `renderStill()` result directly to `<Picture src>` fails → Wrap bytes in `picture(await renderStill(scene))` first.

# `@svjeez/video`

Encode a finished svjeez scene or SVG into MP4 or WebM video using headless Chromium and WebCodecs (Mediabunny)—no `ffmpeg` required.

## Setup

```sh
npm install -D @svjeez/video playwright-core
npx playwright-core install chromium-headless-shell
```

- `svjeez video <file>` auto-loads `@svjeez/video`.
- Programmatic use calls `video(svgString, options)` directly.

## Mental model

- **Browser WebCodecs, not ffmpeg:** Frames are captured from headless Chromium (`max(1, round(duration * loops * fps))`) and encoded in-page with Mediabunny.
- **Format & codecs:**
  - `mp4` (default): `avc` (default), `hevc`, `vp9`, `av1`. No alpha channel.
  - `webm`: `vp9` (default), `vp8`, `av1`. Supports `--background transparent` (alpha).
- **Even dimensions:** Output pixels = `scene size × scale`, rounded **down** to even numbers (required by H.264).
- **Theme selection:** `--color-scheme system | light | dark` picks which scheme renders (set it explicitly for dual-theme scenes so CI matches local output).
- **CLI vs API input:** `svjeez video` accepts a `.tsx`/`.ts` scene or `.svg` file; `video(svg, opts)` in code takes an **SVG string** (`svg.emit(scene)` from `svjeez/tools`).

## API map

| Surface | Signature / usage |
|---|---|
| CLI | `svjeez video <file> [--out scene.mp4] [--format mp4\|webm] [--fps 30] [--loops 1] [--quality low\|medium\|high] [--scale 2] [--preview] [--color-scheme system\|light\|dark] [--background css] [params]` |
| `@svjeez/video` | `video(svg: string, options?: VideoOptions): Promise<Video>` returning `{ bytes, mime, format, codec, playTime, frames, colorScheme }`. |

## Verified snippet

CLI:

```sh
svjeez video scene.tsx --out scene.mp4 --fps 30 --color-scheme dark
svjeez video scene.tsx --out draft.mp4 --preview   # fps 12, scale 1, quality low; explicit flags win
svjeez video scene.tsx --out scene.webm --background transparent --scale 2
```

Programmatic:

```ts
import { video } from "@svjeez/video";
import { writeFile } from "node:fs/promises";
import { svg } from "svjeez/tools";
import myScene from "./scene.tsx";

const out = await video(svg.emit(myScene), { format: "webm", codec: "vp9", fps: 24, loops: 1, colorScheme: "light" });
await writeFile("scene.webm", out.bytes);
```

## Gotchas

- `video() can't keep a transparent background in mp4` → Use `--format webm` / `--out x.webm`, or pass a solid `--background "#101114"`.
- `video() needs an animated scene, got one whose loop lasts 0s` → Animate something in the scene, or export a still PNG with `svjeez frames`.
- `--format webm doesn't match --out x.mp4` → Omit `--format` (inferred from `--out`) or make the extension and `--format` agree.
- `video() needs a mp4 codec of avc, hevc, vp9, av1, got vp8` → Pick a codec supported by the container.
- `this Chromium can't encode avc` (some Linux headless builds) → Switch to `--format webm`, or pass `executablePath` to Google Chrome.
- `No Chromium to render with` → Run `npx playwright-core install chromium-headless-shell` (or `svjeez browser install` with `@svjeez/bin`).

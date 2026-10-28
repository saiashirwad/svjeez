# Video with @svjeez/video

`@svjeez/video` is a separate package: `npm i -D @svjeez/video playwright-core`, then `npx playwright-core install chromium-headless-shell`. It turns a finished scene into an MP4 or WebM for places that don't take SVG, such as social posts, slides and chat apps. The scene doesn't change. Write it, check its frames, then encode it.

```sh
npx svjeez video scene.tsx --out scene.mp4
npx svjeez video scene.tsx --out scene.webm --background transparent
npx svjeez video scene.tsx --out scene.mp4 --loops 3 --scale 2 --color-scheme light
```

```ts
import { writeFile } from "node:fs/promises";
import { renderVideo } from "@svjeez/video";

const video = await renderVideo(svg, { format: "mp4", fps: 30, loops: 2, scale: 2 });
await writeFile("scene.mp4", video.bytes);
```

The video plays `loops` loops of the scene (default 1) at `fps` frames per second (default 30). Frame `i` shows the scene at `i / fps` seconds, so a 4-second scene at 30 fps is 120 frames. The format follows `--out`'s extension, else MP4. MP4 is H.264 by default and WebM is VP9; `codec` picks another (`avc`, `hevc`, `vp9` or `av1` in MP4, `vp9`, `vp8` or `av1` in WebM). `quality` is `low`, `medium` or `high` (default).

## Size and color

The video is the SVG's `width` by `height` times `scale`, so a 480 by 270 scene at `--scale 2` is 960 by 540. Each side is rounded down to an even number of device pixels, because 4:2:0 video can't encode an odd one. Give the scene even sides to keep every pixel.

A video can't follow `prefers-color-scheme`, so an adaptive theme is baked in on one side. Pass `--color-scheme light` or `dark`. The default is this machine's setting.

## Transparency

The background behind the SVG defaults to the scheme's page color. `--background transparent` keeps alpha, in WebM only, and only where the scene doesn't paint over it. A full-size background `<rect>` makes every frame opaque, and the video carries no alpha. MP4 can't carry alpha, so a transparent MP4 throws.

## Errors

| Error | Fix |
| --- | --- |
| `renderVideo() needs an animated scene, got one whose loop lasts 0s.` | The scene has no motion. Use `svjeez frames` for a still. |
| `renderVideo() can't keep a transparent background in mp4.` | Use `--format webm`, or pass a background color. |
| `renderVideo() needs a Chromium that can encode … at …, and this one can't.` | Try another codec, or WebM, or pass `executablePath` to Google Chrome. |
| `svjeez video needs @svjeez/video.` | `npm i -D @svjeez/video`. |

# @svjeez/video

MP4 and WebM video from a [svjeez](https://www.npmjs.com/package/svjeez) scene, for places that take video and not SVG: social posts, slides, chat apps, video editors.

<p align="center">
  <a href="https://github.com/saiashirwad/svjeez/tree/main/examples/hype"><img src="https://raw.githubusercontent.com/saiashirwad/svjeez/main/examples/dist/hype.svg" width="640" alt="A one-minute reel for svjeez that follows the viewer's light or dark mode. In Claude Code, Claude reads the svjeez skill, writes a scene, renders frames, looks at them and ships an SVG. The scene's TSX, highlighted by @svjeez/code, streams into an editor while a preview draws each line's effect. Four shots each compose several packages: a dot map of the world with routes and dots in flight beside two counters that tick up; Mermaid text typed into an editor while it becomes a flowchart; a damped spring's equation typeset and braced, then the spring bouncing beside its plot; and one dataset drawn as a bar chart with a trend line and as a voxel skyline. &quot;Write anything.&quot; is inked on over a field of streamlines. Three facts: zero bytes of runtime JS, one self-contained file, CSS and SMIL. The svjeez logo draws on above the install command and a row of the packages." /></a>
  <br /><sub>A 45 second scene. <code>svjeez video</code> encodes scenes like it as MP4 or WebM</sub>
</p>

## Install

```sh
npm i -D @svjeez/video svjeez playwright-core
npx playwright-core install chromium-headless-shell
```

## Use

```ts
import { writeFile } from "node:fs/promises";
import { renderVideo } from "@svjeez/video";

const video = await renderVideo(svg, { fps: 30, loops: 2, scale: 2 });
await writeFile("scene.mp4", video.bytes);
```

Or from the command line, through svjeez's CLI:

```sh
npx svjeez video scene.tsx --out scene.mp4 --loops 2 --scale 2
npx svjeez video scene.tsx --out scene.webm --background transparent
```

`renderVideo(svg, options)` returns `{ bytes, mime, format, codec, duration, frames, colorScheme }`. Frame `i` shows the scene at `i / fps` seconds, and the video holds `round(loop × loops × fps)` frames, where `loop` is one loop of the scene.

| Option | Default | |
| --- | --- | --- |
| `format` | `"mp4"` | `"mp4"` or `"webm"`. |
| `codec` | `"avc"` for MP4, `"vp9"` for WebM | MP4 takes `avc`, `hevc`, `vp9` or `av1`. WebM takes `vp9`, `vp8` or `av1`. |
| `fps` | `30` | Frames per second. |
| `loops` | `1` | How many times the scene's loop plays. |
| `quality` | `"high"` | `"low"`, `"medium"` or `"high"`, a bitrate scaled to the frame size and rate. |
| `scale` | `1` | Device pixel ratio. A 480 × 270 scene at scale 2 is a 960 × 540 video. |
| `colorScheme` | `"system"` | `"light"` or `"dark"` picks a side of an adaptive theme. |
| `background` | `Canvas` | CSS background behind the SVG. `"transparent"` keeps alpha, in WebM only. |
| `executablePath` | | A Chromium or Chrome binary to use instead of Playwright's own. |

Each side of the video is a whole, even number of device pixels, because 4:2:0 video can't encode an odd one. An odd side loses its last row or column.

## How it works

Node has no video encoder, so encoding happens in the headless Chromium that `svjeez/frames` drives. svjeez seeks the paused scene to each frame's time and captures it, and [Mediabunny](https://mediabunny.dev) encodes the frames with the browser's WebCodecs and writes the container. Nothing is installed besides Mediabunny, and no ffmpeg is needed.

Before it captures, `renderVideo()` asks the browser whether it can encode the codec at that size, and throws if it can't. The error suggests another codec, WebM, or `executablePath` pointing at Google Chrome.

## Errors

A scene with nothing animated throws, because its loop is 0 seconds long. Use `renderFrames()` from `svjeez/frames` for a still. A transparent background in MP4 throws, because MP4 can't carry alpha. A codec the format doesn't hold, a non-positive `fps`, or a `loops` that isn't a positive whole number throws before a browser starts.

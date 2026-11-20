# Writing and rendering

Every command takes a `.tsx` or `.ts` module whose default export is a scene, a function returning one, or an SVG string, plus `--params` and `--param` ([params.md](params.md)). On Node, `.tsx` loads through `tsx`; under Bun, run `bunx --bun svjeez`.

```sh
npx svjeez svg scene.tsx --out scene.svg                        # the SVG; --json prints { svg, warnings, lanes }
npx svjeez frames scene.tsx --sheet --out frames/               # PNGs and a labelled sheet.png
npx svjeez frames scene.tsx --times 0,0.5,1.2,3 --scale 2 --color-scheme dark --out frames/
npx svjeez dev scene.tsx --port 5173                            # a live preview with a scrubber and timeline
npx svjeez video scene.tsx --out scene.mp4                      # needs @svjeez/video
npx svjeez skill --install --dir .claude/skills                 # copy this skill into a project
```

## Frames

`frames` writes one PNG per time and, with `--sheet` (or `--columns`), `sheet.png`, a labelled grid: open it first. Without `--times` it takes `--count` frames (default 6) across one loop. Times are scene seconds. `--scale 2` for small text; `--color-scheme light` or `dark` picks the side of the theme (default `system`); `--background` sets the page behind. It needs `playwright-core` and `npx playwright-core install chromium-headless-shell`.

Render each beat's start, middle and end, `0`, and just before `duration`, in both schemes. Two times that should differ but look the same mean a motion is not attached, or starts later than you think: `check --at` says which. In code: `renderFrames(svg, { times | count, sheet, scale, colorScheme })` from `svjeez/frames`.

## The SVG

One self-contained file: animation as CSS keyframes (and SMIL where CSS can't reach), fonts as embedded subsets, colors as CSS variables with a light and a dark value, and a still frame at `still` for viewers who ask for less motion. It runs no JavaScript, so it works in `<img>`, READMEs and docs. In code, `svg.emit(scene)` from `svjeez/tools` writes it, with `{ prefix }` to keep two scenes' ids apart on one page, `{ resolve: { ink: "currentColor" } }` to set tokens to one CSS value for a scene inlined in a page (`"inherit"` takes the page's own custom property of that name), `{ playbackRate }` to play faster or slower, and `{ sources: true }` for an editor (one element per node, with `data-source`). `validateSvg(svg)` and `costOf(svg)` come from `svjeez/frames`.

`dev` serves the preview and rebuilds it when a file beside the scene changes. Its **Timeline** lists every animated lane (`key · lane`) with its spans, and its Check button runs `check --json --browser`.

## Embedding and scrubbing

Use the file in `<img src="scene.svg" alt="…">`. For scroll-driven or scrubbed playback, `svjeez/page` has `seek(time, root?)`, which pauses every animation in the root and jumps to scene seconds, `loopLength(root?)`, and `restyle(svg, { css, theme, scheme, at, paused, still, timeline, range })`, which returns the SVG with extra CSS, its tokens repainted from a `tokens()` `theme` (mixes follow), its prefers-color-scheme queries answered for `scheme` (Safari answers an `<img>` SVG with the OS's scheme, whatever the page says), frozen at `at`, or driven by a CSS scroll or view `timeline` (`"view()"`). A scene with a morph, a geometry that changes size or an animated effect can't follow a `timeline`: call `seek()` on scroll instead. Frameworks: [web.md](web.md).

## Video

`npm i -D @svjeez/video@next`. `svjeez video scene.tsx --out scene.mp4` encodes `--loops` loops (default 1) at `--fps` (default 30) in headless Chromium; `.webm` or `--format webm` writes WebM, and `--background transparent` keeps alpha (WebM only). `--quality low|medium|high`, `--scale`, `--color-scheme` (a video bakes one scheme). Give the scene even sides: video can't encode odd ones. In code: `video(svg, { fps, loops, scale })` returns `{ bytes, format, codec, duration, frames }`.

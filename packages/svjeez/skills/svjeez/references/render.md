# Writing and rendering

Every command takes a `.tsx` or `.ts` module whose default export is a scene, a function returning one, or an SVG string, plus `--params` and `--param` ([params.md](params.md)). On Node, `.tsx` loads through `tsx`; under Bun, run `bunx --bun svjeez`.

```sh
npx svjeez svg scene.tsx --out scene.svg                       # the SVG; --json adds compiler warnings and timeline tracks
npx svjeez frames scene.tsx --sheet --out frames/              # PNGs and a labelled sheet.png
npx svjeez frames scene.tsx --times 0,0.5,1.2,3 --scale 2 --color-scheme dark --out frames/
npx svjeez dev scene.tsx                                        # a live preview with a scrubber, rebuilt on save
npx svjeez video scene.tsx --out scene.mp4                      # needs @svjeez/video
```

## Frames

`frames` writes one PNG per time and, with `--sheet` (or `--columns`), `sheet.png`, a labelled grid: open it first. Without `--times` it takes `--count` frames (default 6) across one loop. Times are scene seconds. `--scale 2` for small text; `--color-scheme light` or `dark` picks the side of the theme (default `system`); `--background` sets the page behind. It needs `playwright-core` and `npx playwright-core install chromium-headless-shell`.

Render each beat's start, middle and end, `0`, and just before `duration`, in both schemes. Two times that should differ but look the same mean a motion is not attached, or starts later than you think: `check --at` says which.

## The SVG

One self-contained file: animation as CSS keyframes (and SMIL where CSS can't reach), fonts as embedded subsets, colors as CSS variables with a light and a dark value, and a still frame at `reducedMotion` for viewers who ask for less motion. It runs no JavaScript, so it works in `<img>`, READMEs and docs. In code, `svg.emit(scene)` from `svjeez/tools` writes it, with `{ prefix }` to keep two scenes' ids apart on one page and `{ playbackRate }` to play faster or slower.

## Video

`npm i -D @svjeez/video`. `svjeez video scene.tsx --out scene.mp4` encodes `--loops` loops (default 1) at `--fps` (default 30) in headless Chromium; `.webm` or `--format webm` writes WebM, `--background transparent` keeps alpha (WebM only, and only where the scene paints nothing). `--quality low|medium|high`, `--scale`, `--color-scheme` (a video bakes one scheme). Give the scene even sides: video can't encode odd ones.

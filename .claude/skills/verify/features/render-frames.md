# Render frames

`svjeez frames` plays a scene in headless Chromium, pauses it at chosen playback times, and writes one PNG per time, plus a labeled contact sheet on request. It is how a user, or an agent, sees whether the motion is right.

## Sub-features

- `frames-times` writes `frame-NN-<t>s.png` for each `--times` entry.
- `frames-count` spreads `--count` frames (default 6) across one loop.
- `frames-sheet` adds `sheet.png` with a `t = …` label under each cell; `--columns` implies `--sheet`.
- `frames-scheme` renders under `--color-scheme light|dark|system`, and the first output line names the scheme used.
- `frames-scale-background` honors `--scale` and `--background`.
- `frames-arg-errors` rejects `--times` with `--count`, empty `--times` entries, non-numbers and a bad scheme.

## How to get to it (user POV)

- `npx svjeez frames scene.tsx --sheet` in a project.
- `bun run render-png <file> --sheet` in `examples/` or `packages/svjeez/`.

## Driving it with verify

Preconditions:

- Baseline from the README; `$V doctor` shows Chromium launching.

- **Chosen times, sheet, dark.** Run `$V cli frames readme/hero.tsx --times 0,1.5 --sheet --color-scheme dark --out $VERIFY_RUN/evidence/hero-frames`. Exit 0. The first line reads `loop 12s, dark`, then two frame paths and `sheet.png`. Open `sheet.png`: the 0s cell is blank dark, the 1.5s cell shows the svjeez wordmark and four panels.
- **Count.** Run `$V cli frames readme/basic.tsx --count 3 --out $VERIFY_RUN/evidence/basic-frames`. Exit 0 and three `frame-0N-*.png` files, evenly spaced across the loop.
- **Columns.** Run `$V cli frames readme/basic.tsx --count 4 --columns 2 --out $VERIFY_RUN/evidence/basic-grid`. `sheet.png` is a 2×2 grid.
- **Argument errors.** Run `$V cli frames readme/hero.tsx --times 1 --count 2`. Exit 1 with `Pass --times or --count, not both.` Run `$V cli frames readme/hero.tsx --color-scheme sepia`. Exit 1 with `--color-scheme is system, light or dark, got "sepia".`
- **Proof.** Open the sheets and describe each cell against the scene's timeline.

## Gotchas

- Without `--out` the frames land in `examples/frames/`, inside the repo. Always pass `--out`.
- A first frame at 0s is often empty, because many scenes fade in. Pick times inside the action.
- `--scale` defaults to 1. Pass `--scale 2` for sharp frames of small scenes.

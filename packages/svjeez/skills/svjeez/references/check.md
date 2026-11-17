# Checking a scene with numbers

`svjeez check` measures a scene in headless Chromium and prints the faults a number can find, one per line, each naming the line of the scene that wrote the element. It needs what frames need: `npm i -D playwright-core` and `npx playwright-core install chromium-headless-shell`, and `tsx` for `.tsx` on Node.

```sh
npx svjeez check scene.tsx
npx svjeez check scene.tsx --times 0,1.2,2.5 --json
```

```
scene.tsx:24:7  off-canvas  error: <circle> is outside the 200x120 canvas at every time it is visible (0s, 0.5s, …). Move it onto the canvas, or remove it.
scene.tsx:31:9  text-overflow  warning: <text "Quarterly revenue"> runs 14 past the right edge of the <rect> at scene.tsx:30:9 it sits on (1s, 1.5s). Shorten it, shrink the font, or widen what holds it.
0 errors, 1 warning; loop 4s, measured at 0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 3.96
```

It exits 1 when any finding is an error, so a script can gate on it. Without `--times` it measures 0, seven times spread across the loop and just before the end. `--json` prints `{ duration, times, findings }`, each finding `{ rule, severity, message, times, element, source }`. `--color-scheme light` or `dark` picks the side of an adaptive theme. An `.svg` file works too, without sources.

Fix errors first. Warnings are likely faults: open a frame at the times a warning names before you change anything, and leave it when the frame shows it is what you meant.

## Rules

| Rule | Severity | Reports |
| --- | --- | --- |
| `off-canvas` | error | A visible element outside the canvas at every time it shows, and still there. A part that slides in from off the canvas is on it at some time, and one that moves out there is not judged. |
| `off-canvas` | warning | A small element (under half the canvas) cut by the canvas edge by less than a quarter of its size, while it rests, in the same place at every time. Bigger bleeds, backgrounds, gradient glows and anything a camera carries are left alone. |
| `text-overflow` | warning | A `<text>` that runs past the canvas edge while it rests, or past the sides of the smallest `<rect>` drawn under its middle by more than a quarter of its height. |
| `static` | warning | An element whose animation never changes any value across the loop, or that carries an animation but draws nothing. |
| `visible-at-zero` | error | An element shown from 0 that cuts to hidden and comes straight back in, an entrance whose hidden start is missing (`motion({ opacity: 0 })`); or a stroke that draws in later while its fill already shows at 0. A part that is hidden for a while before it returns is not reported. |
| `loop-seam` | warning | An element seen on both sides of the loop's end that moves more than 3 or changes opacity by more than 0.3 when the loop restarts, beyond where its motion just before the end was taking it. |
| `overlap` | warning | Two different `<text>` elements whose middles overlap by more than 30% of the smaller, both visible and at rest. A copy of the same words (a shadow or an outline) and a text covered by an opaque shape drawn between them are left alone. |

Units are the scene's viewBox units. Each rule reports once per place in the source, so a component's twenty labels make one line ending "and 19 more written here".

## Sources

For a module, `svjeez check` renders the scene with every element marked with the line that wrote it. The scene's own `render()` call does this; you need not pass `sources`. An element built inside a library component (a chart, a diagram, `code()`) points at the line of the scene that called it. The places come from the call stack, so a bundled or minified scene reports no lines, and under Bun an element a small arrow function returns may point at the line that called it. For an `.svg`, or from `checkScene()`, render with `render({ sources: true })` under the development JSX runtime to get them.

## In code

```ts
import { checkScene } from "svjeez/frames";

const { duration, times, findings } = await checkScene(svg, { times: [0, 1, 2] });
const errors = findings.filter((found) => found.severity === "error");
```

It takes the options of `renderFrames` that set up the page (`colorScheme`, `scale`, `background`, `executablePath`) and `times`. It throws `checkScene() needs finite, non-negative times, got …` and `checkScene() needs at least one time, got an empty list.` before it starts a browser.

## What it cannot see

It reads boxes, opacity and computed style, never pixels. A clean run is not a finished scene. Use a contact sheet for:

- Color and contrast, legibility in both color schemes, and whether the picture reads well.
- Anything a `mask` hides, and occlusion: a shape drawn over text, or text in the same color as what is under it. Text under a mask is skipped by `overlap` and `loop-seam`.
- Timing that falls between the measured times. Rules that follow a value across the loop sample it 96 times; the box rules see only the measured times. Pass `--times` at each beat when a fault hides between them.
- Turning. `loop-seam` compares each element's middle and size, not its angle, so a wheel back at an equal angle passes, and so does a needle that should have come back and did not.
- Stepped and jittering motion at the seam, which is skipped because it jumps anyway. A `ease.hold` blink or wiggle that cycles a whole number of times in the loop (two or more) is not a seam at all, and is skipped on purpose.
- A whole scene that builds up and cuts back to its start. That is a choice, so parts that vanish or pop in at the seam are not reported. Look at the last frame and the first, and fade out before the end, or pass `render({ loop: false })`, when the cut is not wanted.
- Whether the right thing moves. `static` only knows that nothing changed.

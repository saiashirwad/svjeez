# Checking a scene with numbers

`svjeez check` prints the faults a number can find, one per line, each naming the line of the scene that wrote it, with what to change on a `hint:` line below. For a scene from `svjeez/scene` it first reads the scene model, with no browser, and names each node by its key; then it measures the scene in headless Chromium. The browser needs what frames need: `npm i -D playwright-core` and `npx playwright-core install chromium-headless-shell`, and `tsx` for `.tsx` on Node. `--no-browser` reads the model only, and answers at once.

```sh
npx svjeez check scene.tsx
npx svjeez check scene.tsx --times 0,1.2,2.5 --json
npx svjeez check scene.tsx --no-browser --at 0,1.5
```

```
scene.tsx:24:7  off-canvas  error: shape "badge" is outside the 200×120 canvas at every time: it stays within x 230 to 250, y 10 to 30.
    hint: Move it onto the canvas, or remove it.
scene.tsx:31:9  low-contrast  warning: text "title" ("Quarterly revenue") is hard to see: muted on surface is 2.1:1 in the dark scheme (4.8:1 in light), under the 4.5:1 text this size needs.
    hint: Pick a fill farther from surface in both schemes, or make the text larger.
1 error, 1 warning, 0 info; loop 4s, measured at 0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 3.96
```

It exits 1 when any finding is an error, a scene that throws while it builds included, so a script can gate on it. Without `--times` the browser measures 0, seven times spread across the loop and just before the end, plus up to 48 times from the scene's keys. `--json` prints `{ errors, warnings, info }`, each finding `{ code, severity, key, source, message, hint, times, related }`; `key` is empty when no node is known. `--at 0,1.5` adds `describe()`'s picture at those times: `frames` and `timeline` in JSON, and a short text after the findings, with what shows where, in which color, and what is moving it. `--color-scheme light` or `dark` picks the side of an adaptive theme. An `.svg` file works too, without sources.

Fix errors first. Warnings are likely faults: open a frame at the times a warning names before you change anything, and leave it when the frame shows it is what you meant.

In `svjeez dev`, open **Timeline**, then click **Check layout**. A finding seeks the preview to the first reported time. `svjeez svg scene.tsx --json` also returns the compiled timeline and validation warnings as JSON and runs without Chromium. For programmatic rendering, pass `onWarning` to `render()` to receive those warnings.

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

For a scene model, these come first, read from the model with no browser (`inspect()` from `svjeez/scene/tools` returns the same list). A rule both read is reported once, as the model says it.

| Code | Severity | Reports |
| --- | --- | --- |
| `never-visible` | warning | A node hidden at every time (opacity or scale 0), painting nothing, cut away by an empty clip, or covered at every time by an opaque, still, upright rect drawn after it. |
| `zero-size` | warning | Geometry, text or an image with no size at any time. |
| `off-canvas` | error, warning | Outside the canvas at every time it could be, or cut by an edge at rest. |
| `text-overflow` | warning | Text past the canvas at rest, or a character wider than the width it wraps to. |
| `overlap` | warning | Two different texts over each other while both rest and neither fades. |
| `missing-glyph` | error | Characters the text's face has no glyph for. |
| `low-contrast` | warning, info | Text, or a thin unfilled line, too close to the one flat color behind it, in either scheme: under 3:1 is a warning, under 4.5:1 for text under 24 units is info. Silent over a gradient, an image, or anything not one color. |
| `loop-seam` | warning | A value that ends somewhere other than where it starts, on a node seen on both sides of the seam: how far it moves, which colors it jumps between. |
| `visible-at-zero` | error | As the browser rule, read from the lanes. |
| `wasted-motion` | info | A value that changes before the node is first seen, or after it is gone for good. |
| `nothing-enters`, `static` | info, warning | Everything on screen from 0s with nothing entering; nothing moving at all, or a change only after the end. |
| `unsupported`, `approximate` | error, warning | What the SVG backend can't draw, or draws differently. |
| `compile-error` | error | The scene threw while it was built: the message, at the line that threw. |

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

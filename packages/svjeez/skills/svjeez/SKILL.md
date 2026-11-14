---
name: svjeez
description: Write animated SVGs with svjeez, a TypeScript library that compiles motions to CSS and SMIL with no runtime JavaScript. Use when asked to make, edit or debug an animated SVG, a svjeez scene, a code explainer, a terminal recording, or an animated flowchart, sequence, state or lanes diagram in TypeScript, or when a project imports svjeez.
---

# svjeez

svjeez turns a scene written in TypeScript into one self-contained animated SVG. Motions are values on a timeline. `render()` compiles them to CSS keyframes (SMIL for filter primitives), validates the output and returns a string. Nothing runs in the viewer's browser.

## Setup

```sh
npm i svjeez
```

Add `"jsx": "react-jsx", "jsxImportSource": "svjeez", "strict": true` to `compilerOptions`, or put `/** @jsxImportSource svjeez */` and `/** @jsxRuntime automatic */` at the top of one file. A scene module exports a default function that returns the SVG string. The CLI and the preview load modules of this shape.

```tsx
import { draw, ease, enter, render } from "svjeez";

export default function build(): string {
  return render(
    { width: 200, height: 120, duration: 4, title: "Hello", desc: "A curve draws on, then a dot pops in." },
    <>
      <path d="M20 100C60 20 140 20 180 100" fill="none" stroke="#FF5FA8" strokeWidth={4} animation={draw({ at: 0.2, over: 1.2 })} />
      <circle cx={100} cy={40} r={8} fill="#3EE6D6" animation={enter({ at: 1.2, over: 0.5 }, { scale: 0 }, ease.pop)} />
    </>,
  );
}
```

`render` takes `width`, `height`, `title` (required), `duration` (one loop, seconds), `desc`, `css`, `playbackRate`, `reducedMotion: { at }` or `false`, `loop` (`false` plays once and holds), `prefix` and `sources` (`true` writes `data-source="file:line:column"` on every element built by the development JSX runtime, for tools that link the picture back to its code). Attributes are camelCase (`strokeWidth`) and the class attribute is `class`.

## Render, look, fix

Never call a scene done from its source. Timing bugs only show in frames.

```sh
npx svjeez frames scene.tsx --times 0,0.5,1.2,3 --sheet --out frames/
```

Times are scene seconds, the clock your motions are written on, even when `playbackRate` is not 1. The command writes one PNG per time plus `sheet.png`, a labelled grid. Open `sheet.png` first. Without `--times` you get `--count` frames (default 6) over one loop. Add `--scale 2` for small text and `--color-scheme light` or `dark` for adaptive themes. `svjeez svg scene.tsx --out scene.svg` writes the SVG. Frames need `npm i -D playwright-core` and `npx playwright-core install chromium-headless-shell`. On Node, `.tsx` needs `npm i -D tsx`. Under Bun use `bunx --bun svjeez`.

1. Pick `duration` first and plan the beats as spans.
2. Run `tsc --noEmit`. Fix type errors with the table below.
3. Render a sheet at each beat's start, middle and end, plus `0` and just before `duration`.
4. Check: nothing visible at `t = 0` that should be hidden; each element arrives and leaves on cue; nothing clipped or off center; text legible in both color schemes; the last frame close to the first.
5. Fix, render again, and report only after a sheet shows the intended motion. Name the times you checked. Two times that should differ but render identically mean the motion is not attached or starts later than you think.

## Time

Every motion is written on a clock that starts at 0. The scene is the root clock, `0` to `duration`; a `<Clip>` starts another. A span is `{ at, over }` on the clock around it, and a span without `over` runs to the end. Recipes, `.to`, `show`, `<Clip>` and the results of `typewriter`, `terminal`, `flow` and `reveal` all take or return spans. Attach motions with the `animation` prop.

```tsx
motion({ opacity: 0 })          // initial values, held until the first transition
  .at(1)                        // move the cursor to 1s
  .to({ opacity: 1 }, 0.5)      // transition over 0.5s; cursor is now 1.5
  .wait(2)                      // values hold; cursor is now 3.5
  .to({ opacity: 0, scale: 0.8 }, 0.4, ease.in)
  .set({ scale: 1 })            // hard cut at the cursor
  .loop(6);                     // repeat every 6s, forever; snapped to divide duration
```

- `.to(values, over, ease?)`: `over` is a length, never an end time. `.to(values, span, ease?)` moves the cursor to `span.at` and takes `span.over`. Default ease is `ease.out`. Between transitions every value holds.
- `.repeat(3)` plays the passage written so far three times in all; `.repeat({ until: 10 })` repeats it until 10s, cutting the last pass short, then holds. Each pass starts from the initial values. Passes become keyframes, so a spin that never stops is `.loop()`, and a long repeat hits the key cap.
- `.rewind(0.8)` glides every channel back to its initial value, ending at the end of the clock: the scene's, a `<Clip>`'s, or a loop's period. It is how a loop closes without a hand-written reset. Nothing can follow it.
- Eases: `ease.linear` (spins), `in`, `out`, `inOut`, `pop` (overshoots), `hold`, `steps(n)`, `bezier(x1, y1, x2, y2)`. Motions are immutable, so chain or reassign. `easeAt(curve, progress)` gives an ease's value at a progress from 0 to 1, to reuse it inside `sampled()` or draw it beside the scene.
- Stack with an array: `animation={[enter(...), wiggle(...)]}`. Index 0 is outermost, like a wrapper `<g>`. Falsy entries drop out.
- Only `opacity x y scale rotate blur` stack. Every other channel takes one motion per element, or render throws `Two motions both animate`. Within one motion, `x` and `y` share a lane, so move them in one `.to()`.
- `scale` and `rotate` pivot on the center of the element's box, which for a group is the box of everything in it. To turn about a chosen point, use `<Pivot origin={{ x, y }} animation={spin}>…</Pivot>`: `origin` is in the coordinates the children are drawn in (default 0,0), and every layer of the stack turns about it.
- `<Once>…</Once>` is a `<g>` whose motions, and every motion inside it, play the timeline one time and hold their last frame while the rest of a looping scene repeats: an intro, or a part that pops in when a page swaps in a new file with `restyle(svg, { at, onceAt: 0 })`.
- Units: px, degrees for `rotate`, standard deviation in px for `blur`, CSS strings for colors.

| Tag | Channels |
| --- | --- |
| `g` `use` `text`, shapes (`path line polyline polygon circle ellipse rect`) | `opacity x y scale rotate blur fill stroke color` |
| `image` | `opacity x y scale rotate blur width height` |
| `tspan` | `fill stroke` |
| shapes | `draw` (0 to 1; the shape needs a stroke, or nothing renders) |
| `path` | `d` (path data; see Shape morphs) |
| `rect` | `width height` |
| `stop` | `stopColor stopOpacity` |
| filter primitives | `stdDeviation baseFrequency seed displace dx dy floodColor floodOpacity` |

Custom properties from `css.property` animate on every tag above except filter primitives.

### Spans

```tsx
const reach = span(0, 0.7);
const grab = reach.then(1, 0.2); // the next span: 1s long, starting 0.2s after reach ends
const down = grab.pad(0.15);     // grown 0.15s each side; negative shrinks
reach.end; reach.shift(2);       // 0.7; the same span 2s later
span(5);                         // from 5s to the end of the clock; its end is Infinity
```

A plain `{ at, over }` is a span too. `span()` only adds `.end`, `.shift(dt)`, `.then(over, gap?)` and `.pad(before, after?)`. `typewriter`, `terminal`, `reveal` and `flow` return `.span`, so `typed.span.then(1)` is the next beat and `typed.span.end` is when it lands.

### Clips

`<Clip at over?>` starts a clock of its own. Everything inside is written from 0 and placed with one number, so a component is a function of its props and nothing else. Clips nest and add up. A clip draws no element.

```tsx
<Clip at={3.1}>
  <Window from={home} to={dropped} drag={grab} />
  <Key label="opt" held={[down]} />
  <Cursor from={idle} moves={[[grip, reach], [gripDropped, grab]]} />
</Clip>
```

- With `over`, every motion inside must end by then, or render throws and names the clip. Without it the clip runs to the end of the clock around it, which is where `.rewind()` ends.
- Before a clip starts a motion holds its first value, and after it ends its last. That costs no keys.
- A `.loop()` inside a clip only shifts its phase, so the loop starts counting at the clip's start. A loop cannot cut a color glide or a `steps()` transition off a step edge to do it, and render says so.
- Motions on a `<filter>` in `def` play on the clock of the clip that uses it.
- `frames --times`, `restyle({ at })` and `seek` take scene seconds, not clip time.
- See `examples/clip.tsx`.

### show

`show(span | spans, { fade })` is opacity on while a span runs and off outside. It is the one way to show and hide.

```tsx
show(span(2, 4));                           // fades in over 0.3s, holds, fades out over the last 0.3s
show([tl.intro, { at: 8 }], { fade: 0.2 }); // several spans; { at: 8 } stays to the end and never fades out
show(tl.intro, { fade: 0 });                // hard cuts, a shot in an edit
```

Fades sit inside the span. Spans that overlap or touch merge, a span shorter than two fades shrinks them, and no spans means never shown, so nothing throws for a click shorter than its fade. `during`, `cut`, `visible`, `tl.show` and `tl.enter` are older spellings of the same thing.

## Recipes

```tsx
enter({ at: 0.5, over: 0.8 });                       // fade in
enter({ at: 0.5, over: 0.8 }, { y: 20, blur: 6 });   // arrive from these values to rest
exit({ at: 4, over: 0.4 }, { y: -10, opacity: 0 });  // leave to these values
draw({ at: 0, over: 1.2 });                          // stroke a shape on
shake({ at: 2, over: 0.5 }, { x: 6 });               // damped shake on x, y or rotate
wiggle({ rotate: 4 }, { seed: "leaf", rate: 6 });    // seeded looping noise; change the seed to reroll
```

Recipes take a span `{ at, over }`. `enter` and `exit` take only the rest channels (`opacity x y scale rotate blur`). Use `motion()` for colors. `sampled(fn, { over, at?, tolerance })` bakes a function of time into keyframes: `fn` is given time from 0 to `over`, plays from `at` (default 0) and holds its first and last values outside, so a motion that belongs to one scene costs keys only for that scene. Every key needs a tolerance for its lane (`translate` covers `x` and `y`), and every sample must return the same keys. A jump in the function, such as an angle reset from 360 to 0, becomes a cut rather than a spin back. For a reset you don't want seen, keep counting instead. To fly along a smooth route, `spline(points)` draws a Catmull-Rom curve through `{ x, y }` points: position `i + u` is `u` along leg `i`, `point(at)` and `angle(at)` feed `sampled()`, `tangent(at)` is the velocity, `path(from, to)` cuts exact path data (`d` is the whole route), and `nearest(p, from, to)` finds the position closest to a point.
`precision: 1` rounds each sample to one decimal place before the keys are kept, which keeps the file small. `random(seed)` is the seeded stream `wiggle` uses: the same numbers from 0 up to 1 on every run, from a whole number or a string such as `"leg-3"`.

`valuesAt(stack, t, { duration })` reads what a motion or stack draws at scene time `t`, eased and looped as `render()` plays it, for placing something beside a moving part or drawing a readout of it. It returns the numeric channels and properties. Across layers `x`, `y` and `rotate` add and `opacity` and `scale` multiply.

```tsx
sampled((t) => ({ x: 100 * Math.cos(t) }), { over: 12, tolerance: { translate: 1 } });
```

## Shape morphs

`d` moves a `<path>` from one outline to another through SMIL, so Safari animates it too. Every value in one motion must have the same commands. `matchPaths()` rewrites any outlines (squares, circles, glyphs, countries) into that form, with rings paired by order and turned so they don't twist. `sampled.path(fn, { over, at?, tolerance })` bakes a function of time that returns path data, keeping only the keys the shape needs; `tolerance` is one number, in px, and `precision` (default 1) the decimal places of the path data. It takes the same `over`, `at` and `step` as `sampled`.

```tsx
const [square, star] = matchPaths([squareD, starD]);
<path d={square} animation={motion({ d: square }).at(1).to({ d: star }, 0.8, ease.inOut)} />;
sampled.path((t) => wavePath(t), { over: 6, tolerance: 0.5 });
```

Reduced motion shows a still copy of the path at `reducedMotion.at`.

`polylinePath(points, { closed, precision })` writes the path data for straight runs through points (one decimal place by default), and `resample(points, count)` spaces `count` points evenly along them.

The path form's `slack: (x, y) => px` lets points that nobody sees stray further, which saves keys; `@svjeez/geo`'s turning globes use it for the side folded out past the clip.

## Errors and fixes

Type errors from `tsc`:

| Error | Fix |
| --- | --- |
| `Type 'number' is not assignable to type 'never'` in `.to()`, `motion()` or `sampled` | Misspelled channel, or a `sampled` key with no tolerance |
| `Motion<"draw"> is not assignable to type 'Stack<TagChannels<"g">>` | The tag cannot animate that channel. See the table |
| `Ref<"linearGradient"> is not assignable to type 'Ref<"clipPath">'` | A def in the wrong slot. Use `def.clipPath` or `def.mask` |
| `'duration' does not exist in type 'Span'` | Recipes take `{ at, over }` |
| `No overload matches this call` on `enter` or `exit` | A non-rest channel such as `fill`. Use `motion().to()` |
| `Expected 2 arguments` on `wiggle` | `wiggle(amplitude, { seed: "name" })` |
| `Property 'title' is missing` | `render` needs `title` |
| `'className' does not exist on type 'Intrinsic<"rect">'` | Use `class` |
| `Type '"c"' is not assignable to type '"a" \| "b"'` | Unknown id in a diagram spec or route |

Runtime errors. `…` stands for a value the message fills in.

| Message | Fix |
| --- | --- |
| `… on <…> has no starting value.` | Pass it in `motion({ width: 10 })` or set the attribute |
| ``Two motions both animate `…` on <…>: put them in one motion().`` | Only the stacking channels may repeat |
| ``Two transitions move `…` between …s and …s.`` | Merge into one `.to({ x, y })`, or stack two motions |
| `A motion on <…> runs until …s, past the …s scene.` | Raise `duration`, or end the motion earlier. Inside a `<Clip>` the message names the clip |
| `to() needs a span with an over, got { at: … } alone. A transition takes time: use span(…, over).` | `.to()` takes a span with an `over` |
| `repeat() would unroll … passes of … steps into keyframes. Use .loop(period) for a motion that never stops.` | `.loop(period)`, or fewer passes |
| `rewind(…) on … needs the last …s of its …s clock, but the motion runs until …s.` | End the motion earlier, or rewind over less time |
| `… cuts a steps(…) transition between two of its steps. Cut it on a step edge, or use ease.out.` | `repeat({ until })` or a loop in a `<Clip>` fell inside a `steps()` transition |
| `… stops … partway through a transition from … to …, and only numbers and paths can be cut there. Cut it between transitions.` | Same, for a color transition |
| `loop(…) is shorter than the motion, which runs until …s.` | The period must cover every step |
| `A step ending at …s overruns loop(…).` | Same, for a later step |
| `d on <path> moves between paths with different commands, so it would jump. Write them through matchPaths() first.` | `matchPaths([a, b])` and animate between its results |
| `sampled.path() returned a path with different commands at t=… than at t=0.` | Write every sample with the same points, or through `matchPaths()` |
| `… on <…> has … keys; the cap is ….` | Raise `tolerance`, or shorten it |
| `to() needs a positive duration, got …. Use set() for a cut.` | Use `.set()` for an instant change |
| `<…> has no attribute "…".` | camelCase: `strokeWidth`, not `stroke-width` |
| `A def ref is not a string. Pass it as the attribute value itself.` | `fill={grad}`, never `url(#id)` |
| `… was never declared with css.property().` | Declare the property before animating it |
| `animation takes motions built with motion() or a recipe.` | Pass motions, an array of them, or a falsy value |
| `Unknown image format. picture() reads …` | The bytes are not an image. Try `picture.load(path)` |
| `Unknown font format. font() reads …` | Pass font bytes or `font.load(path)` |
| `code() needs a monospaced font, and … is proportional.` | Use a monospaced font for `code()` |
| `Generated SVG is invalid:` | Often a duplicate hand-written `id`. Let `def` make ids |
| `Node cannot load …. Install tsx` | `npm i -D tsx`, or run under Bun |

## References

Read the one that matches the task. `svjeez skill --install` copies them.

| Task | Read |
| --- | --- |
| Gradients, clip paths, filters, custom properties, `<Style>` | [`references/defs-css.md`](references/defs-css.md) |
| Photos, web fonts, text measuring, outlined text | [`references/images-fonts.md`](references/images-fonts.md) |
| Hand-drawn strokes, handwriting | [`references/ink.md`](references/ink.md) |
| Code walkthroughs, terminals, annotations, camera, themes, recoloring, axes and calculus (`@svjeez/math`), pausing or scrubbing a rendered SVG from a page | [`references/explainers.md`](references/explainers.md) |
| Flowchart, sequence, state, tree, lanes (`@svjeez/diagrams`), `flow` | [`references/diagrams.md`](references/diagrams.md) |
| Pixel-art voxel scenes (`@svjeez/voxel`) | [`references/voxels.md`](references/voxels.md) |
| Tabler and Lucide icons, drawn on stroke by stroke (`@svjeez/icons`) | [`references/icons.md`](references/icons.md) |
| Real maps: countries, places, great-circle routes (`@svjeez/geo`) | [`references/geo.md`](references/geo.md) |
| Equations: TeX, equation transforms, `morph()` over formulas (`@svjeez/math`) | [`references/math.md`](references/math.md) |
| Vector fields, streamlines, slope fields, contour lines, implicit curves (`@svjeez/math`) | [`references/fields.md`](references/fields.md) |
| Syntax highlighting for `code()` and `terminal()`, themed by role (`@svjeez/code`) | [`references/code.md`](references/code.md) |
| Bar, line and area charts that animate in (`@svjeez/charts`) | [`references/charts.md`](references/charts.md) |
| Mermaid text drawn as a flowchart, sequence or state diagram (`@svjeez/mermaid`) | [`references/mermaid.md`](references/mermaid.md) |
| MP4 or WebM video of a finished scene (`@svjeez/video`) | [`references/video.md`](references/video.md) |
| `.ts` files, frameworks, several scenes in one page | [`references/without-jsx.md`](references/without-jsx.md) |
| Values a page or editor can change: counts, times, colors, eases, choices (`svjeez/params`) | [`references/params.md`](references/params.md) |

## Examples

Each file in `examples/` renders. Copy one and change it.

- `examples/toast.tsx`: a `motion()` chain, stacked `enter` and `shake`, `draw` on a check.
- `examples/clip.tsx`: a `<Clip>` with a card, a cursor and a key driven by three spans, and `.rewind()` to close the loop.
- `examples/orbit.tsx`: `sampled()` orbit, a `.loop()` spin, a `wiggle` breath.
- `examples/review-flow.tsx`: hand-placed boxes, a `flow` comet along them, an adaptive theme.
- `examples/explainer.tsx`: `code`, `morph`, `timeline`, `Focus`, `Marker`, `Callout`.
- `examples/terminal.tsx`: `appWindow` with a typed `terminal` session.

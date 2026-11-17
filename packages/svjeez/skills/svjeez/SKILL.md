---
name: svjeez
description: Write animated SVGs with svjeez, a TypeScript library that compiles motions to CSS and SMIL with no runtime JavaScript. Use when asked to make, edit or debug an animated SVG, a svjeez scene, a code explainer, a terminal recording, or an animated flowchart, sequence, state or lanes diagram in TypeScript, or when a project imports svjeez.
---

# svjeez

svjeez turns a scene written in TypeScript into one self-contained animated SVG. Motions are values on a timeline. `render()` compiles them to CSS keyframes (SMIL for filter primitives, `d`, `width` and `height`, since Firefox takes no geometry from CSS), validates the output and returns a string. Nothing runs in the viewer's browser.

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

`render` takes `width`, `height`, `title` (required), `duration` (one loop, seconds), `desc`, `css`, `playbackRate`, `reducedMotion: { at }` or `false`, `loop` (`false` plays once and holds), `prefix` (so two scenes can share one page), `comment` and `sources` (`true` writes `data-source="file:line:column"` on every element built by the development JSX runtime, for tools that link the picture back to its code). Attributes are camelCase (`strokeWidth`) and the class attribute is `class`.

Imports:

| Path | Holds |
| --- | --- |
| `svjeez` | `render`, `motion`, `ease`, the recipes, spans, `<Clip>`, `show`, `def`, `css`, fonts, pictures, and the explainer parts |
| `svjeez/geometry` | `rect`, `matchPaths`, `polylinePath`, `resample`, `pathLength`, `num`. The types `Rect`, `Point`, `Edge` and `PathData` come from `svjeez` |
| `svjeez/frames` | `renderFrames`, `checkScene`, `validateSvg` |
| `svjeez/page` | `restyle`, `seek`, `loopLength`, for a page that holds a rendered SVG |
| `svjeez/params` | the params that make a scene a template: what the CLI, an editor or your build passes in |
| `svjeez/jsx-runtime` | `jsx(tag, props)`, for `.ts` files |

Packages that place something on the canvas take a `frame: Rect`, built with `rect(x, y, w, h)`.

## Render, look, fix

Never call a scene done from its source. Timing bugs only show in frames, and most of them show in numbers first.

```sh
npx tsc --noEmit
npx svjeez check scene.tsx
npx svjeez frames scene.tsx --times 0,0.5,1.2,3 --sheet --out frames/
```

`svjeez check` measures the scene in headless Chromium and prints one finding per line, `file:line:column  rule  severity: message`: parts off the canvas, text running past the canvas or the box it sits on, text over text, animations that change nothing, entrances visible at 0, and jumps at the loop seam. It exits 1 on an error. Its rules, and what it cannot see, are in [`references/check.md`](references/check.md).

`frames` writes one PNG per time plus `sheet.png`, a labelled grid. Open `sheet.png` first. Times are scene seconds, the clock your motions are written on, even when `playbackRate` is not 1. Without `--times` you get `--count` frames (default 6) over one loop. Add `--scale 2` for small text and `--color-scheme light` or `dark` for adaptive themes. `svjeez svg scene.tsx --out scene.svg` writes the SVG. `svjeez dev scene.tsx` serves a page that plays the scene with a scrubber and rebuilds it on every save. Every command takes `--params data.json` and `--param key=value` for a scene that exports `params` ([`references/params.md`](references/params.md)). `frames` and `check` need `npm i -D playwright-core` and `npx playwright-core install chromium-headless-shell`. On Node, `.tsx` needs `npm i -D tsx`. Under Bun use `bunx --bun svjeez`.

1. Pick `duration` first and plan the beats as spans.
2. Run `tsc --noEmit`. Fix type errors with the table below.
3. Run `svjeez check`. Fix every error. For each warning, look at a frame at the times it names, and fix it unless the frame shows what you meant.
4. Render a sheet at each beat's start, middle and end, plus `0` and just before `duration`. Check what a number cannot: each element arrives and leaves on cue, nothing off center, text legible in both color schemes, the picture reads, and the last frame close to the first when the scene should not cut.
5. Fix, run check and render again, and report only after check has no errors and a sheet shows the intended motion. Name the times you checked. Two times that should differ but render identically mean the motion is not attached or starts later than you think.

## Time

Every motion is written on a clock that starts at 0. The scene is the root clock, `0` to `duration`; a `<Clip>` starts another. A span is a plain `{ at, over }` on the clock around it, and a span without `over` runs to the end. Recipes, `show`, `<Clip>` and the results of `typewriter`, `terminal`, `reveal`, `morph` and `flow` take or return spans. Attach motions with the `animation` prop.

```tsx
const fadeIn = span(1, 0.5);
const fadeOut = fadeIn.next(0.4, 2);    // 0.4s long, starting 2s after fadeIn ends

motion({ opacity: 0 })                  // initial values, held until the first transition
  .to({ opacity: 1 }, fadeIn)           // during the span, 1s to 1.5s
  .to({ opacity: 0, scale: 0.8 }, fadeOut, ease.in) // 3.5s to 3.9s; values hold before it
  .set({ scale: 1 }, fadeOut.end)       // a hard cut at 3.9s
  .loop(6);                             // repeat every 6s, forever; snapped to divide duration
```

- `.to(values, span, ease?)`: the transition plays during the span. Default ease is `ease.out`. Between transitions every value holds. There is no cursor: a step right after another is the next span, `a.next(over)`, and a run of them is `const [up, down, settle] = chain(span(0.4, 0.3), 0.2, 0.4)`.
- `.set(values, at)`: a hard cut at `at` seconds. A cut has no length, so it takes a time, as in `.set({ opacity: 1 }, beat.end)`.
- Steps may be written in any order; each lane plays them in time order. Two transitions that move one lane at the same time throw.
- `.repeat(3)` plays the passage written so far three times in all; the passage runs from the earliest step's start to the latest step's end; `.repeat({ until: 10 })` repeats it until 10s, cutting the last pass short, then holds. Each pass starts from the initial values. Passes become keyframes, so a spin that never stops is `.loop()`, and a long repeat hits the key cap.
- `.rewind(0.8)` glides every channel back to its initial value, ending at the end of the clock: the scene's, a `<Clip>`'s, or a loop's period. It is how a loop closes without a hand-written reset. Nothing can follow it.
- `.label(name)` names the keyframes. It changes nothing else.
- Eases: `ease.linear` (spins), `in`, `out`, `inOut`, `pop` (overshoots), `hold`, `steps(n)`, `bezier(x1, y1, x2, y2)`. Motions are immutable, so chain or reassign. `easeAt(curve, progress)` gives an ease's value at a progress from 0 to 1, to reuse it inside `sampled()` or draw it beside the scene.
- Stack with an array: `animation={[enter(...), wiggle(...)]}`. Index 0 is outermost, like a wrapper `<g>`. Falsy entries drop out.
- Only `opacity x y scale rotate blur` stack. Every other channel takes one motion per element, or render throws `Two motions both animate`. Within one motion, `x` and `y` share a lane, so move them in one `.to()`.
- `scale` and `rotate` pivot on the center of the element's box, which for a group is the box of everything in it. To turn about a chosen point, use `<Pivot origin={{ x, y }} animation={spin}>…</Pivot>`: `origin` is in the coordinates the children are drawn in (default 0,0), and every layer of the stack turns about it.
- `<Once>…</Once>` is a `<g>` whose motions, and every motion inside it, play the timeline one time and hold their last frame while the rest of a looping scene repeats: an intro, or a part that pops in when a page swaps in a new file with `restyle(svg, { at, onceAt: 0 })`.
- `<Ambient>…</Ambient>` is a `<g>` whose motions, and every motion inside it, stay on the clock when a page scrubs the scene with `restyle(svg, { timeline: "--story" })` from `svjeez/page`: wheels that keep turning while the scroll moves a `Camera` past them. The rest of the scene follows the scroll or view timeline, one loop over its range. Played on the clock it changes nothing. Give each ambient motion a `.loop(period)`, or make it close over `duration`, since under a timeline the rest of the scene no longer restarts with it. SMIL (`d`, `width`, filters) cannot follow a timeline, so `restyle` throws for it outside `<Ambient>`.
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

A span is how to say when. Build each one from the spans it follows, so moving one beat moves everything placed after it, and no time is written twice or added up by hand.

```tsx
const reach = span(0, 0.7);
const grab = reach.next(1, 0.2); // the next span: 1s long, starting 0.2s after reach ends
const down = grab.pad(0.15);     // grown 0.15s each side; negative shrinks
reach.end; reach.shift(2);       // 0.7; the same span 2s later
span(2).until(3.5);              // from a start to an end: 2s to 3.5s
grab.until(down.end);            // starts with grab, ends when down ends
grab.first(0.3); grab.last(0.3); // the first and the last 0.3s of grab
span(5);                         // from 5s to the end of the clock; its end is Infinity
stagger(span(1, 0.5), 4, 0.1);   // a cascade: four 0.5s spans, each 0.1s after the one before
chain(span(1, 0.3), 0.1, 0.5);   // end to end: 1s to 1.3s, 1.3s to 1.4s, 1.4s to 1.9s
```

A `span` is a plain `{ at, over }` that also has `.end`, `.shift(dt)`, `.next(over, gap?)`, `.pad(before, after?)`, `.until(end)`, `.first(over)` and `.last(over)`. A span without `over` has `.shift`, `.pad`, `.until` and `.first`. `at` is 0 or later and `over` is positive; `span(at, 0)` is allowed as a point to chain from. `stagger(first, count, step)` returns `count` spans as long as `first`, `step` apart: map items over it, as in `items.map((item, i) => <g animation={enter(cascade[i]!)}>…</g>)`, and `cascade.at(-1)!.end` is when the last one settles. `chain(first, ...overs)` returns `first` and one span per length, each starting when the one before ends: the steps of a motion that play one after another, destructured into names. `typewriter`, `terminal`, `reveal`, `morph` and `flow` return `.span`, so `typed.span.next(1)` is the next beat and `typed.span.end` is when it lands. `timeline({ intro: 4, demo: 6 }, { gap, pace, at })` lays out named scenes as spans, with `.end` for the total.

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

`show(span | spans, { fade })` is opacity on while a span runs and off outside. It is how to show and hide.

```tsx
show(span(2, 4));                           // fades in over 0.3s, holds, fades out over the last 0.3s
show([tl.intro, { at: 8 }], { fade: 0.2 }); // several spans; { at: 8 } stays to the end and never fades out
show(tl.intro, { fade: 0 });                // hard cuts, a shot in an edit
```

Fades sit inside the span. Spans that overlap or touch merge, a span shorter than two fades shrinks them, and no spans means never shown, so nothing throws for a click shorter than its fade.

## Recipes

```tsx
enter({ at: 0.5, over: 0.8 });                       // fade in
enter({ at: 0.5, over: 0.8 }, { y: 20, blur: 6 });   // arrive from these values to rest
exit({ at: 4, over: 0.4 }, { y: -10, opacity: 0 });  // leave to these values
draw({ at: 0, over: 1.2 });                          // stroke a shape on
shake({ at: 2, over: 0.5 }, { x: 6 });               // damped shake on x, y or rotate
wiggle({ rotate: 4 }, { seed: "leaf", rate: 6 });    // seeded looping noise; change the seed to reroll
```

Recipes take a span `{ at, over }`, and an ease last (`enter`, `exit`, `draw`). `enter` and `exit` take only the rest channels (`opacity x y scale rotate blur`). Use `motion()` for colors. `shake` and `wiggle` take an amplitude per channel, and `rate` must be positive. `wiggle` also takes `period` (default 2s, snapped to divide the scene) and `ease`.

`sampled({ at, over }, fn, { tolerance, step?, precision? })` bakes a function of time into keyframes. `fn` is given time from 0 to `over`, plays from `at` and holds its first and last values outside, so a motion that belongs to one scene costs keys only for that scene. Every key needs a tolerance for its lane (`translate` covers `x` and `y`), and every sample must return the same keys. A jump in the function, such as an angle reset from 360 to 0, becomes a cut rather than a spin back. For a reset you don't want seen, keep counting instead. `precision: 1` rounds each sample to one decimal place before the keys are kept, which keeps the file small.

```tsx
sampled({ at: 0, over: 12 }, (t) => ({ x: 100 * Math.cos(t) }), { tolerance: { translate: 1 } });
```

`spline(points)` draws a Catmull-Rom curve through `{ x, y }` points, for flying something along a smooth route. Position `i + u` is `u` along leg `i`. `point(at)` and `angle(at)` feed `sampled()`, `tangent(at)` is the velocity, `d` is the whole route as path data, `path(from, to)` cuts exact path data, and `nearest(p, from, to)` finds the position closest to a point.

`random(seed)` is the seeded stream `wiggle` uses: the same numbers from 0 up to 1 on every run, from a whole number or a string such as `"leg-3"`.

`valuesAt(stack, t, { duration, loop? })` reads what a motion or stack draws at scene time `t`, eased and looped as `render()` plays it, for placing something beside a moving part or drawing a readout of it. Pass the scene's `duration` and `loop`. It returns the numeric channels and properties. Across layers `x`, `y` and `rotate` add and `opacity` and `scale` multiply.

## Shape morphs

`d` moves a `<path>` from one outline to another through SMIL, so Safari animates it too. Every value in one motion must have the same commands. `matchPaths()` from `svjeez/geometry` rewrites any outlines (squares, circles, glyphs, countries) into that form, with rings paired by order and turned so they don't twist. `sampled.path({ at, over }, fn, { tolerance, step?, precision? })` bakes a function of time that returns path data, keeping only the keys the shape needs; `tolerance` is one number, in px, and `precision` (default 1) the decimal places of the path data.

```tsx
import { matchPaths } from "svjeez/geometry";

const [square, star] = matchPaths([squareD, starD]);
<path d={square} animation={motion({ d: square }).to({ d: star }, span(1, 0.8), ease.inOut)} />;
sampled.path({ at: 0, over: 6 }, (t) => wavePath(t), { tolerance: 0.5 });
```

Reduced motion shows a still copy of the path at `reducedMotion.at`.

Also in `svjeez/geometry`: `polylinePath(points, { closed?, precision? })` writes path data for straight runs through points (one decimal place by default), `resample(points, count)` spaces `count` points evenly along them, and `pathLength(points)` is their total length.

`sampled.path` takes `slack: (x, y) => px`, which lets points that nobody sees stray further and saves keys. `@svjeez/geo`'s turning globes use it for the side folded out past the clip.

## Drawn results

Charts, maps, formulas and diagrams (`@svjeez/charts`, `geo`, `math`, `diagrams`, `mermaid`) all return a `Drawn`: `node`, `span` for when it all plays, `bounds`, `parts` and `part(id)`. Put the result itself in the scene, `{bars}`: JSX takes a `Drawn` as a child and draws its `node`. A part is a bar, region, diagram node or edge, route, formula line or glyph run with an `id`, a `box` (a `Rect`, where it rests) and its own `span`. Time what comes after a part from `part.span` and place it with `part.box`, so a callout follows the chart when the chart's timing changes:

```tsx
const bars = c.bars({ at: 0.8, over: 1.5 }, sales);
const q3 = bars.part("Q3"); // throws, naming ids that exist, when there is none

<>
  {bars}
  <text x={q3.box.top.x} y={q3.box.top.y - 8} textAnchor="middle" animation={enter(q3.span.next(0.4))}>
    {q3.value}
  </text>
</>;
```

Each package adds its own fields to its parts (a bar's `value`, a line point's `point`, a derivation line's `tex`). Their references say which, and what a part's `span` means there. `span.end` of the whole result is where the next beat starts.

## Errors and fixes

Type errors from `tsc`:

| Error | Fix |
| --- | --- |
| `Type 'number' is not assignable to type 'never'` in `.to()`, `motion()` or `sampled` | Misspelled channel, or a `sampled` key with no tolerance |
| `Motion<"draw"> is not assignable to type 'Stack<TagChannels<"g">>` | The tag cannot animate that channel. See the table |
| `Ref<"linearGradient"> is not assignable to type 'Ref<"clipPath">'` | A def in the wrong slot. Use `def.clipPath` or `def.mask` |
| `'duration' does not exist in type 'Span'` | Recipes take `{ at, over }` |
| `Argument of type 'number' is not assignable to parameter of type 'Span'` on `.to` | `.to` takes a span, never a length: `.to(values, span(at, over))`, or `prev.next(over)` for the step after `prev` |
| `Argument of type 'OpenSpanned' is not assignable to parameter of type 'Span'` on `.to` | A transition needs an end: `span(a, over)` or `span(a).until(b)`, not `span(a)` |
| `Property 'at' does not exist on type 'Motion<…>'`, or `'wait'` | The cursor is gone. Place each step with a span: `.at(t).to(v, d)` is `.to(v, span(t, d))`, `.at(t).set(v)` is `.set(v, t)` |
| `Expected 2 arguments, but got 1` on `.set` | `.set(values, at)` needs the time of the cut |
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
| `repeat() would unroll … passes of … steps into keyframes. Use .loop(period) for a motion that never stops.` | `.loop(period)`, or fewer passes |
| `rewind(…) on … needs the last …s of its …s clock, but the motion runs until …s.` | End the motion earlier, or rewind over less time |
| `… cuts a steps(…) transition between two of its steps. Cut it on a step edge, or use ease.out.` | `repeat({ until })` or a loop in a `<Clip>` fell inside a `steps()` transition |
| `… stops … partway through a transition from … to …, and only numbers and paths can be cut there. Cut it between transitions.` | Same, for a color transition |
| `loop(…) is shorter than the motion, which runs until …s.` | The period must cover every step |
| `A step ending at …s overruns loop(…).` | Same, for a later step |
| `d on <path> moves between paths with different commands, so it would jump. Write them through matchPaths() first.` | `matchPaths([a, b])` and animate between its results |
| `sampled.path() returned a path with different commands at t=… than at t=0.` | Write every sample with the same points, or through `matchPaths()` |
| `… on <…> has … keys; the cap is ….` | Raise `tolerance`, or shorten it |
| `to() needs a positive duration, got …. Use set() for a cut.` | Use `.set(values, at)` for an instant change |
| `to() takes a span, got …. Write .to(values, span(at, over)); a step right after another is span.next(over).` | Plain JavaScript passed a length; pass a span |
| `set() takes the time of the cut in seconds, got …. Write .set(values, at).` | Pass the time of the cut |
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
| Code walkthroughs, terminals, annotations, camera, themes, recoloring, planes, axes and calculus (`@svjeez/math`), pausing or scrubbing a rendered SVG from a page | [`references/explainers.md`](references/explainers.md) |
| Flowchart, sequence, state, tree, lanes (`@svjeez/diagrams`), `flow` | [`references/diagrams.md`](references/diagrams.md) |
| Tabler and Lucide icons, drawn on stroke by stroke (`@svjeez/icons`) | [`references/icons.md`](references/icons.md) |
| Real maps: countries, places, great-circle routes (`@svjeez/geo`) | [`references/geo.md`](references/geo.md) |
| Equations: TeX, equation transforms, `morph()` over formulas (`@svjeez/math`) | [`references/math.md`](references/math.md) |
| Vector fields, streamlines, slope fields, contour lines, implicit curves (`@svjeez/math`) | [`references/fields.md`](references/fields.md) |
| Syntax highlighting for `code()` and `terminal()`, themed by role (`@svjeez/code`) | [`references/code.md`](references/code.md) |
| Bar, line and area charts that animate in (`@svjeez/charts`) | [`references/charts.md`](references/charts.md) |
| Mermaid text drawn as a flowchart, sequence or state diagram (`@svjeez/mermaid`) | [`references/mermaid.md`](references/mermaid.md) |
| Lint a scene by measuring it: off-canvas parts, text overflow and overlap, dead motions, loop seams (`svjeez check`) | [`references/check.md`](references/check.md) |
| Small revisions to a scene ("slow the second beat", "a warmer orange"): list its values by key and set them, then check and look (`svjeez values`, `svjeez set`) | [`references/edit.md`](references/edit.md) |
| MP4 or WebM video of a finished scene (`@svjeez/video`) | [`references/video.md`](references/video.md) |
| Rendering a scene on request in a Cloudflare Worker: fonts, params from the URL, caching, what needs a browser | [`references/worker.md`](references/worker.md) |
| `.ts` files, frameworks, several scenes in one page | [`references/without-jsx.md`](references/without-jsx.md) |
| A scene as a template: text, lists, counts, times, colors, eases and choices it takes from `--params data.json`, an editor or your build (`svjeez/params`) | [`references/params.md`](references/params.md) |

## Examples

Each file in `examples/` renders. Copy one and change it.

- `examples/toast.tsx`: a `motion()` chain, stacked `enter` and `shake`, `draw` on a check.
- `examples/clip.tsx`: a `<Clip>` with a card, a cursor and a key driven by three spans, and `.rewind()` to close the loop.
- `examples/orbit.tsx`: `sampled()` orbit, a `.loop()` spin, a `wiggle` breath.
- `examples/review-flow.tsx`: hand-placed boxes, a `flow` comet along them, an adaptive theme.
- `examples/explainer.tsx`: `code`, `morph`, `timeline`, `Focus`, `Marker`, `Callout`.
- `examples/terminal.tsx`: `appWindow` with a typed `terminal` session.

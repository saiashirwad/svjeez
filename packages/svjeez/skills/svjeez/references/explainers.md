# Explainers, terminals and annotations

Import from `svjeez/extras`. `code` and `terminal` take `theme` (default `defaultDark`), `x`, `y`, `fontSize`, `font` and `class`, and return an object with a `node` to put in the tree. The annotations (`Arrow`, `Callout`, `Brace`, `Underline`, `Marker`), `Focus` and `Camera` are components that return a node. `examples/explainer.tsx` and `examples/terminal.tsx` show whole scenes.

## Themes

Themes are base16: `theme.base00` is the background and `base05` the text, up to `base0F`. Ready-made: `tomorrowNight`, `tomorrow`, `systemDark`, `systemLight`, `solarizedDark`, `solarizedLight`, `gruvboxDark`, `gruvboxLight`, `defaultDark`, `defaultLight`. `base16(...16 colors)` builds one and `tint(theme, role)` reads a color by code role.

```tsx
import { adaptive, tomorrow, tomorrowNight } from "svjeez/extras";

const { theme, css } = adaptive({ dark: tomorrowNight, light: tomorrow });
const fonts = `${css}\n.sans text{font-family:system-ui,sans-serif}`; // pass as render's css, then class="sans"
```

`adaptive` gives colors as CSS variables that follow the viewer's color scheme. Diagram and callout text inherits the page font, so add a font rule or pass `font`.

Code roles are `plain muted comment punct keyword fn string number constant type variable tag red green yellow blue magenta cyan`.

## Restyling with CSS variables

A scene painted with `adaptive` colors reads sixteen variables, `--base00` to `--base0F`, from CSS. A page can set them again, after the scene is rendered. `base00` to `base07` run from background to foreground: `00` background, `01` raised surface, `02` selection and borders, `03` comments and muted text, `04` secondary text, `05` text, `06` and `07` brighter text. `base08` to `base0F` are accents: `08` red, `09` orange, `0A` yellow, `0B` green, `0C` cyan, `0D` blue, `0E` purple, `0F` brown.

Code and terminal runs use them by role:

| Role | Slot |
| --- | --- |
| `plain` | `base05` |
| `muted`, `comment` | `base03` |
| `punct` | `base04` |
| `keyword`, `magenta` | `base0E` |
| `fn`, `blue` | `base0D` |
| `string`, `green` | `base0B` |
| `number`, `constant` | `base09` |
| `type`, `yellow` | `base0A` |
| `variable`, `tag`, `red` | `base08` |
| `cyan` | `base0C` |

`variables(dark, light?)` does the same for colors a scene paints itself. It returns `vars`, where `vars.sky` is `var(--sky)`, and `css` for `render`. With `light`, those values win under `prefers-color-scheme: light`. Names must be CSS identifiers.

```tsx
import { variables } from "svjeez/extras";

const { vars, css } = variables({ sky: "#14162A", sea: "#1F3A5C" }, { sky: "#FBF1DE", sea: "#9DCFCF" });
// <rect fill={vars.sky} />, and render({ ..., css }, ...)
```

`restyle(svg, { css, at, onceAt, paused, still })` returns a copy of a rendered SVG with more CSS after the scene's own. A page uses it to recolor an `<img>` without restarting the animation. `at` is how many playback seconds the copy starts in, written to `--t0` on the root, which delays every CSS animation, and to `begin` on every SMIL `<animate>`. Any value works, so a page never needs the scene's loop length. `paused: true` holds the frame at `at` (0 when left out) instead of playing on, whatever the viewer's setting, so a page can show any moment in an `<img>`. SMIL holds through `begin`, `end` and `fill="freeze"`. Parts inside `<Once>` keep their own clock, which follows `at` unless `onceAt` sets it, so `restyle(next, { at, onceAt: 0 })` swaps in a new file that keeps the loop's place while its once parts play from the top. `still: true` holds the reduced-motion frame instead, ignoring `at` and `paused`. Both pause every animation, your own CSS included, and your own CSS animations stay where they start. A scene rendered with `reducedMotion: false` has no still frame to hold.

To scrub a picture inlined in the page instead, `seek(time, svg)` from `svjeez/page` pauses every CSS and SMIL animation in that `<svg>` at `time`, and `loopLength(svg)` returns its loop in seconds. Both default to the whole document and run only in a browser.

```ts
import { restyle } from "svjeez";
import { adaptive, solarizedDark, solarizedLight } from "svjeez/extras";

const text = await (await fetch(img.src)).text();
const at = (performance.now() - shownAt) / 1000; // shownAt: when the img started playing
const css = adaptive({ dark: solarizedDark, light: solarizedLight }).css;
img.src = URL.createObjectURL(new Blob([restyle(text, { css, at })], { type: "image/svg+xml" }));
```

## Code

`code(lines, options)` lays out monospaced code. A line is an array of pieces: plain text, a run `[role, text, id?]`, or a Shiki-style token `{ content, color, fontStyle }`.

```tsx
import { code, tomorrowNight, type CodeRun } from "svjeez/extras";

const kw = (text: string): CodeRun => ["keyword", text];
const src = code(
  [
    [kw("const"), " total ", ["punct", "="], " ", ["fn", "sum", "call"], ["punct", "(xs);"]],
    [kw("return"), " total", ["punct", ";"]],
  ],
  { x: 40, y: 60, fontSize: 16, theme: tomorrowNight, gutter: true },
);

const aim = [src.get("call"), src.find("total"), src.lines(1, 2), src.at(2, 8)]; // Rects, and a Point
```

`get(id)` is the bounds of every run with that id. `find(text, nth?)` the first match. `lines(first, last?)` is a row range. `at(line, column)` is a point. All are 1-based and throw when out of range. Rects have `x y w h`, edge midpoints (`top`, `center`), `pad(n)`, `union(r)` and `side(edge, t)`. The `font` option must be monospaced.

## Timeline

`timeline` names consecutive beats so annotations and animations share one clock.

```tsx
import { timeline, readingTime, during, cut, shot, visible } from "svjeez/extras";

const tl = timeline({ intro: readingTime("One piece of state"), change: 5, outro: 3 }, { gap: 0.5, pace: 1.2 });
tl.intro; tl.change.at; tl.end; tl.duration; // spans are { at, over }
const fade = tl.show("intro"); // fade in at the start, out by the end; tl.enter("intro") fades in and stays
const shown = during(tl.outro); // fade a span in and out
const hard = cut(tl.outro);     // on for the span, hard cuts, for a shot in an edit
const moved = shot(tl.change, { enter: "rise", exit: "zoom" }); // a shot that moves in and out inside its span
const lit = visible([tl.intro, tl.outro]); // on for each span, off between
```

`shot(span, { enter, exit, over })` takes the moves `cut`, `fade`, `rise`, `zoom` and `slide`, each `over` seconds (default 0.45) inside the span. Put it on the `<g>` that holds the whole shot. Shots laid end to end hand over through the background.

`readingTime(text)` is seconds to read: words at 3.5 per second plus a second to settle, at least 2. `pace` scales every beat but not `gap`. `duration`, `end`, `show` and `enter` are reserved scene names. A start time like `at` in `play` or `reveal` is a `Beats`: one number (items follow `step` apart) or one time per item.

## Moving code

Each returns an object with `node` and times to hang other beats on.

```tsx
import { morph, reveal, typewriter } from "svjeez/extras";

const after = code([[kw("return"), " total", ["punct", ";"]]], { x: 40, y: 60, fontSize: 16, theme: tomorrowNight, gutter: true });
const m = morph([src, after], { at: [tl.change.at], gutter: true }); // { node, spans, end }
const typed = typewriter(src, { at: 1, cps: 28, cursor: true });      // { node, end, spans }
const shown2 = reveal(src, { at: 1, step: 0.6 });                      // { node, spans, end }
```

- `morph(versions, { at, over })` moves words that survive, fades the rest, and pairs runs by id first. One `at` per transition. Give a run an id when the text changes but the meaning does not. `morph()` also takes anything with `words` and `draw()`, such as a `tex()` formula from `@svjeez/math`; `gutter` needs `code()` versions.
- `typewriter` types line by line. `spans[i]` is when line `i + 1` types.
- `reveal` shows a paragraph at a time. `blocks: [[2, 3], [5, 9]]` picks line ranges and leaves the rest visible. `blocks: "line"` goes line by line.

## Annotations

Each takes `during: Span` and aims at a `Rect` with `target`.

```tsx
import { Arrow, Brace, Callout, Camera, Focus, Marker, Underline } from "svjeez/extras";

const notes = (
  <>
    <Focus stops={[{ during: tl.intro, target: src.lines(2) }]} dim={0.3}>{src.node}</Focus>
    <Marker stops={[{ during: tl.intro, target: src.get("call").pad(4) }, { during: tl.change, target: src.find("total").pad(4) }]} />
    <Callout target={src.get("call")} side="right" during={tl.outro} columns={24}>Handlers send intent</Callout>
    <Arrow from={src.at(1, 1)} to={src.at(2, 3)} bend={0.2} during={tl.change} />
    <Brace target={src.lines(1, 2)} side="left" label="two lines" during={tl.change} />
    <Underline target={src.find("total")} variant="squiggle" during={tl.outro} />
  </>
);
```

- `Focus` dims its children except the stop's rects. A stop's `target` may be a list of rects.
- `Marker` is a box that glides between stops.
- `Callout` takes text as children, wrapped at `columns` characters, on any `side`. With `font` it sizes by measuring.
- `Brace` takes `side` `"left"`, `"right"`, `"above"` or `"below"`. The last two run along the top or bottom of the target, which suits a term of an equation.
- `Underline` has `variant` `"straight"` or `"squiggle"`.
- `color` defaults to the theme's `base09` on all of them.

## Camera

`Camera` pans and zooms everything inside it to each stop's `target` (a `Rect`, or `"all"` for the whole view). A stop at 0 is the opening view. Clip it yourself.

```tsx
import { rect } from "svjeez";
import type { CameraStop } from "svjeez/extras";

const FRAME = rect(0, 0, 800, 450);
const stops: CameraStop[] = [{ during: { at: 4, over: 4 }, target: rect(300, 200, 160, 90) }, { during: { at: 8, over: 3 }, target: "all" }];
const zoomed = <Camera frame={FRAME} stops={stops} over={0.8}>{src.node}</Camera>;
```

Do not zoom a camera over hundreds of animated elements. Chromium keeps each animated element on its own raster, and when a parent scales they fall behind and flash blank mid-zoom. The fix has three parts:

1. Play the intro as one animated copy outside the `Camera`.
2. At a hard cut, swap to a second copy inside the `Camera` that has no animations at all.
3. Put what must keep moving during the zoom in a small `Camera` with the same stops.

Share geometry through `def.symbol` so the second copy costs little.

```tsx
import { def, motion, type Ref } from "svjeez";

const shapes = new Map<string, Ref<"symbol">>();
const shape = (d: string): Ref<"symbol"> => {
  let symbol = shapes.get(d);
  if (!symbol) shapes.set(d, (symbol = def.symbol({ style: "overflow:visible" }, <path d={d} />)));
  return symbol;
};

const Atlas = ({ still }: { still: boolean }) => (
  <g>
    <use href={shape("M0 0h50v50z")} fill="#888" animation={still ? undefined : enter({ at: 0.5, over: 1 })} />
  </g>
);

const SWAP = 4;
const scene = (
  <>
    <g animation={motion({ opacity: 1 }).at(SWAP).set({ opacity: 0 })}><Atlas still={false} /></g>
    <g animation={motion({ opacity: 0 }).at(SWAP).set({ opacity: 1 })}>
      <Camera frame={FRAME} stops={stops}><Atlas still /></Camera>
    </g>
  </>
);
```

## Heading and steady

`travel(points, { at, over, heading: true })` also turns the token to face the way it moves, through a `rotate` channel. Legs ease into each other, so a route of many short legs turns smoothly. A number is added in degrees: an icon drawn pointing up takes `heading: 90`.

```tsx
<g animation={travel(route, { at: 2, over: 3, heading: 90 })}>
  <Icon icon={plane} x={-8} y={-8} size={16} />
</g>
```

`Steady` keeps what it holds at its size on screen while a `Camera` zooms. Give it the camera's `frame`, `stops` and `over`, and `at`, the point it is drawn around. Put it inside the `Camera`'s children.

```tsx
<Camera frame={FRAME} stops={stops} over={0.8}>
  <Steady frame={FRAME} stops={stops} over={0.8} at={{ x: city.x, y: city.y }}>
    <circle cx={city.x} cy={city.y} r={4} />
  </Steady>
</Camera>
```

## Axes and function plots

`axes(options)` draws coordinate axes over a graph range and returns `{ node, bounds, point, plot }`. `x` and `y` are `[min, max]` ranges, `width` and `height` the plot area in px, and `at` its top-left. `ticks: { x, y }` are steps in graph units, and an axis without a step has no ticks. `labels` (default true) numbers the ticks, `grid` adds faint lines, and `theme`, `fontSize` and `font` style it. Each axis crosses at 0 when 0 is in its range, else sits on the bottom or left edge.

```tsx
import { draw } from "svjeez";
import { axes, tint, tomorrowNight } from "svjeez/extras";

const theme = tomorrowNight;
const ax = axes({ x: [-3, 3], y: [-1, 9], width: 400, height: 260, at: { x: 300, y: 60 }, theme, ticks: { x: 1, y: 2 } });
const parabola = ax.plot((x) => x * x, { samples: 120, color: tint(theme, "blue"), animation: draw({ at: 1, over: 1.5 }) });
const dot = ax.point(2, 4); // graph coordinates to a scene Point

const scene = <g>{ax.node}{parabola.node}<circle cx={dot.x} cy={dot.y} r={4} fill={tint(theme, "yellow")} /></g>;
```

`plot(f, options)` samples `f` evenly (`samples`, default 200, over `from`..`to`, default the x range) and returns `{ node, d, points }`. The curve breaks where `f` is not finite, leaves the y range by more than one range height, or jumps by more than the range, so `1 / x` and `Math.tan` draw no vertical spikes. Clipping to the plot area is built in. `color`, `strokeWidth` and `animation` (such as `draw()`) style the path. `axes()` and `plot()` throw on empty ranges, non-positive sizes, steps or sample counts.

## Calculus on axes

The axes also carry calculus. A value that moves is a `Moving`: a number holds still, `{ from, to, at, over, ease }` sweeps it (default `ease.inOut`), and an array of sweeps chains them, holding in between. Lines and areas whose shape changes bake into a `d` motion through `sampledPath()`, so they morph in Safari too.

```tsx
import { draw, enter } from "svjeez";
import { axes, readout } from "svjeez/extras";

const graph = axes({ x: [-3, 3], y: [0, 4], width: 300, height: 240, at: { x: 40, y: 60 }, theme });
const f = (x: number) => 2 + Math.sin(x);

const rider = graph.dot(f, { from: -2, to: 2, at: 1, over: 3 });         // { node, motion, point(t) }
const secant = graph.secant(f, 0.5, { from: 2, to: 0, at: 1, over: 3 }); // h shrinks to 0: it lands on the tangent
const slope = readout((t) => `slope ≈ ${secant.slope(t).toFixed(2)}`, { at: 1, over: 3, x: 190, y: 330, fill: "white" });

const sums = graph.riemann(f, { from: -2, to: 2, n: [4, 8, 16, 32], at: [5, 6, 7], over: 0.7 }); // { node, sums }
const filled = graph.area(f, -2, { from: -2, to: 2, at: 8, over: 2 });  // { node, value(t) }
const taylor = graph.morph([p0, p2, p4], { at: [3, 4.5], over: 0.8, animation: draw({ at: 1, over: 1 }) });
```

- `dot(f, x, { r, color })` puts a dot on `f` that rides the curve as `x` moves. Put `motion` on a `<g>` to carry a label with it.
- `tangent(f, x, options)` is a segment `length` px long (default half the plot width) that slides along the curve. `secant(f, x, h, options)` passes through `f` at `x` and `x + h` and draws a dot at each, unless `points: false`. When `h` reaches 0 it becomes the tangent. Both return `{ node, slope(t) }`, with the slope in graph units.
- `area(f, from, to, { color, opacity, base })` shades the region between `f` and `base` (default 0), and either bound can move. `value(t)` is its signed area.
- `riemann(f, { from, to, n, at, over, rule })` draws rectangles as one path. Each stage in `n` splits into the next, and `at` gives one start time per later stage. `rule` is `"left"`, `"mid"` (the default) or `"right"`, and `sums` holds each stage's sum.
- `morph([f, g, …], { at, over, color })` is one curve that bends from each function into the next, so it never draws twice. Values are clamped just past the plot. Give `color` an array, one per function, and the stroke changes color with each bend.
- `parametric((t) => [x, y], [t0, t1])` and `polar((θ) => r, [θ0, θ1])` draw like `plot()`, with 400 samples by default. They return `{ node, d, points }`.
- `readout(text, { at, over, step, ...textAttributes })` is text that changes over time. It samples `text(t)` every `step` (default 1/12 s) and shows each distinct string while it holds.

## Terminals

```tsx
import { rect } from "svjeez";
import { appWindow, terminal } from "svjeez/extras";

const shell = appWindow(rect(20, 20, 400, 170), { theme, title: "~/hello", dots: "traffic" }); // { node, body }
const session = terminal(
  [
    { cmd: "npm i svjeez", output: [[["muted", "added 1 package"]]] },
    { cmd: "npx tsx hello.tsx", output: [[["green", "✓"], " wrote hello.svg"]] },
  ],
  { theme, x: shell.body.x + 20, y: shell.body.y + 16, fontSize: 14 },
);
// duration: session.end + 2 holds the last line before the loop restarts
```

`output` entries are one string or one line of pieces. `terminal` takes `at`, `prompt`, `cps`, `think` and `gap` too, and returns `{ node, end, bounds }`. `dots` is `"muted"`, `"traffic"` or `false`.

# Explainers, terminals and annotations

Import from `svjeez/extras`. `code` and `terminal` take `theme` (default `defaultDark`), `x`, `y`, `fontSize`, `font` and `class`, and return an object with a `node` to put in the tree. The annotations (`Arrow`, `Callout`, `Brace`, `Underline`, `Marker`), `Focus` and `Camera` are components that return a node. `examples/explainer.tsx` and `examples/terminal.tsx` show whole scenes.

## Themes

Themes are base16: `theme.base00` is the background and `base05` the text, up to `base0F`. Ready-made: `tomorrowNight`, `tomorrow`, `defaultDark`, `defaultLight`. `base16(...16 colors)` builds one and `tint(theme, role)` reads a color by code role.

```tsx
import { adaptive, tomorrow, tomorrowNight } from "svjeez/extras";

const { theme, css } = adaptive({ dark: tomorrowNight, light: tomorrow });
const fonts = `${css}\n.sans text{font-family:system-ui,sans-serif}`; // pass as render's css, then class="sans"
```

`adaptive` gives colors as CSS variables that follow the viewer's color scheme. Diagram and callout text inherits the page font, so add a font rule or pass `font`.

Code roles are `plain muted comment punct keyword fn string number constant type variable tag red green yellow blue magenta cyan`.

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
import { timeline, readingTime, during, cut, visible } from "svjeez/extras";

const tl = timeline({ intro: readingTime("One piece of state"), change: 5, outro: 3 }, { gap: 0.5, pace: 1.2 });
tl.intro; tl.change.at; tl.end; tl.duration; // spans are { at, over }
const fade = tl.show("intro"); // fade in at the start, out by the end; tl.enter("intro") fades in and stays
const shown = during(tl.outro); // fade a span in and out
const shot = cut(tl.outro);     // on for the span, hard cuts, for a shot in an edit
const lit = visible([tl.intro, tl.outro]); // on for each span, off between
```

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

- `morph(versions, { at, over })` moves words that survive, fades the rest, and pairs runs by id first. One `at` per transition. Give a run an id when the text changes but the meaning does not.
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

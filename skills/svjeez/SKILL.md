---
name: svjeez
description: Write animated SVGs with svjeez, a TSX library that compiles motions to CSS and SMIL with no runtime JavaScript. Use when asked to make, edit or debug an animated SVG, a svjeez scene, a code explainer, a terminal recording, or an animated flowchart, sequence, state or lanes diagram in TSX.
---

# svjeez

svjeez turns a TSX scene into one self-contained animated SVG. Motions are values on a timeline. `render()` compiles them to CSS keyframes (SMIL for filter primitives), validates the output and returns a string. Nothing runs in the viewer's browser.

Work in a loop: write the scene, render frames, look at them, fix, repeat. Never call a scene done from the source alone. Timing bugs only show up in frames.

## Setup

```json
{ "compilerOptions": { "jsx": "react-jsx", "jsxImportSource": "svjeez", "strict": true } }
```

A scene module exports a default function that returns the SVG string. The CLI and the preview load modules of this shape.

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

`render` options: `width`, `height`, `title` (required), `duration` (one loop, seconds), `desc`, `css`, `speed` (playback rate), `reducedMotion: { at }` (the still frame under `prefers-reduced-motion`, default 85% through) or `false`, `comment`.

## The timeline

Every motion lives on the scene timeline, `0` to `duration`, and the whole scene loops. Attach motions with the `animation` prop.

```tsx
motion({ opacity: 0 })          // initial values, held until the first transition
  .at(1)                        // move the cursor to 1s (absolute)
  .to({ opacity: 1 }, 0.5)      // transition over 0.5s from the cursor; cursor is now 1.5
  .wait(2)                      // advance the cursor 2s; values hold
  .to({ opacity: 0, scale: 0.8 }, 0.4, ease.in)
  .set({ scale: 1 })            // hard cut at the cursor
  .label("fade");               // readable keyframe names, optional
```

- `.to(values, over, ease?)`: `over` is a duration, never an end time. The default ease is `ease.out`.
- Between transitions every value holds. You never write hold keys.
- `.loop(period)` repeats the motion every `period` seconds. Render snaps the period so it divides `duration`.
- Motions are immutable. Each call returns a new motion, so build them as one chain or reassign.
- Stack layers with an array: `animation={[enter(...), wiggle(...)]}`. Index 0 is outermost, like a wrapper `<g>`. Falsy entries are dropped, so `cond && motion` works.
- Two transitions in one motion may not move the same lane at overlapping times. `x` and `y` share the `translate` lane. Move them in one `.to()`, or stack two motions.

### Channels

| Tag | Channels |
| --- | --- |
| shapes, `g`, `text`, `use` | `opacity` `x` `y` `scale` `rotate` `blur` `fill` `stroke` `color` |
| shapes (`path` `line` `polyline` `polygon` `circle` `ellipse` `rect`) | `draw` (0 to 1) |
| `rect`, `image` | `width` `height` |
| `stop` | `stopColor` `stopOpacity` |
| filter primitives | `stdDeviation` `baseFrequency` `seed` `displace` `dx` `dy` `floodColor` `floodOpacity` |

Units: `x`, `y`, `width`, `height` are px; `rotate` is degrees; `blur` is the Gaussian blur's standard deviation in px; colors are CSS color strings. `scale` and `rotate` pivot on the element's own center (fill-box), not the canvas origin. To rotate around another point, put the shape in a `<g transform="translate(cx cy)">` and draw it around 0,0.

### Easing

`ease.linear`, `ease.in`, `ease.out` (default), `ease.inOut`, `ease.pop` (overshoots, then settles), `ease.hold` (jumps at the end), `ease.steps(n)`, `ease.bezier(x1, y1, x2, y2)`. An ease shapes only the transition it is passed to. Use `ease.linear` for spins and anything looping at constant speed.

## Recipes

```tsx
enter({ at: 0.5, over: 0.8 });                       // fade in
enter({ at: 0.5, over: 0.8 }, { y: 20, blur: 6 });   // arrive from these values to rest
enter({ at: 1, over: 0.4 }, { scale: 0 }, ease.pop); // pop in
exit({ at: 4, over: 0.4 });                          // fade out
exit({ at: 4, over: 0.4 }, { y: -10, opacity: 0 });  // leave to these values
draw({ at: 0, over: 1.2 });                          // stroke a shape on; needs a stroke
shake({ at: 2, over: 0.5 }, { x: 6 });               // damped shake on x, y or rotate
wiggle({ rotate: 4 }, { seed: "leaf", rate: 6 });    // seeded looping noise around rest
```

Recipes take a span `{ at, over }`. `enter` and `exit` only take rest channels (`opacity x y scale rotate blur`), because rest is where they start or end. Use `motion()` for colors. `wiggle` needs a `seed`; change the seed to reroll. `rate` is samples per second, `period` the loop length (default 2s), `ease: ease.hold` gives a jittery look.

### sampled()

Bake any function of time into keyframes. The tolerance per lane decides how many keys survive.

```tsx
sampled((t) => ({ x: 100 * Math.cos(t), y: 100 * Math.sin(t) }), {
  duration: 12,
  tolerance: { translate: 1 }, // px; rotate is degrees, scale and opacity are unitless
});
```

Every key the function returns needs a tolerance for its lane (`translate` covers `x` and `y`). Every sample must return the same keys, each a finite number. Make `t = duration` match `t = 0` if the scene loops.

## Defs, CSS and effects

```tsx
const fade = def.linearGradient({ x1: 0, y1: 0, x2: 0, y2: 1 }, <><stop offset={0} stopColor="#fff" /><stop offset={1} stopColor="#fff" stopOpacity={0} /></>);
<rect width={100} height={100} fill={fade} />;  // pass the ref itself, never a string or url(#id)

<text filter={fx.glow({ blur: 4 })}>OPEN</text>;   // neon bloom
<g filter={fx.boil({ strength: 2 })}>{/* ... */}</g>; // hand-drawn boil
```

`render` emits a def only if something uses it, with a generated id. `def.property(name, { syntax, inherits, initial })` declares a typed CSS custom property you can animate as a motion key and use inside `` css`...` `` with `calc`. `el.circle({...}, children)` builds elements without JSX.

Attributes are camelCase (`strokeWidth`, `textAnchor`, `strokeLinecap`) and the class attribute is `class`, not `className`.

## Images

Embed images as data URIs so the output stays one file. GitHub and Markdown show SVGs through `<img>`, which blocks external hrefs but allows `data:`.

```tsx
import { Picture, fx, motion, ease, picture } from "svjeez";

const photo = await picture.load(new URL("./harbor.jpg", import.meta.url)); // path, file: or http(s) URL
const logo = picture('<svg viewBox="0 0 40 40">...</svg>');                   // bytes or SVG markup, sync

<Picture src={photo} x={20} y={20} width={240} radius={16} fit="cover" alt="A harbor at dusk" filter={fx.duotone({ dark: "#1b1464", light: "#ffb36b" })} />;
<Picture src={photo} x={20} y={20} width={240} height={160} animation={motion({ scale: 1 }).to({ scale: 1.3 }, 6, ease.inOut)} />; // Ken Burns
```

`picture()` sniffs the format from the bytes (svg, png, jpeg, gif, webp), never the extension, and reads the intrinsic size from the header. It throws on anything else. `<Picture>` takes `x`, `y` and `width` and/or `height` (one given derives the other from the aspect ratio; none uses the intrinsic size), `fit` (`cover` default, `contain`, `fill`), `radius`, `filter`, `opacity`, `class` and `alt` (omit it and the picture is `aria-hidden`). `animation` moves the inner image while the frame stays put, so `scale` zooms about the frame's center, clipped to the frame. To animate the whole picture, wrap it in an animated `<g>`. Draw a picture as often as you like: its bytes go into the file once.

Filters that suit photos: `fx.grayscale({ amount })`, `fx.duotone({ dark, light })` (hex colors, maps luminance onto the ramp), `fx.blur({ blur })`, `fx.shadow({ dx, dy, blur, color, opacity })`.

Before you embed:

- Only SVG scales infinitely. Raster pixelates when scaled up, so prefer SVG, and export raster at 2x the drawn size.
- base64 adds about 33%, and the whole file downloads before the first frame. Keep each image small, under 100 KB; `validateSvg` warns past 256 KB.
- An embedded SVG is sealed. Web fonts, scripts and external refs do not load inside it, so outline its text. You cannot animate its parts. Its own CSS animations run when the outer SVG is inline in a page but freeze on the first frame through `<img>` (measured in Chromium), which is how GitHub shows it. Animate with `<Picture animation>` or a wrapping `<g>` instead.
- Animated content under a filter on a large image re-renders every frame and is expensive.
- You are redistributing the image's bytes. Check the license.

## Extras

Import from `svjeez/extras`. Every extra takes `theme`, `x`, `y`, `fontSize` and `class`, and returns `{ node, ... }`. Put `node` in the tree.

**Themes.** `const { theme, css } = adaptive({ dark: tomorrowNight, light: tomorrow })` gives colors as CSS variables (`theme.base00` background through `theme.base0F`) that follow the viewer's color scheme. Pass `css` to `render`. Diagram text inherits the page font, so add a font rule: `` css: `${css}\n.sans text{font-family:system-ui,sans-serif}` `` with `class: "sans"`.

**Code explainers.**

```tsx
const kw = (text: string): Run => ["keyword", text];
const src = code([[kw("const"), " total ", ["punct", "="], " ", ["fn", "sum", "call"], ["punct", "();"]]], { x: 40, y: 60, fontSize: 16, theme });
src.get("call"); src.find("total"); src.lines(1, 2); src.at(2, 8); // Rects and Points to aim at

const tl = timeline({ intro: read("One piece of state"), change: 5, outro: 3 }, { gap: 0.5 }); // named spans
morph([before, after], { at: [tl.change.at], gutter: true }).node; // moves surviving words, fades the rest
typewriter(src, { at: 1, cps: 28, cursor: true });  // { node, end }
reveal(src, { at: 1, step: 0.6 });                  // a paragraph at a time: { node, spans, end }
```

Annotations are components: `<Focus stops={[{ during: tl.intro, on: src.lines(2) }]}>`, `<Marker stops={[{ at: span, rect }]} />`, `<Callout target={rect} side="right" during={span}>text</Callout>`, `Arrow`, `Brace`, `Underline`, `Camera`. `during(span)` fades anything in and out over a span.

**Terminals.**

```tsx
const shell = window(rect(20, 20, 400, 170), { theme, title: "~/hello", dots: "traffic" });
const session = terminal(
  [{ cmd: "bun add svjeez", output: [[["muted", "installed svjeez"]]] }, { cmd: "bun run build", output: [[["green", "✓"], " dist/hello.svg"]] }],
  { theme, x: shell.body.x + 20, y: shell.body.y + 16, fontSize: 14 },
);
// duration: session.end + 2, so the last line stays up before the loop restarts
```

**Diagrams.** `flowchart`, `sequence`, `state`, `tree` and `lanes` take a typed spec, so a misspelled id is a compile error. Each returns `{ node, get(id), bounds }` plus helpers. Size the canvas from `bounds` instead of guessing. `anchor: "center"` places a diagram by its center. Stepped things take `at` plus `step`. `sequence`'s `play`, `state`'s `walk` and the code `reveal` also take one time per item, as in `play: { at: [0.5, 1, 3] }`, which keeps two diagrams in sync. A flowchart or tree `reveal` takes a single `at`. A node `role` (`task input output tool decision store`) picks its shape and color.

```tsx
const chart = flowchart({ nodes: { a: "Start", b: { label: "Done", role: "output" } }, edges: [["a", "b"]] }, { theme, reveal: { at: 0.5 } });
const trip = flow(chart.route("a", "b"), { at: 3, style: "comet", arrive: true }); // dot, comet, trace, packet
<>{chart.layers.under}{trip.node}{chart.layers.over}</>; // the flow runs between edges and nodes
```

`sequence(...).message(i)`, `state(...).walk(ids, { at })`, `tree(...).route(a, b)`, `lanes(...).x(t)` and `travel(points, { at })` cover the rest. Read `README.md` in the svjeez repo for each spec.

## Errors and fixes

Type errors (from `tsc`):

| Error | Cause | Fix |
| --- | --- | --- |
| `Type 'number' is not assignable to type 'never'` inside `.to({...})`, `motion({...})` or `sampled` | Misspelled channel (`opcity`), or a `sampled` key with no tolerance for its lane | Fix the name from the channel table; add the lane to `tolerance` |
| `Motion<"draw"> is not assignable to type 'Stack<TagChannels<"g">>'` | The tag cannot animate that channel (`draw` on `<g>`, `width` on `<circle>`) | Move the motion to a tag from the table, or wrap the element in `<g>` for transforms |
| `Ref<"linearGradient"> is not assignable to type 'Ref<"clipPath">'` | A def used in the wrong slot | Make the right def kind (`def.clipPath`, `def.mask`, `def.filter`) |
| `'duration' does not exist in type 'Span'` | Recipes take `{ at, over }` | Use `over`, the length in seconds |
| `No overload matches this call` on `enter` or `exit` | A non-rest channel such as `fill` | Use `motion().to({ fill }, over)` |
| `Expected 2 arguments` on `wiggle` | Missing options | `wiggle(amp, { seed: "name" })` |
| `Property 'title' is missing` | `render` needs `title` | Add a title (and a `desc`) |
| `Type '{ className: string; }' is not assignable to type 'Intrinsic<"rect">'` | JSX here is SVG | Use `class` |
| `Type '"c"' is not assignable to type '"a" \| "b"'` | Unknown id in a diagram spec or route | Use an id from `nodes` |

Runtime errors (thrown by `motion()` or `render()`):

| Message | Fix |
| --- | --- |
| `Two transitions move \`translate\` between 1s and 2s` | Merge them into one `.to({ x, y })`, or stack two motions |
| `A motion on <rect> runs until 4s, past the 2s scene` | Raise `duration`, or end the motion earlier |
| `loop(2) is shorter than the motion` | The loop period must cover every step in it |
| `<rect> has no attribute "stroke-width"` | Use camelCase: `strokeWidth` |
| `to() needs a positive duration. Use set() for a cut.` | `over` is a length; use `.set()` for an instant change |
| `Two keys are too close to tell apart` | Space transitions further apart, or shorten `duration` |
| `Unknown image format. picture() reads png, jpeg, gif, webp, svg.` | The bytes are something else, such as a path string, an HTML error page or AVIF. Convert the image, and pass a file or URL to `picture.load()` |
| `<image href="photo.png"> will not load when the SVG is shown through <img>` | `await picture.load(path)` and draw it with `<Picture>` |
| `Generated SVG is invalid` | Usually a hand-written `id` clashing with another; let `def` make ids |

## Render, look, fix

Render frames at the moments that matter and look at them before you report anything.

```sh
npx svjeez render scene.tsx --times 0,0.5,1.2,3 --sheet --out frames/  # Bun: bunx --bun svjeez render ...
```

This writes one PNG per time plus `sheet.png`, all frames on one labelled grid. Open `sheet.png` first. Without `--times` you get `--count` frames (default 6) over one loop. Frames follow the machine's light or dark appearance; render both `--scheme light` and `--scheme dark` when the scene uses an adaptive theme. Add `--scale 2` to read small text. `svjeez svg scene.tsx --out scene.svg` writes the SVG itself. From code, `renderFrames(svg, { times, sheet: true })` from `svjeez/frames` returns the same PNGs as bytes. Frames need `playwright-core` and Chromium: `npm i -D playwright-core && npx playwright-core install chromium-headless-shell`.

The loop:

1. Write the scene. Pick `duration` first and plan beats in absolute seconds.
2. Run `tsc --noEmit`. Fix type errors with the table above.
3. Render a sheet. Choose times at each beat's start, middle and end, plus `0` and just before `duration`.
4. Look at each frame and check, in order:
   - Is anything visible at `t = 0` that should still be hidden, or missing at the end?
   - Does each element arrive and leave when planned? A frame mid-transition should be partway.
   - Is anything clipped by the canvas, overlapping, or off center? Size the canvas from `bounds`.
   - Is text legible: font, size, contrast in both schemes?
   - Does the last frame match the first well enough that the loop does not jump?
5. Fix and render again. Report only after a sheet shows the intended motion, and name the times you checked.

Frames are deterministic: the same time renders the same pixels. Two times that should differ but render identically mean the motion is not attached or starts later than you think.

## Worked examples

Each file in `examples/` next to this skill compiles and renders. Read them as patterns.

- `examples/toast.tsx` shows a `motion()` chain with `.at` and `.to`, a stacked `enter` and `shake`, `draw` on a check mark, and `exit` through `ease.in`.
- `examples/orbit.tsx` shows `sampled()` for an elliptical orbit, a `.loop()` spin with `ease.linear`, and a `wiggle` breathing effect.
- `examples/review-flow.tsx` shows a typed `flowchart` with `reveal`, a `flow` comet along `route()`, an `adaptive` theme with a font rule, and a canvas sized from `bounds`.

Render one to see the loop in action: `npx svjeez render examples/orbit.tsx --count 6 --sheet`.

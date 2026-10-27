<h1 align="center">svjeez</h1>

<p align="center">Animated SVGs in TSX. One file out, no JavaScript.</p>

svjeez is a TypeScript library for making animated SVGs. Describe a scene with TSX, compose motions on a timeline, and render it to a single SVG file. The animation is built into the SVG with CSS and SVG animation, so it plays without a JavaScript runtime.

<p align="center"><img src="https://raw.githubusercontent.com/saiashirwad/svjeez/main/dist/horizon.svg" width="720" alt="An animated black hole" /></p>

## Installation

Install the package and configure TypeScript to use its JSX runtime:

```sh
npm install svjeez
```

```json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "svjeez",
    "strict": true
  }
}
```

## Basic usage

```tsx
import { writeFileSync } from "node:fs";
import { draw, ease, enter, motion, render } from "svjeez";

const svg = render(
  { width: 200, height: 120, duration: 4, title: "Hello" },
  <>
    <path
      d="M20 100C60 20 140 20 180 100"
      fill="none"
      stroke="#FF5FA8"
      strokeWidth={4}
      animation={draw({ at: 0.2, over: 1.2 })}
    />
    <circle
      cx={100}
      cy={40}
      r={8}
      fill="#3EE6D6"
      animation={enter({ at: 1.2, over: 0.5 }, { scale: 0 }, ease.pop)}
    />
  </>,
);

writeFileSync("hello.svg", svg);
```

Run it with Bun (`bun hello.tsx`) or on Node with [tsx](https://tsx.is) (`npx tsx hello.tsx`). For `tsc` to know `node:fs`, install `@types/node` and add `"types": ["node"]`.

<img src="https://raw.githubusercontent.com/saiashirwad/svjeez/main/dist/readme/basic.svg" width="200" alt="A curve draws on, then a dot pops in" />

## Motions

```tsx
motion({ opacity: 0 }) // initial values
  .at(1) // move the cursor to 1s
  .to({ opacity: 1 }, 0.5) // fade in, cursor now at 1.5s
  .wait(2) // hold for 2s
  .to({ opacity: 0, scale: 0.8 }, 0.4, ease.in)
  .set({ scale: 1 }); // hard cut
```

Between transitions, every value holds.

<img src="https://raw.githubusercontent.com/saiashirwad/svjeez/main/dist/readme/motion.svg" width="200" alt="A square fades in, holds, then shrinks away" />

### Channels

| Tag                        | Channels                                                                               |
| -------------------------- | -------------------------------------------------------------------------------------- |
| shapes, `g`, `text`, `use` | `opacity` `x` `y` `scale` `rotate` `blur` `fill` `stroke` `color`                      |
| shapes                     | `draw`                                                                                 |
| `rect`, `image`            | `width` `height`                                                                       |
| `stop`                     | `stopColor` `stopOpacity`                                                              |
| filter primitives          | `stdDeviation` `baseFrequency` `seed` `displace` `dx` `dy` `floodColor` `floodOpacity` |

### Loops

```tsx
motion({ rotate: 0 }).to({ rotate: 360 }, 2, ease.linear).loop(2);
```

`render` snaps each period so it divides `duration`.

### Stacking

```tsx
<circle animation={[enter({ at: 0, over: 0.6 }), wiggle({ x: 4, y: 4 }, { seed: "dot" })]} />
```

Index 0 is the outermost, as if it were a wrapper `<g>`.

<img src="https://raw.githubusercontent.com/saiashirwad/svjeez/main/dist/readme/loops.svg" width="200" alt="A looping spinner and a wandering dot" />

## Recipes

```tsx
enter({ at: 0.5, over: 0.8 }); // fade in
enter({ at: 0.5, over: 0.8 }, { y: 20, blur: 6 }); // rise out of a blur
exit({ at: 4, over: 0.4 }); // fade out
draw({ at: 0, over: 1.2 }); // stroke a shape on
shake({ at: 2, over: 0.5 }, { x: 6 }); // damped shake
wiggle({ rotate: 4 }, { seed: "leaf", rate: 6 }); // seeded noise that loops
```

<img src="https://raw.githubusercontent.com/saiashirwad/svjeez/main/dist/readme/recipes.svg" width="600" alt="enter, enter from a blur, exit, draw, shake and wiggle" />

```tsx
sampled((t) => ({ x: 100 * Math.cos(t), y: 100 * Math.sin(t) }), {
  duration: 12,
  tolerance: { translate: 1 },
});
```

`sampled` bakes any function of time and keeps only the keys each lane needs to stay within its tolerance.

## Easing

```tsx
ease.linear;
ease.in;
ease.out; // default
ease.inOut;
ease.pop; // overshoots, then settles
ease.hold; // jumps at the end
ease.steps(4);
ease.bezier(0.2, 0.8, 0.2, 1);
```

<img src="https://raw.githubusercontent.com/saiashirwad/svjeez/main/dist/readme/easing.svg" width="420" alt="Eight dots crossing a track, one per easing" />

## Defs

```tsx
const fade = def.linearGradient(
  { x1: 0, y1: 0, x2: 0, y2: 1 },
  <>
    <stop offset={0} stopColor="#fff" />
    <stop offset={1} stopColor="#fff" stopOpacity={0} />
  </>,
);

<rect width={100} height={100} fill={fade} />;
```

`render` emits a def only if something uses it, with a generated id.

### Properties

```tsx
const yaw = def.property("yaw", { syntax: "angle", inherits: true, initial: 0 });
const px = def.property("px", { syntax: "number", inherits: false, initial: 0 });

render(
  {
    width: 200,
    height: 200,
    duration: 4,
    title: "Orbit",
    css: css`
      .dot {
        translate: calc(100px + 60px * ${px} * cos(${yaw})) 100px;
      }
    `,
  },
  <g animation={motion().to({ [yaw]: 360 }, 4, ease.linear)}>
    <circle class="dot" r={6} style={{ [px]: 1 }} />
  </g>,
);
```

A property is a key in motions and `style`, and a hole in `css`. Each value is checked against its syntax: `number`, `length` (px), `angle` (deg) or `color`.

<img src="https://raw.githubusercontent.com/saiashirwad/svjeez/main/dist/readme/property.svg" width="200" alt="A dot orbiting, driven by an animated angle property" />

### Calc

```tsx
const { add, sub, mul, div, sin, cos, clamp, length, angle } = calc;

css`
  .dot {
    translate: ${add(length(100), mul(length(60), px, cos(yaw)))} 100px;
  }
`;
// .dot{translate:calc(100px + 60px * var(--p1) * cos(var(--p2))) 100px}

const z = add(mul(px, sin(yaw)), mul(pz, cos(yaw)));
css`
  .dot {
    scale: ${div(720, add(720, z))};
  }
`;
```

Operands are numbers, properties and other `calc` expressions, and units are checked. In `mul` and `div`, only the first operand may be a length or angle. `length(60)` is `60px`, and `length(expr)` turns a number into px. Also `min` and `max`.

## el

```tsx
const { circle, g } = el;

g({ opacity: 0.5 }, [
  circle({ cx: 12, cy: 34, r: 4, animation: enter({ at: 0, over: 1 }) }),
  el.text({ x: 4, y: 10 }, "hi"),
]);
```

Same props and children as JSX, as plain calls.

## Voxels

```tsx
const view = voxel.camera({ yaw: 45, pitch: 30, unit: 24 }); // unit: px per block edge
const grass = voxel.texture(
  { g: "#5DA03A", d: "#7A5534" },
  `
  gggg
  gdgg
  dddd
  dddd
`,
);

<g transform="translate(300 160)">
  {voxel.scene({
    camera: view,
    blocks: [
      { at: [0, 0, 0], skin: { side: dirt, top: grass } },
      { at: [1, 0, 0], skin: dirt, from: 3, until: 9 }, // pops in at 3s, gone at 9s
      { at: [0, 0, 1], skin: { side: dirt, top: grass }, from: 1, animation: enter({ at: 1, over: 0.6 }, { y: -30 }, ease.pop) },
    ],
  })}
</g>;

sampled((t) => view.project([2, 3 - t, 1]), { duration: 3, tolerance: { translate: 0.5 } }); // a free point
```

<img src="https://raw.githubusercontent.com/saiashirwad/svjeez/main/dist/readme/voxels.svg" width="200" alt="Three voxel blocks, one dropping in and one popping in" />

The scene is plain data: whole-cell blocks with an optional lifetime and motion. Blocks draw back to front, so order never depends on the array, except that blocks sharing a cell keep theirs (an overlay is a second block). A block hidden behind its three nearer neighbors for its whole life is left out, unless a neighbor is animated, has a transparent pixel, or lives a shorter time.

A texture is pixel art, one character per palette color (`#rgb`, `#rrggbb` or `#rrggbbaa`, `null` for a hole). Each face is shaded like Minecraft and every block skin is one symbol. A skin is a texture, or `{ side, top, north, south, east, west }` with `side` as the fallback.

## Effects

```tsx
<text filter={fx.glow({ blur: 4 })}>OPEN</text>
<g filter={fx.boil({ strength: 2 })}>{/* ... */}</g>
```

<img src="https://raw.githubusercontent.com/saiashirwad/svjeez/main/dist/readme/effects.svg" width="320" alt="A glowing word and a boiling hand-drawn house" />

## Extras

`svjeez/extras` builds code explainers and terminal recordings on top of the core. Every export is a plain function or component, so a bundle keeps only what it imports.

### Code

```tsx
import { code, tomorrowNight, type Run } from "svjeez/extras";

const kw = (text: string): Run => ["keyword", text];

const src = code(
  [
    [kw("const"), " total ", ["punct", "="], " ", ["fn", "sum", "call"], ["punct", "("], "xs", ["punct", ");"]],
    [kw("return"), " total", ["punct", ";"]],
  ],
  { x: 40, y: 60, fontSize: 16, gutter: true, theme: tomorrowNight },
);

src.node;           // the rendered code
src.get("call");    // Rect around every run with id "call"
src.find("total");  // Rect around the first "total"
src.lines(1, 2);    // Rect around lines 1-2
src.at(2, 8);       // Point at line 2, column 8
```

A line is a list of pieces. A piece is plain text, a `[role, text]` run, a `[role, text, id]` run, or a Shiki-style `{ content, color, fontStyle }` token. The theme colors each run by its role (`keyword`, `fn`, `string`, `number`, `type`, `tag`, `variable`, `punct`, `comment`, `muted`, and the ANSI names `red` through `cyan`). An id names a run for `get()` and for `morph`.

### Themes

```tsx
import { adaptive, base16, tomorrow, tomorrowNight } from "svjeez/extras";

const custom = base16("#111318", "#1a1d24", /* 14 more, base00 to base0F */);
const { theme, css } = adaptive({ dark: tomorrowNight, light: tomorrow });
render({ /* ... */ css }, content); // follows the viewer's light or dark mode
```

A theme is a base16 scheme. `defaultDark`, `defaultLight`, `tomorrowNight` and `tomorrow` are built in. `adaptive` turns a dark and light pair into one theme of CSS variables plus the CSS that switches them.

### Explainers

```tsx
import { Arrow, Callout, Focus, Marker, morph, read, timeline } from "svjeez/extras";

const tl = timeline({ intro: read("One piece of state"), change: 5, outro: 3 }, { gap: 0.5, pace: 1.2 });

<>
  <Focus stops={[{ during: tl.intro, on: before.lines(2) }]} dim={0.3}>
    {morph([before, after], { at: [tl.change.at], gutter: true }).node}
  </Focus>
  <Marker stops={[{ at: tl.intro, rect: before.get("hook").pad(4) }, { at: tl.change, rect: after.get("hook").pad(4) }]} />
  <Callout target={after.get("send")} side="right" during={tl.outro} class="note">Handlers send intent</Callout>
</>;
```

`morph` moves the words that survive each change and fades the rest. Runs that share an id pair first, and when their text differs they cross-fade as they move. `timeline` lays out named scenes, `read` gives the seconds a caption needs, and `pace` scales every scene. `timeline(beats, { at: tl.change.at })` lays out beats inside a scene. `during(span)` fades anything in and out with a span. `Camera` pans and zooms each stop's view to fit inside a `frame` rect; clip it yourself. Annotations take a `class`, so their font comes from your CSS.

<img src="https://raw.githubusercontent.com/saiashirwad/svjeez/main/dist/readme/code.svg" width="360" alt="A call to sum morphs into a reduce and back, with a marker following it" />

### Terminals

```tsx
import { terminal, typewriter, window } from "svjeez/extras";

const shell = window(rect(80, 50, 800, 340), { theme, title: "~/hello", dots: "traffic" });
const session = terminal(
  [
    { cmd: "bun add svjeez", output: [[["muted", "installed svjeez@0.2.0"]]] },
    { cmd: "bun run build", output: [[["green", "✓"], " dist/hello.svg"]] },
  ],
  { theme, x: shell.body.x + 32, y: shell.body.y + 20, fontSize: 16 },
);

<>{shell.node}{session.node}</>; // session.end is when the last command finishes

typewriter(src, { at: 1, cps: 28, cursor: true }); // any code, typed: { node, end }
reveal(src, { at: 1, step: 0.6 }); // a paragraph at a time: { node, spans, end }
reveal(src, { at: 1, blocks: [[2, 3], [5, 9]] }); // these lines in turn, the rest there from the start
reveal(src, { at: [1, 4] }); // one time per block
```

<img src="https://raw.githubusercontent.com/saiashirwad/svjeez/main/dist/readme/terminal.svg" width="440" alt="Two commands typed into a terminal window" />

### Diagrams

Each diagram takes a typed object, so a misspelled id is a compile error. It returns `{ node, get(id), bounds }` plus its own helpers, and takes `theme`, `x`, `y`, `fontSize` and `class` like the other extras. `anchor` (`"center"`, `"top"`, `"right"`, `"bottom"`, `"left"`, default `"top-left"`) picks the point of `bounds` that lands on `x`, `y`, so a diagram centers without measuring it first.

Anything that happens in steps takes `at` as a start, with things following `step` apart, or as one time per thing: `play: { at: [0.5, 1, 3] }`, `walk(path, { at: [1, 4, 5] })`, `reveal(src, { at: [1, 4] })`. That is how two diagrams stay in sync. A node's `role` (`task`, `input`, `output`, `tool`, `decision`, `store`) picks its shape and theme color.

```tsx
const chart = flowchart(
  {
    nodes: { pr: { label: "PR opened", role: "input" }, lint: { label: "Run linters", role: "tool" }, ok: { label: "Clean?", role: "decision" }, post: "Post review" },
    groups: { agent: { label: "Review agent", nodes: ["lint", "ok"] } },
    edges: [["pr", "lint"], ["lint", "ok"], ["ok", "post", { label: "yes" }], ["ok", "lint", { label: "no" }]],
  },
  { theme, reveal: { at: 0.5 } },
);
const trip = flow(chart.route("pr", "post"), { at: 4, style: "trace", arrive: true });
<>{chart.layers.under}{trip.node}{chart.layers.over}</>;
```

`flowchart` lays nodes out in ranks with curved edges that never cross a node; `edge(a, b)` and `route(a, b)` return points along the drawn curves. `layers` splits `node` into edges `under` and nodes `over`, so a flow runs between them.

<img src="https://raw.githubusercontent.com/saiashirwad/svjeez/main/dist/readme/flowchart.svg" width="250" alt="A review flowchart revealed rank by rank, then traced" />

`flow(points, { at, style })` runs something along a path: `dot`, `comet` (a head with a fading tail and halo), `trace` (lights the path as it goes, then fades) or `packet` (a labelled chip). `arrive: true` ripples a ring where it lands, and `end` is when it gets there. `walk({ token })` takes the same look options.

```tsx
const login = sequence(
  { actors: { user: "User", api: "API", db: { label: "Postgres", role: "store" } }, messages: [["user", "api", "POST /login"], ["api", "db", "select"], ["db", "api", "row", { reply: true }], { note: "api", text: "hash check" }] },
  { theme, play: { at: 0.5, step: 0.8 } },
);
```

`sequence` draws one row per message or note; `message(i)` gives its arrow and its slot on the `play` timeline.

<img src="https://raw.githubusercontent.com/saiashirwad/svjeez/main/dist/readme/sequence.svg" width="342" alt="A login sequence diagram playing message by message" />

```tsx
const agent = state(
  {
    states: { idle: "Idle", working: { label: "Working", states: { plan: "Plan", act: "Act" }, initial: "plan" }, done: { label: "Done", final: true } },
    initial: "idle",
    transitions: [["idle", "working", "task"], ["plan", "act"], ["act", "plan"], ["working", "done", "finish"]],
  },
  { theme },
);
const walk = agent.walk(["idle", "working", "plan", "act", "done"], { at: 1 }); // { node, spans, end }
```

`state` marks the initial state with a dot and sends final states to a bullseye; a state with `states` is a composite laid out inside its own box, and `walk` lights each state in turn while a token runs the transitions. Given one time per state, each lights at its time with the token arriving just then.

<img src="https://raw.githubusercontent.com/saiashirwad/svjeez/main/dist/readme/state.svg" width="178" alt="A state machine lighting each state in turn" />

```tsx
const team = tree({ nodes: { lead: "Lead", a: { label: "Search", parent: "lead" }, b: { label: "Build", parent: "lead" } } }, { theme, reveal: { at: 0.5 } });
team.route("a", "b"); // up through the common ancestor and down
```

`tree` is a tidy tree with each parent centered over its children, revealed breadth-first.

<img src="https://raw.githubusercontent.com/saiashirwad/svjeez/main/dist/readme/tree.svg" width="215" alt="A small tree revealed level by level" />

```tsx
const run = lanes(
  { lanes: { lead: "Lead", build: { label: "Build", role: "tool" } }, spans: [{ lane: "lead", from: 0, to: 1, label: "plan" }, { lane: "build", from: 1, to: 4, label: "editing" }], events: [{ lane: "build", at: 2, label: "TEST" }], links: [{ from: "lead", to: "build", at: 1 }] },
  { theme, scale: 80, play: { at: 0 } },
);
```

`lanes` puts one row per lane on a time axis in seconds; `x(t)` maps a time to x, and `play: { at }` runs it in real time from `at` with a playhead. `visible(spans)` and `travel(points, { at })` are the time helpers the diagrams use: on during each span, and a token that runs a path at constant speed.

<img src="https://raw.githubusercontent.com/saiashirwad/svjeez/main/dist/readme/lanes.svg" width="463" alt="Two lanes on a time axis played in real time" />

## Render

```tsx
render(
  {
    width: 600,
    height: 400,
    duration: 8, // one loop, in seconds
    title: "Hello",
    desc: "A dot fades in and pulses.",
    css: ".mono{font-family:ui-monospace,monospace}",
    reducedMotion: { at: 4 }, // frame shown under prefers-reduced-motion, or false
    speed: 1.5, // playback rate; duration and reducedMotion stay in scene seconds
    comment: "Generated by svjeez.",
  },
  content,
);
```

`render` throws if the output is invalid.

## Validation

```tsx
const { errors, warnings } = validateSvg(svg);
```

## Frames

`svjeez render` rasterizes an animation at chosen times, so you can check a moment without watching the loop. It takes an `.svg`, or a module whose default export is an SVG string or a function that returns one.

```sh
npm i -D playwright-core && npx playwright-core install chromium-headless-shell

npx svjeez render scene.tsx --times 0,0.5,1,2 --out frames/ --sheet
npx svjeez render scene.svg --count 8 --scale 2 --scheme dark
npx svjeez svg scene.tsx --out scene.svg
```

Times are playback seconds. Without `--times`, it takes `--count` frames (default 6) spread over one loop. `--sheet` also writes `sheet.png`, every frame on one labelled grid. On Node, a `.tsx` file loads through `tsx` if the project has it; under Bun, use `bunx --bun svjeez`.

The same thing is a function, for scripts and tools:

```ts
import { renderFrames } from "svjeez/frames";

const { duration, frames, sheet } = await renderFrames(svg, { times: [0, 1.5], scale: 2, sheet: true });
frames[0].png; // Uint8Array
```

Frames come from headless Chromium through `playwright-core`, an optional peer dependency. Every CSS and SMIL animation is paused and seeked to the time, so a frame is the same on every run.

## Development

```sh
bun install
bun run dev examples/readme/basic.tsx   # writes .preview/basic.svg, serves it, reloads on change
bun run build                           # every example into dist/
bun test && bun run typecheck
```

The preview page plays the SVG inline with a scrubber, and shows the error when a build fails. It watches the module's folder and `src/`.

## Type safety

```tsx
<g animation={draw({ at: 0, over: 1 })} /> // error: a <g> has no stroke to draw
<g clipPath={fade} />                       // error: a gradient is not a clip path
motion().to({ opcity: 1 }, 1);              // error: misspelled channel
calc.mul(calc.length(1), calc.length(2));   // error: a length times a length
calc.cos(px);                               // error: cos takes an angle
```

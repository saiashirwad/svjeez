<h1 align="center">svjeez</h1>

<p align="center">Animated SVGs in TSX. One file out, no JavaScript.</p>

Make code walkthroughs, diagrams and terminal animations in TSX. svjeez compiles them into a single SVG with no JavaScript or dependencies.

<p align="center"><img src="https://raw.githubusercontent.com/saiashirwad/svjeez/main/dist/readme/hero.svg" width="720" alt="A flowchart spec in TSX on the left; on the right each node appears as its line is highlighted, then a comet runs from PR opened to Post review" /></p>

The animation lives in the SVG, so it plays in an `<img>`, including in GitHub READMEs.

### Typed ids

Diagram ids are checked at compile time:

```ts
const chart = flowchart({
  nodes: { pr: "PR opened", lint: "Run linters", post: "Post review" },
  edges: [["pr", "lint"], ["lint", "posts"]],
});
chart.route("pr", "review");
```

```text
error TS2820: Type '"posts"' is not assignable to type '"lint" | "post" | "pr"'. Did you mean '"post"'?
error TS2345: Argument of type '"review"' is not assignable to parameter of type '"lint" | "post" | "pr"'.
```

## Installation

Install svjeez and configure its JSX runtime. svjeez needs Node 20 or later, and its type checks need TypeScript 5.4 or later:

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

Run with Bun (`bun hello.tsx`) or Node and [tsx](https://tsx.is) (`npx tsx hello.tsx`). For `node:fs` types, install `@types/node` and add `"types": ["node"]`.

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

Values hold between transitions.

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

The first animation is outermost, like a wrapper `<g>`.

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

`sampled` turns a function of time into keyframes within the given tolerance.

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

`render` gives used defs generated ids.

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

Use properties in motions, `style` and `css`. Values are checked against their declared syntax.

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

`calc` checks units in CSS expressions. It also includes `min` and `max`.

## el

```tsx
const { circle, g } = el;

g({ opacity: 0.5 }, [
  circle({ cx: 12, cy: 34, r: 4, animation: enter({ at: 0, over: 1 }) }),
  el.text({ x: 4, y: 10 }, "hi"),
]);
```

The same props and children as JSX, in plain calls.

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

A scene is a list of blocks with optional lifetimes and motion. Blocks draw back to front; blocks in the same cell keep their array order.

Textures are pixel art. A skin can use one texture for every face or different textures per face.

## Effects

```tsx
<text filter={fx.glow({ blur: 4 })}>OPEN</text>
<g filter={fx.boil({ strength: 2 })}>{/* ... */}</g>
```

<img src="https://raw.githubusercontent.com/saiashirwad/svjeez/main/dist/readme/effects.svg" width="320" alt="A glowing word and a boiling hand-drawn house" />

Photo filters: `fx.grayscale({ amount })`, `fx.duotone({ dark, light })`, `fx.blur({ blur })`, `fx.shadow({ dx, dy, blur, color, opacity })`.

## Images

Embed SVG or raster images as data URIs, so the output stays one file that GitHub shows through `<img>`.

```tsx
const photo = await picture.load(new URL("./harbor.jpg", import.meta.url)); // or picture(bytesOrSvgMarkup)
<Picture src={photo} x={20} y={20} width={240} radius={16} fit="cover" alt="A harbor" />
```

`<Picture>` takes `fit` (`cover`, `contain`, `fill`), `radius`, `filter`, `opacity`, `alt`, and an `animation` that moves the image inside a fixed frame (a Ken Burns zoom). `validateSvg` warns on external image hrefs, which GitHub won't load, and on a data URI over 256 KB. Prefer SVG, which scales infinitely; embedded SVGs are sealed, so outline their text. Full notes are in the skill's Images section. See `examples/images`.

## Fonts

Embed a font as real text, measure text with it, or draw text as animated outlines.

```tsx
const display = await font.load(new URL("./ArchivoBlack-Regular.ttf", import.meta.url)); // or font(bytes)
const body = font.family(await font.load("Body-Regular.ttf"), await font.load("Body-Italic.ttf"));

<text x={20} y={60} fontFamily={body}>Selectable text in an embedded font</text>
const w = display.measure("Wave!", 96); // px, matches the browser, kerning included
<Glyphs font={display} text="Wave!" size={96} x={(W - w) / 2} y={140} animation={(glyph, i) => draw({ at: i * 0.15, over: 1 })} />
```

A font is embedded once, only if the tree uses it, and cut down to the glyphs the scene's text needs. Load a coding font with `{ ligatures: false }` so its `=>` ligatures don't force the whole file in. `<Glyphs>` draws one path per glyph and embeds no font, which suits short animated titles. Extras take `font` and size their boxes by measuring. Full notes are in the skill's Fonts section. See `examples/fonts`, `examples/newspaper` for a front page with a drawn masthead and columns justified by measuring, and `examples/map` for a fantasy map with labels set along curves and a camera that follows a journey.

## Ink

Draw a path with a pen, brush, calligraphy nib or pencil instead of an even stroke. The tool sets the width at every point.

```tsx
<Stroke d="M20 80C80 20 160 140 220 80" tool={brush({ size: 8, seed: 2 })} color="#2B2118" draw={{ at: 0.5, over: 1.2 }} />
```

`draw` inks the stroke in along its path. `ink(d, tool)` returns the outline as path data. See the skill's Ink section, and `examples/map`, whose coasts, rivers, peaks and lava are all inked.

## Extras

`svjeez/extras` adds code explainers, terminals and diagrams.

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

Lines contain text, themed runs or Shiki tokens. Give a run an id to find it with `get()` or match it with `morph`.

### Themes

```tsx
import { adaptive, base16, tomorrow, tomorrowNight } from "svjeez/extras";

const custom = base16("#111318", "#1a1d24", /* 14 more, base00 to base0F */);
const { theme, css } = adaptive({ dark: tomorrowNight, light: tomorrow });
render({ /* ... */ css }, content); // follows the viewer's light or dark mode
```

Themes use base16 colors. `adaptive` switches between a dark and light theme.

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

`morph` moves matching text between versions. `timeline` arranges named scenes, and `read` estimates a caption’s duration.

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

typewriter(src, { at: 1, cps: 28, cursor: true }); // any code, typed: { node, end, lines }, a span per line
reveal(src, { at: 1, step: 0.6 }); // a paragraph at a time: { node, spans, end }
reveal(src, { at: 1, blocks: [[2, 3], [5, 9]] }); // these lines in turn, the rest there from the start
reveal(src, { at: [1, 4] }); // one time per block
```

<img src="https://raw.githubusercontent.com/saiashirwad/svjeez/main/dist/readme/terminal.svg" width="440" alt="Two commands typed into a terminal window" />

### Diagrams

Diagrams have typed ids and return `{ node, get(id), bounds }` alongside their own helpers. Use `anchor` to position a diagram by its center or edge.

Stepped animations accept a start time and spacing, or an array of times to sync them with other animations.

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

`edge` and `route` follow the drawn curves. Use `layers` to place a flow between the edges and nodes.

<img src="https://raw.githubusercontent.com/saiashirwad/svjeez/main/dist/readme/flowchart.svg" width="250" alt="A review flowchart revealed rank by rank, then traced" />

`flow` follows a path as a `dot`, `comet`, `trace` or `packet`.

```tsx
const login = sequence(
  { actors: { user: "User", api: "API", db: { label: "Postgres", role: "store" } }, messages: [["user", "api", "POST /login"], ["api", "db", "select"], ["db", "api", "row", { reply: true }], { note: "api", text: "hash check" }] },
  { theme, play: { at: 0.5, step: 0.8 } },
);
```

`message(i)` gives a message’s arrow and its slot on the `play` timeline.

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

`walk` follows the transitions, lighting each state in turn.

<img src="https://raw.githubusercontent.com/saiashirwad/svjeez/main/dist/readme/state.svg" width="178" alt="A state machine lighting each state in turn" />

```tsx
const team = tree({ nodes: { lead: "Lead", a: { label: "Search", parent: "lead" }, b: { label: "Build", parent: "lead" } } }, { theme, reveal: { at: 0.5 } });
team.route("a", "b"); // up through the common ancestor and down
```

`tree` lays out parents above their children and reveals them level by level.

<img src="https://raw.githubusercontent.com/saiashirwad/svjeez/main/dist/readme/tree.svg" width="215" alt="A small tree revealed level by level" />

```tsx
const run = lanes(
  { lanes: { lead: "Lead", build: { label: "Build", role: "tool" } }, spans: [{ lane: "lead", from: 0, to: 1, label: "plan" }, { lane: "build", from: 1, to: 4, label: "editing" }], events: [{ lane: "build", at: 2, label: "TEST" }], links: [{ from: "lead", to: "build", at: 1 }] },
  { theme, scale: 80, play: { at: 0 } },
);
```

`lanes` plots spans and events on a time axis. `play` adds a playhead.

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

`svjeez render` captures frames from an SVG or a module that exports one.

```sh
npm i -D playwright-core && npx playwright-core install chromium-headless-shell

npx svjeez render scene.tsx --times 0,0.5,1,2 --out frames/ --sheet
npx svjeez render scene.svg --count 8 --scale 2 --scheme dark
npx svjeez svg scene.tsx --out scene.svg
```

Times are playback seconds. Without `--times`, frames are spread over one loop. `--sheet` writes a labelled grid; `--scheme` sets light or dark mode. On Node, loading `.tsx` requires `tsx`. Under Bun, use `bunx --bun svjeez`.

For scripts and tools:

```ts
import { renderFrames } from "svjeez/frames";

const { duration, frames, sheet } = await renderFrames(svg, { times: [0, 1.5], scale: 2, sheet: true });
frames[0].png; // Uint8Array
```

Frames use headless Chromium through the optional `playwright-core` peer dependency.

## Development

```sh
bun install
bun run dev examples/readme/basic.tsx   # writes .preview/basic.svg, serves it, reloads on change
bun run render-png examples/readme/basic.tsx --times 0,1,2   # PNG frames into frames/
bun run build                           # every example into dist/
bun test && bun run typecheck
```

The preview watches the module’s folder and `src/`, with a scrubber and build errors.

For coding agents, see [`AGENTS.md`](AGENTS.md) and the [scene-writing skill](skills/svjeez/SKILL.md). Run `npx svjeez skill` to print the skill or `npx svjeez skill --install` to install it (use `--dir` to choose a folder).

## Type safety

```tsx
<g animation={draw({ at: 0, over: 1 })} /> // error: a <g> has no stroke to draw
<g clipPath={fade} />                       // error: a gradient is not a clip path
motion().to({ opcity: 1 }, 1);              // error: misspelled channel
calc.mul(calc.length(1), calc.length(2));   // error: a length times a length
calc.cos(px);                               // error: cos takes an angle
```

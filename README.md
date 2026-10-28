<p align="center">
  <img src="https://raw.githubusercontent.com/saiashirwad/svjeez/main/dist/readme/hero.svg" width="840" alt="The svjeez wordmark inks on above a four-quadrant showcase: code morphing with a gliding marker, a typed flowchart traced by comets, hand-inked calligraphy written stroke by stroke, and a damped spring physics simulation plotted in real time." />
</p>

<p align="center">
  <strong>Write scenes in TSX. Compile them into a single animated SVG. Zero runtime JavaScript.</strong>
</p>

<p align="center">
  <a href="https://svjeez.texoport.in">Website</a> ·
  <a href="https://svjeez.texoport.in/examples/">Examples Gallery</a> ·
  <a href="https://svjeez.texoport.in/intro">45s Intro Reel</a> ·
  <a href="https://github.com/saiashirwad/svjeez/blob/main/skills/svjeez/SKILL.md">Agent Skill &amp; Docs</a> ·
  <a href="https://www.npmjs.com/package/svjeez">npm</a>
</p>

---

**svjeez** compiles TSX scenes into one self-contained animated SVG. Motions compile to CSS `@keyframes` (or SMIL `<animate>` on filter primitives), fonts are subsetted and embedded, and themes adapt to `prefers-color-scheme` and `prefers-reduced-motion` inside the file itself.

Because the animation lives in the SVG with **no JavaScript**, it plays anywhere an `<img>` tag works — including GitHub READMEs, docs sites, and blog posts.

## Made with svjeez

Every preview below is a single `.svg` file loaded in an `<img>` tag. Click any card to inspect it full-size on [svjeez.texoport.in](https://svjeez.texoport.in/examples/) or read its TSX source.

<table>
  <tr>
    <td align="center" width="50%">
      <a href="https://svjeez.texoport.in/examples/map">
        <img src="https://raw.githubusercontent.com/saiashirwad/svjeez/main/dist/map.svg" width="400" alt="A hand-inked fantasy map draws itself, then the camera zooms in and follows a dashed route east to Mount Cinder." />
      </a><br />
      <sub><b>The Western Reaches</b> · Hand-inked cartography, curved labels &amp; camera pan (<a href="https://github.com/saiashirwad/svjeez/tree/main/examples/map">TSX</a>)</sub>
    </td>
    <td align="center" width="50%">
      <a href="https://svjeez.texoport.in/examples/breaker">
        <img src="https://raw.githubusercontent.com/saiashirwad/svjeez/main/dist/breaker.svg" width="400" alt="A seven-slide explainer on circuit breakers combining code morphs, state machines, sequence diagrams, lanes, and flowcharts." />
      </a><br />
      <sub><b>Circuit Breakers</b> · 7-slide explainer with code, state machine, sequence &amp; lanes (<a href="https://github.com/saiashirwad/svjeez/tree/main/examples/breaker">TSX</a>)</sub>
    </td>
  </tr>
  <tr>
    <td align="center" width="50%">
      <a href="https://svjeez.texoport.in/examples/horizon">
        <img src="https://raw.githubusercontent.com/saiashirwad/svjeez/main/dist/horizon.svg" width="400" alt="A cinematic black hole with a glowing accretion disk, lensed photon ring, relativistic jets, and HUD telemetry." />
      </a><br />
      <sub><b>Event Horizon</b> · Accretion disk, lensed photon ring, camera shake &amp; HUD (<a href="https://github.com/saiashirwad/svjeez/tree/main/examples/horizon">TSX</a>)</sub>
    </td>
    <td align="center" width="50%">
      <a href="https://svjeez.texoport.in/examples/strata">
        <img src="https://raw.githubusercontent.com/saiashirwad/svjeez/main/dist/strata.svg" width="400" alt="An outliner app with coding agents working in the margin, typing a query, citing sources, and inserting structured notes." />
      </a><br />
      <sub><b>Strata</b> · Product UI showcase with live margin agents (<a href="https://github.com/saiashirwad/svjeez/tree/main/examples/strata">TSX</a>)</sub>
    </td>
  </tr>
  <tr>
    <td align="center" width="50%">
      <a href="https://svjeez.texoport.in/examples/daynight">
        <img src="https://raw.githubusercontent.com/saiashirwad/svjeez/main/dist/daynight.svg" width="400" alt="A lighthouse scene that shows sun and clouds in light mode, or moon, stars, and a sweeping lantern beam in dark mode." />
      </a><br />
      <sub><b>Day &amp; Night Lighthouse</b> · One SVG that swaps scenes with your OS theme (<a href="https://github.com/saiashirwad/svjeez/tree/main/examples/daynight">TSX</a>)</sub>
    </td>
    <td align="center" width="50%">
      <a href="https://svjeez.texoport.in/examples/newspaper">
        <img src="https://raw.githubusercontent.com/saiashirwad/svjeez/main/dist/newspaper.svg" width="240" alt="A broadsheet front page spins in: a blackletter masthead inks on letter by letter, three measured columns justify, and an EXTRA stamp lands." />
      </a><br />
      <sub><b>The Svjeez Gazette</b> · Outlined masthead &amp; measured column justification (<a href="https://github.com/saiashirwad/svjeez/tree/main/examples/newspaper">TSX</a>)</sub>
    </td>
  </tr>
</table>

<p align="center">
  More in <a href="https://github.com/saiashirwad/svjeez/tree/main/examples"><code>examples/</code></a>:
  <a href="https://svjeez.texoport.in/examples/lighthouse">Agent Timelapse (108s)</a> ·
  <a href="https://svjeez.texoport.in/examples/horizon">Event Horizon</a> ·
  <a href="https://svjeez.texoport.in/examples/grove">Floating Grove</a> ·
  <a href="https://svjeez.texoport.in/examples/manifold">3D Manifold</a> ·
  <a href="https://svjeez.texoport.in/examples/bloom">Bloom</a> ·
  <a href="https://svjeez.texoport.in/examples/explainer">React Explainer</a> ·
  <a href="https://svjeez.texoport.in/examples/walkthrough">Server Walkthrough</a> ·
  <a href="https://svjeez.texoport.in/intro">45s Hype Reel</a>
</p>

---

## Quickstart

### 1. Install

svjeez runs on Node 20+ or Bun and has zero runtime dependencies. For full type checking, use TypeScript 5.4+.

```sh
npm install svjeez
```

Configure TypeScript to use svjeez's JSX runtime in `tsconfig.json` (or add `/** @jsxImportSource svjeez */` at the top of a file):

```json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "svjeez",
    "strict": true
  }
}
```

> **Using a coding agent?** Install the built-in scene-writing skill and worked examples into `.claude/skills/svjeez` (pass `--dir` for another agent harness):
>
> ```sh
> npx svjeez skill --install
> ```

### 2. Write a scene (`scene.tsx`)

Export a default function returning `render(...)`. Both the CLI and the live preview load this module shape:

```tsx
import { draw, ease, enter, render } from "svjeez";

export default function build(): string {
  return render(
    {
      width: 200,
      height: 120,
      duration: 4,
      title: "Hello",
      desc: "A curve draws on, then a dot pops in.",
    },
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
}
```

### 3. Render & inspect frames

Compile to a standalone `.svg` file, or rasterize a labelled contact sheet of timestamps to verify your timing visually:

```sh
# Compile to SVG (on Node, install tsx so Node can import .tsx; on Bun, use bunx --bun svjeez)
npx svjeez svg scene.tsx --out hello.svg

# Optional: render PNG frames & a contact sheet to check timing in headless Chromium
npm i -D playwright-core && npx playwright-core install chromium-headless-shell
npx svjeez frames scene.tsx --times 0,0.8,1.6,3 --sheet --out frames/
```

<img src="https://raw.githubusercontent.com/saiashirwad/svjeez/main/dist/readme/basic.svg" width="200" alt="A curve draws on, then a dot pops in" />

---

## Tour of Features

### 1. Timeline, Recipes & Easing

Every motion lives on the scene timeline (`0` to `duration`). `motion()` uses a cursor: `.at(t)` moves the cursor, `.to(values, over, ease?)` transitions over a duration and advances the cursor, `.wait(d)` holds values, and `.set(values)` cuts instantly.

```tsx
import { draw, ease, enter, exit, motion, sampled, shake, wiggle } from "svjeez";

// Chainable timeline
const pulse = motion({ opacity: 0 })
  .at(1)
  .to({ opacity: 1 }, 0.5)
  .wait(2)
  .to({ opacity: 0, scale: 0.8 }, 0.4, ease.in)
  .set({ scale: 1 });

// Ready-made recipes
enter({ at: 0.5, over: 0.8 }, { y: 20, blur: 6 }); // rise out of a blur to rest
exit({ at: 4, over: 0.4 }); // fade out
draw({ at: 0, over: 1.2 }); // stroke a path or shape on
shake({ at: 2, over: 0.5 }, { x: 6 }); // damped shake
wiggle({ rotate: 4 }, { seed: "leaf", rate: 6 }); // seeded looping noise

// Stack multiple animations on one element (outermost first) + loop
<circle animation={[enter({ at: 0, over: 0.6 }), wiggle({ x: 4, y: 4 }, { seed: "dot" })]} />;

// Bake any math or physics function of time into keyframes within a pixel/degree tolerance
const orbit = sampled((t) => ({ x: 100 * Math.cos(t), y: 100 * Math.sin(t) }), {
  duration: 12,
  tolerance: { translate: 1 },
});
```

<p>
  <img src="https://raw.githubusercontent.com/saiashirwad/svjeez/main/dist/readme/recipes.svg" width="560" alt="enter, enter from a blur, exit, draw, shake and wiggle" />
</p>
<p>
  <img src="https://raw.githubusercontent.com/saiashirwad/svjeez/main/dist/readme/motion.svg" width="180" alt="A square fades in, holds, then shrinks away" />
  <img src="https://raw.githubusercontent.com/saiashirwad/svjeez/main/dist/readme/loops.svg" width="180" alt="A looping spinner and a wandering dot" />
  <img src="https://raw.githubusercontent.com/saiashirwad/svjeez/main/dist/readme/easing.svg" width="340" alt="Eight dots crossing a track, one per easing" />
</p>

### 2. Code Walkthroughs, Morphing & Terminals (`svjeez/extras`)

`svjeez/extras` turns code blocks into measurable geometry (`src.get(id)`, `src.find(text)`, `src.lines(a, b)`) that drives `<Focus>`, `<Marker>`, `<Callout>`, `<Arrow>`, `<Brace>`, `<Underline>`, `<Camera>`, and token-level `morph()`.

```tsx
import {
  Callout,
  Focus,
  Marker,
  adaptive,
  appWindow,
  code,
  morph,
  readingTime,
  terminal,
  timeline,
  tomorrow,
  tomorrowNight,
} from "svjeez/extras";

// Adaptive base16 themes emit CSS variables that follow prefers-color-scheme
const { theme, css } = adaptive({ dark: tomorrowNight, light: tomorrow });

// Named beats with automatic reading-time estimation
const tl = timeline(
  { intro: readingTime("One piece of state"), change: 5, outro: 3 },
  { gap: 0.5 },
);

// Morph matching tokens smoothly between code versions while markers and callouts track them
<>
  <Focus stops={[{ during: tl.intro, target: before.lines(2) }]} dim={0.3}>
    {morph([before, after], { at: [tl.change.at], gutter: true }).node}
  </Focus>
  <Marker
    theme={theme}
    stops={[
      { during: tl.intro, target: before.get("hook").pad(4) },
      { during: tl.change, target: after.get("hook").pad(4) },
    ]}
  />
  <Callout theme={theme} target={after.get("send")} side="right" during={tl.outro}>
    Handlers send intent
  </Callout>
</>;
```

<p>
  <img src="https://raw.githubusercontent.com/saiashirwad/svjeez/main/dist/explainer.svg" width="680" alt="A React counter refactored from useState to useReducer across four timed slides with Focus, Marker, Brace, Arrow and morph" />
</p>

Build terminal recordings with `appWindow`, `terminal`, `typewriter`, and `reveal`:

```tsx
const shell = appWindow(rect(80, 50, 800, 340), { theme, title: "~/hello", dots: "traffic" });
const session = terminal(
  [
    { cmd: "bun add svjeez", output: [[["muted", "installed svjeez"]]] },
    { cmd: "bun run build", output: [[["green", "✓"], " dist/hello.svg"]] },
  ],
  { theme, x: shell.body.x + 32, y: shell.body.y + 20, fontSize: 16 },
);
```

<p>
  <img src="https://raw.githubusercontent.com/saiashirwad/svjeez/main/dist/terminal.svg" width="560" alt="Two commands typed into an adaptive terminal window" />
</p>

### 3. Typed Diagrams & Flows (`svjeez/extras`)

All five diagram builders — `flowchart`, `sequence`, `stateMachine`, `tree`, and `lanes` — infer literal node IDs from your spec. Referencing a nonexistent node in an edge, transition, or `.route()` fails at compile time with a suggestion:

```ts
const chart = flowchart({
  nodes: { pr: "PR opened", lint: "Run linters", post: "Post review" },
  edges: [
    ["pr", "lint"],
    ["lint", "posts"],
  ],
  //                                ^^^^^^^
  // error TS2820: Type '"posts"' is not assignable to type '"lint" | "post" | "pr"'. Did you mean '"post"'?
});
```

Diagrams lay themselves out and expose `.get(id)`, `.bounds`, `.route(from, to)`, and `.layers` so `flow()` tokens (`"dot"`, `"comet"`, `"trace"`, or `"packet"`) can travel right between edges and nodes:

```tsx
const chart = flowchart(
  {
    nodes: {
      pr: { label: "PR opened", role: "input" },
      lint: { label: "Run linters", role: "tool" },
      ok: { label: "Clean?", role: "decision" },
      post: "Post review",
    },
    groups: { agent: { label: "Review agent", nodes: ["lint", "ok"] } },
    edges: [
      ["pr", "lint"],
      ["lint", "ok"],
      ["ok", "post", { label: "yes" }],
      ["ok", "lint", { label: "no" }],
    ],
  },
  { theme, play: { at: 0.5 } },
);
const trip = flow(chart.route("pr", "post"), { theme, at: 4, style: "trace", arrive: true });

<>
  {chart.layers.under}
  {trip.node}
  {chart.layers.over}
</>;
```

<table>
  <tr>
    <td align="center">
      <img src="https://raw.githubusercontent.com/saiashirwad/svjeez/main/dist/readme/flowchart.svg" width="220" alt="Flowchart revealed rank by rank, then traced" /><br />
      <sub><code>flowchart()</code> + <code>flow()</code></sub>
    </td>
    <td align="center">
      <img src="https://raw.githubusercontent.com/saiashirwad/svjeez/main/dist/readme/sequence.svg" width="300" alt="Sequence diagram playing message by message" /><br />
      <sub><code>sequence()</code></sub>
    </td>
    <td align="center">
      <img src="https://raw.githubusercontent.com/saiashirwad/svjeez/main/dist/readme/state.svg" width="160" alt="State machine walking nested states" /><br />
      <sub><code>stateMachine()</code> + <code>.walk()</code></sub>
    </td>
  </tr>
  <tr>
    <td align="center">
      <img src="https://raw.githubusercontent.com/saiashirwad/svjeez/main/dist/readme/tree.svg" width="215" alt="Tree revealed level by level" /><br />
      <sub><code>tree()</code></sub>
    </td>
    <td align="center" colspan="2">
      <img src="https://raw.githubusercontent.com/saiashirwad/svjeez/main/dist/readme/lanes.svg" width="440" alt="Two lanes on a time axis with a sweeping playhead" /><br />
      <sub><code>lanes()</code></sub>
    </td>
  </tr>
</table>

### 4. Ink, Fonts, Images & Effects

Draw variable-width strokes with a pen, brush, calligraphy nib, or pencil (`<Ink>`); subset and embed TTF/OTF fonts (`font.load`) or draw outlined glyphs (`<Glyphs>`); embed framed photos with Ken Burns pan/zoom (`<Picture>`); and apply animated SVG filters (`fx.*`).

```tsx
import { Glyphs, Ink, Picture, draw, font, fx, picture, strokeFont, tool } from "svjeez";

const display = await font.load(new URL("./ArchivoBlack-Regular.ttf", import.meta.url));
const photo = await picture.load(new URL("./nebula.jpg", import.meta.url));

// Outlined display type drawn letter by letter + exact browser-matching text measurement
const w = display.measure("Wave!", 96);
<Glyphs
  font={display}
  text="Wave!"
  size={96}
  x={(680 - w) / 2}
  y={140}
  animation={(_, i) => draw({ at: i * 0.15, over: 1 })}
/>;

// Variable-width brush, nib, pen, or pencil strokes (plus single-line handwriting via strokeFont)
<Ink
  d="M20 80C80 20 160 140 220 80"
  tool={tool.brush({ size: 8, seed: 2 })}
  fill="#2B2118"
  draw={{ at: 0.5, over: 1.2 }}
/>;

// Embedded images (SVG/PNG/JPEG/WebP/GIF/AVIF) & animated SMIL/CSS filters
<Picture
  src={photo}
  x={20}
  y={20}
  width={240}
  radius={16}
  fit="cover"
  filter={fx.duotone({ dark: "#14162A", light: "#FFB86C" })}
  alt="Nebula"
/>;
<g filter={fx.boil({ strength: 2 })}>{/* hand-drawn line boil */}</g>;
```

<p>
  <img src="https://raw.githubusercontent.com/saiashirwad/svjeez/main/dist/fonts.svg" width="340" alt="Wave! drawn as glyph outlines then filled, with measured text below" />
  <img src="https://raw.githubusercontent.com/saiashirwad/svjeez/main/dist/images.svg" width="340" alt="Picture fit modes, duotone, grayscale, and Ken Burns pan/zoom" />
</p>
<p>
  <img src="https://raw.githubusercontent.com/saiashirwad/svjeez/main/dist/effects.svg" width="460" alt="Six effect tiles: blur, jitter, smooth drift, boiling house, neon flicker, spinner" />
</p>

### 5. Defs, Typed CSS `@property` & Unit-Checked `calc()`

Create gradients, masks, clip paths, patterns, filters, and reusable `<symbol>` defs with `def.*` (`render` assigns conflict-free IDs only to referenced defs), or animate typed CSS `@property` variables inside dimension-checked `calc()` expressions:

```tsx
import { calc, css, def, ease, motion, render } from "svjeez";

const fade = def.linearGradient(
  { x1: 0, y1: 0, x2: 0, y2: 1 },
  <>
    <stop offset={0} stopColor="#fff" />
    <stop offset={1} stopColor="#fff" stopOpacity={0} />
  </>,
);

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
        translate: ${calc.add(calc.length(100), calc.mul(calc.length(60), px, calc.cos(yaw)))} 100px;
      }
    `,
  },
  <g animation={motion().to({ [yaw]: 360 }, 4, ease.linear)}>
    <circle class="dot" r={6} fill={fade} style={{ [px]: 1 }} />
  </g>,
);
```

<p>
  <img src="https://raw.githubusercontent.com/saiashirwad/svjeez/main/dist/readme/property.svg" width="180" alt="A dot orbiting, driven by an animated angle property" />
</p>

---

## End-to-End Type Safety

Beyond diagram IDs, svjeez uses TypeScript's type system to catch broken animations and invalid SVG combinations before you render:

```tsx
<g animation={draw({ at: 0, over: 1 })} /> // ✗ error: <g> has no stroke to draw
<g clipPath={fadeGradient} />              // ✗ error: Ref<"linearGradient"> is not assignable to Ref<"clipPath">
motion().to({ opcity: 1 }, 1);             // ✗ error: misspelled channel
calc.mul(calc.length(1), calc.length(2));  // ✗ error: cannot multiply a length by a length
calc.cos(px);                              // ✗ error: calc.cos() requires an angle
```

At runtime, `render()` validates its own output (`validateSvg(svg)`) and throws actionable errors if a motion exceeds `duration`, two transitions collide on the same lane, or a non-stackable channel is stacked.

---

## CLI, `render()` & Plain TypeScript (`el`)

### CLI commands

| Command                                                              | Description                                                                                                                                                  |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npx svjeez svg <file.tsx> [-o out.svg]`                             | Compile a scene module (or validate an `.svg`) to `--out` or stdout.                                                                                         |
| `npx svjeez frames <file> [-t 0,1,2 \| -n 6] [--sheet] [-o frames/]` | Rasterize PNG frames and an optional contact sheet (`sheet.png`). Supports `--scale`, `--columns`, `--color-scheme light\|dark\|system`, and `--background`. |
| `npx svjeez skill [--install [--dir .claude/skills]]`                | Print `SKILL.md` or copy the full skill, references, and examples into your project.                                                                         |

### `render(options, content)` & `renderFrames(svg, options)`

```tsx
import { render, validateSvg } from "svjeez";
import { renderFrames } from "svjeez/frames";

const svg = render(
  {
    width: 600,
    height: 400,
    duration: 8, // loop length in seconds
    title: "My Scene", // required; wired to role="img" and aria-labelledby
    desc: "Accessible summary.",
    css: ".mono { font-family: ui-monospace, monospace }",
    reducedMotion: { at: 4 }, // freeze frame for prefers-reduced-motion (defaults to 85% of duration)
    playbackRate: 1.5, // speed multiplier
    loop: false, // play once and hold the final frame (default: true)
    prefix: "hero-", // namespace generated IDs/classes/keyframes when inlining multiple SVGs on one page
  },
  content,
);

const { errors, warnings } = validateSvg(svg);
const { frames, sheet } = await renderFrames(svg, { times: [0, 2, 4], scale: 2, sheet: true });
```

### Without JSX (`el`)

Prefer plain `.ts` files or embedding inside a non-JSX framework? `el` builds the exact same SVG nodes with identical props and type checking:

```ts
import { draw, el, render } from "svjeez";

const { path, circle } = el;
const svg = render({ width: 200, height: 120, duration: 4, title: "Hello" }, [
  path({
    d: "M20 100C60 20 140 20 180 100",
    fill: "none",
    stroke: "#FF5FA8",
    strokeWidth: 4,
    animation: draw({ at: 0.2, over: 1.2 }),
  }),
  circle({ cx: 100, cy: 40, r: 8, fill: "#3EE6D6" }),
]);
```

---

## Contributing & Local Development

```sh
bun install
bun run dev examples/readme/hero.tsx                         # live preview with hot reload & timeline scrubber
bun run render-png examples/readme/hero.tsx --sheet          # render PNG frames & contact sheet into frames/
bun run build                                                # compile all examples into dist/
bun test && bun run typecheck                                # run test suite & typecheck
```

See [`AGENTS.md`](https://github.com/saiashirwad/svjeez/blob/main/AGENTS.md) for architecture notes and release instructions. MIT Licensed.

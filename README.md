<p align="center">
  <img src="https://raw.githubusercontent.com/saiashirwad/svjeez/main/examples/dist/readme/hero.svg" width="840" alt="The svjeez wordmark inks on above a four-quadrant showcase: code morphing with a gliding marker, a typed flowchart traced by comets, hand-inked calligraphy written stroke by stroke, and a damped spring physics simulation plotted in real time." />
</p>

<p align="center">
  <strong>Write scenes in TSX. Compile them into a single animated SVG. Zero runtime JavaScript.</strong>
</p>

<p align="center">
  <a href="https://svjeez.texoport.in">Website</a> ·
  <a href="https://svjeez.texoport.in/examples/">Examples</a> ·
  <a href="https://svjeez.texoport.in/intro">45s intro</a> ·
  <a href="https://github.com/saiashirwad/svjeez/blob/main/packages/svjeez/skills/svjeez/SKILL.md">Docs &amp; agent skill</a> ·
  <a href="https://www.npmjs.com/package/svjeez">npm</a>
</p>

---

svjeez compiles a TSX scene into one self-contained SVG. Motions become CSS `@keyframes`, or SMIL on filter primitives. Fonts are subset and embedded, and the file follows `prefers-color-scheme` and `prefers-reduced-motion` by itself. Nothing runs in the viewer's browser, so a scene plays anywhere an `<img>` works, this README included.

## Quickstart

```sh
npm install svjeez
```

Set `"jsx": "react-jsx"` and `"jsxImportSource": "svjeez"` in `tsconfig.json`, then write `scene.tsx`:

```tsx
import { draw, ease, enter, render } from "svjeez";

export default () =>
  render(
    { width: 200, height: 120, duration: 4, title: "Hello" },
    <>
      <path d="M20 100C60 20 140 20 180 100" fill="none" stroke="#FF5FA8" strokeWidth={4}
        animation={draw({ at: 0.2, over: 1.2 })} />
      <circle cx={100} cy={40} r={8} fill="#3EE6D6"
        animation={enter({ at: 1.2, over: 0.5 }, { scale: 0 }, ease.pop)} />
    </>,
  );
```

<img src="https://raw.githubusercontent.com/saiashirwad/svjeez/main/examples/dist/readme/basic.svg" width="200" align="right" alt="A curve draws on, then a dot pops in" />

```sh
npx svjeez svg scene.tsx --out hello.svg              # needs tsx on Node; on Bun use bunx --bun
npx svjeez frames scene.tsx --times 0,1,2 --sheet     # PNG contact sheet, needs playwright-core
npx svjeez skill --install                            # the scene-writing skill for coding agents
```

Node 20+ or Bun. No runtime dependencies.

## What's in the box

`motion()` timelines and recipes (`enter`, `exit`, `draw`, `shake`, `wiggle`), `sampled()` for baking physics into keyframes, code walkthroughs with token `morph()`, terminals, five typed diagram builders whose node IDs are checked at compile time, variable-width `<Ink>`, embedded fonts and images, filters, and typed CSS `@property` with unit-checked `calc()`. [`SKILL.md`](https://github.com/saiashirwad/svjeez/blob/main/packages/svjeez/skills/svjeez/SKILL.md) covers all of it.

<p align="center">
  <img src="https://raw.githubusercontent.com/saiashirwad/svjeez/main/examples/dist/readme/recipes.svg" width="420" alt="enter, enter from a blur, exit, draw, shake and wiggle" />
  <img src="https://raw.githubusercontent.com/saiashirwad/svjeez/main/examples/dist/readme/flowchart.svg" width="180" alt="Flowchart revealed rank by rank, then traced" />
  <img src="https://raw.githubusercontent.com/saiashirwad/svjeez/main/examples/dist/readme/state.svg" width="140" alt="State machine walking nested states" />
</p>
<p align="center">
  <img src="https://raw.githubusercontent.com/saiashirwad/svjeez/main/examples/dist/explainer.svg" width="420" alt="A React counter refactored from useState to useReducer across four timed slides with Focus, Marker, Brace, Arrow and morph" />
  <img src="https://raw.githubusercontent.com/saiashirwad/svjeez/main/examples/dist/effects.svg" width="320" alt="Six effect tiles: blur, jitter, smooth drift, boiling house, neon flicker, spinner" />
</p>

## Packages

Each package runs while the scene compiles, so the SVG it ends up in still carries no script.

<table>
  <tr>
    <td width="50%" valign="top">
      <a href="https://github.com/saiashirwad/svjeez/tree/main/packages/charts"><img src="https://raw.githubusercontent.com/saiashirwad/svjeez/main/examples/dist/charts.svg" width="100%" alt="Grouped bars grow and an area chart wipes on, showing review times falling after a bot ships." /></a><br />
      <a href="https://github.com/saiashirwad/svjeez/tree/main/packages/charts"><b><code>@svjeez/charts</code></b></a> · Bar, line and area charts through d3-scale
    </td>
    <td width="50%" valign="top">
      <a href="https://github.com/saiashirwad/svjeez/tree/main/packages/geo"><img src="https://raw.githubusercontent.com/saiashirwad/svjeez/main/examples/dist/flights.svg" width="100%" alt="A world map where great-circle routes draw on between twelve airline hubs and a plane follows one." /></a><br />
      <a href="https://github.com/saiashirwad/svjeez/tree/main/packages/geo"><b><code>@svjeez/geo</code></b></a> · GeoJSON and TopoJSON maps, routes and globes through d3-geo
    </td>
  </tr>
  <tr>
    <td width="50%" valign="top">
      <a href="https://github.com/saiashirwad/svjeez/tree/main/packages/math"><img src="https://raw.githubusercontent.com/saiashirwad/svjeez/main/examples/dist/math.svg" width="100%" alt="(a+b)^2 morphs into a^2+2ab+b^2 and grows into the binomial theorem." /></a><br />
      <a href="https://github.com/saiashirwad/svjeez/tree/main/packages/math"><b><code>@svjeez/math</code></b></a> · TeX typeset into glyph paths that <code>morph()</code> can animate
    </td>
    <td width="50%" valign="top">
      <a href="https://github.com/saiashirwad/svjeez/tree/main/packages/code"><img src="https://raw.githubusercontent.com/saiashirwad/svjeez/main/examples/dist/code.svg" width="100%" alt="A Fibonacci function morphs between TypeScript, Python, Rust and Go." /></a><br />
      <a href="https://github.com/saiashirwad/svjeez/tree/main/packages/code"><b><code>@svjeez/code</code></b></a> · Shiki highlighting that follows the scene's theme
    </td>
  </tr>
  <tr>
    <td width="50%" valign="top">
      <a href="https://github.com/saiashirwad/svjeez/tree/main/packages/fonts"><img src="https://raw.githubusercontent.com/saiashirwad/svjeez/main/examples/dist/fonts.svg" width="100%" alt="Wave! draws on as glyph outlines, then fills, above measured text." /></a><br />
      <a href="https://github.com/saiashirwad/svjeez/tree/main/packages/fonts"><b><code>@svjeez/fonts</code></b></a> · Google Fonts by family name, subset and embedded
    </td>
    <td width="50%" valign="top">
      <a href="https://github.com/saiashirwad/svjeez/tree/main/packages/icons"><img src="https://raw.githubusercontent.com/saiashirwad/svjeez/main/examples/dist/icons.svg" width="100%" alt="Seven outline icons draw on stroke by stroke, then a filled heart pops in." /></a><br />
      <a href="https://github.com/saiashirwad/svjeez/tree/main/packages/icons"><b><code>@svjeez/icons</code></b></a> · Tabler and Lucide icons as path data for <code>&lt;Icon&gt;</code>
    </td>
  </tr>
  <tr>
    <td width="50%" valign="top">
      <a href="https://github.com/saiashirwad/svjeez/tree/main/packages/mermaid"><img src="https://raw.githubusercontent.com/saiashirwad/svjeez/main/examples/dist/mermaid.svg" width="200" alt="A deploy pipeline written as Mermaid text appears node by node, then a token runs to the live release." /></a><br />
      <a href="https://github.com/saiashirwad/svjeez/tree/main/packages/mermaid"><b><code>@svjeez/mermaid</code></b></a> · Mermaid flowcharts, sequence and state diagrams, no DOM needed
    </td>
    <td width="50%" valign="top">
      <a href="https://github.com/saiashirwad/svjeez/tree/main/packages/vite"><b><code>@svjeez/vite</code></b></a> · Import <code>./hero.tsx?svjeez</code> and get the SVG's URL, with optional poster stills<br /><br />
      <a href="https://github.com/saiashirwad/svjeez/tree/main/packages/astro"><b><code>@svjeez/astro</code></b></a> · <code>&lt;Scene&gt;</code> and <code>getScene()</code> for Astro pages<br /><br />
      <a href="https://github.com/saiashirwad/svjeez/tree/main/packages/video"><b><code>@svjeez/video</code></b></a> · MP4 or WebM from any scene, for places that don't take SVG
    </td>
  </tr>
</table>

## Made with svjeez

<p align="center">
  <a href="https://svjeez.texoport.in/examples/map"><img src="https://raw.githubusercontent.com/saiashirwad/svjeez/main/examples/dist/map.svg" width="400" alt="A hand-inked fantasy map draws itself, then the camera zooms in and follows a dashed route east to Mount Cinder." /></a>
  <a href="https://svjeez.texoport.in/examples/horizon"><img src="https://raw.githubusercontent.com/saiashirwad/svjeez/main/examples/dist/horizon.svg" width="400" alt="A cinematic black hole with a glowing accretion disk, lensed photon ring, relativistic jets, and HUD telemetry." /></a>
</p>

More in the [gallery](https://svjeez.texoport.in/examples/), with the TSX for each in [`examples/`](https://github.com/saiashirwad/svjeez/tree/main/examples).

## Contributing

```sh
bun install && cd examples
bun run dev readme/hero.tsx          # live preview with a scrubber
bun run build                        # rebuild examples/dist/
cd .. && bun run test && bun run typecheck
```

See [`AGENTS.md`](https://github.com/saiashirwad/svjeez/blob/main/AGENTS.md) for the layout and release process. MIT licensed.

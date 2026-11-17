<p align="center">
  <a href="https://svjeez.texoport.in/intro"><img src="https://raw.githubusercontent.com/saiashirwad/svjeez/main/examples/dist/hype.svg" width="840" alt="The svjeez intro: a short reel hosted by Blip, showing scenes, code, diagrams, ink and charts, all in one animated SVG." /></a>
</p>

<p align="center">
  <strong>Write motion in TypeScript. Ship it as one SVG file.</strong><br />
  No player and no runtime JavaScript. It plays wherever an <code>&lt;img&gt;</code> does, this README included.
</p>

<p align="center">
  <a href="https://svjeez.texoport.in">Website</a> ·
  <a href="https://svjeez.texoport.in/examples/">Examples</a> ·
  <a href="https://svjeez.texoport.in/intro">One-minute intro</a> ·
  <a href="https://github.com/saiashirwad/svjeez/blob/main/packages/svjeez/skills/svjeez/SKILL.md">Agent skill</a> ·
  <a href="https://www.npmjs.com/package/svjeez">npm</a>
</p>

## What it's for

**Film your real UI.** This is a React app, recorded: a demo presses keys, types, clicks and drags in Chromium, and [`@svjeez/dom`](https://github.com/saiashirwad/svjeez/tree/main/packages/dom) turns every state into one SVG where cards slide to their new places and counts tick over. The recording is kept in a JSON file and made again only when the demo or a file it imports changes.

<img src="https://raw.githubusercontent.com/saiashirwad/svjeez/main/examples/dist/board.svg" width="640" alt="A project board, filmed from its React demo: a command palette turns into a new-issue dialog, the new card is dragged to In progress and marked done, and the counts, progress bar and sidebar update." />

**Explain how something works.** Code, terminal sessions, diagrams and math go on one timeline. This one walks a circuit breaker through its code, its state machine and a sequence diagram, in one file.

<img src="https://raw.githubusercontent.com/saiashirwad/svjeez/main/examples/dist/breaker.svg" width="640" alt="A six-slide explainer on circuit breakers combining code morphs, a state machine, a sequence diagram, and a flowchart." />

**Tell a story with data.** Charts and maps are drawn from your data at build time. A scene with params is a template: `svjeez svg scene.tsx --params data.json` draws this week's numbers.

<img src="https://raw.githubusercontent.com/saiashirwad/svjeez/main/examples/dist/metrics.svg" width="640" alt="A row of four KPI tiles counts up, then a bar chart of eight weeks of signups grows." />

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
```

Preview it, check it, and compile it:

```sh
npx svjeez dev scene.tsx                       # plays with a scrubber, reloads on save
npx svjeez check scene.tsx                     # layout and timing faults, one per line
npx svjeez frames scene.tsx --times 0,1,2 --sheet
npx svjeez svg scene.tsx --out hello.svg
```

<img src="https://raw.githubusercontent.com/saiashirwad/svjeez/main/examples/dist/readme/basic.svg" width="200" alt="A curve draws on, then a dot pops in" />

svjeez runs on Node 20+ or Bun and has no runtime dependencies. On Node, install `tsx` so it can load `.tsx`. `frames`, `check` and `video` need `playwright-core` and Chromium.

## Working with an agent

- `npx svjeez skill --install` gives a coding agent the scene-writing skill, its references and worked examples.
- Scenes are typed TypeScript, and errors say what to fix.
- `svjeez check` reports layout and timing faults as text, and `svjeez frames --sheet` shows the agent its work.

## Packages

Each package runs while the scene compiles, so the SVG still carries no script.

- [`svjeez`](https://github.com/saiashirwad/svjeez/tree/main/packages/svjeez): the compiler, timelines, recipes, text, ink and the CLI
- [`@svjeez/charts`](https://github.com/saiashirwad/svjeez/tree/main/packages/charts): bar, line and area charts
- [`@svjeez/geo`](https://github.com/saiashirwad/svjeez/tree/main/packages/geo): maps, routes and globes from GeoJSON and TopoJSON
- [`@svjeez/diagrams`](https://github.com/saiashirwad/svjeez/tree/main/packages/diagrams): flowcharts, sequence diagrams, state machines, trees and swimlanes
- [`@svjeez/mermaid`](https://github.com/saiashirwad/svjeez/tree/main/packages/mermaid): Mermaid text as svjeez diagrams
- [`@svjeez/math`](https://github.com/saiashirwad/svjeez/tree/main/packages/math): TeX, coordinate planes and plots
- [`@svjeez/code`](https://github.com/saiashirwad/svjeez/tree/main/packages/code): Shiki highlighting in the scene's theme
- [`@svjeez/dom`](https://github.com/saiashirwad/svjeez/tree/main/packages/dom): real HTML, React and Svelte, filmed in Chromium
- [`@svjeez/fonts`](https://github.com/saiashirwad/svjeez/tree/main/packages/fonts): Google Fonts by name, subset and embedded
- [`@svjeez/icons`](https://github.com/saiashirwad/svjeez/tree/main/packages/icons): Tabler and Lucide icons
- [`@svjeez/video`](https://github.com/saiashirwad/svjeez/tree/main/packages/video): MP4 or WebM from a scene
- [`@svjeez/vite`](https://github.com/saiashirwad/svjeez/tree/main/packages/vite), [`@svjeez/astro`](https://github.com/saiashirwad/svjeez/tree/main/packages/astro): scenes compiled into a Vite app or Astro site
- [`@svjeez/live`](https://github.com/saiashirwad/svjeez/tree/main/packages/live), [`@svjeez/react`](https://github.com/saiashirwad/svjeez/tree/main/packages/react), [`@svjeez/svelte`](https://github.com/saiashirwad/svjeez/tree/main/packages/svelte): the scene editor, with a control on every value

## Where it plays

Anywhere an `<img>` takes an SVG: GitHub READMEs, docs sites and any web page. For everywhere else, `svjeez video scene.tsx` writes MP4 or WebM.

More scenes are in the [gallery](https://svjeez.texoport.in/examples/), with the TSX for each in [`examples/`](https://github.com/saiashirwad/svjeez/tree/main/examples).

## Contributing

```sh
bun install && cd examples
bun run dev readme/hero.tsx          # live preview with a scrubber
bun run build                        # rebuild examples/dist/
cd .. && bun run test && bun run typecheck
```

See [`AGENTS.md`](https://github.com/saiashirwad/svjeez/blob/main/AGENTS.md) for the layout and release process, and [`UPGRADING.md`](https://github.com/saiashirwad/svjeez/blob/main/UPGRADING.md) to move a project from 0.5, 0.6 or 0.7. MIT licensed.

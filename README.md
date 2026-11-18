# svjeez

Compose animated graphics in TypeScript and ship a self-contained SVG. The output plays as an image using CSS and SMIL, with zero viewer JavaScript.

<a href="https://svjeez.texoport.in/intro"><img src="https://raw.githubusercontent.com/saiashirwad/svjeez/main/examples/dist/hype.svg" width="840" alt="Blip introduces a reel of animated code, diagrams, math and maps." /></a>

[Website](https://svjeez.texoport.in) · [Gallery and source](https://svjeez.texoport.in/examples/) · [One-minute intro](https://svjeez.texoport.in/intro) · [npm](https://www.npmjs.com/package/svjeez)

## Quickstart

From a new directory with Node 20 or later:

```sh
npm init -y
npm pkg set type=module
npm install svjeez
npm install -D tsx typescript
```

Save this as `tsconfig.json`:

```json
{
  "compilerOptions": {
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "jsx": "react-jsx",
    "jsxImportSource": "svjeez",
    "strict": true
  }
}
```

Save this as `scene.tsx`:

```tsx
import { draw, ease, enter, render, span } from "svjeez";

export default () =>
  render(
    { width: 200, height: 120, duration: 4, title: "Hello" },
    <>
      <path d="M20 100C60 20 140 20 180 100" fill="none" stroke="#FF5FA8"
        strokeWidth={4} animation={draw(span(0.2, 1.2))} />
      <circle cx={100} cy={40} r={8} fill="#3EE6D6"
        animation={enter(span(1.2, 0.5), { scale: 0 }, ease.pop)} />
    </>,
  );
```

```sh
npx svjeez svg scene.tsx --out hello.svg
npx svjeez dev scene.tsx
```

Open `hello.svg` in a browser or embed it with `<img src="hello.svg" alt="A curve draws on, then a dot pops in">`. With Bun, use `bun add svjeez` and `bunx --bun svjeez` with the same scene and JSX config.

## Check a scene

```sh
npm install -D playwright-core
npx playwright-core install chromium-headless-shell
npx svjeez check scene.tsx
npx svjeez frames scene.tsx --times 0,1,2 --sheet
```

Open **Timeline** in the dev preview to inspect clips and motion tracks. **Check layout** and the `check` command report layout and timing findings with source locations. Open `frames/sheet.png` to review the picture at each selected time. Run `npx svjeez skill --install` for the [authoring guide](https://github.com/saiashirwad/svjeez/blob/main/packages/svjeez/skills/svjeez/SKILL.md) and worked examples.

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

## Contributing

Run `bun install` at the root, then `bun run typecheck` and `bun run test`. See [AGENTS.md](https://github.com/saiashirwad/svjeez/blob/main/AGENTS.md) for the workspace and release process, and [UPGRADING.md](https://github.com/saiashirwad/svjeez/blob/main/UPGRADING.md) for the 0.7 migration.

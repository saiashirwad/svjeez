# svjeez

Compose animated graphics in TypeScript and ship a self-contained SVG. The output plays as an image using CSS and SMIL, with zero viewer JavaScript.

<a href="https://svjeez.texoport.in/intro"><img src="https://raw.githubusercontent.com/saiashirwad/svjeez/main/examples/dist/hype.svg" width="840" alt="Blip introduces a reel of animated code, diagrams, math and maps." /></a>

[Website](https://svjeez.texoport.in) · [Gallery and source](https://svjeez.texoport.in/examples/) · [One-minute intro](https://svjeez.texoport.in/intro) · [npm](https://www.npmjs.com/package/svjeez)

## Quickstart

From a new directory with Node 20 or later:

```sh
npm init -y
npm pkg set type=module
npm install svjeez@next
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
import { Group, Shape, circle, ease, enter, path, scene, span, track } from "svjeez";

export default scene({ size: [200, 120], duration: 4, title: "Hello" }, () => (
  <Group>
    <Shape
      geometry={path().moveTo([20, 100]).curveTo([60, 20], [140, 20], [180, 100])}
      stroke={{ color: "#FF5FA8", width: 4 }}
      draw={track(0).to(1, span(0.2, 1.2))}
    />
    <Shape
      geometry={circle(8)}
      at={[100, 40]}
      anchor="center"
      fill="#3EE6D6"
      motion={enter(span(1.2, 0.5), { from: { scale: 0 }, curve: ease.pop })}
    />
  </Group>
));
```

```sh
npx svjeez svg scene.tsx --out hello.svg
npx svjeez dev scene.tsx
```

The scene function is handed its `canvas` (`canvas.rect`, `canvas.center`, `canvas.size`). Open `hello.svg` in a browser or embed it with `<img src="hello.svg" alt="A curve draws on, then a dot pops in">`. With Bun, use `bun add svjeez@next` and `bunx --bun svjeez` with the same scene and JSX config.

## Ways to move something

Each has one job.

- **A track** is a value you build, then hand to a node: `const glow = track(0).to(1, span(1, 0.3))`, `<Shape opacity={glow} />`. Tracks are immutable: every `to`, `set`, `loop`, `repeat` and `rewind` returns a new track, so a component given a track can't schedule motion behind your back. Name your spans first, build each track, then write the JSX. `glow.span` is the span of the last step, so `glow.span.next(0.5)` follows it. A point track can go to an anchor, resolved after layout: `track(p).to(card.right, glow.span.next(0.5))` lands the node's `anchor` point on it. Its times count on the clock of the nodes that read it, so nodes on different clocks (another `<Sequence>`) need their own tracks.
- **`draw`** is how a component is told to draw itself: a number or a track from 0 to 1, as in `<Arrow draw={t} />` or `<Shape draw={t} />` (trim `[0, draw]`), and each series of a chart takes the same prop.
- **A motion layer** is a passing effect on top of the prop, such as an entrance, an exit or a wobble: `motion={enter(span(1, 0.3))}`, or a plain object of tracks, `motion={{ opacity: track(0).to(1, span(1, 0.3)) }}` (keys `offset`, `rotate`, `scale`, `opacity`). Layers always stack: the first is outermost, the node's own props innermost.
- **A morph** says the picture's structure changes from one state to another, and moves whatever differs.
- **A ref** moves nothing and has no name: `ref()` is a handle you give one node (`ref={card}`) so others can measure and place against it (`card.right`, `card.side("top")`, `card.part("title").center`). The node's key, if it has one, is what morphs match.
- **A curve** is `ease.out` wherever you leave it out: `to`, `rewind`, recipes and morphs.

## Check a scene

```sh
npx svjeez check scene.tsx
npm install -D playwright-core
npx playwright-core install chromium-headless-shell
npx svjeez check scene.tsx --browser
npx svjeez frames scene.tsx --times 0,1,2 --sheet
```

`svjeez check` reads the scene model and the SVG it emits, with no browser, and prints one report: every problem with its source and a `fix:`, then the animated lanes (CSS, or SMIL where a scene animates geometry, a filter or a gradient). `--json` prints the same as `{ ok, file, scene, problems, lanes }`, and `--browser` adds a pixel pass in Chromium. In code, `check(scene)` from `svjeez/tools` returns `{ problems, lanes }`. Open **Timeline** in the dev preview to see the lanes. Open `frames/sheet.png` to review the picture at each selected time. Run `npx svjeez skill --install` for the [authoring guide](https://github.com/saiashirwad/svjeez/blob/next/packages/svjeez/skills/svjeez/SKILL.md) and worked examples.

## Packages

Each package runs while the scene compiles, so the SVG still carries no script.

- [`svjeez`](https://github.com/saiashirwad/svjeez/tree/next/packages/svjeez): scenes, layout, text, timelines, the SVG backend and the CLI
- [`@svjeez/fonts`](https://github.com/saiashirwad/svjeez/tree/next/packages/fonts): Google Fonts by name, subset and embedded
- [`@svjeez/icons`](https://github.com/saiashirwad/svjeez/tree/next/packages/icons): Tabler and Lucide icons as an `<Icon>` node
- [`@svjeez/charts`](https://github.com/saiashirwad/svjeez/tree/next/packages/charts): bar, line and area charts on shared axes
- [`@svjeez/code`](https://github.com/saiashirwad/svjeez/tree/next/packages/code): highlighted code that types itself and morphs
- [`@svjeez/geo`](https://github.com/saiashirwad/svjeez/tree/next/packages/geo): maps and turning globes from GeoJSON or TopoJSON
- [`@svjeez/math`](https://github.com/saiashirwad/svjeez/tree/next/packages/math): TeX as glyph shapes, plots, constructions and plane transformations
- [`@svjeez/diagrams`](https://github.com/saiashirwad/svjeez/tree/next/packages/diagrams): flowcharts, sequence diagrams, state machines, trees and swimlanes, laid out and revealed
- [`@svjeez/mermaid`](https://github.com/saiashirwad/svjeez/tree/next/packages/mermaid): Mermaid flowcharts, sequence and state diagrams drawn as svjeez diagrams
- [`@svjeez/video`](https://github.com/saiashirwad/svjeez/tree/next/packages/video): MP4 or WebM from a scene
- [`@svjeez/vite`](https://github.com/saiashirwad/svjeez/tree/next/packages/vite), [`@svjeez/astro`](https://github.com/saiashirwad/svjeez/tree/next/packages/astro): scenes compiled into a Vite app or Astro site

## Contributing

Run `bun install` at the root, then `bun run typecheck` and `bun run test`. See [AGENTS.md](https://github.com/saiashirwad/svjeez/blob/next/AGENTS.md) for the workspace and release process, and [UPGRADING.md](https://github.com/saiashirwad/svjeez/blob/next/UPGRADING.md) for migration between versions.

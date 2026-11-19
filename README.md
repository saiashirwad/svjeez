# svjeez

Write animated graphics in TypeScript and JSX. Ship a single `.svg` with zero viewer JavaScript.

<a href="https://svjeez.texoport.in/intro"><img src="https://raw.githubusercontent.com/saiashirwad/svjeez/main/examples/dist/hype.svg" width="840" alt="Blip introduces a reel of animated code, diagrams, math and maps." /></a>

[Website](https://svjeez.texoport.in) · [Gallery](https://svjeez.texoport.in/examples/) · [One-minute intro](https://svjeez.texoport.in/intro) · [npm](https://www.npmjs.com/package/svjeez)

`svjeez` compiles scenes into self-contained SVGs animated with CSS and SMIL. Because there is no script in the output, they play anywhere an image works: `<img>` tags, GitHub READMEs, PR descriptions, and static docs.

## Example

No hardcoded coordinates. `<Align>` and `<Stack>` handle layout, `ref()` attaches the `<Arrow>` to the laid-out edges, and `enter()` + `track()` handle timing:

```tsx
import {
  Align,
  Arrow,
  Group,
  Shape,
  Stack,
  circle,
  ease,
  enter,
  rect,
  ref,
  scene,
  span,
  track,
} from "svjeez";

export default scene({ size: [300, 120], duration: 3, title: "Flow" }, () => {
  const from = ref();
  const to = ref();

  return (
    <Group>
      <Align>
        <Stack direction="row" gap={72} align="center">
          <Shape
            ref={from}
            geometry={rect(56, 40, { radius: 8 })}
            fill="#FF5FA8"
            motion={enter(span(0.1, 0.4), { from: { scale: 0.8, opacity: 0 }, curve: ease.pop })}
          />
          <Shape
            ref={to}
            geometry={circle(20)}
            fill="#3EE6D6"
            motion={enter(span(1.1, 0.4), { from: { scale: 0.8, opacity: 0 }, curve: ease.pop })}
          />
        </Stack>
      </Align>
      <Arrow
        from={from.right}
        to={to.left}
        inset={8}
        stroke={{ color: "#94A3B8", width: 3 }}
        draw={track(0).to(1, span(0.45, 0.6))}
      />
    </Group>
  );
});
```

```sh
npx svjeez dev scene.tsx                 # Live preview with scrubber and timeline
npx svjeez svg scene.tsx --out flow.svg  # Standalone SVG, no JS
```

## What makes it different

- **Zero-JS output.** Compiles to CSS keyframes by default, and uses SMIL when animating paths, gradients, or filters.
- **Layout and anchors.** `<Stack>`, `<Grid>`, `<Center>`, and `<Align>` size and place elements. Give a node `ref={card}` so arrows and tracks can target `card.right` or `card.side("top")` after layout settles.
- **Composable motion.** `track()` builds immutable timelines (`to`, `set`, `loop`, `repeat`, `rewind`, `.map()`, `.with()`). Stack passing effects with `enter()`, `exit()`, and `wiggle()`, or diff two JSX states by `key` with `morph()`.
- **Static scene linting (`svjeez check`).** Evaluates your scene across time without a browser and reports `overlap`, `off-canvas`, `text-overflow`, `low-contrast`, `loop-seam`, and `moving-filter` repaint cost, with source locations and `fix:` hints. Add `--browser` for Chromium pixel checks, `--json` for tooling, or run `svjeez frames scene.tsx --sheet` for a PNG contact sheet.
- **Parameters and video.** Export a typed `params` schema to override values via `--param key=value`, or render MP4/WebM with `svjeez video`.

## Packages

Every package runs at compile time, so the output stays script-free.

- [`svjeez`](https://github.com/saiashirwad/svjeez/tree/next/packages/svjeez): core runtime, layout, motion, SVG compiler, CLI
- [`@svjeez/diagrams`](https://github.com/saiashirwad/svjeez/tree/next/packages/diagrams), [`@svjeez/mermaid`](https://github.com/saiashirwad/svjeez/tree/next/packages/mermaid): flowcharts, sequence, state machines, trees, swimlanes, and Mermaid input
- [`@svjeez/code`](https://github.com/saiashirwad/svjeez/tree/next/packages/code), [`@svjeez/math`](https://github.com/saiashirwad/svjeez/tree/next/packages/math): self-typing/morphing highlighted code; TeX glyphs, plots, and constructions
- [`@svjeez/charts`](https://github.com/saiashirwad/svjeez/tree/next/packages/charts), [`@svjeez/geo`](https://github.com/saiashirwad/svjeez/tree/next/packages/geo): bar/line/area charts; GeoJSON/TopoJSON maps and turning globes
- [`@svjeez/fonts`](https://github.com/saiashirwad/svjeez/tree/next/packages/fonts), [`@svjeez/icons`](https://github.com/saiashirwad/svjeez/tree/next/packages/icons): subset embedded Google Fonts; Lucide and Tabler `<Icon>` nodes
- [`@svjeez/video`](https://github.com/saiashirwad/svjeez/tree/next/packages/video), [`@svjeez/vite`](https://github.com/saiashirwad/svjeez/tree/next/packages/vite), [`@svjeez/astro`](https://github.com/saiashirwad/svjeez/tree/next/packages/astro): MP4/WebM export and Vite/Astro build plugins

## Quickstart

Requires Node 20+ (or Bun):

```sh
npm init -y && npm pkg set type=module
npm install svjeez@next
npm install -D tsx typescript
```

Add to `tsconfig.json`:

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

Run `npx svjeez dev scene.tsx` to preview, `npx svjeez check scene.tsx` to lint, and `npx svjeez svg scene.tsx --out out.svg` to build. With Bun, use `bun add svjeez@next` and `bunx --bun svjeez`.

## Contributing

Run `bun install` at the root, then `bun run typecheck` and `bun run test`. See [AGENTS.md](https://github.com/saiashirwad/svjeez/blob/next/AGENTS.md) and [UPGRADING.md](https://github.com/saiashirwad/svjeez/blob/next/UPGRADING.md).

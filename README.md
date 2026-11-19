# svjeez

Code animated graphics in TypeScript. Ship a single `.svg` with no JavaScript.

<a href="https://svjeez.texoport.in/intro"><img src="https://raw.githubusercontent.com/saiashirwad/svjeez/main/examples/dist/hype.svg" width="840" alt="Blip introduces a reel of animated code, diagrams, math and maps." /></a>

[Website](https://svjeez.texoport.in) · [Gallery](https://svjeez.texoport.in/examples/) · [One-minute intro](https://svjeez.texoport.in/intro) · [npm](https://www.npmjs.com/package/svjeez)

`svjeez` compiles JSX scenes into self-contained SVGs animated with CSS and SMIL—with dark mode, `prefers-reduced-motion` still frames, and subsetted fonts built in. Because there is no script in the output, they play anywhere an `<img>` works: GitHub READMEs, PR descriptions, docs, and emails.

<table>
  <tr>
    <td align="center" width="50%">
      <a href="https://github.com/saiashirwad/svjeez/blob/next/examples/code/index.tsx">
        <img src="https://raw.githubusercontent.com/saiashirwad/svjeez/next/examples/dist/code.svg" width="400" alt="Code morphing between TypeScript, Python, Rust, and Go." />
      </a><br />
      <sub><strong>Morphing code</strong> · 18 KB · 0 JS (<a href="https://github.com/saiashirwad/svjeez/blob/next/examples/code/index.tsx">source</a>)</sub>
    </td>
    <td align="center" width="50%">
      <a href="https://github.com/saiashirwad/svjeez/blob/next/examples/math/index.tsx">
        <img src="https://raw.githubusercontent.com/saiashirwad/svjeez/next/examples/dist/math.svg" width="400" alt="TeX equation morphing with a measured brace and plotted curve." />
      </a><br />
      <sub><strong>TeX morph &amp; plots</strong> · 25 KB · 0 JS (<a href="https://github.com/saiashirwad/svjeez/blob/next/examples/math/index.tsx">source</a>)</sub>
    </td>
  </tr>
  <tr>
    <td align="center" width="50%">
      <a href="https://github.com/saiashirwad/svjeez/blob/next/examples/layout/index.tsx">
        <img src="https://raw.githubusercontent.com/saiashirwad/svjeez/next/examples/dist/layout.svg" width="400" alt="Three laid-out cards with arrows that follow a moving card." />
      </a><br />
      <sub><strong>Layout &amp; moving anchors</strong> · 18 KB · 0 JS (<a href="https://github.com/saiashirwad/svjeez/blob/next/examples/layout/index.tsx">source</a>)</sub>
    </td>
    <td align="center" width="50%">
      <a href="https://github.com/saiashirwad/svjeez/blob/next/examples/epicycles/index.tsx">
        <img src="https://raw.githubusercontent.com/saiashirwad/svjeez/next/examples/dist/epicycles.svg" width="400" alt="Fourier epicycles tracing a pi glyph extracted from a Google Font." />
      </a><br />
      <sub><strong>Fourier epicycles</strong> · 45 KB · 0 JS (<a href="https://github.com/saiashirwad/svjeez/blob/next/examples/epicycles/index.tsx">source</a>)</sub>
    </td>
  </tr>
</table>

<sub>Every image above is a live, script-free SVG that adapts to your light or dark theme automatically.</sub>

## Example

No hardcoded coordinates. `tokens()` handles light/dark colors, `<Align>` and `<Stack>` settle layout, and `ref()` keeps the `<Arrow>` attached even after the circle springs up and back:

```tsx
import {
  Align, Arrow, Group, Shape, Stack,
  circle, ease, enter, rect, ref, scene, span, tokens, track, type Vec,
} from "svjeez";

const theme = tokens({
  light: { bg: "#FFFFFF", from: "#E11D74", to: "#0D9488", line: "#64748B" },
  dark: { bg: "#0F172A", from: "#FF5FA8", to: "#3EE6D6", line: "#94A3B8" },
});

export default scene({ size: [300, 120], duration: 3, loop: false, theme, title: "Flow" }, (canvas) => {
  const from = ref();
  const to = ref();
  const drift = track<Vec>([0, 0])
    .to([0, -18], span(1.4, 0.8), ease.spring())
    .to([0, 0], span(2.3, 0.5));

  return (
    <Group>
      <Shape geometry={canvas.rect} fill={theme.bg} />
      <Align>
        <Stack direction="row" gap={72} align="center">
          <Shape
            ref={from}
            geometry={rect(56, 40, { radius: 8 })}
            fill={theme.from}
            motion={enter(span(0.1, 0.4), { from: { scale: 0.8, opacity: 0 }, curve: ease.pop })}
          />
          <Shape
            ref={to}
            geometry={circle(20)}
            fill={theme.to}
            motion={[
              enter(span(0.3, 0.4), { from: { scale: 0.8, opacity: 0 }, curve: ease.pop }),
              { offset: drift },
            ]}
          />
        </Stack>
      </Align>
      <Arrow
        from={from.right}
        to={to.left}
        inset={8}
        stroke={{ color: theme.line, width: 3 }}
        draw={track(0).to(1, span(0.75, 0.5))}
      />
    </Group>
  );
});
```

```sh
npx svjeez dev scene.tsx                 # Live preview with scrubber and timeline
npx svjeez check scene.tsx               # Lint layout, contrast, timing, and cost
npx svjeez svg scene.tsx --out flow.svg  # Standalone SVG, no JS
```

## What makes it different

- **Web-native `.svg` output.** CSS keyframes by default (SMIL only for paths, gradients, and filters), with automatic dark mode (`tokens()`), `prefers-reduced-motion` still frames, accessible `title`/`desc`, and pure-TS font subsetting.
- **Layout & moving anchors.** `<Stack>`, `<Grid>`, `<Center>`, and `<Align>` settle at compile time; `ref()` keeps arrows and tracks attached even as nodes move or rotate.
- **Composable motion & `morph()`.** Immutable `track()` timelines, analytical `ease.spring()` curves fitted to compact Beziers, and JSX-keyed `morph()` across shapes, layouts, code, and math.
- **Browserless scene linting.** `svjeez check` catches overlaps, clipping, low contrast, loop seams, and repaint cost with `file:line:col` and `fix:` hints—plus `--browser`, `--json`, `frames --sheet`, and `svjeez skill --install` for agent workflows.

## Packages

Every package runs at compile time, so the output stays script-free. Install companion packages with `@next`.

| Package | What it adds |
| --- | --- |
| [`svjeez`](https://github.com/saiashirwad/svjeez/tree/next/packages/svjeez) | Core runtime, layout, motion, `morph()`, font subsetting, typed `params`, CLI, and optional `svjeez/page` scroll/seek helpers |
| [`@svjeez/diagrams`](https://github.com/saiashirwad/svjeez/tree/next/packages/diagrams), [`@svjeez/mermaid`](https://github.com/saiashirwad/svjeez/tree/next/packages/mermaid) | Auto-laid-out flowcharts, sequence, state machines (`.walk()`), trees, swimlanes, and Mermaid input with full animation handles |
| [`@svjeez/code`](https://github.com/saiashirwad/svjeez/tree/next/packages/code), [`@svjeez/math`](https://github.com/saiashirwad/svjeez/tree/next/packages/math) | Zero-WASM Shiki typing & keyed `morph()`; MathJax TeX glyph morphing, `\cssId` anchors, plots, constructions, and plane warps |
| [`@svjeez/charts`](https://github.com/saiashirwad/svjeez/tree/next/packages/charts), [`@svjeez/geo`](https://github.com/saiashirwad/svjeez/tree/next/packages/geo) | d3-scaled bar/line/area charts with custom plot annotations; GeoJSON/TopoJSON maps and turning 3D globes with day/night shading |
| [`@svjeez/fonts`](https://github.com/saiashirwad/svjeez/tree/next/packages/fonts), [`@svjeez/icons`](https://github.com/saiashirwad/svjeez/tree/next/packages/icons) | Cached Google Fonts fetcher; tree-shakeable Lucide and Tabler `<Icon>` nodes with per-stroke `draw` |
| [`@svjeez/vite`](https://github.com/saiashirwad/svjeez/tree/next/packages/vite), [`@svjeez/astro`](https://github.com/saiashirwad/svjeez/tree/next/packages/astro), [`@svjeez/video`](https://github.com/saiashirwad/svjeez/tree/next/packages/video) | Zero-JS `?svjeez` / `<Scene>` imports with light/dark WebP posters; MP4 and transparent WebM export |

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

For Chromium pixel checks (`--browser`), PNG contact sheets (`frames --sheet`), or video (`video`, also needs `@svjeez/video@next`), install Playwright once:

```sh
npm install -D playwright-core && npx playwright-core install chromium-headless-shell
```

## Contributing

Run `bun install` at the root, then `bun run typecheck` and `bun run test`. See [AGENTS.md](https://github.com/saiashirwad/svjeez/blob/next/AGENTS.md) and [UPGRADING.md](https://github.com/saiashirwad/svjeez/blob/next/UPGRADING.md).

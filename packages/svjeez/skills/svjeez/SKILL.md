---
name: svjeez
description: Write animated SVGs with svjeez, a TypeScript library that compiles a JSX scene into one self-contained animated SVG (with no runtime JS) plus frames or video.
---

# svjeez

## What a scene is

A scene default-exports `scene(options, (canvas) => tree)`. svjeez measures layout and fonts at build time, validates the model, and emits one self-contained animated SVG with CSS keyframes, SMIL where needed, light/dark token variables, and a `prefers-reduced-motion` still frame.

```tsx
/** @jsxImportSource svjeez */
import { Group, Shape, Text, circle, ease, enter, path, scene, span, track } from "svjeez";
import { sans, theme } from "./style";

export default scene(
  {
    size: [240, 140],
    duration: 4,
    loop: false,
    title: "Hello",
    desc: "A curve draws itself, a dot pops in on top of it, and the word hello sits below.",
    theme,
    still: 2.5,
  },
  (canvas) => (
    <Group>
      <Shape geometry={canvas.rect} fill={theme.background} />
      <Shape
        geometry={path().moveTo([20, 110]).curveTo([80, 20], [160, 20], [220, 110])}
        stroke={{ color: theme.blue, width: 4, cap: "round" }}
        draw={track(0).to(1, span(0.2, 1.2))}
      />
      <Shape
        geometry={circle(8)}
        offset={[120, 44]}
        fill={theme.text}
        motion={enter(span(1.2, 0.5), { from: { scale: 0 }, curve: ease.pop })}
      />
      <Text font={sans} size={14} at={[120, 132]} anchor="baseline" fill={theme.text}>
        hello
      </Text>
    </Group>
  ),
);
```

## Setup

```sh
npm i svjeez@next && npm i -D tsx typescript playwright-core
bun add svjeez@next    # run CLI under Bun with: bunx --bun svjeez
```

Set `"jsx": "react-jsx"`, `"jsxImportSource": "svjeez"`, and `"strict": true` in `tsconfig.json`, or start scene files with `/** @jsxImportSource svjeez */`. Without JSX, build nodes in a plain `.ts` file with `h(Component, props | null, ...children)`: `h(Shape, { key: "a", geometry: circle(8), fill })` is `<Shape key="a" geometry={circle(8)} fill={fill} />`, and `h(Fragment, null, ...)` is `<>...</>`. `scene()` takes `size`, `duration`, `title`, `desc`, `theme`, `loop`, and `still`; export `params` (`param.*`, `defaults`) and a `(values) => scene(...)` function for parameterized scenes. Companion packages: `@svjeez/fonts`, `@svjeez/icons`, `@svjeez/charts`, `@svjeez/code`, `@svjeez/diagrams`, `@svjeez/mermaid`, `@svjeez/geo`, `@svjeez/math`, `@svjeez/dom`, `@svjeez/video`, `@svjeez/vite`, `@svjeez/astro`.

## Model

1. Every node has a measured bounding box (including stroke and text).
2. `at` places `anchor` (`"top-left"` by default; text supports `"baseline"`); `offset` moves the node's own `[0, 0]` instead (never pass both). `at` places the node's box, so a `<Code>` whose split drops the first column, or a group with a caret at x=-6, shifts; use `offset` there. `rotate`, `scale`, and `skew` pivot around `origin`.
3. Nothing is inherited: every shape needs `fill` or `stroke`, and every `<Text>` needs `font`, `size`, and `fill`.
4. Tracks are immutable (`to`, `set`, `loop`, `repeat`, `rewind`, `map`, `with`).
5. `span(start, over)` marks time on a clock (`.next`, `.shift`, `.chain`, `.cascade`, `.distribute`, `.pace`); `<Sequence>` starts a child clock.
6. Layout containers (`<Stack>`, `<Grid>`, `<Center>`, `<Align>`) place their children; don't set `at` on placed children.
7. `ref()` creates a handle for anchors (`.left`, `.right`, `.center`, `.part`, `.side`) used by `<Arrow>`, `<Align>`, and tracks.
8. `morph` / `morph.between` transitions keyed nodes across states. `stagger` delays each changing part; `each` sets how long each part moves.

## API

| Group | Exports |
| --- | --- |
| Scene & components | `scene`, `h`, `Fragment`, `component`, `context`, `param`, `defaults`, `parse`, `font`, `picture`, `random` |
| Nodes | `<Shape>`, `<Text>`, `<Run>`, `<Group>`, `<Picture>`, `<Arrow>`, `<Sequence>`, `<Series>`, `<Slot>`, `<Shader>` |
| Layout | `<Stack>`, `<Grid>`, `<Center>`, `<Align>`, `spread`, `ref` |
| Geometry | `rect`, `circle`, `ellipse`, `arc`, `line`, `polygon`, `spline`, `path`, `moved`, `rotated`, `scaled`, `mirrored`, `reversed`, `merge`, `around`, `subtract`, `bounds`, `length`, `pointAt`, `along` |
| Paint & effects | `tokens`, `alpha`, `mix`, `linear`, `radial`, `pattern`, `blur`, `shadow`, `adjust`, `displace` |
| Time & motion | `span`, `track`, `keyframes`, `clock`, `ease`, `enter`, `exit`, `wiggle`, `ride`, `sampled`, `through`, `within`, `timeAt`, `morph` |
| Text helpers | `count`, `numeral`, `typed`, `chars`, `words` |

## CLI

```sh
npx svjeez check scene.tsx [--at 0,1.5] [--browser] [--json]
npx svjeez frames scene.tsx --sheet --out frames/ [--color-scheme light|dark]
npx svjeez svg scene.tsx --out scene.svg [--json]
npx svjeez dev scene.tsx
npx svjeez video scene.tsx --out scene.mp4 [--preview]   # --preview: fps 12, scale 1, quality low; --fps/--scale/--quality win
npx svjeez skill [--install [--dir .claude/skills]]
npx svjeez version
```

## Check

| Code | Meaning |
| --- | --- |
| `type-error` | TypeScript diagnostic from project tsconfig |
| `compile-error` | Scene threw during build |
| `compile-warning` | Warning from an embedded SVG file or string |
| `never-visible`, `zero-size` | Hidden/covered at every time, or zero-sized geometry/text/image |
| `off-canvas` | Outside or clipped by canvas |
| `text-overflow`, `missing-glyph` | Text past canvas/width, or missing font glyph |
| `overlap`, `layout-overlap` | Overlapping texts or container siblings colliding |
| `low-contrast` | Insufficient contrast against background |
| `loop-seam` | Loop end differs from start |
| `visible-at-zero` | Shown at `0s` then immediately re-entering, or filled while drawing |
| `nothing-enters`, `static`, `wasted-motion` | No entrance, no motion, or invisible animation |
| `moving-filter` | Filter animated or filtering moving content |
| `moving-box` | `at`-placed `<Group>` with moving children; use `offset` |
| `word-cut` | Word wider than wrapped `width` |
| `unsupported`, `approximate` | Unsupported or approximated SVG backend feature |

## Examples

| File | Demonstrates |
| --- | --- |
| [`examples/hello.tsx`](examples/hello.tsx) | Minimal scene above |
| [`examples/card.tsx`](examples/card.tsx) | `Stack`, `Center`, `Align`, wrapped `<Text>` with `<Run>`, `enter`/`exit` |
| [`examples/pipeline.tsx`](examples/pipeline.tsx) | `ref()` anchors, `<Arrow draw>`, anchor-targeted track |
| [`examples/chart.tsx`](examples/chart.tsx) | Keyed `morph.between` bar chart |
| [`examples/progress.tsx`](examples/progress.tsx) | Single track driving `draw`, `rect`, `count()`, and spring `ease.pop` |
| [`examples/reveal.tsx`](examples/reveal.tsx) | Gradients, `clip`, `mask`, `subtract`, looped `rotate` |
| [`examples/series.tsx`](examples/series.tsx) | `<Series>` sequencing and overlap |
| [`examples/steps.tsx`](examples/steps.tsx) | Custom span component, `<Sequence>`, derived tracks |

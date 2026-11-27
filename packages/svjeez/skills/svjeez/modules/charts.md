# `@svjeez/charts`

Axis-based data charts (`bars`, `line`, `area`) rendered as one `<Chart>` JSX component with auto-fitted scales and animated series reveal.

## Setup

```sh
npm install @svjeez/charts @svjeez/fonts svjeez
```

- `d3-scale` and `d3-shape` are bundled with `@svjeez/charts`.
- Pass a loaded `font`, `axis` paint, and `label` paint (use `tokens()` for light/dark).
- Alias `line` if you also import geometry `line` from `svjeez` (`import { line as seriesLine } from "@svjeez/charts"`).

## Mental model

- **`size` is the plot area only:** Y tick labels spill left (~30–40 px) and X tick labels spill below (~20 px). Place `<Chart at={[60, 30]} size={[w, h]}>` with margins, and reserve right margin when using `line(..., { label })`.
- **Series builders:** Pass `bars()`, `line()`, and `area()` inside `series={[...]}`. Every series requires `color`. Give each series a unique `name` when a chart has more than one of a kind (defaults are `"bars"`, `"line"`, `"area"`).
- **Scales:** `x` is `{ kind: "band", domain: [...] }` (required for `bars()`) or `{ kind: "linear", domain?, ticks?, format? }`. `y` auto-fits and includes `0` whenever any bar or area is present (lone `line` fits tightly; override with `y.zero`). Explicit `y.domain` / `x.domain` is a hard constraint—out-of-range data throws rather than clipping.
- **Animation:** Set `axesIn={span(start, over)}` for axes and `draw: track(0).to(1, span(...))` on each series. Without either, the chart is static (`static` warning). Bars scale from baseline with `stagger` in `[0, 1)`; lines trim on; areas wipe in.
- **Annotations:** `children` must be a render function `(plot) => Child` receiving `{ size, bandwidth, x(v), y(v) }` in plot coordinates.
- **Morphing datasets:** Pass keyed `<Chart key="chart">` states to `morph.between(states, spans)`. Omit `draw` on morphing bars (their per-bar scale origin changes with height); fade the wrapper `<Group motion={enter(...)}>` instead.

## API map

| Export | Summary |
|---|---|
| `<Chart>` | Required: `size`, `x`, `series`, `font`, `axis`, `label`. Optional: `y`, `at`, `grid` (`{}` enables), `textSize` (12), `axesIn`, `key`, `children: (plot) => Child`. |
| `bars(data, opts)` | `data`: record or `[string, number][]`. Opts: `color`, `name?`, `draw?`, `stagger?` (0.3), `radius?` (3), `values?`. |
| `line(data, opts)` | `data`: `[x, y][]`. Opts: `color`, `name?`, `draw?`, `curve?`, `dots?`, `stroke?`, `label?`. |
| `area(data, opts)` | Like `line` plus `baseline?` (0), `line?` (`false` hides outline). |
| `curve` | `linear`, `monotone`, `step`, `stepBefore`, `stepAfter`, `natural`, `basis`, `cardinal`, `catmullRom`. |

## Verified snippet

```tsx
/** @jsxImportSource svjeez */
import { Chart, bars } from "@svjeez/charts";
import { google } from "@svjeez/fonts";
import { Group, Shape, scene, span, tokens, track } from "svjeez";

const mono = await google("JetBrains Mono", { fallback: ["ui-monospace", "monospace"], ligatures: false });
const theme = tokens({
  light: { background: "#FFFFFF", border: "#D4D7DD", muted: "#555A66", blue: "#0A6CFF", orange: "#D95D00" },
  dark: { background: "#090A0C", border: "#2C3038", muted: "#98A0AD", blue: "#64D2FF", orange: "#FF9F43" },
});

export default scene(
  { size: [480, 300], duration: 3.5, title: "Grouped bars", desc: "Two bar series grow in.", theme, still: 3, loop: false },
  (canvas) => (
    <Group>
      <Shape geometry={canvas.rect} fill={theme.background} />
      <Chart
        font={mono}
        axis={theme.border}
        label={theme.muted}
        grid={{}}
        at={[60, 24]}
        size={[380, 220]}
        x={{ kind: "band", domain: ["Jan", "Feb", "Mar"] }}
        axesIn={span(0, 0.5)}
        series={[
          bars({ Jan: 10, Feb: 40, Mar: 25 }, { name: "a", color: theme.blue, values: true, draw: track(0).to(1, span(0.3, 1.2)) }),
          bars({ Jan: 20, Feb: 10, Mar: 5 }, { name: "b", color: theme.orange, draw: track(0).to(1, span(0.6, 1.2)) }),
        ]}
      />
    </Group>
  ),
);
```

## Gotchas

- `outside y.domain [min, max]` → Widen `y.domain` or omit it to auto-fit.
- `Two series are both named "bars"` → Pass a distinct `name` to each series of the same kind.
- `bars() needs categories on the x axis, and x is linear` → Use `x={{ kind: "band", domain: [...] }}` for bars.
- `props.children is not a function` → Pass a callback `{({ x, y }) => <Group>...</Group>}` to `<Chart>`, not raw JSX children.
- `morph() can't blend <Shape> "Q1": … its origin moves between states` → Drop `draw` on bars inside `morph.between()` and animate entrance on an outer `<Group>`.
- Series `label` clips at the right edge silently → Reserve ~8 px + ~7 px/char of right margin outside `size[0]` and verify with `frames --sheet`.
- Many `loop-seam` warnings on bars → Set `loop: false` in `scene()`, or wrap `<Chart>` in `<Group motion={exit(span(...))}>`.

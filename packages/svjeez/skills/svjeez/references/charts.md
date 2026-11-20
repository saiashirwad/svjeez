# Charts

`@svjeez/charts` (`npm i @svjeez/charts@next`) draws bars, lines and areas on shared axes. `<Chart>` is a component; its series are plain values you list in `series`. It fits the scales to the data, lays out the axes and builds ordinary nodes, so everything in the other references applies to what it draws.

```tsx
import { Chart, area, bars, line } from "@svjeez/charts";

<Chart
  at={[84, 196]}
  size={[380, 290]}
  x={{ kind: "band", domain: months }}
  y={{ ticks: 4 }}
  font={mono}
  axis={theme.border}
  label={theme.muted}
  grid={{}}
  axesIn={span(0.4, 0.6)}
  series={[
    bars(opened, { color: theme.orange, draw: track(0).to(1, span(0.6, 1.1)) }),
    line(merged, { color: theme.blue, name: "merged", draw: track(0).to(1, span(1.2, 1.1)), dots: true }),
  ]}
>
  {({ x, y }) => <Text key="note" font={mono} size={12} at={[x("Mar"), y(60)]} fill={theme.text}>…</Text>}
</Chart>
```

The whole example is `examples/charts/index.tsx` in the repository.

## `<Chart>`

| Prop | Meaning |
| --- | --- |
| `size` | the plot area, `[width, height]`. The axes draw outside it: leave about 50 on the left and 30 below |
| `at` | where the plot area's top-left goes. Default `[0, 0]` |
| `x` | `{ kind: "band", domain: ["Q1", …], padding?, format? }` for categories, or `{ kind: "linear", domain?, ticks?, format? }` for numbers |
| `y` | `{ domain?, ticks?, zero?, format? }`. Domains widen to round numbers |
| `series` | `bars()`, `line()` and `area()` values, drawn in order |
| `font`, `textSize` | the axis labels' font and size (default 12) |
| `axis`, `label` | paint for the axis lines, and for the labels (a token) |
| `grid` | guide lines at the ticks, off unless set: `{}` draws them in the axis color, an object restyles them |
| `axesIn` | a span the axes fade in over; without it they are there from the start |
| `key` | key the chart when you morph between states |
| children | a function `({ x, y, bandwidth, size }) => nodes`: annotations in the plot's own coordinates |

A domain you leave out is fitted to every series; a fitted y domain includes 0 when the chart has bars or an area (`y.zero` sets that explicitly). Domains can widen to round tick boundaries. A value outside the resulting domain is an error.

## Series

```tsx
bars(data, { color, name?, draw?, stagger?, radius?, values? })
line(points, { color, name?, draw?, curve?, dots?, stroke?, label? })
area(points, { …line options, baseline?, line? })
```

- `data` of `bars` is a record `{ Q1: 12 }` or `[key, value]` pairs; `points` are `[x, y]` pairs, `x` a category string on a band axis or a number on a linear one.
- `color` is required. `name` keys the series; two series in one chart need different names (default `"bars"`, `"line"`, `"area"`).
- `draw` is how much of the series is drawn, 0 to 1, a number or a track: one timeline drives the whole series. Without it the series is just there, which is what you want inside a morph. Ease the `draw` track.
- Several `bars` in one chart stand side by side in each band. `bars`: `stagger` is the share of the draw spent staggering the bars' starts (default 0.3), `radius` defaults to 3, `values: true` writes each number at its bar (or pass `(value) => string`).
- `line`: `curve` is `curve.linear` (default), `curve.monotone`, `curve.step`, or any d3-shape curve; `dots` is `true` (radius 4) or a radius; `stroke` restyles the line over its default (the series color, width 2.5, round cap and join); `label` is written past the last point, so leave room on the right.
- `area`: a fill fading toward the baseline wipes in with the line. `baseline` is the y it reaches down to (default 0). `line: false` leaves the top edge unstroked.

## Data that changes

Write one `<Chart>` per state and morph between them; bars are keyed by category, so they grow, shrink, enter and leave:

```tsx
const state = (values: Record<string, number>) => (
  <Chart key="sales" size={[300, 200]} x={{ kind: "band", domain: months }} y={{ domain: [0, 100] }}
    series={[bars(values, { color: theme.blue })]} font={mono} axis={theme.border} label={theme.muted} />
);

morph.between([q1, q2, q3].map(state), [span(1, 1), span(3, 1)]);
```

Give `y.domain` and the x domain the same in every state, so the axes hold still and only the marks move. Leave `draw` off inside a morph. A line or area morphs point for point: every state needs the same number of points and the same `curve`.

## Errors

Each error points at the `<Chart>` line and names the series: a category not in `x.domain`, `bars()` on a linear x, a line with fewer than 2 points, a value outside `y.domain`, two series with one name, a `size` that isn't positive, or nothing to fit the axis to. Axis labels and bar values are plain `<Text>` and crossfade in a morph; for a number that counts, add a separate `<Text>` with `count()`.

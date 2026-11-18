# Charts

`@svjeez/charts` draws bars, lines and areas on shared axes: `npm i @svjeez/charts@next`. `<Chart>` is a component; its series are plain values you list in `series`. It fits the scales to the data, lays out the axes and builds ordinary nodes, so everything in the other references applies to what it draws.

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
  grid
  axesIn={span(0.4, 0.6)}
  series={[
    bars(opened, { name: "opened", color: theme.orange, span: span(0.6, 1.1) }),
    bars(merged, { name: "merged", color: theme.blue, span: span(0.8, 1.1) }),
  ]}
>
  {({ x, y }) => <Text key="note" font={mono} size={12} at={[x("Mar"), y(60)]} fill={theme.text}>…</Text>}
</Chart>
```

The whole example is [`examples/charts`](../../../../../examples/charts/index.tsx) in the repository.

## `<Chart>`

| Prop | Meaning |
| --- | --- |
| `size` | the plot area, `[width, height]`. The axes draw outside it: leave about 50 on the left and 30 below |
| `at` | where the plot area's top-left goes. Default `[0, 0]` |
| `x` | `{ kind: "band", domain: ["Q1", …], padding?, format? }` for categories, or `{ kind: "linear", domain?, ticks?, format? }` for numbers |
| `y` | `{ domain?, ticks?, zero?, format? }`. Domains widen to round numbers |
| `series` | `bars()`, `line()` and `area()` values, drawn in order |
| `font`, `fontSize` | the axis labels' font and size (default 12) |
| `axis`, `label` | paint for the axis lines and grid, and for the labels (a token) |
| `grid` | faint lines across the plot at the ticks |
| `axesIn` | a span the axes fade in over; without it they are there from the start |
| `key` | key the chart when you morph between states |
| children | a function `({ x, y, bandwidth, size }) => nodes`: annotations in the plot's own coordinates, where `x(value)` is a band's center or a linear value and `y(value)` a y value |

A domain you leave out is fitted to every series. A fitted y domain includes 0 when the chart has bars or an area, and not for lines alone; `y.zero` overrides it. A domain you give is never stretched: a value outside it is an error.

## Series

```tsx
bars(data, { color, name?, span?, stagger?, ease?, radius?, values? })
line(points, { color, name?, span?, curve?, dots?, width?, label? })
area(points, { …line options, baseline?, line? })
```

- `data` of `bars` is a record `{ Q1: 12 }` or `[key, value]` pairs; `points` are `[x, y]` pairs, `x` a category string on a band axis or a number on a linear one.
- `color` is required, a token or hex. `name` keys the series, and two series in one chart need different names (default: `"bars"`, `"line"`, `"area"`).
- `span` is when it plays. Without one a series is just there, which is what you want inside a morph.
- Several `bars` in one chart stand side by side in each band.
- `bars`: each bar grows over `span`, `stagger` seconds after the one before it (default 0.08, so bar `i` starts at `span.start + i * stagger`). `ease` defaults to `ease.out`, `radius` to 3. `values: true` writes each number at its bar and fades it in as the bar lands, or pass `(value) => string`.
- `line`: the stroke draws on over `span`. `curve` is `"linear"`, `"monotone"` or `"step"`. `dots` is `true` (radius 4) or a radius; each pops in as the stroke reaches it. `width` defaults to 2.5. `label` is written past the last point and fades in after the stroke, so leave room on the right.
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

Give `y.domain` (and the x domain) the same in every state, so the axes hold still and only the marks move. Leave `span` off the series inside a morph. A line or area morphs point for point, so every state needs the same number of points and the same `curve`.

## Errors

Each error points at the `<Chart>` line and names the series:

| Message | Fix |
| --- | --- |
| `bars("sales") has "Apr", which is not in x.domain (…).` | add the category to `x.domain` or drop it from the data |
| `bars() needs categories on the x axis, and x is linear.` | use a band `x`, or draw a `line()` or `area()` |
| `line() has 1 point.` | a line or area needs at least 2 points |
| `bars() has 99 at Jan, outside y.domain [0, 10].` | widen `y.domain`, or leave it out to fit the data |
| `Two series are both named "bars".` | give each series of one chart its own `name` |
| `size is [0, 200].` | a positive width and height |
| `There is nothing to fit the y axis to.` | add a series, or give `y.domain` |

## Counting numbers

Axis labels and bar values are plain `<Text>`; in a morph they crossfade. Numbers that tick up between states will come from the counting text node once it lands.

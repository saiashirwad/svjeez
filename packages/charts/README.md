# @svjeez/charts

Animated bar, line and area charts for [svjeez](https://www.npmjs.com/package/svjeez) scenes. `chart()` fits the scales to your data while the scene compiles, draws the axes, and hands back series that grow, draw and wipe on at the seconds you name. The result is plain SVG elements with CSS keyframes, so a chart is still one file with no JavaScript and no font to load.

## Install

```sh
npm i -D @svjeez/charts svjeez
```

## Use

```tsx
import { chart } from "@svjeez/charts";
import { render } from "svjeez";

const quarters = ["Q1", "Q2", "Q3", "Q4"];
const sales = { Q1: 12, Q2: 48, Q3: 31, Q4: 87 };

const c = chart({
  width: 360,
  height: 200,
  at: { x: 56, y: 24 },
  x: { kind: "band", domain: quarters },
  data: Object.entries(sales),
  grid: true,
});

const bars = c.bars(sales, { at: 0.6 });
const trend = c.line(Object.entries(sales), { at: bars.end, curve: "monotone", dots: true });

export default () =>
  render(
    { width: 440, height: 260, duration: 6, title: "Sales by quarter" },
    <>
      {c.node}
      {bars.node}
      {trend.node}
    </>,
  );
```

`chart(options)` owns the frame, so the scales are decided once and every series shares them. It takes:

- `width`, `height` and `at`, the plot area in px and its top-left. The axes draw outside it.
- `x`, a band scale `{ kind: "band", domain: ["Q1", …], padding? }` or a linear one `{ kind: "linear", domain?, ticks?, format? }`. A linear scale without a `domain` fits `data`.
- `y`, `{ domain?, ticks?, zero?, format? }`. The domain widens to round numbers. Fitted from `data`, it includes 0 unless `zero` is `false`.
- `data`, every point the chart will draw, as `[x, y]` pairs. It is needed only for a domain you left out. `Object.entries(record)` gives the pairs for bars.
- `grid`, `theme`, `fontSize` and `font`. The theme is a `Base16` palette and defaults to `defaultDark`. Axis lines use its `comment` color and labels its `muted` color, the same as `axes()`, so the two sit in one scene.

The chart has:

- `node`, the axes, ticks, labels and grid. They are static. Wrap them in an `enter()` to fade them in.
- `bounds`, `x(value)`, `y(value)` and `bandwidth`, to place annotations in scene px. On a band scale `x()` is the center of a band.
- `bars(values, options)`, which grows each bar up from the baseline. Band scales only.
- `line(points, options)` and `area(points, options)`, with points as `[x, y]` pairs.

Every series takes `color`, `at` and `over` in seconds. `color` defaults to the next accent of the theme: blue, orange, green, magenta, cyan, yellow, red. Each returns its `node` and `end`, the second it finishes, so the next series can start there.

- `bars` also takes `stagger` (seconds between bars, 0.08), `group: { index, count }` to put series side by side in each band, `radius` and `values` to write each number at its bar. It returns `bars`, one `{ key, value, bounds }` per bar.
- `line` also takes `curve` (`"linear"`, `"monotone"` or `"step"`), `dots` (`true` or a radius), `strokeWidth` and `label`, the series name written past the last point. It returns `d` and `points` in scene px. The dots pop in as the stroke reaches them.
- `area` takes the options of `line`, plus `baseline` (default 0) and `line: false` to leave the top edge unstroked. A gradient fill wipes in from the left in step with the line.

## Errors

Bad data throws at the call that got it, naming the call, the value and the fix: `bars() got "Q5", which is not in the x domain (Q1, Q2, Q3, Q4). Add it to x.domain.` A point outside the fitted domain throws too, so the chart never clips a value. Pass the series to `data` or widen the domain.

## Notes

`d3-scale` and `d3-shape` run once, on the build machine. Only numbers and path strings reach the scene. There is no time scale: pass dates as numbers and give the x axis a `format`.

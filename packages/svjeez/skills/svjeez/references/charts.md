# Charts with @svjeez/charts

`@svjeez/charts` is a separate package: `npm i -D @svjeez/charts`. `chart()` fits the scales to the data while the scene compiles and draws the axes. Its `bars()`, `line()` and `area()` return elements that grow, draw and wipe on over the seconds you give them. The SVG carries no script.

```tsx
import { chart } from "@svjeez/charts";
import { enter, render } from "svjeez";
import { css, mono, theme } from "./style";

const sales = { Q1: 12, Q2: 48, Q3: 31, Q4: 87 };

const c = chart({
  width: 360,
  height: 200,
  at: { x: 56, y: 24 },
  x: { kind: "band", domain: Object.keys(sales) },
  data: Object.entries(sales),
  grid: true,
  theme,
  font: mono,
});

const bars = c.bars(sales, { at: 0.8 });
const trend = c.line(Object.entries(sales), { at: bars.end, curve: "monotone", dots: true, label: "trend" });

<>
  <g animation={enter({ at: 0.2, over: 0.6 })}>{c.node}</g>
  {bars.node}
  {trend.node}
</>;
```

- `chart({ width, height, at, x, y, data, grid, theme, fontSize, font })`. `width` and `height` are the plot area in px, and the axes draw outside it, so leave about 50px on the left and 30px at the bottom. `theme` colors the axes like `axes()`: lines `comment`, labels `muted`. Pass the scene's theme and `font`.
- `x` is `{ kind: "band", domain: [...] }` for categories, or `{ kind: "linear", domain?, ticks?, format? }` for numbers. `y` is `{ domain?, ticks?, zero?, format? }`. Domains widen to round numbers. A domain you leave out is fitted to `data`, a list of `[x, y]` pairs covering everything the chart will draw. A fitted y domain includes 0 unless `zero: false`.
- `.node` is the axes and grid, drawn at once. `.bounds`, `.x(v)`, `.y(v)` and `.bandwidth` place annotations in scene px. On a band scale `.x(key)` is the band's center, so `Brace`, `Callout` and `Marker` can point at a bar.
- `.bars(record, { at, over, stagger, color, group, radius, values })` grows each bar up from the baseline, `stagger` seconds apart. `group: { index, count }` puts several series side by side in each band. `values: true` writes each number at its bar. Band scales only.
- `.line(points, { at, over, color, curve, dots, strokeWidth, label })` draws on over `over` seconds. `curve` is `"linear"`, `"monotone"` or `"step"`. `dots` pop in as the stroke reaches them. `label` is written past the last point, so leave room on the right.
- `.area(points, { ...line options, baseline, line })` wipes a gradient fill in with the line. `line: false` leaves the top edge unstroked.
- Every series returns `node` and `end`, the second it finishes. Start the next series at `end`. `color` defaults to the theme's next accent, so give two series that must match across charts an explicit one.

A series whose data lies outside the chart's domain throws, so pass all of it to `data` or set `domain`.

## Errors

| Error | Fix |
| --- | --- |
| `chart() needs y.domain or data to fit the y scale, got neither.` | Pass `data` or `y: { domain }`. The same holds for a linear x scale. |
| `chart() needs finite data, got … at index ….` | A `NaN` or `Infinity` in `data`. Clean it before the chart. |
| `chart() needs distinct x.domain categories, got "…" twice.` | Band categories must be unique. |
| `bars() got "…", which is not in the x domain (…). Add it to x.domain.` | A key the band scale lacks. The same message starts `line()` and `area()` for a category point. |
| `bars() got … for "…", outside the y domain […]. Pass the data to chart({ data }) or widen y.domain.` | The series is not in the data the scale was fitted to. |
| `bars() needs a band x scale, got a linear one. Use line() or area() here.` | Bars need categories. |
| `line() needs at least 2 points, got ….` | One point draws nothing. |
| `bars() needs a positive over, got ….` | `over` is a length in seconds. |

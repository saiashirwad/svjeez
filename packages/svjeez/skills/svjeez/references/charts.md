# Charts with @svjeez/charts

`@svjeez/charts` is a separate package: `npm i -D @svjeez/charts`. `chart()` fits the scales to the data while the scene compiles and draws the axes. Its `bars()`, `line()` and `area()` take a `{ at, over }` span first and return elements that grow, draw and wipe on over it. The SVG carries no script.

```tsx
import { chart } from "@svjeez/charts";
import { enter, render } from "svjeez";
import { rect } from "svjeez/geometry";
import { css, mono, theme } from "./style";

const sales = { Q1: 12, Q2: 48, Q3: 31, Q4: 87 };

const c = chart({
  frame: rect(56, 24, 360, 200),
  x: { kind: "band", domain: Object.keys(sales) },
  data: Object.entries(sales),
  grid: true,
  theme,
  font: mono,
});

const bars = c.bars({ at: 0.8, over: 1.5 }, sales);
const trend = c.line({ at: bars.span.end, over: 1.2 }, Object.entries(sales), {
  curve: "monotone",
  dots: true,
  label: "trend",
});

<>
  <g animation={enter({ at: 0.2, over: 0.6 })}>{c.node}</g>
  {bars}
  {trend}
</>;
```

- `chart({ frame, x, y, data, grid, theme, fontSize, font })`. `frame` is a `Rect`, the plot area in px, and the axes draw outside it, so leave about 50px on the left and 30px at the bottom. `theme` colors the axes like `plane()`: lines `comment`, labels `muted`. Pass the scene's theme and `font`. `fontSize` defaults to 12 and `grid` to false.
- `x` is `{ kind: "band", domain: [...], padding?, format? }` for categories (`padding` is the gap between bands, 0 to 1, default 0.3), or `{ kind: "linear", domain?, ticks?, format? }` for numbers. `y` is `{ domain?, ticks?, zero?, format? }`. Domains widen to round numbers. A domain you leave out is fitted to `data`, a list of `[x, y]` pairs covering everything the chart will draw. A fitted y domain includes 0 unless `zero: false`.
- `.node` is the axes and grid, drawn at once. `.bounds`, `.x(v)`, `.y(v)` and `.bandwidth` place annotations in scene px. On a band scale `.x(key)` is the band's center, so `Brace`, `Callout` and `Marker` can point at a bar.
- `.bars(span, record, { stagger, ease, color, group, radius, values })` grows each bar up from the baseline, `stagger` seconds apart, so the last one lands at the end of `span` and each grows for `over - (bars - 1) * stagger`. `stagger` defaults to 0.08, or less when the span is short. `ease` defaults to `ease.out` and `radius` to 3. `record` may also be `[key, value]` pairs. `group: { index, count }` puts several series side by side in each band. `values: true` writes each number at its bar, or pass a `(value) => string`. Band scales only.
- `.line(span, points, { color, curve, dots, strokeWidth, label })` draws on over `span`. `curve` is `"linear"`, `"monotone"` or `"step"`. `dots` is `true` (radius 4) or a radius, and they pop in as the stroke reaches them. `strokeWidth` defaults to 2.5. `label` is written past the last point, so leave room on the right. It also returns `d`, the path data.
- `.area(span, points, { ...line options, baseline, line })` wipes a gradient fill in with the line. `baseline` is the y the fill reaches down to, default 0. `line: false` leaves the top edge unstroked. It also returns `fill`, the path data of the shape.
- Every series returns `node`, `span`, `bounds`, `parts` and `part(id)`, the shape every svjeez package returns. Put the series itself in the scene, `{bars}`. For `line()` and `area()` the span runs to when the label has appeared, and for `bars()` it is the span you passed. Start the next series at `span.end`.
- A bar's part is `{ id, value, box, span }`: `id` is its category, `box` where it rests, and `span` its staggered window, so a callout can land right after one bar: `enter(bars.part("Q3").span.next(0.4))`. A point of a line or area is `{ id, value, point, box, span }`, its `id` the x value as a string (`"Q3"`, `"2019"`); `span` starts when the stroke reaches it, and `box` is its dot. `color` defaults to the theme's next accent, so give two series that must match across charts an explicit one.

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
| `bars() needs a span longer than … staggers of …s, got over ….` | Lengthen the span or lower `stagger`. |

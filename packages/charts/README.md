# @svjeez/charts

Draw data-driven bars, lines and areas on shared axes in a svjeez scene.

```sh
npm i -D @svjeez/charts svjeez
```

```tsx
import { chart } from "@svjeez/charts";
import { render, span } from "svjeez";
import { rect } from "svjeez/geometry";

const sales = { Q1: 12, Q2: 48, Q3: 31, Q4: 87 };
const points = Object.entries(sales);
const plot = chart({
  frame: rect(56, 24, 360, 200),
  x: { kind: "band", domain: Object.keys(sales) },
  data: points,
  grid: true,
});
const bars = plot.bars(span(0.6, 1.5), sales);

export default () =>
  render(
    { width: 440, height: 260, duration: 4, title: "Sales by quarter" },
    <>{plot.node}{bars}</>,
  );
```

Use `line(span, points)` or `area(span, points)` on the same plot. Series expose `span`, `bounds` and named parts. For example, `bars.part("Q3").box` gives a callout its position.

<a href="https://github.com/saiashirwad/svjeez/tree/main/examples/charts"><img src="https://raw.githubusercontent.com/saiashirwad/svjeez/main/examples/dist/charts.svg" width="540" alt="Grouped bars grow beside an area chart." /></a>

[API reference](https://github.com/saiashirwad/svjeez/blob/main/packages/svjeez/skills/svjeez/references/charts.md)

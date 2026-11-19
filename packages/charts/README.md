# @svjeez/charts

Bar, line, and area charts on shared axes for `svjeez`. Scales are computed at build time, and each series animates in from a `draw` progress (`0` to `1` or a `track`).

```sh
npm i -D @svjeez/charts@next @svjeez/fonts@next svjeez@next
```

```tsx
import { Chart, bars, line } from "@svjeez/charts";
import { google } from "@svjeez/fonts";
import { Group, scene, span, tokens, track } from "svjeez";

const theme = tokens({
  light: { text: "#1D1D1F", muted: "#6E6E73", blue: "#0A6CFF" },
  dark: { text: "#E5E5EA", muted: "#A1A1A6", blue: "#5EA0FF" },
});
const mono = await google("JetBrains Mono");
const sales = { Q1: 12, Q2: 48, Q3: 31, Q4: 87 };

export default scene({ size: [440, 260], duration: 4, title: "Sales by quarter", theme }, () => (
  <Group>
    <Chart
      at={[56, 24]}
      size={[360, 200]}
      x={{ kind: "band", domain: Object.keys(sales) }}
      series={[
        bars(sales, { color: theme.blue, draw: track(0).to(1, span(0.6, 1.2)) }),
        line(Object.entries(sales), {
          color: theme.text,
          draw: track(0).to(1, span(1.8, 1.2)),
          dots: true,
        }),
      ]}
      font={mono}
      axis={theme.muted}
      label={theme.muted}
    />
  </Group>
));
```

To animate data changes over time, render one `<Chart>` per state and pass them to `morph.between()`.

[API reference](https://github.com/saiashirwad/svjeez/blob/next/packages/svjeez/skills/svjeez/references/charts.md)

import { chart, type Bars, type Chart } from "@svjeez/charts";
import { render } from "svjeez";
import { rect } from "svjeez/geometry";

const quarters: Chart<"band"> = chart({
  frame: rect(40, 20, 360, 180),
  x: { kind: "band", domain: ["Q1", "Q2", "Q3"] },
  data: [
    ["Q1", 4],
    ["Q3", 9],
  ],
});

const sales: Bars = quarters.bars({ at: 0.5, over: 1 }, { Q1: 4, Q2: 7, Q3: 9 });

const trend = quarters.line(
  { at: sales.span.end, over: 1 },
  [
    ["Q1", 4],
    ["Q3", 9],
  ],
  { curve: "monotone", dots: true },
);

export const svg: string = render({ width: 440, height: 240, duration: 4, title: "Charts" }, [
  quarters.node,
  sales.node,
  trend.node,
]);

export const end: number = sales.span.end;

import { chart, type Bars, type Chart } from "@svjeez/charts";
import { render } from "svjeez";

const quarters: Chart<"band"> = chart({
  width: 360,
  height: 180,
  at: { x: 40, y: 20 },
  x: { kind: "band", domain: ["Q1", "Q2", "Q3"] },
  data: [
    ["Q1", 4],
    ["Q3", 9],
  ],
});

const sales: Bars = quarters.bars({ Q1: 4, Q2: 7, Q3: 9 }, { at: 0.5 });

const trend = quarters.line(
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

export const end: number = sales.end;

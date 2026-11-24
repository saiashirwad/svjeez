import { Chart, area, bars, curve, line, type ChartProps, type Series } from "@svjeez/charts";
import { font } from "svjeez";

const face = await font.load(new URL("./fonts/ABeeZee-Regular.ttf", import.meta.url));

const series: readonly Series[] = [
  bars({ Q1: 12, Q2: 48 }, { color: "#0A6CFF", draw: 1 }),
  line(
    [
      ["Q1", 12],
      ["Q2", 48],
    ],
    { color: "#E5453B", curve: curve.monotone, dots: true },
  ),
  area(
    [
      [1, 2],
      [2, 3],
    ],
    { color: "#2FA84F", baseline: 0 },
  ),
];

export const props: ChartProps = {
  size: [300, 200],
  x: { kind: "band", domain: ["Q1", "Q2"] },
  series,
  font: face,
  axis: "#8E8E93",
  label: "#6E6E73",
};

// @ts-expect-error a series needs a color
export const colorless = bars({ Q1: 1 }, {});

export { Chart };

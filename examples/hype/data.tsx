import { chart } from "@svjeez/charts";
import { enter, type Span } from "svjeez";
import { mono, theme } from "../style";
import { C, Caption } from "./kit";

const STARS = [42, 61, 55, 88, 120, 164, 230, 312];
const WEEKS = STARS.map((_, i) => `W${i + 1}`);
const pairs = WEEKS.map((week, i) => [week, STARS[i]!] as const);
const STEP = 0.11;

const plot = chart({
  width: 800,
  height: 330,
  at: { x: 240, y: 150 },
  x: { kind: "band", domain: WEEKS },
  y: { ticks: 4 },
  data: pairs,
  grid: true,
  theme,
  font: mono,
  fontSize: 12,
});

export const dataShot = ({ at }: Span) => {
  const grow = at + 0.5;
  const bars = plot.bars(Object.fromEntries(pairs), { at: grow, stagger: STEP, color: C.hairline });

  const trend = plot.line(pairs, {
    at: bars.span.end,
    over: 0.8,
    curve: "monotone",
    dots: true,
    color: C.accent,
    label: "stars",
  });

  return (
    <>
      <g animation={enter({ at: at + 0.15, over: 0.5 }, { opacity: 0 })}>{plot.node}</g>
      {bars.node}
      {trend.node}
      <Caption
        at={at + 0.1}
        tag="@svjeez/charts"
        call="chart().bars(stars).line(stars)"
        line="one dataset, drawn as bars with a trend line"
      />
    </>
  );
};

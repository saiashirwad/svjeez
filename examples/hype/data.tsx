import { chart } from "@svjeez/charts";
import { enter, type Span } from "svjeez";
import { rect } from "svjeez/geometry";
import { jumps } from "../site/lib/blip";
import { mono, theme } from "../style";
import { C, Caption, Blip } from "./kit";

const STARS = [42, 61, 55, 88, 120, 164, 230, 312];
const WEEKS = STARS.map((_, i) => `W${i + 1}`);
const pairs = WEEKS.map((week, i) => [week, STARS[i]!] as const);
const STEP = 0.11;

const plot = chart({
  frame: rect(240, 150, 800, 330),
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

  const bars = plot.bars({ at: grow, over: 0.7 + (pairs.length - 1) * STEP }, pairs, {
    stagger: STEP,
    color: C.hairline,
  });

  const trend = plot.line({ at: bars.span.end, over: 0.8 }, pairs, {
    curve: "monotone",
    dots: true,
    color: C.accent,
    label: "stars",
  });

  // Blip pops up on the second tallest bar once the bars are in, and cheers when the trend line lands.
  const last = pairs.at(-2)!;
  const perch = { x: plot.x(last[0]), y: plot.y(last[1]) };

  const cheer = jumps([
    { land: trend.span.end + 0.2, height: 70 },
    { land: trend.span.end + 1.3, height: 40 },
  ]);

  return (
    <>
      <g animation={enter({ at: at + 0.15, over: 0.5 }, { opacity: 0 })}>{plot.node}</g>
      {bars.node}
      {trend.node}
      <Blip
        x={perch.x}
        y={perch.y}
        size={0.36}
        pop={bars.span.end}
        blinks={[bars.span.end + 0.9]}
        body={cheer.body}
        stretch={cheer.stretch}
        bulb={cheer.bulb}
      />
      <Caption
        at={at + 0.1}
        tag="@svjeez/charts"
        call="chart().bars(stars).line(stars)"
        line="one dataset, drawn as bars with a trend line"
      />
    </>
  );
};

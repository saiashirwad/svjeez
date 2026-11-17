// A KPI row and a bar chart as a template: the figures and the series are list params, so the same scene draws any
// week's numbers. `svjeez svg metrics/index.tsx --params metrics/data.json` renders the ones in data.json.
import { chart } from "@svjeez/charts";
import { easeAt, ease, enter, motion, readout, render, span, stagger } from "svjeez";
import { rect } from "svjeez/geometry";
import { defaults, list, number, text, type Values } from "svjeez/params";

import {
  color,
  css,
  geist,
  HEIGHT,
  MARGIN,
  motions,
  mono,
  RADIUS,
  rise,
  SUBTITLE,
  theme,
  Title,
  WIDTH,
} from "../gallery-style";

export const params = {
  title: text("Weekly signups doubled since March", { maxLength: 44 }),
  subtitle: text("Product metrics, last 8 weeks", { maxLength: 60 }),
  kpis: list(
    {
      label: text("Signups", { maxLength: 18 }),
      value: number(0, { min: 0, max: 999_999, step: 0.1 }),
      unit: text("", { maxLength: 3 }),
    },
    [
      { label: "Signups", value: 4_812, unit: "" },
      { label: "Activation", value: 63.5, unit: "%" },
      { label: "Paid seats", value: 1_204, unit: "" },
      { label: "Churn", value: 1.8, unit: "%" },
    ],
    { min: 1, max: 4 },
  ),
  weeks: list(
    { label: text("W1", { maxLength: 4 }), value: number(0, { min: 0, max: 999_999 }) },
    [
      { label: "W1", value: 2_310 },
      { label: "W2", value: 2_480 },
      { label: "W3", value: 2_920 },
      { label: "W4", value: 3_150 },
      { label: "W5", value: 3_600 },
      { label: "W6", value: 3_980 },
      { label: "W7", value: 4_420 },
      { label: "W8", value: 4_812 },
    ],
    { min: 2, max: 12 },
  ),
};

const D = 9;
const GAP = 16;
const TILE = { y: 132, height: 104 };

/** A figure as a person writes it: grouped thousands, one decimal only where the value has one. */
const figure = (value: number, decimals: number) =>
  value.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

export default function build(p: Values<typeof params> = defaults(params)): string {
  const width = (WIDTH - 2 * MARGIN - GAP * (p.kpis.length - 1)) / p.kpis.length;
  const tiles = stagger(span(0.5, 0.5), p.kpis.length, 0.12);
  // One clock for everything that grows: the figures count up while the bars rise, and they land together.
  const grow = span(0.9, 1.6);
  const axes = span(0.8, 0.5);
  const out = motion({ opacity: 1 }).to({ opacity: 0 }, span(D - 1.4, 1), ease.inOut);

  const plot = chart({
    theme,
    font: mono,
    // 16px at 960 wide is about 14px in a README, the smallest that reads.
    fontSize: 16,
    grid: true,
    frame: rect(MARGIN + 56, 272, WIDTH - 2 * MARGIN - 72, 184),
    x: { kind: "band", domain: p.weeks.map((week) => week.label) },
    y: { ticks: 4 },
    data: p.weeks.map((week) => [week.label, week.value] as const),
  });

  const bars = plot.bars(
    grow,
    p.weeks.map((week) => [week.label, week.value] as const),
    { color: color.accent },
  );

  return render(
    {
      width: WIDTH,
      height: HEIGHT,
      duration: D,
      title: p.title,
      desc: `${p.subtitle}. ${p.kpis.map((kpi) => `${kpi.label} ${figure(kpi.value, Number.isInteger(kpi.value) ? 0 : 1)}${kpi.unit}`).join(", ")}. Bars for ${p.weeks.map((week) => `${week.label} ${week.value}`).join(", ")} grow in.`,
      css,
      reducedMotion: { at: D - 1 },
    },
    <>
      <rect width="100%" height="100%" fill={color.bg} />
      <g animation={out}>
        <Title title={p.title} />
        <text
          x={SUBTITLE.x}
          y={SUBTITLE.y + 6}
          fontFamily={geist}
          fontSize={20}
          fill={color.dim}
          animation={rise(motions.lead)}
        >
          {p.subtitle}
        </text>
        {p.kpis.map((kpi, i) => {
          const x = MARGIN + i * (width + GAP);
          const decimals = Number.isInteger(kpi.value) ? 0 : 1;

          return (
            <g animation={rise(tiles[i]!.at, tiles[i]!.over)}>
              <rect
                x={x}
                y={TILE.y}
                width={width}
                height={TILE.height}
                rx={RADIUS}
                fill={color.panel}
                stroke={color.edge}
              />
              <text x={x + 20} y={TILE.y + 32} fontFamily={geist} fontSize={16} fill={color.dim}>
                {kpi.label}
              </text>
              {readout(
                grow,
                (t) =>
                  `${figure(kpi.value * easeAt(ease.out, Math.min(1, (t - grow.at) / grow.over)), decimals)}${kpi.unit}`,
                {
                  x: x + 20,
                  y: TILE.y + 80,
                  fontFamily: mono,
                  fontSize: 34,
                  fontWeight: 600,
                  fill: color.ink,
                },
              )}
            </g>
          );
        })}
        <g animation={enter(axes)}>{plot.node}</g>
        {bars}
      </g>
    </>,
  );
}

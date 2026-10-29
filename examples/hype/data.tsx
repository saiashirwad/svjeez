import { chart } from "@svjeez/charts";
import { ease, enter, type Span } from "svjeez";
import { voxel } from "svjeez/voxel";
import { mono, theme } from "../style";
import { C, Caption } from "./kit";

const STARS = [42, 61, 55, 88, 120, 164, 230, 312];
const WEEKS = STARS.map((_, i) => `W${i + 1}`);
const pairs = WEEKS.map((week, i) => [week, STARS[i]!] as const);
const STEP = 0.11;

const plot = chart({
  width: 470,
  height: 330,
  at: { x: 110, y: 150 },
  x: { kind: "band", domain: WEEKS },
  y: { ticks: 4 },
  data: pairs,
  grid: true,
  theme,
  font: mono,
  fontSize: 12,
});

const view = voxel.camera({ yaw: 24, pitch: 28, unit: 26 });

// Voxel skins take hex, not the theme's CSS variables, so these mid tones read on both backgrounds.
const stone = voxel.texture(
  { a: "#9AA4AF", b: "#8C96A1" },
  `
  aaba
  abaa
  aaab
  baaa
`,
);

const ember = voxel.texture(
  { a: "#F07A2B", b: "#E06A1C", c: "#F79A55" },
  `
  acaa
  aaba
  baac
  aaba
`,
);

const TALLEST = 7;
const heights = STARS.map((v) => Math.max(1, Math.round((v / STARS.at(-1)!) * TALLEST)));

export const dataShot = ({ at }: Span) => {
  const grow = at + 0.5;
  const bars = plot.bars(Object.fromEntries(pairs), { at: grow, stagger: STEP, color: C.hairline });

  const trend = plot.line(pairs, {
    at: bars.end,
    over: 0.8,
    curve: "monotone",
    dots: true,
    color: C.accent,
    label: "stars",
  });

  const blocks = heights.flatMap((height, i) =>
    Array.from({ length: height }, (_, h) => {
      const from = grow + i * STEP + h * 0.06;

      return {
        at: [i * 2, h, 0] as const,
        skin: i === heights.length - 1 ? ember : stone,
        from,
        animation: enter({ at: from, over: 0.35 }, { y: -26 }, ease.pop),
      };
    }),
  );

  return (
    <>
      <g animation={enter({ at: at + 0.15, over: 0.5 }, { opacity: 0 })}>{plot.node}</g>
      {bars.node}
      {trend.node}
      <g transform="translate(690 450)">{voxel.scene({ camera: view, blocks })}</g>
      <Caption
        at={at + 0.1}
        tag="@svjeez/charts · svjeez/voxel"
        call="chart().bars(stars) + voxel.scene()"
        line="one dataset, drawn as a chart and as a skyline"
      />
    </>
  );
};

import { Chart, bars, curve, line as plotted } from "@svjeez/charts";
import {
  Arrow,
  Group,
  Shape,
  Stack,
  Text,
  ease,
  enter,
  rect,
  ref,
  span,
  track,
  type SceneElement,
  type Vec,
} from "svjeez";
import type { Child } from "svjeez/tools";
import { Builds } from "./builds";
import { RESULT_COLUMN, SHOTS, mono, theme } from "./kit";

// Two more code slides in the same shape as the basics: data becomes a chart, and named boxes become a diagram.

const SKELETON = `export default scene(opts, () => (
  <Group />
));`;

/** One tile filling the result column, appearing at `from`; bare, it has no background, and only its contents show. */
const Tile = ({
  from,
  bare = false,
  children,
}: {
  readonly from: number;
  readonly bare?: boolean;
  readonly children: Child;
}): SceneElement => (
  <Group
    offset={[RESULT_COLUMN[0], RESULT_COLUMN[1]]}
    motion={enter(span(from - 0.35, 0.3), {
      from: { opacity: 0, offset: [0, 8] },
      curve: ease.out,
    })}
  >
    {!bare && (
      <Shape
        geometry={rect(RESULT_COLUMN[2], RESULT_COLUMN[3], { radius: 12 })}
        fill={theme.surface}
        stroke={{ color: theme.line, width: 1 }}
      />
    )}
    {children}
  </Group>
);

const sales = [
  ["Q1", 12],
  ["Q2", 48],
  ["Q3", 31],
  ["Q4", 87],
] as const;

/** The chart fills the column, a little in from its edges for the axis labels. */
const CHART_AT: Vec = [48, 40];
const CHART_SIZE: Vec = [RESULT_COLUMN[2] - 60, RESULT_COLUMN[3] - 80];

/** The top of the tallest bar, Q4, in the film's pixels, for Blip to stand on once it has grown. */
export const TALLEST: Vec = [
  RESULT_COLUMN[0] + CHART_AT[0] + CHART_SIZE[0] * 0.875,
  RESULT_COLUMN[1] + CHART_AT[1] + CHART_SIZE[1] * (1 - 87 / 100),
];

const chartFile = (n: number): string => {
  if (n === 0) return SKELETON;

  const data = `const sales = { Q1: 12, Q2: 48, Q3: 31, Q4: 87 };\n\n`;

  if (n === 1)
    return `${data}export default scene(opts, () => (
  <Group />
));`;

  return `${data}export default scene(opts, () => (
  <Chart
    x={{ kind: "band", domain: quarters }}
    series={[
      bars(sales, { color: theme.blue, draw }),${
        n >= 3 ? `\n      line(sales, { color: theme.pink, draw }),` : ""
      }
    ]}
  />
));`;
};

export const ChartSlide = (): SceneElement => (
  <Builds
    name="sales.tsx"
    file={chartFile}
    lands={[1.0, 2.6, 4.6]}
    over={SHOTS.chart.over!}
    result={([, grow, trend]) => (
      <Tile from={grow!} bare>
        <Chart
          at={CHART_AT}
          size={CHART_SIZE}
          x={{ kind: "band", domain: sales.map(([q]) => q), padding: 0.35 }}
          y={{ ticks: 4 }}
          axesIn={span(grow! - 0.2, 0.4)}
          series={[
            bars([...sales], {
              color: theme.blue,
              radius: 4,
              draw: track(0).to(1, span(grow!, 1), ease.out),
            }),
            plotted([...sales], {
              color: theme.pink,
              curve: curve.monotone,
              dots: 4.5,
              stroke: { width: 2.5 },
              draw: track(0).to(1, span(trend!, 1), ease.inOut),
            }),
          ]}
          font={mono}
          textSize={14}
          axis={theme.line}
          label={theme.faint}
          grid={{ color: theme.line, width: 1 }}
        />
      </Tile>
    )}
  />
);

const NODES = ["app", "api", "db"] as const;

const diagramFile = (n: number): string => {
  if (n === 0) return SKELETON;

  const arrows = [
    ["app", "api"],
    ["api", "db"],
  ]
    .slice(0, n - 1)
    .flatMap(([from, to]) => [
      "    <Arrow",
      `      from={${from}.right}`,
      `      to={${to}.left}`,
      "    />",
    ]);

  return [
    "const [app, api, db] = refs();",
    "",
    "export default scene(opts, () => (",
    "  <Group>",
    "    <Stack",
    '      direction="row"',
    "      gap={72}",
    "    >",
    ...NODES.map((node) => `      <Box ref={${node}}>${node}</Box>`),
    "    </Stack>",
    ...arrows,
    "  </Group>",
    "));",
  ].join("\n");
};

const handles = { app: ref(), api: ref(), db: ref() } as const;
const BOX = [110, 64] as const;
const GAP = 72;

export const DiagramSlide = (): SceneElement => (
  <Builds
    name="arch.tsx"
    file={diagramFile}
    lands={[1.0, 3.0, 4.4]}
    over={SHOTS.diagram.over!}
    result={([boxes, first, second]) => (
      <Tile from={boxes!}>
        <Stack
          direction="row"
          gap={GAP}
          at={[(RESULT_COLUMN[2] - 3 * BOX[0] - 2 * GAP) / 2, (RESULT_COLUMN[3] - BOX[1]) / 2]}
        >
          {NODES.map((node, i) => (
            <Stack
              ref={handles[node]}
              width={BOX[0]}
              height={BOX[1]}
              align="center"
              justify="center"
              radius={10}
              fill={theme.background}
              stroke={{ color: theme.faint, width: 1 }}
              motion={enter(span(boxes! + i * 0.12, 0.4), {
                from: { opacity: 0, scale: 0.7 },
                curve: ease.pop,
              })}
            >
              <Text font={mono} size={20} fill={theme.text}>
                {node}
              </Text>
            </Stack>
          ))}
        </Stack>
        <Arrow
          from={handles.app.right}
          to={handles.api.left}
          inset={6}
          stroke={{ color: theme.blue, width: 2.5, cap: "round" }}
          draw={track(0).to(1, span(first!, 0.6), ease.out)}
        />
        <Arrow
          from={handles.api.right}
          to={handles.db.left}
          inset={6}
          stroke={{ color: theme.blue, width: 2.5, cap: "round" }}
          draw={track(0).to(1, span(second!, 0.6), ease.out)}
        />
      </Tile>
    )}
  />
);

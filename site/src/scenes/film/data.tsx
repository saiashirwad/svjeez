import { createRequire } from "node:module";
import { Chart, bars, curve, line as plotted } from "@svjeez/charts";
import { project, type LonLat, type Topology } from "@svjeez/geo";
import { Group, Shape, circle, ease, path, span, track, type SceneElement, type Vec } from "svjeez";
import { mono, theme } from "./kit";

const world: Topology = createRequire(import.meta.url)("world-atlas/countries-110m.json");

const SIZE: Vec = [400, 200];
const CELL = 5.4;

const map = project(world, {
  size: SIZE,
  filter: (f) => f.properties?.["name"] !== "Antarctica",
});

const land = new Set(
  map.dots(0.45).map(({ point: [x, y] }) => `${Math.floor(x / CELL)},${Math.floor(y / CELL)}`),
);

/** Every dot as a round cap on a stroke too short to see, all in one path. */
const dots = [...land].reduce((drawn, cell) => {
  const [i, j] = cell.split(",").map(Number);
  const [x, y] = [(i! + 0.5) * CELL, (j! + 0.5) * CELL];

  return drawn.moveTo([x, y]).lineTo([x + 0.01, y]);
}, path());

const HUB: LonLat = [8.68, 50.11];

const routes: LonLat[] = [
  [-122.42, 37.77],
  [139.69, 35.69],
  [-46.63, -23.55],
  [151.21, -33.87],
  [28.05, -26.2],
];

const week = [
  ["Mon", 62],
  ["Tue", 74],
  ["Wed", 69],
  ["Thu", 88],
  ["Fri", 95],
  ["Sat", 58],
  ["Sun", 64],
] as const;

const Pin = ({ at, when }: { readonly at: LonLat; readonly when: number }): SceneElement => {
  const point = map.point(at);

  return (
    <Group offset={point}>
      <Shape
        geometry={circle(9)}
        at={[0, 0]}
        anchor="center"
        stroke={{ color: theme.blue, width: 1.5 }}
        scale={track(0.2).to(1.6, span(when, 0.8), ease.out)}
        opacity={track(0)
          .to(0.8, span(when, 0.05))
          .to(0, span(when + 0.05, 0.75))}
      />
      <Shape
        geometry={circle(3.5)}
        at={[0, 0]}
        anchor="center"
        fill={theme.blue}
        scale={track(0).to(1, span(when, 0.35), ease.pop)}
      />
    </Group>
  );
};

/** The dot map with its routes flying out of Frankfurt, starting at `start`, drawn from its own [0, 0]. */
export const DotMap = ({ start }: { readonly start: number }): SceneElement => {
  const flights = span(start + 0.3, 1).cascade(routes.length, 0.2);

  return (
    <Group>
      <Shape geometry={dots} stroke={{ color: theme.strong, width: 3, cap: "round" }} />
      {routes.map((to, i) => (
        <Shape
          geometry={map.route(HUB, to)}
          stroke={{ color: theme.blue, width: 1.5, cap: "round" }}
          draw={track(0).to(1, flights[i]!, ease.inOut)}
        />
      ))}
      <Pin at={HUB} when={start + 0.1} />
      {routes.map((to, i) => (
        <Pin at={to} when={flights[i]!.end} />
      ))}
    </Group>
  );
};

/** A week of requests as bars with a line drawn over them, starting at `start`, drawn from its own [0, 0]. */
export const WeekChart = ({
  start,
  size,
}: {
  readonly start: number;
  readonly size: Vec;
}): SceneElement => (
  <Chart
    size={size}
    x={{ kind: "band", domain: week.map(([day]) => day), padding: 0.35 }}
    y={{ ticks: 3 }}
    series={[
      bars([...week], {
        color: theme.strong,
        radius: 3,
        draw: track(0).to(1, span(start, 1), ease.out),
      }),
      plotted([...week], {
        color: theme.blue,
        curve: curve.monotone,
        dots: 3.5,
        stroke: { width: 2 },
        draw: track(0).to(1, span(start + 0.8, 1), ease.inOut),
      }),
    ]}
    font={mono}
    textSize={12}
    axis={theme.line}
    label={theme.faint}
    grid={{ color: theme.line, width: 1 }}
  />
);

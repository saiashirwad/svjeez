import { createRequire } from "node:module";
import { Chart, bars, curve, line as plotted } from "@svjeez/charts";
import { project, type LonLat, type Topology } from "@svjeez/geo";
import {
  Group,
  Shape,
  Text,
  circle,
  count,
  ease,
  line,
  numeral,
  path,
  span,
  track,
  type SceneElement,
  type Vec,
} from "svjeez";
import { Header, SHOTS, STAGE, geist, mono, shown, theme } from "./kit";

const world: Topology = createRequire(import.meta.url)("world-atlas/countries-110m.json");

const SIZE: Vec = [490, 246];
const AT: Vec = [680, 300];
const CELL = 6.5;

const map = project(world, {
  size: SIZE,
  filter: (f) => f.properties?.["name"] !== "Antarctica",
});

// The map as a grid of dots: a cell is land when any point a degree apart falls in it, and its dot sits in its middle,
// so every dot lines up with its neighbours however the coastline runs.
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

const flights = span(1.2, 1.1).cascade(routes.length, 0.25);

const week = [
  ["Mon", 62],
  ["Tue", 74],
  ["Wed", 69],
  ["Thu", 88],
  ["Fri", 95],
  ["Sat", 58],
  ["Sun", 64],
] as const;

const Label = ({ at, children }: { readonly at: Vec; readonly children: string }): SceneElement => (
  <Text font={mono} size={13} letterSpacing={1.2} at={at} anchor="baseline-left" fill={theme.muted}>
    {children.toUpperCase()}
  </Text>
);

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

/** Shot 5: a week of requests charted on the left, the routes they took drawn on a dot map on the right. */
export const DataShot = (): SceneElement => {
  const { over } = SHOTS.data;
  const left = STAGE.x + 60;
  const right = 690;

  return (
    <Group>
      <Header
        title="Charts and maps, from your data."
        from="@svjeez/charts · @svjeez/geo"
        over={over!}
      />
      <Group motion={shown(over!)}>
        <Label at={[left, STAGE.y + 58]}>Requests this week</Label>
        <Text
          font={geist}
          weight={600}
          size={44}
          letterSpacing={-1.6}
          at={[left, STAGE.y + 112]}
          anchor="baseline-left"
          fill={theme.text}
        >
          {count(track(0).to(510_204, span(0.6, 1.8), ease.out), {
            format: numeral({ separator: "," }),
          })}
        </Text>
        <Chart
          at={[left + 30, STAGE.y + 160]}
          size={[450, 290]}
          x={{ kind: "band", domain: week.map(([day]) => day), padding: 0.35 }}
          y={{ ticks: 4 }}
          series={[
            bars([...week], {
              color: theme.strong,
              radius: 3,
              draw: track(0).to(1, span(0.6, 1.2), ease.out),
            }),
            plotted([...week], {
              color: theme.blue,
              curve: curve.monotone,
              dots: 4,
              stroke: { width: 2 },
              draw: track(0).to(1, span(1.5, 1.2), ease.inOut),
            }),
          ]}
          font={mono}
          textSize={13}
          axis={theme.line}
          label={theme.faint}
          grid={{ color: theme.line, width: 1 }}
          axesIn={span(0.4, 0.5)}
        />
        <Shape
          geometry={line([640, STAGE.y + 36], [640, STAGE.y + STAGE.h - 36])}
          stroke={{ color: theme.line, width: 1 }}
        />
        <Label at={[right, STAGE.y + 58]}>p95 latency</Label>
        <Text
          font={geist}
          weight={600}
          size={44}
          letterSpacing={-1.6}
          at={[right, STAGE.y + 112]}
          anchor="baseline-left"
          fill={theme.text}
        >
          {count(track(42.8).to(18.4, span(1.2, 2.2), ease.out), {
            format: numeral({ decimals: 1 }),
          })}{" "}
          ms
        </Text>
        <Group offset={AT}>
          <Shape geometry={dots} stroke={{ color: theme.strong, width: 3.4, cap: "round" }} />
          {routes.map((to, i) => (
            <Shape
              geometry={map.route(HUB, to)}
              stroke={{ color: theme.blue, width: 1.5, cap: "round" }}
              draw={track(0).to(1, flights[i]!, ease.inOut)}
            />
          ))}
          <Pin at={HUB} when={0.9} />
          {routes.map((to, i) => (
            <Pin at={to} when={flights[i]!.end} />
          ))}
        </Group>
      </Group>
    </Group>
  );
};

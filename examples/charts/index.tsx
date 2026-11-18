import { Chart, area, bars } from "@svjeez/charts";
import {
  Group,
  Shape,
  Text,
  canvas,
  ease,
  enter,
  exit,
  line,
  rect,
  scene,
  span,
  track,
  type Paint,
} from "svjeez";
import { geist } from "../fonts/faces";
import { mono, theme } from "../theme";

const counts = [
  ["Jan", 42, 31],
  ["Feb", 48, 38],
  ["Mar", 51, 44],
  ["Apr", 57, 55],
  ["May", 63, 64],
  ["Jun", 70, 72],
] as const;

const hours = [26, 28, 25, 27, 29, 26, 24, 15, 11, 9, 8, 7];

const look = { font: mono, fontSize: 12, axis: theme.border, label: theme.muted, grid: true };

const rise = (at: number) => enter(span(at, 0.6), { from: { opacity: 0, offset: [0, 10] } });

const heading = (x: number, title: string, note: string, at: number) => (
  <Group offset={[x, 124]} motion={rise(at)}>
    <Text font={geist} weight={600} size={18} fill={theme.text}>
      {title}
    </Text>
    <Text font={geist} size={13} at={[0, 26]} fill={theme.muted}>
      {note}
    </Text>
  </Group>
);

const legend = (x: number, color: Paint, name: string) => (
  <Group offset={[x, 144]}>
    <Shape geometry={rect(10, 10, { radius: 3 })} fill={color} />
    <Text font={geist} size={12} at={[16, 5]} anchor="left" fill={theme.muted}>
      {name}
    </Text>
  </Group>
);

export default scene(
  {
    size: [960, 540],
    duration: 11,
    title: "Pull request review time",
    desc: "Two charts animate in. Grouped bars show pull requests opened and merged per month, merged catching up with opened. An area chart shows the median hours to a first review falling from about 26 to 7 after a review bot ships in week 8. Sample data.",
    theme,
    reducedMotion: 6,
  },
  () => (
    <Group>
      <Shape geometry={canvas.rect} fill={theme.background} />
      <Group motion={exit(span(10.2, 0.8))}>
        <Text font={geist} weight={600} size={28} at={[48, 44]} fill={theme.text}>
          Median time to first review fell from 26 to 7 hours
        </Text>
        <Text font={geist} size={15} at={[48, 84]} fill={theme.muted}>
          Pull requests, January to June
        </Text>
        {heading(48, "Opened and merged", "Pull requests per month", 0.3)}
        <Group motion={enter(span(0.5, 0.5))}>
          {legend(260, theme.orange, "opened")}
          {legend(330, theme.blue, "merged")}
        </Group>
        {heading(532, "Time to first review", "Median hours, by week", 0.8)}
        <Chart
          {...look}
          at={[84, 196]}
          size={[380, 290]}
          x={{ kind: "band", domain: counts.map(([month]) => month) }}
          y={{ ticks: 4 }}
          axesIn={span(0.4, 0.6)}
          series={[
            bars(
              counts.map(([month, opened]) => [month, opened] as const),
              {
                name: "opened",
                color: theme.orange,
                draw: track(0).to(1, span(0.6, 1.5)),
              },
            ),
            bars(
              counts.map(([month, , merged]) => [month, merged] as const),
              {
                name: "merged",
                color: theme.blue,
                draw: track(0).to(1, span(0.8, 1.5)),
              },
            ),
          ]}
        />
        <Chart
          {...look}
          at={[568, 196]}
          size={[300, 290]}
          x={{ kind: "linear", domain: [1, 12], ticks: 11 }}
          y={{ domain: [0, 30], ticks: 3 }}
          axesIn={span(0.9, 0.6)}
          series={[
            area(
              hours.map((v, i) => [i + 1, v] as const),
              {
                name: "median",
                color: theme.magenta,
                curve: "monotone",
                dots: 3.5,
                label: "median",
                draw: track(0).to(1, span(1.2, 1.8), ease.linear),
              },
            ),
          ]}
        >
          {({ x, y }) => (
            <Group key="ships" motion={rise(2.8)}>
              <Shape
                geometry={line([x(8), y(30)], [x(8), y(0)])}
                stroke={{ color: theme.border, width: 1.5, dash: [4, 4] }}
              />
              <Text
                font={geist}
                size={13}
                at={[x(8) + 10, y(30) + 8]}
                anchor="left"
                fill={theme.text}
              >
                Review bot ships
              </Text>
            </Group>
          )}
        </Chart>
      </Group>
    </Group>
  ),
);

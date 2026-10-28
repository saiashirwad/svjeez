import { arc, project, traffic, type LonLat, type Topology } from "@svjeez/geo";
import { plane } from "@svjeez/icons/tabler";
import { Icon, draw, ease, motion, rect, render, type SvgNode } from "svjeez";
import { travel, variables } from "svjeez/extras";
import { createRequire } from "node:module";

const countries: Topology = createRequire(import.meta.url)("world-atlas/countries-110m.json");

const W = 960;
const H = 540;
const D = 18;
const SANS = "system-ui, sans-serif";

/** Each color is a CSS variable, so the map follows the viewer's light or dark mode. */
const { vars: C, css } = variables(
  {
    night: "#08121C",
    sea: "#0D1E2C",
    land: "#1A3446",
    line: "#2C4B60",
    arc: "#F4B740",
    comet: "#FFE3A3",
    hub: "#FFD27A",
    text: "#E8EEF2",
    dim: "#93AAB9",
  },
  {
    night: "#E9EEF2",
    sea: "#D6E3EC",
    land: "#F7F5EF",
    line: "#B7C8D4",
    arc: "#D9480F",
    comet: "#B8380A",
    hub: "#B8380A",
    text: "#13202A",
    dim: "#5A6F7D",
  },
);

const map = project(countries, {
  frame: rect(24, 90, W - 48, H - 120),
  filter: (f) => f.properties?.name !== "Antarctica",
});

type Code =
  | "JFK"
  | "LAX"
  | "GRU"
  | "LHR"
  | "FRA"
  | "JNB"
  | "DXB"
  | "DEL"
  | "SIN"
  | "HKG"
  | "NRT"
  | "SYD";

interface Hub {
  readonly city: string;
  readonly at: LonLat;
  /** Which way the label sits from the dot. */
  readonly side: "left" | "right" | "above" | "below";
}

const HUBS: Record<Code, Hub> = {
  JFK: { city: "New York", at: [-73.78, 40.64], side: "right" },
  LAX: { city: "Los Angeles", at: [-118.41, 33.94], side: "left" },
  GRU: { city: "São Paulo", at: [-46.47, -23.43], side: "left" },
  LHR: { city: "London", at: [-0.46, 51.47], side: "above" },
  FRA: { city: "Frankfurt", at: [8.57, 50.03], side: "right" },
  JNB: { city: "Johannesburg", at: [28.25, -26.13], side: "below" },
  DXB: { city: "Dubai", at: [55.36, 25.25], side: "below" },
  DEL: { city: "Delhi", at: [77.1, 28.56], side: "above" },
  SIN: { city: "Singapore", at: [103.99, 1.36], side: "below" },
  HKG: { city: "Hong Kong", at: [113.91, 22.31], side: "left" },
  NRT: { city: "Tokyo", at: [140.39, 35.77], side: "above" },
  SYD: { city: "Sydney", at: [151.18, -33.94], side: "left" },
};

/** Illustrative routes between the hubs, with how busy each is drawn: the share of the comets it gets. */
const ROUTES: readonly (readonly [Code, Code, number])[] = [
  ["JFK", "LHR", 4],
  ["JFK", "FRA", 2],
  ["JFK", "LAX", 3],
  ["JFK", "GRU", 2],
  ["LAX", "GRU", 1],
  ["LHR", "DXB", 3],
  ["LHR", "DEL", 2],
  ["LHR", "JNB", 2],
  ["LHR", "GRU", 1],
  ["FRA", "DXB", 2],
  ["FRA", "HKG", 2],
  ["FRA", "DEL", 1],
  ["DXB", "SIN", 3],
  ["DXB", "DEL", 2],
  ["DXB", "JNB", 1],
  ["DXB", "SYD", 1],
  ["DEL", "SIN", 2],
  ["DEL", "HKG", 1],
  ["SIN", "HKG", 3],
  ["SIN", "SYD", 3],
  ["SIN", "NRT", 2],
  ["HKG", "NRT", 3],
  ["HKG", "SYD", 1],
  ["NRT", "SYD", 1],
  ["GRU", "JNB", 1],
];

const lines = ROUTES.map(([from, to, weight]) => {
  const points = arc(map, HUBS[from].at, HUBS[to].at);

  return { from, to, weight, points };
});

const line = (points: readonly { x: number; y: number }[]) =>
  points.map((p, i) => `${i ? "L" : "M"}${p.x} ${p.y}`).join("");

const FADE = 1;
const DRAW = 3.2;
const FLOW = { at: 2.6, over: 10.4 };

/** The one plane: London to Singapore, turning with its arc. */
const flight = arc(map, HUBS.LHR.at, HUBS.SIN.at, { height: 90 });
const PLANE_AT = 5;
const PLANE_OVER = 8;

const SIZE = 20;

function Arcs(): SvgNode {
  return (
    <g fill="none" stroke={C.arc} strokeWidth={1} strokeLinecap="round" opacity={0.6}>
      {lines.map(({ points }, i) => (
        <path
          d={line(points)}
          animation={draw({ at: FADE + (i / lines.length) * DRAW, over: 1.4 }, ease.inOut)}
        />
      ))}
    </g>
  );
}

const LABEL: Record<Hub["side"], readonly [number, number, "start" | "middle" | "end"]> = {
  left: [-8, 4, "end"],
  right: [8, 4, "start"],
  above: [0, -9, "middle"],
  below: [0, 17, "middle"],
};

function Hubs(): SvgNode {
  return (
    <g fontFamily={SANS} fontSize={11.5} fontWeight={600} fill={C.text}>
      {Object.values(HUBS).map(({ city, at, side }, i) => {
        const { x, y } = map.point(at);
        const [dx, dy, anchor] = LABEL[side];

        return (
          <g
            animation={motion({ opacity: 0 })
              .at(FADE + 0.2 + i * 0.12)
              .to({ opacity: 1 }, 0.5)}
          >
            <circle cx={x} cy={y} r={6} fill={C.hub} opacity={0.2} />
            <circle cx={x} cy={y} r={2.8} fill={C.hub} stroke={C.night} strokeWidth={0.8} />
            <text
              x={x + dx}
              y={y + dy}
              textAnchor={anchor}
              style={{ paintOrder: "stroke" }}
              stroke={C.sea}
              strokeWidth={3}
            >
              {city}
            </text>
          </g>
        );
      })}
    </g>
  );
}

function Plane(): SvgNode {
  return (
    <g animation={travel(flight, { at: PLANE_AT, over: PLANE_OVER, heading: true })}>
      <Icon
        icon={plane}
        x={-SIZE / 2}
        y={-SIZE / 2}
        size={SIZE}
        stroke={C.text}
        strokeWidth={1.8}
      />
    </g>
  );
}

export default function build(): string {
  const { node } = traffic(lines, {
    during: FLOW,
    rate: 5,
    seed: 7,
    back: 0.45,
    style: "comet",
    color: C.comet,
    size: 2.6,
    tail: 6,
    speed: 130,
  });

  return render(
    {
      width: W,
      height: H,
      duration: D,
      title: "Air traffic between twelve hubs",
      desc: "A flat world map with twelve major airline hubs. Curved arcs draw on between them to show illustrative routes, not real flight counts. Comets stream along the arcs in both directions, and one plane turns to follow its arc from London to Singapore.",
      reducedMotion: { at: 9 },
      css,
      comment: "Generated by svjeez. Edit examples/flights/ instead of this file.",
    },
    <>
      <rect width={W} height={H} fill={C.night} />
      <path d={map.sphere} fill={C.sea} />
      <path d={map.land} fill={C.land} />
      <path d={map.lines} fill="none" stroke={C.line} strokeWidth={0.4} strokeLinejoin="round" />
      <Arcs />
      {node}
      <Hubs />
      <Plane />
      <g
        fontFamily={SANS}
        animation={motion({ opacity: 0, y: 6 }).at(0.3).to({ opacity: 1, y: 0 }, 0.7, ease.out)}
      >
        <text x={40} y={50} fontSize={24} fontWeight={700} fill={C.text}>
          Twelve hubs, one sky
        </text>
        <text x={40} y={70} fontSize={13} fill={C.dim} letterSpacing={0.4}>
          Illustrative routes between major airline hubs
        </text>
      </g>
    </>,
  );
}

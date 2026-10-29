import { arc, project, traffic, type LonLat, type Topology } from "@svjeez/geo";
import { download, world } from "@svjeez/icons/tabler";
import { counter } from "@svjeez/math";
import { Icon, def, ease, enter, motion, rect, type Span } from "svjeez";
import { createRequire } from "node:module";
import { theme } from "../style";
import { C, Caption, H } from "./kit";

const countries: Topology = createRequire(import.meta.url)("world-atlas/countries-110m.json");

const map = project(countries, {
  frame: rect(330, 70, 890, 480),
  filter: (f) => f.properties?.name !== "Antarctica",
});

// Every dot of land in one path: a zero-length run with a round cap draws a dot.
const land = map
  .dots(2.4)
  .flatMap(({ point }) => (point ? [`M${point.x.toFixed(1)} ${point.y.toFixed(1)}h0`] : []))
  .join("");

const CITIES: readonly LonLat[] = [
  [-122.42, 37.77],
  [-74.0, 40.71],
  [-46.63, -23.55],
  [-0.13, 51.5],
  [13.4, 52.52],
  [3.38, 6.52],
  [77.59, 12.97],
  [139.69, 35.68],
  [151.21, -33.87],
];

const LINKS: readonly [number, number][] = [
  [0, 1],
  [1, 3],
  [3, 4],
  [0, 7],
  [1, 2],
  [3, 5],
  [4, 6],
  [6, 7],
  [7, 8],
  [2, 5],
  [0, 3],
  [6, 8],
];

const routes = LINKS.map(([a, b]) => arc(map, CITIES[a]!, CITIES[b]!, { height: 36, steps: 24 }));

const line = (points: readonly { x: number; y: number }[]) =>
  points.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join("");

export const mapShot = ({ at, over }: Span) => {
  const sweep = def.clipPath(
    {},
    <rect
      x={map.frame.x - 10}
      y={0}
      width={0}
      height={H}
      animation={motion({ width: 0 })
        .at(at + 0.1)
        .to({ width: map.frame.w + 20 }, 0.9, ease.inOut)}
    />,
  );

  const flying = { at: at + 1.2, over: over - 2.1 };

  const flights = traffic(routes, {
    during: flying,
    rate: 8,
    seed: 7,
    style: "dot",
    size: 3.5,
    speed: 360,
    back: 0.4,
    color: C.accent,
  });

  const installs = counter((t) => 48213 * ease01((t - at - 0.6) / (over - 1.4)), {
    duration: at + over,
    step: 0.15,
    x: 64,
    y: 168,
    fontSize: 54,
    theme,
  });

  const nations = counter((t) => 112 * ease01((t - at - 0.9) / (over - 1.8)), {
    duration: at + over,
    step: 0.2,
    x: 64,
    y: 318,
    fontSize: 54,
    theme,
  });

  return (
    <>
      <g clipPath={sweep}>
        <path
          d={land}
          stroke={C.muted}
          strokeOpacity={0.55}
          strokeWidth={3.2}
          strokeLinecap="round"
        />
      </g>
      {routes.map((points, i) => (
        <path
          d={line(points)}
          fill="none"
          stroke={C.accent}
          strokeOpacity={0.35}
          strokeWidth={1.2}
          animation={motion({ draw: 0 })
            .at(at + 0.8 + i * 0.05)
            .to({ draw: 1 }, 0.6, ease.inOut)}
        />
      ))}
      {flights.node}
      {CITIES.map((city, i) => {
        const p = map.point(city);

        return (
          <g transform={`translate(${p.x} ${p.y})`}>
            <circle
              r={5}
              fill={C.page}
              stroke={C.accent}
              strokeWidth={2.5}
              animation={enter({ at: at + 0.7 + i * 0.06, over: 0.4 }, { scale: 0 }, ease.pop)}
            />
          </g>
        );
      })}
      <g animation={enter({ at: at + 0.3, over: 0.45 }, { opacity: 0, y: 10 })}>
        <Icon icon={download} x={64} y={128} size={26} stroke={C.accent} />
        <text x={100} y={148} fontSize={14} fill={C.soft}>
          installs this week
        </text>
        {installs.node}
      </g>
      <g animation={enter({ at: at + 0.5, over: 0.45 }, { opacity: 0, y: 10 })}>
        <Icon icon={world} x={64} y={278} size={26} stroke={C.accent} />
        <text x={100} y={298} fontSize={14} fill={C.soft}>
          countries
        </text>
        {nations.node}
      </g>
      <Caption
        at={at + 0.1}
        tag="@svjeez/geo · @svjeez/math · @svjeez/icons"
        call="traffic(routes) + counter(t => n)"
        line="a real map, live routes, a number that counts"
      />
    </>
  );
};

/** An ease-out from 0 to 1 over `u`, flat outside it. */
const ease01 = (u: number) => 1 - (1 - Math.min(Math.max(u, 0), 1)) ** 3;

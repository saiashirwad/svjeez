import { night, project, sun, type LonLat, type Topology } from "@svjeez/geo";
import { geoOrthographic } from "d3-geo";
import { css, def, ease, enter, fx, motion, rect, render, type SvgNode } from "svjeez";
import { createRequire } from "node:module";
import { geist, geistMono } from "../fonts/faces";

const countries: Topology = createRequire(import.meta.url)("world-atlas/countries-110m.json");

const W = 960;
const H = 540;

/** One turn of the globe: a day in 24 seconds. */
const D = 24;

/** How far the north pole leans toward the viewer, in degrees. */
const TILT = 22;

/** Where the sun sits from the middle of the globe, in degrees of longitude. Negative is west, so night falls on the right. */
const SUN_OFFSET = -72;

/** The June solstice, at midnight UTC. */
const DAY = Date.UTC(2026, 5, 21);
const R = 226;

const [sunLon, sunLat] = sun(new Date(DAY));

/** The longitude at the middle of the globe at t = 0. Each second of the scene turns it 15 degrees west. */
const middle = sunLon - SUN_OFFSET;

const map = project(countries, {
  frame: rect(656 - R, H / 2 - R, 2 * R, 2 * R),
  projection: geoOrthographic().rotate([-middle, -TILT]),
  fit: "sphere",
  filter: (f) => f.properties?.name !== "Antarctica",
});

const [cx, cy] = map.projection.translate();
const RAD = Math.PI / 180;
const SIN_T = Math.sin(TILT * RAD);
const COS_T = Math.cos(TILT * RAD);

/**
 * The globe turns through one custom property. `yaw` runs a full turn on the group that holds every dot, and each dot
 * reads it with its own `lat` and `lon` to find where it is, how far it faces the viewer and how much sun it gets.
 * The sun stays put relative to the viewer, so the night shading and the terminator below never move.
 */
const yaw = def.property("yaw", { syntax: "angle", inherits: true, initial: 0 });
const lat = def.property("lat", { syntax: "angle", inherits: true, initial: 0 });
const lon = def.property("lon", { syntax: "angle", inherits: false, initial: 0 });

const spin = motion({ [yaw]: -middle }).to({ [yaw]: 360 - middle }, D, ease.linear);

const style = css`
  svg {
    --space: #04060c;
    --sea: #0b1a2c;
    --deep: #050b14;
    --land: #bfe3ff;
    --dawn: #ff9d5c;
    --city: #ffc56b;
    --text: #eef4fa;
    --dim: #7f93a8;
    --star: #c8d6e6;
  }
  @media (prefers-color-scheme: light) {
    svg {
      --space: #eef2f7;
      --sea: #d6e4f0;
      --deep: #9fb3c8;
      --land: #12324f;
      --dawn: #e8590c;
      --city: #f08c00;
      --text: #0f1e2c;
      --dim: #5b6f82;
      --star: #eef2f7;
    }
  }
  .g {
    --l: calc(${lon} + ${yaw});
    --z: calc(${SIN_T} * sin(${lat}) + ${COS_T} * cos(${lat}) * cos(var(--l)));
    --sun: calc(
      ${Math.sin(sunLat * RAD)} * sin(${lat}) + ${Math.cos(sunLat * RAD)} * cos(${lat}) *
        cos(var(--l) - ${SUN_OFFSET}deg)
    );
    translate: calc(${R}px * cos(${lat}) * sin(var(--l)))
      calc(${R}px * (${SIN_T} * cos(${lat}) * cos(var(--l)) - ${COS_T} * sin(${lat})));
  }
  .d {
    opacity: calc(clamp(0, var(--z) * 12, 1) * clamp(0.2, 0.4 + var(--sun) * 3, 1));
    scale: calc(0.45 + 0.55 * var(--z));
  }
  .c {
    opacity: calc(clamp(0, var(--z) * 12, 1) * clamp(0, -6 * var(--sun) - 0.15, 1));
  }
  .n {
    opacity: calc(clamp(0, (var(--z) - 0.3) * 6, 1) * clamp(0, -5 * var(--sun) - 0.3, 1));
  }
`;

const C = {
  space: "var(--space)",
  sea: "var(--sea)",
  deep: "var(--deep)",
  land: "var(--land)",
  dawn: "var(--dawn)",
  city: "var(--city)",
  text: "var(--text)",
  dim: "var(--dim)",
  star: "var(--star)",
} as const;

const dots = map.dots(2.4);
const rows = new Map<number, number[]>();

for (const { at } of dots) rows.set(at[1], [...(rows.get(at[1]) ?? []), at[0]]);

interface City {
  readonly name: string;
  readonly at: LonLat;
  readonly label?: true;
}

/** The fifty largest cities by metro population, give or take. The labelled ones name themselves as night reaches them. */
const CITIES: readonly City[] = [
  { name: "Tokyo", at: [139.69, 35.69], label: true },
  { name: "Delhi", at: [77.21, 28.61], label: true },
  { name: "Shanghai", at: [121.47, 31.23], label: true },
  { name: "São Paulo", at: [-46.63, -23.55], label: true },
  { name: "Mexico City", at: [-99.13, 19.43], label: true },
  { name: "Cairo", at: [31.24, 30.04], label: true },
  { name: "Mumbai", at: [72.88, 19.08] },
  { name: "Beijing", at: [116.41, 39.9] },
  { name: "Dhaka", at: [90.41, 23.81] },
  { name: "Osaka", at: [135.5, 34.69] },
  { name: "New York", at: [-74.0, 40.71], label: true },
  { name: "Karachi", at: [67.0, 24.86] },
  { name: "Buenos Aires", at: [-58.38, -34.6] },
  { name: "Chongqing", at: [106.55, 29.56] },
  { name: "Istanbul", at: [28.98, 41.01] },
  { name: "Kolkata", at: [88.36, 22.57] },
  { name: "Manila", at: [120.98, 14.6] },
  { name: "Lagos", at: [3.38, 6.52], label: true },
  { name: "Rio de Janeiro", at: [-43.17, -22.91] },
  { name: "Kinshasa", at: [15.27, -4.44] },
  { name: "Guangzhou", at: [113.26, 23.13] },
  { name: "Los Angeles", at: [-118.24, 34.05], label: true },
  { name: "Moscow", at: [37.62, 55.76], label: true },
  { name: "Lahore", at: [74.36, 31.52] },
  { name: "Bengaluru", at: [77.59, 12.97] },
  { name: "Paris", at: [2.35, 48.86] },
  { name: "Bogotá", at: [-74.07, 4.71] },
  { name: "Jakarta", at: [106.85, -6.21], label: true },
  { name: "Chennai", at: [80.27, 13.08] },
  { name: "Lima", at: [-77.04, -12.05] },
  { name: "Bangkok", at: [100.5, 13.76] },
  { name: "Seoul", at: [126.98, 37.57] },
  { name: "London", at: [-0.13, 51.51], label: true },
  { name: "Tehran", at: [51.39, 35.69] },
  { name: "Chicago", at: [-87.63, 41.88] },
  { name: "Ho Chi Minh City", at: [106.63, 10.82] },
  { name: "Luanda", at: [13.23, -8.84] },
  { name: "Johannesburg", at: [28.05, -26.2] },
  { name: "Sydney", at: [151.21, -33.87], label: true },
  { name: "Singapore", at: [103.82, 1.35] },
  { name: "Madrid", at: [-3.7, 40.42] },
  { name: "Toronto", at: [-79.38, 43.65] },
  { name: "Nairobi", at: [36.82, -1.29] },
  { name: "Riyadh", at: [46.72, 24.71] },
  { name: "Santiago", at: [-70.67, -33.45] },
  { name: "Melbourne", at: [144.96, -37.81] },
  { name: "Berlin", at: [13.4, 52.52] },
  { name: "Atlanta", at: [-84.39, 33.75] },
  { name: "Dubai", at: [55.27, 25.2] },
  { name: "Addis Ababa", at: [38.75, 9.03] },
];

const place = ([lo, la]: LonLat) => ({ [lat]: la, [lon]: lo });

const glow = def.radialGradient(
  {},
  <>
    <stop offset={0} stopColor={C.city} stopOpacity={0.9} />
    <stop offset={0.35} stopColor={C.city} stopOpacity={0.3} />
    <stop offset={1} stopColor={C.city} stopOpacity={0} />
  </>,
);

/** The sun's direction on screen, from the globe's middle, so the ocean can be lit from that side. */
const light = map.point([sunLon, sunLat]);

const ocean = def.radialGradient(
  { gradientUnits: "userSpaceOnUse", cx: light.x, cy: light.y, r: 2.1 * R },
  <>
    <stop offset={0} stopColor={C.sea} />
    <stop offset={0.55} stopColor={C.sea} />
    <stop offset={1} stopColor={C.deep} />
  </>,
);

const halo = def.radialGradient(
  { gradientUnits: "userSpaceOnUse", cx, cy, r: R * 1.22 },
  <>
    <stop offset={0.8} stopColor={C.land} stopOpacity={0.16} />
    <stop offset={0.84} stopColor={C.land} stopOpacity={0.07} />
    <stop offset={1} stopColor={C.land} stopOpacity={0} />
  </>,
);

const nightSide = night(new Date(DAY));
const terminator = map.path({ type: "LineString", coordinates: nightSide.coordinates[0]! });

function Globe(): SvgNode {
  return (
    <>
      <circle cx={cx} cy={cy} r={R * 1.22} fill={halo} />
      <path d={map.sphere} fill={ocean} />
      <path d={map.path(nightSide)} fill={C.deep} opacity={0.75} filter={fx.blur(18)} />
      <path
        d={map.path({
          type: "MultiLineString",
          coordinates: [-60, -30, 0, 30, 60].map((la) =>
            Array.from({ length: 73 }, (_, i): [number, number] => [i * 5 - 180, la]),
          ),
        })}
        fill="none"
        stroke={C.land}
        strokeOpacity={0.08}
        strokeWidth={0.6}
      />
      <path
        d={terminator}
        fill="none"
        stroke={C.dawn}
        strokeWidth={14}
        opacity={0.28}
        filter={fx.blur(10)}
      />
      <g transform={`translate(${cx} ${cy})`} animation={spin}>
        {[...rows].map(([la, row]) => (
          <g style={{ [lat]: la }} fill={C.land}>
            {row.map((lo) => (
              <circle class="g d" r={1.9} style={{ [lon]: lo }} />
            ))}
          </g>
        ))}
        {CITIES.map((city) => (
          <g class="g c" style={place(city.at)}>
            <circle r={12} fill={glow} />
            <circle r={1.8} fill="#fff6e0" />
          </g>
        ))}
        {CITIES.flatMap((city) =>
          city.label
            ? [
                <text
                  class="g n"
                  style={place(city.at)}
                  x={7}
                  y={-6}
                  fontFamily={geist}
                  fontSize={11}
                  fontWeight={600}
                  letterSpacing={0.3}
                  fill={C.text}
                >
                  {city.name}
                </text>,
              ]
            : [],
        )}
      </g>
      <path d={map.sphere} fill="none" stroke={C.land} strokeOpacity={0.25} strokeWidth={0.8} />
    </>
  );
}

/** A seeded scatter of stars, a few of them breathing. */
function Stars(): SvgNode {
  let seed = 7;

  const random = () => {
    seed = (seed * 16807) % 2147483647;

    return seed / 2147483647;
  };

  return (
    <g fill={C.star}>
      {Array.from({ length: 90 }, (_, i) => {
        const x = random() * W;
        const y = random() * H;
        const far = Math.hypot(x - cx, y - cy) > R * 1.15;
        const size = 0.4 + random() * 0.9;
        const shine = 0.25 + random() * 0.5;

        return far ? (
          <circle
            cx={x}
            cy={y}
            r={size}
            opacity={shine}
            animation={
              i % 6 === 0
                ? motion({ opacity: shine })
                    .at(random() * 10)
                    .to({ opacity: 0.08 }, 1.2, ease.inOut)
                    .to({ opacity: shine }, 1.2, ease.inOut)
                : undefined
            }
          />
        ) : null;
      })}
    </g>
  );
}

const hours = Array.from({ length: 24 }, (_, h) => `${String(h).padStart(2, "0")}:00`);

/** The UTC time, one hour per second, cut over as the globe turns. */
function Clock(): SvgNode {
  return (
    <g fontFamily={geistMono} fill={C.text}>
      {hours.map((label, h) => (
        <text
          x={64}
          y={334}
          fontSize={44}
          fontWeight={500}
          letterSpacing={-1}
          animation={
            h === 0
              ? motion({ opacity: 1 }).at(1).set({ opacity: 0 })
              : motion({ opacity: 0 })
                  .at(h)
                  .set({ opacity: 1 })
                  .at(Math.min(h + 1, D - 0.001))
                  .set({ opacity: h === 23 ? 1 : 0 })
          }
        >
          {label}
        </text>
      ))}
      <text x={202} y={334} fontSize={15} fill={C.dim} letterSpacing={1.5}>
        UTC
      </text>
    </g>
  );
}

function Caption(): SvgNode {
  return (
    <g fontFamily={geist} animation={enter({ at: 0.2, over: 1 }, { y: 10 })}>
      <text x={64} y={180} fontFamily={geistMono} fontSize={11} letterSpacing={2.4} fill={C.dawn}>
        21 JUNE 2026
      </text>
      <text x={64} y={226} fontSize={40} fontWeight={600} letterSpacing={-1.6} fill={C.text}>
        The longest day
      </text>
      <text x={64} y={256} fontSize={14} fill={C.dim}>
        {`One turn of the Earth in ${dots.length.toLocaleString("en-US")} dots of land.`}
      </text>
      <text x={64} y={276} fontSize={14} fill={C.dim}>
        Fifty cities switch on as the sun sets on them.
      </text>
      <Clock />
    </g>
  );
}

export default function build(): string {
  return render(
    {
      width: W,
      height: H,
      duration: D,
      title: "The longest day",
      desc: "A globe of glowing dots turns through the 24 hours of the June solstice. The sun lights the left side, the terminator glows orange, and fifty of the largest cities switch on as night reaches them, while a clock counts the hours in UTC.",
      reducedMotion: { at: 12 },
      css: style,
      comment: "Generated by svjeez. Edit examples/earth/ instead of this file.",
    },
    <>
      <rect width={W} height={H} fill={C.space} />
      <Stars />
      <Globe />
      <Caption />
    </>,
  );
}

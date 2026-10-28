import { distance, project, type LonLat, type Topology } from "@svjeez/geo";
import { draw, ease, motion, rect, render, type Child, type Rect, type SvgNode } from "svjeez";
import { Camera, flow, variables, type CameraStop } from "svjeez/extras";
import { createRequire } from "node:module";

const countries: Topology = createRequire(import.meta.url)("world-atlas/countries-50m.json");

const W = 960;
const H = 540;
const D = 22;

/** Each color is a CSS variable, so the map follows the viewer's light or dark mode. */
const { vars: C, css } = variables(
  {
    night: "#08121C",
    sea: "#0D1E2C",
    grid: "#15293A",
    land: "#1A3446",
    line: "#4F7A92",
    lit: "#3A5A3F",
    route: "#F4B740",
    text: "#E8EEF2",
    dim: "#93AAB9",
  },
  {
    night: "#E9EEF2",
    sea: "#D6E3EC",
    grid: "#C4D5E0",
    land: "#F7F5EF",
    line: "#9AAFBD",
    lit: "#CFE2C0",
    route: "#D9480F",
    text: "#13202A",
    dim: "#5A6F7D",
  },
);

const map = project(countries, {
  frame: rect(24, 24, W - 48, H - 48),
  filter: (f) => f.properties?.name !== "Antarctica",
});

interface Stop {
  readonly city: string;
  readonly country: string;
  readonly at: LonLat;
  /** Which side of the dot the label sits on. */
  readonly side: 1 | -1;
}

/** The Kangaroo Route, Qantas and Imperial Airways' London to Sydney service, by its classic stops. */
const STOPS: readonly Stop[] = [
  { city: "London", country: "United Kingdom", at: [-0.13, 51.5], side: -1 },
  { city: "Cairo", country: "Egypt", at: [31.24, 30.04], side: -1 },
  { city: "Karachi", country: "Pakistan", at: [67.0, 24.86], side: 1 },
  { city: "Singapore", country: "Singapore", at: [103.82, 1.35], side: -1 },
  { city: "Sydney", country: "Australia", at: [151.21, -33.87], side: 1 },
];

const INTRO = 3.4;
const PAN = 1.2;
const FLIGHT = 2.1;
const PAUSE = 0.5;

/** Each leg: where the camera frames it, how far it zooms, and when the flight leaves and lands. */
const legs = STOPS.slice(1).map((to, i) => {
  const from = STOPS[i]!;
  const target = map.bounds([from.at, to.at], 46);
  const camera = INTRO + i * (PAN + FLIGHT + PAUSE);

  return {
    from,
    to,
    target,
    zoom: scaleOf(target),
    camera,
    leave: camera + PAN,
    land: camera + PAN + FLIGHT,
    route: map.route(from.at, to.at),
  };
});

function scaleOf(target: Rect): number {
  return Math.min(W / target.w, H / target.h);
}

const BACK = legs.at(-1)!.land + 0.8;

const stops: CameraStop[] = [
  { during: { at: 0, over: INTRO }, target: "all" },
  ...legs.map(({ camera, target }) => ({
    during: { at: camera, over: PAN + FLIGHT + PAUSE },
    target,
  })),
  { during: { at: BACK, over: D - BACK }, target: "all" },
];

const Follow = ({ children }: { children: Child }): SvgNode => (
  <Camera frame={rect(0, 0, W, H)} stops={stops} over={PAN}>
    {children}
  </Camera>
);

/** West to east, the order each country starts to draw. */
const west = Math.min(...map.regions.map((r) => r.centroid.x));
const east = Math.max(...map.regions.map((r) => r.centroid.x));
const start = (x: number) => 0.2 + (2 * (x - west)) / (east - west);

/**
 * The borders draw in as one path per country, then hand over at INTRO to a copy the camera zooms, which holds the
 * whole map in two paths. Chromium keeps each animated element on its own raster and flashes blank tiles when a camera
 * scales hundreds of them, so the copy that zooms has no animations at all.
 */
function Intro(): SvgNode {
  return (
    <g strokeWidth={0.5} strokeLinejoin="round">
      {map.regions.map((r) => (
        <path
          d={r.d}
          stroke={C.line}
          animation={[
            motion({ fill: C.sea })
              .at(start(r.centroid.x) + 0.4)
              .to({ fill: C.land }, 0.6),
            draw({ at: start(r.centroid.x), over: 0.8 }),
          ]}
        />
      ))}
    </g>
  );
}

/** Each country on the route lights up as the plane lands in it. */
function Visited(): SvgNode {
  const when = new Map(legs.map((leg) => [leg.to.country, leg.land]));

  return (
    <g stroke={C.line} strokeWidth={0.25}>
      {STOPS.map(({ country }) => (
        <path
          d={map.region(country).d}
          fill={C.lit}
          animation={motion({ opacity: 0 })
            .at(when.get(country) ?? INTRO)
            .to({ opacity: 1 }, 0.5)}
        />
      ))}
    </g>
  );
}

/** Scales by the inverse of the camera's zoom at every stop, so what it holds keeps its size on screen. */
const steady = stops.reduce(
  (track, { during, target }) => {
    const scale = target === "all" ? 1 : 1 / scaleOf(target);

    return during.at === 0
      ? track.set({ scale })
      : track.at(during.at).to({ scale }, PAN, ease.inOut);
  },
  motion({ scale: 1 }),
);

/** A dot and name that keep their size on screen while the camera zooms, gone by the time it pulls back. */
function Marker({ stop, at }: { stop: Stop; at: number }): SvgNode {
  const { x, y } = map.point(stop.at);
  const origin = { transformOrigin: `${x}px ${y}px` };

  return (
    <g animation={steady} style={origin}>
      <g
        animation={motion({ opacity: 0, scale: 0.4 })
          .at(at)
          .to({ opacity: 1, scale: 1 }, 0.4, ease.pop)
          .at(BACK - 0.2)
          .to({ opacity: 0 }, 0.5)}
        style={origin}
      >
        <circle cx={x} cy={y} r={8} fill={C.route} opacity={0.22} />
        <circle cx={x} cy={y} r={3.6} fill={C.route} />
        <text
          x={x + stop.side * 11}
          y={y + 5}
          textAnchor={stop.side === 1 ? "start" : "end"}
          fontFamily="system-ui, sans-serif"
          fontWeight={650}
          fontSize={15}
          fill={C.text}
        >
          {stop.city}
        </text>
      </g>
    </g>
  );
}

const line = (points: readonly { x: number; y: number }[]) =>
  points.map((p, i) => `${i ? "L" : "M"}${p.x} ${p.y}`).join("");

function Flights(): SvgNode {
  return (
    <>
      {legs.map(({ route, zoom, leave }) => (
        <path
          d={line(route)}
          fill="none"
          stroke={C.route}
          strokeWidth={1.6 / zoom}
          strokeLinecap="round"
          opacity={0.75}
          animation={[
            draw({ at: leave, over: FLIGHT }, ease.inOut),
            motion()
              .at(BACK - 0.2)
              .to({ opacity: 0 }, 0.5),
          ]}
        />
      ))}
      {legs.map(
        ({ route, zoom, leave }) =>
          flow(route, {
            at: leave,
            over: FLIGHT,
            style: "comet",
            color: C.route,
            size: 4 / zoom,
            arrive: true,
          }).node,
      )}
      {STOPS.map((stop, i) => (
        <Marker stop={stop} at={i === 0 ? legs[0]!.camera + 0.6 : legs[i - 1]!.land} />
      ))}
    </>
  );
}

/** The whole route at world scale, once the camera has pulled back. */
function Summary(): SvgNode {
  const appear = motion({ opacity: 0 })
    .at(BACK + 0.3)
    .to({ opacity: 1 }, 0.8);

  return (
    <g animation={appear}>
      <path
        d={line(legs.flatMap((leg) => leg.route))}
        fill="none"
        stroke={C.route}
        strokeWidth={1.4}
        strokeLinejoin="round"
      />
      {STOPS.map((stop) => {
        const { x, y } = map.point(stop.at);

        return <circle cx={x} cy={y} r={2.6} fill={C.route} stroke={C.night} strokeWidth={0.8} />;
      })}
    </g>
  );
}

function Caption(): SvgNode {
  const total = distance(STOPS.map((stop) => stop.at));

  return (
    <g
      fontFamily="system-ui, sans-serif"
      animation={motion({ opacity: 0, y: 8 })
        .at(BACK + 0.8)
        .to({ opacity: 1, y: 0 }, 0.6, ease.out)}
    >
      <text x={40} y={H - 66} fontSize={24} fontWeight={700} fill={C.text}>
        The Kangaroo Route
      </text>
      <text x={40} y={H - 42} fontSize={13} fill={C.dim} letterSpacing={0.4}>
        {`London to Sydney in ${legs.length} hops · ${Math.round(total).toLocaleString("en-US")} km of great circles`}
      </text>
    </g>
  );
}

export default function build(): string {
  return render(
    {
      width: W,
      height: H,
      duration: D,
      title: "The Kangaroo Route",
      desc: "A world map draws its borders in from west to east. The camera then follows a plane along great-circle arcs from London to Cairo, Karachi, Singapore and Sydney, lighting up each country as it lands, before pulling back to show the whole route across the world.",
      reducedMotion: { at: D - 1 },
      css,
      comment: "Generated by svjeez. Edit examples/world/ instead of this file.",
    },
    <>
      <rect width={W} height={H} fill={C.night} />
      <Follow>
        <path d={map.sphere} fill={C.sea} />
        <path d={map.graticule(15)} fill="none" stroke={C.grid} strokeWidth={0.4} />
      </Follow>
      <g animation={motion({ opacity: 1 }).at(INTRO).set({ opacity: 0 })}>
        <Intro />
      </g>
      <g animation={motion({ opacity: 0 }).at(INTRO).set({ opacity: 1 })}>
        <Follow>
          <path d={map.land} fill={C.land} />
          <path
            d={map.lines}
            fill="none"
            stroke={C.line}
            strokeWidth={0.5}
            strokeLinejoin="round"
          />
        </Follow>
      </g>
      <Follow>
        <Visited />
        <Flights />
        <Summary />
      </Follow>
      <Caption />
    </>,
  );
}

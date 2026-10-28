import { project, type LonLat, type Topology } from "@svjeez/geo";
import { draw, ease, enter, rect, render, type Point } from "svjeez";
import { flow } from "svjeez/extras";
import { createRequire } from "node:module";
import { CSS, chrome, outro } from "./kit";
import { theme } from "../style";

// The world's countries fill in from west to east, then great-circle flights leave London for six cities.
const W = 504;
const H = 340;
const BAR = 40;
const D = 10;
const win = chrome(W, H, "map.tsx");

const countries: Topology = createRequire(import.meta.url)("world-atlas/countries-110m.json");

const map = project(countries, {
  frame: rect(28, BAR + 22, W - 56, H - BAR - 84),
  tolerance: 1,
  // Fiji straddles the antimeridian and would stretch the fit across the whole frame.
  filter: (f) => !["Antarctica", "Fiji"].includes(f.properties?.name),
});

/** Countries fade in by band of longitude, one path and one animation per band. */
const BANDS = 14;

const band = (x: number) =>
  Math.min(BANDS - 1, Math.floor(((x - map.frame.x) / map.frame.w) * BANDS));

const bands = Array.from({ length: BANDS }, (_, i) =>
  map.regions
    .filter((r) => band(r.centroid.x) === i)
    .map((r) => r.d)
    .join(""),
);

const ROUTE = theme.base09;
const HOME: LonLat = [-0.13, 51.5];

interface City {
  readonly name: string;
  readonly at: LonLat;
  /** Where the label sits, from the dot. */
  readonly dx: number;
  readonly dy: number;
  readonly anchor: "start" | "middle" | "end";
}

const CITIES: readonly City[] = [
  { name: "New York", at: [-74.0, 40.71], dx: -8, dy: 4, anchor: "end" },
  { name: "São Paulo", at: [-46.63, -23.55], dx: -8, dy: 4, anchor: "end" },
  { name: "Lagos", at: [3.38, 6.52], dx: -8, dy: 4, anchor: "end" },
  { name: "Mumbai", at: [72.88, 19.08], dx: 0, dy: 16, anchor: "middle" },
  { name: "Singapore", at: [103.82, 1.35], dx: 0, dy: 16, anchor: "middle" },
  { name: "Tokyo", at: [139.69, 35.69], dx: 0, dy: 16, anchor: "middle" },
];

const LEAVE = 2.2;
const GAP = 0.4;
const FLIGHT = 1.5;

const flights = CITIES.map((city, i) => ({
  ...city,
  route: map.route(HOME, city.at, { steps: 24 }),
  leave: LEAVE + i * GAP,
  land: LEAVE + i * GAP + FLIGHT,
}));

const line = (points: readonly Point[]) =>
  points.map((p, i) => `${i ? "L" : "M"}${p.x} ${p.y}`).join("");

const home = map.point(HOME);

/** A label with a halo in the window's color, so it stays legible over land and routes. */
function Label(props: { x: number; y: number; anchor: City["anchor"]; children: string }) {
  return (
    <text
      x={props.x}
      y={props.y}
      fontSize={10.5}
      fontWeight={600}
      textAnchor={props.anchor}
      fill={theme.base05}
      stroke={theme.base00}
      strokeWidth={3}
      strokeLinejoin="round"
      style={{ paintOrder: "stroke" }}
    >
      {props.children}
    </text>
  );
}

export default function build(): string {
  return render(
    {
      width: W,
      height: H,
      duration: D,
      title: "Flights from London",
      desc: "The world's countries fill in from west to east. Great-circle routes then arc out of London to New York, São Paulo, Lagos, Mumbai, Singapore and Tokyo, and each city lights up as its flight lands.",
      css: CSS,
      reducedMotion: { at: D - 1 },
    },
    <>
      {win.node}
      <g animation={outro(D)}>
        <g fill={theme.base02} stroke={theme.base00} strokeWidth={0.6} strokeLinejoin="round">
          {bands.map((d, i) => (
            <path d={d} animation={enter({ at: 0.3 + i * 0.08, over: 0.6 })} />
          ))}
        </g>
        {flights.map(({ route, leave }) => (
          <path
            d={line(route)}
            fill="none"
            stroke={ROUTE}
            strokeWidth={1.4}
            strokeLinecap="round"
            animation={draw({ at: leave, over: FLIGHT }, ease.inOut)}
          />
        ))}
        {flights.map(
          ({ route, leave }) =>
            flow(route, { at: leave, over: FLIGHT, color: ROUTE, size: 2.6 }).node,
        )}
        {flights.map(({ name, at, dx, dy, anchor, land }) => {
          const { x, y } = map.point(at);

          return (
            <>
              <circle
                cx={x}
                cy={y}
                r={3}
                fill={ROUTE}
                stroke={theme.base00}
                strokeWidth={1.5}
                style={{ transformOrigin: `${x}px ${y}px` }}
                animation={enter({ at: land, over: 0.4 }, { opacity: 0, scale: 0 }, ease.pop)}
              />
              <g class="sans" animation={enter({ at: land + 0.1, over: 0.4 })}>
                <Label x={x + dx} y={y + dy} anchor={anchor}>
                  {name}
                </Label>
              </g>
            </>
          );
        })}
        <g
          style={{ transformOrigin: `${home.x}px ${home.y}px` }}
          animation={enter({ at: 1.7, over: 0.5 }, { opacity: 0, scale: 0 }, ease.pop)}
        >
          <circle
            cx={home.x}
            cy={home.y}
            r={4.5}
            fill={theme.base05}
            stroke={theme.base00}
            strokeWidth={2}
          />
        </g>
        <g class="sans" animation={enter({ at: 1.9, over: 0.4 })}>
          <Label x={home.x} y={home.y - 10} anchor="middle">
            London
          </Label>
        </g>
        <g class="sans" animation={enter({ at: 2, over: 0.6 }, { opacity: 0, y: 6 })}>
          <text x={W / 2} y={H - 26} fontSize={12} textAnchor="middle" fill={theme.base03}>
            {"map.route(london, tokyo)"}
          </text>
        </g>
      </g>
    </>,
  );
}

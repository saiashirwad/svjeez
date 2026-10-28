import { project, type LonLat, type Topology } from "@svjeez/geo";
import { draw, ease, enter, motion, rect, render, type Point } from "svjeez";
import { flow } from "svjeez/extras";
import { createRequire } from "node:module";
import { CSS, chrome, outro } from "./kit";
import { theme } from "../style";

// A dot map of the world fills in from west to east, then great-circle flights leave London for six cities.
const W = 504;
const H = 340;
const BAR = 40;
const D = 10;
const win = chrome(W, H, "map.tsx");

const countries: Topology = createRequire(import.meta.url)("world-atlas/countries-110m.json");

const map = project(countries, {
  frame: rect(20, BAR + 18, W - 40, H - BAR - 78),
  // Fiji straddles the antimeridian and would stretch the fit across the whole frame.
  filter: (f) => !["Antarctica", "Fiji"].includes(f.properties?.name),
});

/**
 * Dots fade in by band of longitude, one animation per band, so the sweep costs a few dozen tracks, not a thousand.
 * Each band is one path of zero-length round-capped segments, which is a fraction of the size of a circle per dot.
 */
const BANDS = 18;

const dots = map.dots(3.2);

const bands = Array.from({ length: BANDS }, (_, band) =>
  dots
    .filter((dot) => Math.min(BANDS - 1, Math.floor(((dot.at[0] + 180) / 360) * BANDS)) === band)
    .map(({ point }) => (point ? `M${point.x} ${point.y}h0` : ""))
    .join(""),
);

const ROUTE = theme.base09;
const HOME: LonLat = [-0.13, 51.5];

const CITIES: readonly { readonly name: string; readonly at: LonLat }[] = [
  { name: "New York", at: [-74.0, 40.71] },
  { name: "São Paulo", at: [-46.63, -23.55] },
  { name: "Lagos", at: [3.38, 6.52] },
  { name: "Mumbai", at: [72.88, 19.08] },
  { name: "Singapore", at: [103.82, 1.35] },
  { name: "Tokyo", at: [139.69, 35.69] },
];

const LEAVE = 2.4;
const GAP = 0.45;
const FLIGHT = 1.6;

const flights = CITIES.map((city, i) => ({
  ...city,
  route: map.route(HOME, city.at, { steps: 24 }),
  leave: LEAVE + i * GAP,
  land: LEAVE + i * GAP + FLIGHT,
}));

const line = (points: readonly Point[]) =>
  points.map((p, i) => `${i ? "L" : "M"}${p.x} ${p.y}`).join("");

const home = map.point(HOME);

export default function build(): string {
  return render(
    {
      width: W,
      height: H,
      duration: D,
      title: "Flights from London",
      desc: "A dot map of the world fills in from west to east. Great-circle routes then arc out of London to New York, São Paulo, Lagos, Mumbai, Singapore and Tokyo, and each city pulses as its flight lands.",
      css: CSS,
      reducedMotion: { at: D - 1 },
    },
    <>
      {win.node}
      <g animation={outro(D)}>
        {bands.map((band, i) => (
          <path
            d={band}
            stroke={theme.base03}
            strokeWidth={2.7}
            strokeLinecap="round"
            animation={enter({ at: 0.3 + i * 0.07, over: 0.5 })}
          />
        ))}
        {flights.map(({ route, leave }) => (
          <path
            d={line(route)}
            fill="none"
            stroke={ROUTE}
            strokeWidth={1.3}
            strokeLinecap="round"
            opacity={0.7}
            animation={draw({ at: leave, over: FLIGHT }, ease.inOut)}
          />
        ))}
        {flights.map(
          ({ route, leave }) =>
            flow(route, { at: leave, over: FLIGHT, style: "comet", color: ROUTE, size: 2.4 }).node,
        )}
        {flights.map(({ name, at, land }) => {
          const { x, y } = map.point(at);
          const origin = { transformOrigin: `${x}px ${y}px` };

          return (
            <>
              <circle
                cx={x}
                cy={y}
                r={4}
                fill="none"
                stroke={ROUTE}
                strokeWidth={1.5}
                style={origin}
                animation={motion({ opacity: 0, scale: 1 })
                  .at(land)
                  .to({ opacity: 0.9 }, 0.08)
                  .to({ opacity: 0, scale: 3.2 }, 0.9, ease.out)}
              />
              <circle
                cx={x}
                cy={y}
                r={3}
                fill={ROUTE}
                style={origin}
                animation={enter({ at: land, over: 0.4 }, { opacity: 0, scale: 0 }, ease.pop)}
              />
              <g class="sans" animation={enter({ at: land + 0.1, over: 0.4 })}>
                <text x={x} y={y - 8} fontSize={10} textAnchor="middle" fill={theme.base05}>
                  {name}
                </text>
              </g>
            </>
          );
        })}
        <g
          animation={enter({ at: 1.8, over: 0.5 }, { opacity: 0, scale: 0 }, ease.pop)}
          style={{ transformOrigin: `${home.x}px ${home.y}px` }}
        >
          <circle
            cx={home.x}
            cy={home.y}
            r={4}
            fill={theme.base07}
            stroke={ROUTE}
            strokeWidth={1.5}
          />
        </g>
        <g class="sans" animation={enter({ at: 2, over: 0.6 }, { opacity: 0, y: 6 })}>
          <text x={W / 2} y={H - 26} fontSize={12} textAnchor="middle" fill={theme.base03}>
            {"<path d={line(map.route(london, tokyo))} animation={draw(…)} />"}
          </text>
        </g>
      </g>
    </>,
  );
}

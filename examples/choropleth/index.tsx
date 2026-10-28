import {
  cartogram,
  choropleth,
  legend,
  palettes,
  project,
  sequential,
  toBars,
  type Topology,
} from "@svjeez/geo";
import { ease, motion, rect, render, type SvgNode } from "svjeez";
import { cut, during } from "svjeez/extras";
import { createRequire } from "node:module";
import { LIFE_EXPECTANCY, POPULATION, YEARS } from "./data";

const countries: Topology = createRequire(import.meta.url)("world-atlas/countries-110m.json");

const W = 960;
const H = 540;
const D = 29;
const SANS = "system-ui, sans-serif";

const INK = "#e8eef2";
const DIM = "#93aab9";

const map = project(countries, {
  frame: rect(20, 96, W - 40, 400),
  filter: (f) => f.properties?.name !== "Antarctica",
});

/** Classes five years wide from 35 to 85, so each edge of the legend is a round number. */
const scale = sequential(palettes.viridis, { domain: [35, 85], steps: 10, empty: "#2a343f" });

const FIRST = 0.6;
const STEP = 2.2;
const AT = YEARS.map((_, i) => FIRST + i * STEP);
const LAST = AT.at(-1)!;
const CARTOGRAM = LAST + 2.6;
const BARS = CARTOGRAM + 6.2;
const MORPH = 1.6;
const OUT = D - 0.9;

const lifeNow = Object.fromEntries(
  Object.entries(LIFE_EXPECTANCY).map(([id, series]) => [id, series.at(-1)!]),
);

const years = choropleth(map, LIFE_EXPECTANCY, { scale, at: AT, over: 1, lines: "#0b1118" });

const circles = cartogram(map, POPULATION, {
  at: CARTOGRAM,
  over: MORPH,
  coverage: 0.34,
  detail: 3,
  fill: (region) => scale(lifeNow[region.id] ?? NaN),
});

const bars = toBars(map, POPULATION, {
  at: BARS,
  over: MORPH,
  stagger: 0.07,
  frame: rect(580, 150, 300, 300),
  top: 10,
  fill: (region) => scale(lifeNow[region.id] ?? NaN),
});

/** The map stays under the shapes and fades while they take over, so no region pops. */
const mapShown = motion({ opacity: 1 })
  .at(CARTOGRAM)
  .to({ opacity: 0 }, MORPH * 0.6)
  .at(BARS - 0.8)
  .to({ opacity: 1 }, 0.6)
  .at(BARS)
  .to({ opacity: 0 }, MORPH * 0.6);

const fadeOut = motion({ opacity: 1 }).at(OUT).to({ opacity: 0 }, 0.7);

const Heading = (): SvgNode => (
  <g fontFamily={SANS}>
    <text x={40} y={54} fontSize={26} fontWeight={700} fill={INK}>
      Life expectancy at birth
    </text>
    <g animation={during({ at: 0, over: CARTOGRAM - 0.2 }, 0.5)}>
      <text x={40} y={78} fontSize={13} fill={DIM}>
        Years a newborn can expect to live, 1960 to 2020
      </text>
    </g>
    <g animation={during({ at: CARTOGRAM - 0.2, over: BARS - CARTOGRAM }, 0.5)}>
      <text x={40} y={78} fontSize={13} fill={DIM}>
        Circle area is population in 2020. Color is life expectancy in 2020.
      </text>
    </g>
    <g animation={during({ at: BARS - 0.2, over: OUT - BARS + 0.2 }, 0.5)}>
      <text x={40} y={78} fontSize={13} fill={DIM}>
        The ten most populous countries, 2020 (millions of people)
      </text>
    </g>
  </g>
);

const Year = (): SvgNode => (
  <g fontFamily={SANS}>
    {YEARS.map((year, i) => (
      <text
        x={W - 40}
        y={64}
        textAnchor="end"
        fontSize={44}
        fontWeight={700}
        fill={INK}
        animation={cut({
          at: i === 0 ? 0 : AT[i]! + 0.3,
          over:
            (YEARS.length - 1 === i ? CARTOGRAM + 0.3 : AT[i + 1]! + 0.3) -
            (i === 0 ? 0 : AT[i]! + 0.3),
        })}
      >
        {String(year)}
      </text>
    ))}
  </g>
);

/** Names on the biggest circles, once they have landed. */
const Names = (): SvgNode => (
  <g
    fontFamily={SANS}
    fontSize={11}
    fontWeight={650}
    fill="#0b1118"
    animation={during({ at: CARTOGRAM + MORPH, over: BARS - CARTOGRAM - MORPH - 0.4 }, 0.5)}
  >
    {[...circles.bubbles]
      .sort((a, b) => b.value - a.value)
      .slice(0, 7)
      .filter((b) => String(b.region.properties?.name).length * 6.5 < 2 * b.r)
      .map((b) => (
        <text x={b.x} y={b.y + 4} textAnchor="middle">
          {String(b.region.properties?.name)}
        </text>
      ))}
  </g>
);

const Labels = (): SvgNode => (
  <g
    fontFamily={SANS}
    fontSize={12}
    animation={motion({ opacity: 0 })
      .at(BARS + MORPH + 0.7)
      .to({ opacity: 1 }, 0.5)}
  >
    {bars.bars.map(({ region, value, rect: r }) => (
      <>
        <text x={r.x - 8} y={r.y + r.h / 2 + 4} textAnchor="end" fill={INK}>
          {String(region.properties?.name)}
        </text>
        <text x={r.x + r.w + 8} y={r.y + r.h / 2 + 4} fill={DIM}>
          {String(Math.round(value / 1e5) / 10)}
        </text>
      </>
    ))}
  </g>
);

export default function build(): string {
  return render(
    {
      width: W,
      height: H,
      duration: D,
      title: "Life expectancy, 1960 to 2020",
      desc: "A world map colored by life expectancy at birth plays through 1960, 1970, 1980, 1990, 2000, 2010 and 2020, with a legend. The countries then morph into circles sized by population in 2020, and into a bar chart of the ten most populous countries. Life expectancy at birth, total (SP.DYN.LE00.IN) and population, total (SP.POP.TOTL), from the World Bank's World Development Indicators, retrieved October 2026.",
      reducedMotion: { at: LAST + 0.5 },
      comment: "Generated by svjeez. Edit examples/choropleth/ instead of this file.",
    },
    <>
      <rect width={W} height={H} fill="#0b1118" />
      <Heading />
      <Year />
      <g animation={[mapShown, fadeOut]}>{years.node}</g>
      <g
        animation={[
          fadeOut,
          motion()
            .at(BARS - 1)
            .to({ opacity: 0 }, 0.7),
        ]}
      >
        {circles.node}
      </g>
      <g animation={fadeOut}>{bars.node}</g>
      <Names />
      <Labels />
      <g animation={during({ at: 0, over: OUT + 0.7 }, 0.5)}>
        {legend(scale, {
          x: 40,
          y: H - 44,
          width: 360,
          height: 10,
          title: "Life expectancy (years)",
          every: 1,
          empty: "No data",
          fontSize: 11,
          font: SANS,
          ink: DIM,
        })}
      </g>
    </>,
  );
}

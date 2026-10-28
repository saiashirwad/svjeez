import { distance, project, type LonLat, type Topology } from "@svjeez/geo";
import { deviceGamepad2, photo, video } from "@svjeez/icons/tabler";
import { geoNaturalEarth1 } from "d3-geo";
import {
  css,
  def,
  draw,
  ease,
  enter,
  Icon,
  motion,
  rect,
  render,
  type IconData,
  type Point,
  type Ref,
  type SvgNode,
} from "svjeez";
import { flow, travel } from "svjeez/extras";
import { createRequire } from "node:module";
import { geist, geistMono } from "../fonts/faces";

const countries: Topology = createRequire(import.meta.url)("world-atlas/countries-110m.json");

const W = 960;
const H = 540;
const D = 18;

/** When the map lets go of the loop: everything fades, and the cables draw in again from the start. */
const OUT = D - 1;

const map = project(countries, {
  frame: rect(24, 22, W - 48, 384),
  projection: geoNaturalEarth1().rotate([-10, 0]),
  filter: (f) => f.properties?.name !== "Antarctica",
});

/** Cable colors are numbered CSS variables, so each scheme can tune its own. */
const style = css`
  svg {
    --sea: #04080f;
    --glow: #0b1a2e;
    --land: #0b1626;
    --grain: #274565;
    --edge: #16283d;
    --text: #eef3f9;
    --dim: #71869c;
    --card: #0a1422;
    --head: #ffffff;
    --c0: #2fe0c5;
    --c1: #5aa9ff;
    --c2: #b388ff;
    --c3: #ff78b4;
    --c4: #ffb547;
  }
  @media (prefers-color-scheme: light) {
    svg {
      --sea: #f4f7fb;
      --glow: #e4ecf6;
      --land: #e2e9f2;
      --grain: #aebfd1;
      --edge: #cfdae6;
      --text: #0d1b29;
      --dim: #5a6e82;
      --card: #ffffff;
      --head: #0d1b29;
      --c0: #0ca58f;
      --c1: #1f74d6;
      --c2: #7b4fd6;
      --c3: #d6337f;
      --c4: #d98200;
    }
  }
`;

const C = {
  sea: "var(--sea)",
  glow: "var(--glow)",
  land: "var(--land)",
  grain: "var(--grain)",
  edge: "var(--edge)",
  text: "var(--text)",
  dim: "var(--dim)",
  card: "var(--card)",
  head: "var(--head)",
} as const;

const hue = (i: number) => `var(--c${i % 5})` as const;

interface Station {
  readonly name: string;
  readonly at: LonLat;
  /** Which side of the dot its name sits on, if it shows one. */
  readonly label?: "left" | "right" | "above" | "below";
}

const station = (name: string, at: LonLat, label?: Station["label"]): Station => ({
  name,
  at,
  label,
});

const VIRGINIA_BEACH = station("Virginia Beach", [-75.98, 36.85]);
const NEW_YORK = station("New York", [-72.9, 40.8], "left");
const BUDE = station("Bude", [-4.55, 50.83]);
const BILBAO = station("Bilbao", [-2.93, 43.4]);
const FORTALEZA = station("Fortaleza", [-38.5, -3.7], "below");
const LISBON = station("Lisbon", [-9.3, 38.7]);
const LAGOS = station("Lagos", [3.4, 6.4], "above");
const LUANDA = station("Luanda", [13.2, -8.8]);
const CAPE_TOWN = station("Cape Town", [18.44, -33.6], "left");
const DURBAN = station("Durban", [31.8, -28.95]);
const MARSEILLE = station("Marseille", [5.37, 43.3], "above");
const MUMBAI = station("Mumbai", [72.8, 19.0], "above");
const MOMBASA = station("Mombasa", [39.7, -4.05], "left");
const SINGAPORE = station("Singapore", [103.8, 1.3], "left");
const HONG_KONG = station("Hong Kong", [114.2, 22.2]);
const TOKYO = station("Tokyo", [139.9, 34.95], "above");
const SYDNEY = station("Sydney", [151.2, -33.9], "below");
const PERTH = station("Perth", [115.8, -31.95]);
const OREGON = station("Oregon", [-124.0, 45.2]);
const LOS_ANGELES = station("Los Angeles", [-118.4, 33.9], "left");
const VALPARAISO = station("Valparaíso", [-71.6, -33.0]);
const BOCA_RATON = station("Boca Raton", [-80.1, 26.35]);

interface Cable {
  readonly name: string;
  readonly from: Station;
  /** The turns the cable takes at sea, between its landings. */
  readonly via: readonly LonLat[];
  readonly to: Station;
}

/** Real systems, simplified to a few turns each. */
const CABLES: readonly Cable[] = [
  { name: "MAREA", from: VIRGINIA_BEACH, via: [[-40, 41]], to: BILBAO },
  { name: "Grace Hopper", from: NEW_YORK, via: [[-30, 47.5]], to: BUDE },
  {
    name: "EllaLink",
    from: FORTALEZA,
    via: [
      [-25, 15],
      [-18, 30],
    ],
    to: LISBON,
  },
  { name: "SACS", from: FORTALEZA, via: [[-15, -7]], to: LUANDA },
  {
    name: "Monet",
    from: FORTALEZA,
    via: [
      [-40, 2],
      [-50, 8],
      [-58, 14],
      [-65, 21],
      [-75, 27],
    ],
    to: BOCA_RATON,
  },
  {
    name: "Equiano",
    from: LISBON,
    via: [[-11, 33], [-19, 22], [-20, 13], [-19, 7], [-10, 1], LAGOS.at, [5, -5], [10, -20]],
    to: CAPE_TOWN,
  },
  {
    name: "SEA-ME-WE 6",
    from: MARSEILLE,
    via: [
      [10, 38],
      [20, 34.5],
      [32.3, 31.3],
      [32.55, 29.95],
      [34.5, 27],
      [38.5, 21],
      [43, 13],
      [50, 12.5],
      [60, 15],
      MUMBAI.at,
      [73, 8],
      [80, 5.3],
      [94, 6.5],
      [97.5, 5.5],
      [100.5, 2.5],
    ],
    to: SINGAPORE,
  },
  {
    name: "PEACE",
    from: MUMBAI,
    via: [
      [60, 8],
      [52, 1],
    ],
    to: MOMBASA,
  },
  {
    name: "Seacom",
    from: MOMBASA,
    via: [
      [42.5, -15],
      [36, -27],
    ],
    to: DURBAN,
  },
  {
    name: "APG",
    from: SINGAPORE,
    via: [[109, 5], [113, 15], HONG_KONG.at, [123, 24], [128, 29], [135, 32.5]],
    to: TOKYO,
  },
  {
    name: "JUPITER",
    from: TOKYO,
    via: [
      [160, 44],
      [-160, 47],
    ],
    to: OREGON,
  },
  {
    name: "Indigo",
    from: SINGAPORE,
    via: [
      [105, -1],
      [106.6, -3.5],
      [105.7, -6.1],
      [104, -8],
      [108, -14],
      [110, -25],
    ],
    to: PERTH,
  },
  {
    name: "JGA",
    from: TOKYO,
    via: [
      [144.8, 13.4],
      [149, 3],
      [158, -3],
      [157, -14],
      [156, -25],
    ],
    to: SYDNEY,
  },
  {
    name: "Southern Cross",
    from: SYDNEY,
    via: [
      [165, -30],
      [178, -16.5],
      [-158, 21.3],
    ],
    to: LOS_ANGELES,
  },
  {
    name: "Curie",
    from: LOS_ANGELES,
    via: [
      [-120, 28],
      [-108, 15],
      [-95, 8],
      [-84, -2],
      [-82, -10],
      [-76, -25],
    ],
    to: VALPARAISO,
  },
];

const route = (cable: Cable): LonLat[] => [cable.from.at, ...cable.via, cable.to.at];

const d = (points: readonly Point[]) =>
  points.map((p, i) => `${i ? "L" : "M"}${p.x} ${p.y}`).join("");

const length = (points: readonly Point[]) =>
  points.slice(1).reduce((n, p, i) => n + Math.hypot(p.x - points[i]!.x, p.y - points[i]!.y), 0);

interface Laid {
  readonly cable: Cable;
  readonly color: ReturnType<typeof hue>;
  /** One list of points per piece: a cable across the Pacific leaves one edge of the map and comes back at the other. */
  readonly pieces: Point[][];
  /** Each piece once, for the packets to `<use>`, with a path length of 1 so a dash is a fraction of it. */
  readonly tracks: Ref<"symbol">[];
  readonly length: number;
  /** When it starts to draw. */
  readonly at: number;
}

const laid: Laid[] = CABLES.map((cable, i) => {
  const pieces = map.line(route(cable));

  return {
    cable,
    color: hue(i),
    pieces,
    tracks: pieces.map((piece) =>
      def.symbol({ style: "overflow:visible" }, <path d={d(piece)} pathLength={1} />),
    ),
    length: pieces.reduce((n, piece) => n + length(piece), 0),
    at: 0.3 + i * 0.12,
  };
});

const DRAW = 1.4;

/** The whole map leaves together before the loop starts over. */
const leave = motion().at(OUT).to({ opacity: 0 }, 0.8, ease.inOut);

const grain = def.pattern(
  { width: 4.5, height: 4.5, patternUnits: "userSpaceOnUse" },
  <circle cx={2.25} cy={2.25} r={0.85} fill={C.grain} />,
);

const haze = def.radialGradient(
  { cx: 0.5, cy: 0.42, r: 0.6 },
  <>
    <stop offset={0} stopColor={C.glow} />
    <stop offset={1} stopColor={C.sea} />
  </>,
);

function Land(): SvgNode {
  return (
    <>
      <path d={map.sphere} fill={C.sea} stroke={C.edge} strokeWidth={0.8} />
      <path d={map.graticule(20)} fill="none" stroke={C.edge} strokeWidth={0.5} opacity={0.6} />
      <path d={map.land} fill={C.land} />
      <path d={map.land} fill={grain} />
    </>
  );
}

/** Each cable draws on along its whole length, piece after piece, with a soft glow under it. */
function Cables(): SvgNode {
  return (
    <g fill="none" strokeLinecap="round" strokeLinejoin="round" animation={leave}>
      {laid.map(({ color, pieces, length: total, at }) => {
        let done = 0;

        return pieces.map((piece) => {
          const span = { at: at + (DRAW * done) / total, over: (DRAW * length(piece)) / total };
          done += length(piece);

          return (
            <>
              <path
                d={d(piece)}
                stroke={color}
                strokeWidth={5}
                opacity={0.06}
                animation={draw(span, ease.linear)}
              />
              <path
                d={d(piece)}
                stroke={color}
                strokeWidth={1}
                opacity={0.38}
                animation={draw(span, ease.linear)}
              />
            </>
          );
        });
      })}
    </g>
  );
}

/**
 * Packets are dashes on a copy of the cable. With `pathLength` 1 a dash is a fraction of the piece, and moving its
 * offset from the start to past the end runs it along. The head and its tail share a timing and an end point.
 */
const offset = def.property("offset", { syntax: "number", inherits: false, initial: 0 });

const packetCss = css`
  .pk {
    stroke-dashoffset: ${offset};
  }
`;

/** A seeded random number, so the traffic is the same on every build. */
const random = (() => {
  let seed = 11;

  return () => {
    seed = (seed * 16807) % 2147483647;

    return seed / 2147483647;
  };
})();

const SPEED = 140;
const TAIL = 56;
const HEAD = 5;
const TRAFFIC = 3.2;

interface PacketProps {
  readonly piece: Point[];
  readonly track: Ref<"symbol">;
  readonly at: number;
  readonly color: Laid["color"];
}

function Packet({ piece, track, at, color }: PacketProps): SvgNode {
  const total = length(piece);
  const tail = TAIL / total;
  const head = HEAD / total;

  // A round cap pokes past its dash, so each dash starts and ends a cap's width off the piece.
  const cap = 2 / total;

  const run = (dash: number) =>
    motion({ [offset]: dash + cap })
      .at(at)
      .to({ [offset]: dash - 1 - tail - cap }, total / SPEED, ease.linear);

  return (
    <>
      <use
        href={track}
        class="pk"
        stroke={color}
        strokeWidth={2.6}
        strokeDasharray={`${tail} 3`}
        opacity={0.75}
        animation={run(tail)}
      />
      <use
        href={track}
        class="pk"
        stroke={C.head}
        strokeWidth={2.8}
        strokeDasharray={`${head} 3`}
        animation={run(head)}
      />
    </>
  );
}

/** Traffic on every cable: a packet crosses each piece in turn, and a few leave each cable while the map is up. */
function Traffic(): SvgNode {
  return (
    <g fill="none" strokeLinecap="round" animation={leave}>
      {laid.flatMap(({ pieces, tracks, length: total, color }) => {
        const trip = total / SPEED;
        const count = Math.max(3, Math.round(total / 180));

        return Array.from({ length: count }, (_, k) => {
          let at = TRAFFIC + ((k + random() * 0.8) / count) * (OUT - TRAFFIC - trip);

          return pieces.map((piece, p) => {
            const node = <Packet piece={piece} track={tracks[p]!} at={at} color={color} />;
            at += length(piece) / SPEED;

            return node;
          });
        });
      })}
    </g>
  );
}

const stations = [...new Set(CABLES.flatMap((c) => [c.from, c.to]))];

const LABEL = {
  left: { dx: -8, dy: 3, anchor: "end" },
  right: { dx: 8, dy: 3, anchor: "start" },
  above: { dx: 0, dy: -9, anchor: "middle" },
  below: { dx: 0, dy: 15, anchor: "middle" },
} as const;

function Stations(): SvgNode {
  return (
    <g animation={leave}>
      {stations.map((s, i) => {
        const { x, y } = map.point(s.at);
        const label = s.label && LABEL[s.label];

        return (
          <g
            style={{ transformOrigin: `${x}px ${y}px` }}
            animation={enter({ at: 1.2 + i * 0.04, over: 0.45 }, { scale: 0 }, ease.pop)}
          >
            <circle cx={x} cy={y} r={3.6} fill={C.sea} stroke={C.text} strokeWidth={1.1} />
            <circle cx={x} cy={y} r={1.3} fill={C.text} />
            {label && (
              <text
                x={x + label.dx}
                y={y + label.dy}
                textAnchor={label.anchor}
                fontFamily={geistMono}
                fontSize={8}
                letterSpacing={0.8}
                fill={C.dim}
              >
                {s.name.toUpperCase()}
              </text>
            )}
          </g>
        );
      })}
    </g>
  );
}

interface Journey {
  readonly what: string;
  readonly icon: IconData;
  readonly cable: string;
  readonly at: number;
  /** Runs the cable from its last landing to its first. */
  readonly reverse?: true;
}

const JOURNEYS: readonly Journey[] = [
  { what: "A video call", icon: video, cable: "Grace Hopper", at: 3.6 },
  { what: "A photo", icon: photo, cable: "SEA-ME-WE 6", at: 8, reverse: true },
  { what: "A game move", icon: deviceGamepad2, cable: "JUPITER", at: 12.4 },
];

const TRIP = 2.8;

/** A ring of the token's own color that breathes out from it twice a second while it rides. */
const pulse = motion({ opacity: 0.55, scale: 1 })
  .to({ opacity: 0, scale: 2.1 }, 0.5, ease.out)
  .loop(0.5);

/** Light in glass covers about 204,000 km a second. */
const FIBRE = 204;

const ride = (journey: Journey) => {
  const found = laid.find((l) => l.cable.name === journey.cable)!;
  const { cable } = found;

  return {
    ...found,
    pieces: journey.reverse
      ? found.pieces.toReversed().map((piece) => piece.toReversed())
      : found.pieces,
    from: journey.reverse ? cable.to : cable.from,
    to: journey.reverse ? cable.from : cable.to,
    km: distance(route(cable)),
  };
};

/** A journey's own trip: the cable lights up behind an icon that rides it, piece by piece, and rings where it lands. */
function Ride({ journey }: { journey: Journey }): SvgNode {
  const { pieces, length: total, color, to } = ride(journey);
  const end = map.point(to.at);
  let at = journey.at;

  return (
    <g animation={leave}>
      {pieces.map((piece) => {
        const over = (TRIP * length(piece)) / total;
        const start = at;
        at += over;

        return (
          <>
            {flow(piece, { at: start, over, style: "trace", color, size: 4 }).node}
            <g animation={travel(piece, { at: start, over })}>
              <circle r={11} fill={color} animation={pulse} />
              <circle r={11} fill={color} />
              <Icon icon={journey.icon} x={-7} y={-7} size={14} stroke={C.sea} strokeWidth={2.2} />
            </g>
          </>
        );
      })}
      <circle
        cx={end.x}
        cy={end.y}
        r={6}
        fill="none"
        stroke={color}
        strokeWidth={2}
        style={{ transformOrigin: `${end.x}px ${end.y}px` }}
        animation={motion({ opacity: 0, scale: 1 })
          .at(at)
          .set({ opacity: 1 })
          .to({ opacity: 0, scale: 4 }, 0.9, ease.out)}
      />
    </g>
  );
}

/** Where the readout for the journey under way sits, under the map on the right. */
const READOUT = rect(572, 436, 348, 72);

/** The journey under way: a colored rule, what it carries and where, and the time light takes, set large. */
function Readout({ journey, until }: { journey: Journey; until: number }): SvgNode {
  const { color, from, to, km } = ride(journey);
  const { x, y, w, h } = READOUT;
  const right = x + w;

  return (
    <g
      animation={motion({ opacity: 0, x: -6 })
        .at(journey.at - 0.3)
        .to({ opacity: 1, x: 0 }, 0.5, ease.out)
        .at(until - 0.4)
        .to({ opacity: 0 }, 0.4)}
    >
      <rect x={x} y={y} width={2} height={h} fill={color} />
      <Icon icon={journey.icon} x={x + 16} y={y + 1} size={14} stroke={color} strokeWidth={2} />
      <g fontFamily={geistMono} fontSize={9.5}>
        <text x={x + 37} y={y + 12} fill={color} letterSpacing={1.6}>
          {journey.what.toUpperCase()}
        </text>
        <text x={x + 16} y={y + h - 2} fill={C.dim} letterSpacing={1.6}>
          {`${journey.cable.toUpperCase()} · ${(Math.round(km / 100) * 100).toLocaleString("en-US")} KM`}
        </text>
        <text x={right} y={y + h - 2} textAnchor="end" fill={C.dim} letterSpacing={1.6}>
          ONE WAY
        </text>
      </g>
      <text
        x={x + 16}
        y={y + 44}
        fontFamily={geist}
        fontSize={21}
        fontWeight={600}
        letterSpacing={-0.6}
        fill={C.text}
      >
        {`${from.name} → ${to.name}`}
      </text>
      <text
        x={right}
        y={y + 50}
        textAnchor="end"
        fontFamily={geist}
        fontSize={44}
        fontWeight={600}
        letterSpacing={-2}
        fill={C.text}
      >
        {Math.round(km / FIBRE)}
        <tspan fontSize={16} letterSpacing={0} fill={C.dim}>
          {" ms"}
        </tspan>
      </text>
    </g>
  );
}

const fibre = Math.round(laid.reduce((km, l) => km + distance(route(l.cable)), 0) / 1000);

function Title(): SvgNode {
  return (
    <g animation={[leave, enter({ at: 0.4, over: 0.8 }, { y: 8, opacity: 0 })]}>
      <text
        x={40}
        y={448}
        fontFamily={geistMono}
        fontSize={10}
        fontWeight={500}
        letterSpacing={2.4}
        fill={hue(0)}
      >
        SUBMARINE CABLES
      </text>
      <text
        x={38}
        y={482}
        fontFamily={geist}
        fontSize={32}
        fontWeight={600}
        letterSpacing={-1.2}
        fill={C.text}
      >
        The internet is wet
      </text>
      <text x={40} y={506} fontFamily={geist} fontSize={13} fill={C.dim}>
        {`${CABLES.length} of the 500-odd cables on the sea floor, ${fibre},000 km of glass.`}
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
      title: "The internet is wet",
      desc: "A dark world map, dotted where there is land, draws fifteen real submarine cables across the oceans. Packets of light stream along them, and three journeys ride a cable each: a video call from New York to Bude, a photo from Singapore to Marseille and a game move from Tokyo to Oregon that leaves the right edge of the map and comes back on the left.",
      reducedMotion: { at: 9.4 },
      css: css`${style}${packetCss}`,
      comment: "Generated by svjeez. Edit examples/cables/ instead of this file.",
    },
    <>
      <rect width={W} height={H} fill={haze} />
      <Land />
      <Cables />
      <Traffic />
      <Stations />
      {JOURNEYS.map((journey) => (
        <Ride journey={journey} />
      ))}
      <Title />
      {JOURNEYS.map((journey, i) => (
        <Readout journey={journey} until={JOURNEYS[i + 1]?.at ?? OUT} />
      ))}
    </>,
  );
}

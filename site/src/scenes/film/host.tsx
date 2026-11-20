import { Group, ease, enter, span, track, type SceneElement, type Span, type Vec } from "svjeez";
import { Blip, GROUND, Pivot, flashes, flight, jumps, waddle, type Hop } from "../blip";
import { H, W } from "./kit";
import { PILL } from "./close";

// Blip runs the film. It pops out of the <img> tag, and from then on goes where the action is: onto the agent's
// session, across to the SVG it wrote, along the code as its lines move, onto the app, and onto the seam between
// light and dark. At the end it rides the stage back into the tag and cheers.

/** Blip's size in the film. */
const S = 0.42;

/** Blip's feet start on the top of the tag, and every place below is where its feet go, in the film's pixels. */
const START: Vec = [W / 2 + 120, H / 2 - 36];

type Move =
  | { readonly walk: Span; readonly to: Vec; readonly steps: number }
  | { readonly hop: Hop; readonly to?: Vec };

const EDGE = 140;

const route: readonly Move[] = [
  { hop: { land: 2.4, height: 150 }, to: [780, EDGE] },
  { walk: span(3.0, 1.6), to: [380, EDGE], steps: 6 },
  // The agent writes a scene.
  { hop: { land: 5.9, height: 40 }, to: [560, 180] },
  { hop: { land: 7.1, height: 30 } },
  { hop: { land: 10.2, height: 90 }, to: [1125, 428] },
  { hop: { land: 11.2, height: 40 } },
  { hop: { land: 12.3, height: 120 }, to: [900, EDGE] },
  // Mermaid.
  { walk: span(12.75, 0.8), to: [760, EDGE], steps: 4 },
  { hop: { land: 14.8, height: 60 }, to: [520, 210] },
  { hop: { land: 16.1, height: 40 } },
  { hop: { land: 18.3, height: 70 }, to: [700, EDGE] },
  // Data: over to the counter, then over to the map.
  { walk: span(18.6, 1.4), to: [330, EDGE], steps: 6 },
  { hop: { land: 21.2, height: 50 } },
  { walk: span(22.0, 2.2), to: [960, EDGE], steps: 9 },
  // Math.
  { walk: span(25.0, 0.8), to: [760, EDGE], steps: 3 },
  { hop: { land: 26.6, height: 50 } },
  { hop: { land: 28.3, height: 60 } },
  // Code: down onto the panel, and along it while its lines move.
  { hop: { land: 31.3, height: 40 }, to: [300, 230] },
  { walk: span(32.5, 2.2), to: [980, 230], steps: 9 },
  { hop: { land: 36.2, height: 60 }, to: [980, EDGE] },
  // The app, and its seam.
  { hop: { land: 37.4, height: 40 }, to: [960, 196] },
  { hop: { land: 38.5, height: 30 } },
  { hop: { land: 40.9, height: 50 } },
  { walk: span(41.6, 1.2), to: [640, 196], steps: 5 },
  { hop: { land: 44.8, height: 40 } },
  { hop: { land: 47.2, height: 70 } },
  // Back into the tag, and cheers.
  { hop: { land: 49.9, height: 70 }, to: [PILL.x + 150, PILL.y - PILL.h / 2] },
  { hop: { land: 51.5, height: 110 } },
  { hop: { land: 52.7, height: 60 } },
];

const isWalk = (move: Move): move is Extract<Move, { walk: Span }> => "walk" in move;

/** Feet positions as offsets from the start, in Blip's own units: it is drawn scaled. */
const own = ([x, y]: Vec): Vec => [(x - START[0]) / S, (y - START[1]) / S];

const travel = route.reduce(
  (t, move) => {
    if (isWalk(move)) return t.to(own(move.to), move.walk, ease.linear);

    return move.to ? t.to(own(move.to), flight(move.hop), ease.linear) : t;
  },
  track<Vec>([0, 0]),
);

const hops = route.flatMap((move) => (isWalk(move) ? [] : [move.hop]));
const leaps = jumps(hops);
const walks = route.flatMap((move) => (isWalk(move) ? [waddle(move.walk, move.steps)] : []));

/** It looks the way it walks, and down at the stage otherwise; up at you at the end. */
const look = route
  .reduce(
    (t, move, i) => {
      if (!isWalk(move)) return t;
      const before = route.slice(0, i).reduce<Vec>((at, m) => m.to ?? at, START);
      const side = move.to[0] < before[0] ? -6 : 6;

      return t
        .to([side, 0], span(move.walk.start - 0.15, 0.15))
        .to([0, 4], span(move.walk.start + move.walk.over, 0.2));
    },
    track<Vec>([0, 0]).to([0, 4], span(3, 0.3)),
  )
  .to([0, -2], span(50.5, 0.3));

const blinks = [1.9, 6.6, 10.4, 15.8, 21.6, 27.4, 32.9, 38.9, 44.2, 51.0];

export const Host = (): SceneElement => (
  <Pivot
    around={GROUND}
    at={START}
    motion={[
      enter(span(1.05, 0.4), { from: { scale: 0 }, curve: ease.pop }),
      { scale: S },
      { offset: travel },
    ]}
  >
    <Group motion={walks.flatMap((walk) => walk.body)}>
      <Blip
        blinks={blinks}
        body={{ offset: leaps.body }}
        stretch={leaps.stretch}
        bulb={leaps.bulb}
        glow={flashes(hops.map((hop) => hop.land))}
        look={look}
        feet={{
          left: walks.map((walk) => walk.feet.left),
          right: walks.map((walk) => walk.feet.right),
        }}
      />
    </Group>
  </Pivot>
);

import { Group, ease, enter, span, track, type SceneElement, type Span, type Vec } from "svjeez";
import { Blip, GROUND, Pivot, flashes, flight, jumps, waddle, type Hop } from "../blip";
import { BASICS, TILE_TOPS } from "./basics";
import { SOON_END } from "./card";
import { TALLEST } from "./connect";
import { FILMING, FRAME_TOP } from "./filming";
import { H, RESULT_COLUMN, SHOTS, W } from "./kit";
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
  // Out of the tag and onto the stage as it opens.
  { hop: { land: 2.4, height: 150 }, to: [780, EDGE] },
  { walk: span(3.0, 1.4), to: [1000, EDGE], steps: 6 },
  // The agent's session takes the stage's place: Blip stays on its top edge, hopping as the calls come in.
  { hop: { land: 5.8, height: 30 } },
  { hop: { land: 7.7, height: 30 } },
  { hop: { land: 9.6, height: 30 } },
  { hop: { land: 11.5, height: 40 } },
  { hop: { land: 12.75, height: 80 } },
  // The basics: onto each tile as its animation plays.
  ...BASICS.plays.map((at, i): Move => ({
    hop: { land: SHOTS.basics.start + at, height: 70 },
    to: TILE_TOPS[i]!,
  })),
  { hop: { land: SHOTS.basics.start + 8.2, height: 40 } },
  // The chart and the diagram: on the tile they draw in, a hop as each piece plays.
  { hop: { land: SHOTS.chart.start + 4.5, height: 90 }, to: TALLEST },
  { hop: { land: SHOTS.chart.start + 5.8, height: 40 } },
  { hop: { land: SHOTS.diagram.start + 1.6, height: 90 }, to: [1100, RESULT_COLUMN[1]] },
  { hop: { land: SHOTS.diagram.start + 3.6, height: 30 } },
  { hop: { land: SHOTS.diagram.start + 5.0, height: 30 } },
  // The card: beside the line.
  { hop: { land: SHOTS.card.start + 1.2, height: 80 }, to: SOON_END },
  { hop: { land: SHOTS.card.start + 2.6, height: 50 } },
  // The filmed component: onto its frame, and a hop at each later snap.
  { hop: { land: SHOTS.filming.start + 0.9, height: 90 }, to: FRAME_TOP },
  ...FILMING.snaps
    .slice(1)
    .map((at): Move => ({ hop: { land: SHOTS.filming.start + at, height: 40 } })),
  // The montage: along the tops of its tiles.
  { hop: { land: SHOTS.montage.start + 0.6, height: 60 }, to: [520, 166] },
  { walk: span(SHOTS.montage.start + 1.2, 1.8), to: [1000, 166], steps: 8 },
  { hop: { land: SHOTS.montage.start + 4.0, height: 40 } },
  // Beside the handwritten line, then on the first fact.
  { hop: { land: SHOTS.anything.start + 0.5, height: 80 }, to: [1170, 420] },
  { hop: { land: SHOTS.anything.start + 2.1, height: 40 } },
  { hop: { land: SHOTS.facts.start + 0.6, height: 90 }, to: [1030, 280] },
  { hop: { land: SHOTS.facts.start + 1.8, height: 40 } },
  // Back into the tag, and cheers.
  { hop: { land: SHOTS.close.start + 0.9, height: 90 }, to: [PILL.x + 150, PILL.y - PILL.h / 2] },
  { hop: { land: SHOTS.close.start + 2.5, height: 110 } },
  { hop: { land: SHOTS.close.start + 3.7, height: 60 } },
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
  .to([0, -2], span(SHOTS.close.start + 1.5, 0.3));

const blinks = [1.9, 6.6, 10.4, 16.3, 21.6, 27.4, 33.1, 38.4, 42.2, 47.6, 53.4, 58.2, 62.6, 66.0];

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

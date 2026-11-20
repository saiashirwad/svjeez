import { ease, enter, span, track, type SceneElement, type Vec } from "svjeez";
import { Blip, GROUND, Pivot, flashes, flight, jumps, type Hop } from "../blip";
import { SHOTS, STAGE, W, H } from "./kit";
import { PILL } from "./close";

// Blip hosts the film. It pops out of the <img> tag as the stage opens, leaps onto the stage's top edge, and hops
// whenever something on the stage happens. When the stage folds back into the tag, Blip rides it down and cheers.

/** Blip's size in the film, and where it stands while the stage is open. */
const S = 0.42;
const PERCH: Vec = [780, STAGE.y];

/** Where Blip's feet go, as an offset from the perch in Blip's own units. */
const from = ([x, y]: Vec): Vec => [(x - PERCH[0]) / S, (y - PERCH[1]) / S];

const TAG_TOP: Vec = [W / 2 + 120, H / 2 - 36];
const ON_PILL: Vec = [PILL.x + 150, PILL.y - PILL.h / 2];

/** The moments a shot does its thing, in the film's seconds, and how high Blip hops for each. */
const beats: Hop[] = [
  { land: SHOTS.layout.start + 2.5, height: 60 },
  { land: SHOTS.layout.start + 4.3, height: 40 },
  { land: SHOTS.code.start + 2.6, height: 50 },
  { land: SHOTS.math.start + 1.6, height: 40 },
  { land: SHOTS.math.start + 3.3, height: 55 },
  { land: SHOTS.diagram.start + 2.2, height: 60 },
  { land: SHOTS.diagram.start + 3.6, height: 40 },
  { land: SHOTS.data.start + 1.4, height: 40 },
  { land: SHOTS.data.start + 2.6, height: 60 },
  { land: SHOTS.app.start + 1.8, height: 40 },
  { land: SHOTS.app.start + 4.4, height: 60 },
  { land: SHOTS.themes.start + 1.8, height: 40 },
  { land: SHOTS.themes.start + 4.4, height: 70 },
];

const onto: Hop = { land: 2.4, height: 150 };
const down: Hop = { land: SHOTS.close.start + 0.9, height: 70 };

const cheers: Hop[] = [
  { land: SHOTS.close.start + 2.5, height: 110 },
  { land: SHOTS.close.start + 3.7, height: 60 },
];

const hops = [onto, ...beats, down, ...cheers];
const moves = jumps(hops);

const travel = track<Vec>(from(TAG_TOP))
  .to([0, 0], flight(onto), ease.linear)
  .to(from(ON_PILL), flight(down), ease.linear);

/** It glances down at the stage while the shots play, and up at you at the end. */
const look = track<Vec>([0, 0])
  .to([-6, 4], span(3, 0.3))
  .to([0, -2], span(SHOTS.close.start + 1, 0.3));

const blinks = [1.9, 6.2, 10.4, 15.8, 21.1, 27.4, 32.6, 38.3, 44.9, 50.6];

export const Host = (): SceneElement => (
  <Pivot
    around={GROUND}
    at={PERCH}
    motion={[
      enter(span(1.05, 0.4), { from: { scale: 0 }, curve: ease.pop }),
      { scale: S },
      { offset: travel },
    ]}
  >
    <Blip
      blinks={blinks}
      body={{ offset: moves.body }}
      stretch={moves.stretch}
      bulb={moves.bulb}
      glow={flashes(hops.map((hop) => hop.land))}
      look={look}
      feet={{}}
    />
  </Pivot>
);

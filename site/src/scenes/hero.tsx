import {
  Align,
  Group,
  Stack,
  ease,
  enter,
  exit,
  ref,
  scene,
  span,
  track,
  wiggle,
  type Span,
  type Vec,
} from "svjeez";
import type { Layer, Layers } from "svjeez/tools";
import { theme } from "../../../examples/theme";
import { BLIP, Blip, GROUND, Pivot, flashes, flight, jumps, type Hop } from "./blip";
import { BAR, CodeLine, Listing, ROW, Selection, Squiggle, Window, word } from "./editor";
import { Burst, Cloud, Hills, Kite, Sky, Stars, Sun, scenery, summit } from "./landscape";

// The home page hero. A scene's source fills in a line at a time while Blip hops down it, and each word Blip lands on
// pops into the picture beside it as what it names. The source is this scene's own, in the API it is written in.

const W = 936;
const H = 452;
const D = 14;

const SOURCE = `scene(opts, () => <>
  <Sun motion={glow} />
  <Hills motion={rise} />
  <Kite motion={flutter} />
  <Cloud motion={drift} />
</>)`;

const NIGHT = SOURCE.replace("Sun", "Moon");

/** The windows' size, and the sky under the picture window's title bar. */
const WINDOW: Vec = [420, 320];
const SKY: Vec = [WINDOW[0] - 2, WINDOW[1] - BAR - 2];

/** Where each piece of the picture sits in the sky: the kite by its tail, Blip's hand on the string. */
const SUN: Vec = [340, 62];
const KITE: Vec = [90, 114];
const CLOUD: Vec = [220, 54];
const HILL = summit(SKY[1]);
const HAND: Vec = [HILL[0] - 10, HILL[1] - 10];
const RISE: Vec = [210, SKY[1] - 50];
const KITE_MIDDLE: Vec = [KITE[0], KITE[1] - 34];

const STARS: Vec[] = [
  [40, 30],
  [160, 22],
  [270, 40],
  [390, 120],
  [30, 140],
];

// When: Blip lands on a word every 1.4 seconds, its line having come in just before, and the word's piece pops in.
// Then Blip leaps onto the hill to hold the kite string, hops twice more, and everything clears for the next loop.

const BEAT = 1.4;
const lines = span(1.55, 0.35).cascade(4, BEAT);
const marks = span(2.2, 0.25).cascade(4, BEAT);
const pops = span(2.32, 0.45).cascade(4, BEAT);

/** Each piece settles a moment after it pops, and its extras follow: rays and stars, the far hill, the string, the drift. */
const [sunUp, hillsUp, kiteUp, cloudUp] = span(2.62, 0.45).cascade(4, BEAT);

const landings = marks.map((m) => m.start);
const finale = 7.9;
const out = span(D - 0.7, 0.3);

const hops: Hop[] = [
  ...landings.map((land, i) => ({ land, height: i === 0 ? 40 : 90 })),
  { land: finale, height: 220 },
  { land: finale + 2.4, height: 40 },
  { land: finale + 3.5, height: 40 },
];

// What: the source's refs and the words Blip lands on.

const [editor, code, sky] = [ref(), ref(), ref()];
const words = ["Sun", "rise", "Kite", "drift"].map((text) => word(code, SOURCE, text));
const moon = word(code, NIGHT, "Moon");

/** Blip stands on each word's middle, its feet a little above the baseline, and last on the hill. */
const stops = [
  ...words.map(({ baseline, width }) => baseline.map(([x, y]): Vec => [x + width / 2, y - 14])),
  sky.topLeft.map(([x, y]): Vec => [x + HILL[0], y + HILL[1]]),
];

// How: tracks and layers, built as values.

/** The picture's `i`th piece pops in after its word, and out a beat after the one before it. */
const popped = (i: number): Layer[] => [
  enter(pops[i]!, { from: { scale: 0 }, curve: ease.pop }),
  exit(out.shift(i * 0.06), { to: { scale: 0 }, curve: ease.in }),
];

const glow = popped(0);
const flutter = [...popped(2), wiggle({ rotate: 7 }, { seed: "kite", rate: 2 })];

const drift = [
  ...popped(3),
  {
    offset: track<Vec>([0, 0]).to(
      [-36, 0],
      span(cloudUp.start, D - 0.8 - cloudUp.start),
      ease.inOut,
    ),
  },
];

const arrive = (when: Span): Layers =>
  enter(when, { from: { opacity: 0, offset: [0, -10] }, curve: ease.pop });

/** The closing line rides under the last line in, starting where the second line will be. */
const closing = lines.reduce(
  (t, when, i) => t.to([0, -(lines.length - 1 - i) * ROW], when.shift(-0.3), ease.inOut),
  track<Vec>([0, -lines.length * ROW]),
);

const jumping = jumps(hops);

const travel = stops.reduce(
  (t, stop, i) => t.to(stop, flight(hops[i]!), ease.linear),
  // Blip starts on the editor's top edge, near its right corner.
  track<Vec>([0, 0]).set(
    editor.topRight.map(([x, y]): Vec => [x - 60, y]),
    span(0),
  ),
);

const look = hops
  .slice(0, stops.length)
  .reduce(
    (t, { land }, i) =>
      i === stops.length - 1
        ? t.to([5, -6], span(land + 0.2, 0.3), ease.inOut)
        : t.to([6, -1], span(land + 0.1, 0.25)).to([0, 2], span(land + 0.75, 0.3), ease.inOut),
    track<Vec>([0, 2]),
  );

/** Blip pops in at the top and out at the end, at 0.4 of its own size. */
const appear: Layers = [
  { scale: 0.4 },
  enter(span(0.05, 0.35), { from: { scale: 0 }, curve: ease.pop }),
  exit(span(out.start + 0.15, 0.25), { to: { scale: 0 }, curve: ease.in }),
];

const march = track(0).to(-12, span(0, 0.9), ease.linear).loop(0.9);

const source = SOURCE.split("\n");
const night = NIGHT.split("\n");

export default scene(
  {
    size: [W, H],
    duration: D,
    title: "Blip hops down a scene's source and builds its picture",
    desc: "A few lines of svjeez source fill in one at a time. Blip hops down them word by word, and each word it lands on pops into the picture beside it as what it names: a sun, or a moon at night, hills, a kite and a cloud. Blip jumps onto the hill, holds the kite string, and everything clears for the next round.",
    theme: { ...theme, ...scenery },
    still: finale + 0.6,
  },
  () => (
    <Group>
      <Align place="center">
        <Selection size={[W - 10, H - 10]} march={march} />
      </Align>
      <Align place="bottom" inset={28}>
        <Stack direction="row" gap={40}>
          <Window handle={editor} size={WINDOW} title="scene.tsx">
            <Listing handle={code} motion={exit(span(out.start, 0.4), { curve: ease.in })}>
              <CodeLine key="line0" source={source[0]!} motion={enter(span(0.1, 0.3))} />
              <Group key="line1" motion={arrive(lines[0]!)}>
                <CodeLine source={source[1]!} scheme="light" />
                <CodeLine source={night[1]!} scheme="dark" />
              </Group>
              {lines.slice(1).map((when, i) => (
                <CodeLine key={`line${i + 2}`} source={source[i + 2]!} motion={arrive(when)} />
              ))}
              <CodeLine
                key="line5"
                source={source[5]!}
                motion={[enter(span(0.1, 0.3)), { offset: closing }]}
              />
            </Listing>
          </Window>
          <Window size={WINDOW} title="scene.svg">
            <Sky handle={sky} size={SKY}>
              <Hills size={SKY} rise={[pops[1], hillsUp]} out={out} />
              <Sun at={SUN} motion={glow} shine={sunUp} out={out} />
              <Stars points={STARS} when={sunUp} out={out} />
              <Kite
                at={KITE}
                motion={flutter}
                hand={HAND}
                string={span(kiteUp.start, 0.6)}
                out={out}
              />
              <Cloud at={CLOUD} motion={drift} />
              <Burst
                bursts={[SUN, RISE, KITE_MIDDLE, CLOUD].map((at, i) => ({ at, when: pops[i]! }))}
                angles={[0, 45, 90, 135, 180, 225, 270, 315]}
                reach={52}
              />
            </Sky>
          </Window>
        </Stack>
      </Align>
      <Squiggle under={words[0]!} color={scenery.sun} draw={marks[0]!} out={out} scheme="light" />
      <Squiggle under={moon} color={scenery.sun} draw={marks[0]!} out={out} scheme="dark" />
      {[scenery.hill, BLIP.cheek, scenery.mist].map((color, i) => (
        <Squiggle under={words[i + 1]!} color={color} draw={marks[i + 1]!} out={out} />
      ))}
      <Burst
        bursts={marks.map((mark, i) => ({ at: stops[i]!, when: span(mark.start, 0.35) }))}
        angles={[-160, -125, -55, -20]}
        reach={22}
      />
      <Group offset={travel} origin="at" motion={appear}>
        <Pivot around={GROUND} at={[0, 0]}>
          <Blip
            blinks={[1.2, 4.6, finale + 0.9]}
            body={{ offset: jumping.body }}
            stretch={jumping.stretch}
            bulb={jumping.bulb}
            glow={flashes(landings)}
            look={look}
            feet={{}}
          />
        </Pivot>
      </Group>
    </Group>
  ),
);

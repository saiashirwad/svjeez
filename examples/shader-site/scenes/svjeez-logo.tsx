import {
  Group,
  Sequence,
  clock,
  ease,
  looping,
  scene,
  span,
  track,
  type SceneElement,
  type Vec,
} from "svjeez";
import { Blip, Pivot, flashes, jumps } from "./blip";

/** The page loops this clock while the svjeez link is hovered or focused: a hop, a flash of the bulb and a blink. */
const hop = clock("hop", span(0.5, 1.6));

/** The page turns Blip's eyes toward the valley's sun with these two clocks: 0 looks left or up, 1 right or down. */
const gazeX = clock("gazeX", span(0, 1.6));
const gazeY = clock("gazeY", span(0, 1.6));

// How far the pupils travel from the middle of the eye, in Blip's units.
const REACH: Vec = [4.5, 3.5];

const LAND = 0.55;

const { body, stretch, bulb } = jumps([{ land: LAND, height: 14 }]);

/** An eye's pupil and glint, moved toward where the page says the sun is. */
const toward = (eye: SceneElement) => (
  <Sequence clock={gazeX}>
    <Group
      motion={{
        offset: track<Vec>([-REACH[0], 0]).to([REACH[0], 0], span(0, gazeX.over), ease.linear),
      }}
    >
      <Sequence clock={gazeY}>
        <Group
          motion={{
            offset: track<Vec>([0, -REACH[1]]).to([0, REACH[1]], span(0, gazeY.over), ease.linear),
          }}
        >
          {eye}
        </Group>
      </Sequence>
    </Group>
  </Sequence>
);

// The box is Blip at rest, from the sides of its body and the top of its bulb to its feet; hops rise out of it.
export default scene(
  {
    size: [132, 133],
    duration: 2.6,
    title: "svjeez",
    desc: "Blip, the svjeez mascot. Its eyes follow the sun; it hops, lights its bulb and blinks.",
    loop: false,
    still: 0,
    states: { idle: { hop: 0 }, hover: { hop: looping } },
  },
  () => (
    <Sequence clock={hop}>
      <Pivot around={[38, 29]} at={[0, 0]}>
        <Blip
          blinks={[1.15]}
          body={{ offset: body }}
          stretch={stretch}
          bulb={bulb}
          gaze={toward}
          glow={flashes([LAND])}
        />
      </Pivot>
    </Sequence>
  ),
);

import {
  Align,
  Group,
  Shape,
  Stack,
  Text,
  ease,
  enter,
  exit,
  line,
  rect,
  scene,
  span,
  track,
  type Vec,
} from "svjeez";
import { geist, mono } from "../../../examples/fonts/faces";
import { theme } from "../../../examples/theme";
import { Bulb } from "./bulb";

const SIZE: Vec = [720, 300];
const MARGIN = 40;

const BULB = 64;
const GROUND_Y = 232;
const REST_Y = GROUND_Y - BULB / 2 - 2;

// The track runs from START to END, then there is nothing.
const START = MARGIN;
const END = 520;
const TICK = 40;
const STEP = 60;
const EDGE_X = END - 24;
const question: Vec = [EDGE_X, REST_Y - BULB / 2 - 12];

// One loop: walk out, stop at the edge, look around, walk back.
const walkOut = span(0.2, 1.8);
const atEdge = walkOut.next(0.2);
const lean = atEdge.next(0.35);
const wonder = span(lean.start + 0.2, 1.4);
const settle = lean.next(1.1);
const walkBack = settle.next(1.9);
const LOOP = 6;

const x = track(START + 20)
  .to(EDGE_X, walkOut, ease.inOut)
  .to(START + 20, walkBack, ease.inOut)
  .loop(LOOP);

// Hop on every STEP of ground covered, so the bulb only bounces while it moves.
const hop = (at: number): number => -Math.abs(Math.sin((at / STEP) * Math.PI)) * 7;
const body = x.map((at): Vec => [at, REST_Y + hop(at)]);

const tip = track(0).to(14, lean, ease.pop).to(0, settle, ease.inOut).loop(LOOP);

const ticks = Array.from({ length: (END - START) / TICK + 1 }, (_, i) => START + i * TICK);

export default scene(
  {
    size: SIZE,
    duration: LOOP,
    title: "Page not found",
    desc: "A small light bulb walks along a timeline, reaches the end of the track, wobbles at the edge wondering where the page went, and walks back.",
    theme,
    still: 0,
  },
  (canvas) => (
    <Group>
      <Shape geometry={canvas.rect} fill={theme.background} />

      <Align place="top-left" inset={MARGIN}>
        <Stack gap={4} align="start">
          <Text font={mono} size={13} fill={theme.muted}>
            404
          </Text>
          <Text font={geist} weight={600} size={30} fill={theme.text}>
            Page not found
          </Text>
        </Stack>
      </Align>

      <Shape
        geometry={line([START, GROUND_Y], [END, GROUND_Y])}
        stroke={{ color: theme.raised, width: 4, cap: "round" }}
      />
      <Shape
        geometry={line([END + 14, GROUND_Y], [canvas.width - MARGIN, GROUND_Y])}
        stroke={{ color: theme.raised, width: 4, cap: "round", dash: [2, 12] }}
      />
      {ticks.map((at) => (
        <Shape
          key={`tick${at}`}
          geometry={rect(2, 10, { radius: 1 })}
          at={[at, GROUND_Y + 12]}
          anchor="top"
          fill={theme.border}
        />
      ))}

      <Bulb mood="lost" size={BULB} at={[0, 0]} motion={{ offset: body, rotate: tip }} />

      <Text
        font={geist}
        weight={600}
        size={26}
        at={question}
        anchor="bottom"
        fill={theme.blue}
        motion={[enter(wonder, { from: { scale: 0.4 }, curve: ease.pop }), exit(settle)]}
      >
        ?
      </Text>
    </Group>
  ),
);

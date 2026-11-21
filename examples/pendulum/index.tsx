import {
  Group,
  Shape,
  Text,
  circle,
  count,
  ease,
  line,
  numeral,
  rect,
  scene,
  span,
  track,
} from "svjeez";
import { mono } from "../fonts/faces";
import { theme } from "../theme";

// Fifteen pendulums, periods in whole-number ratios, released from one angle.
// Lengths are the real thing: L = g·(T / 2πn)², scaled so the slowest swing fills the shop.
const SECONDS = 12;
const GRAVITY = 9.81;
const COUNT = 15;
const FIRST = 8; // swings per cycle for the longest pendulum; the rest add one each
const AMPLITUDE = 24; // degrees, same release angle for all
const ROD_MAX = 300;
const PIVOT_Y = 106;
const FIRST_X = 150;
const LAST_X = 810;

const lengths = (() => {
  const raw = Array.from(
    { length: COUNT },
    (_, i) => GRAVITY * (SECONDS / (2 * Math.PI * (FIRST + i))) ** 2,
  );

  const scale = ROD_MAX / raw[0]!;

  return raw.map((length) => length * scale);
})();

// A swing is two bezier halves: ease.bezier(0.37, 0, 0.63, 1) tracks cosine closely, and every
// pendulum starts and ends at full amplitude, so the 12 s cycle loops without a seam.
const sine = ease.bezier(0.37, 0, 0.63, 1);

const swing = (n: number) => {
  const half = SECONDS / (2 * n);
  let lane = track(AMPLITUDE);

  for (let i = 1; i <= n * 2; i++)
    lane = lane.to(i % 2 === 1 ? -AMPLITUDE : AMPLITUDE, span((i - 1) * half, half), sine);

  return lane;
};

const pendulums = lengths.map((length, i) => ({
  x: FIRST_X + (i * (LAST_X - FIRST_X)) / (COUNT - 1),
  length,
  lane: swing(FIRST + i),
}));

const elapsed = track(0).to(SECONDS, span(0, SECONDS), ease.linear);

export default scene(
  {
    size: [960, 540],
    duration: SECONDS,
    title: "The pendulum wave",
    desc: "Fifteen pendulums released together from one angle. Their periods are whole-number ratios, so the row falls into traveling waves, folds into an S, and returns to a straight line every twelve seconds.",
    theme,
    still: 2.7,
  },
  (canvas) => (
    <Group>
      <Shape geometry={canvas.rect} fill={theme.background} />
      <Shape
        geometry={rect(864, 18, { radius: 9 })}
        at={[48, 88]}
        fill={theme.raised}
        stroke={{ color: theme.border, width: 1 }}
      />
      {pendulums.map(({ x }, i) => (
        <Shape
          key={`bolt-${i}`}
          geometry={circle(2.6)}
          at={[x, 97]}
          anchor="center"
          fill={theme.border}
        />
      ))}

      {/* Longest to shortest, left to right */}
      {pendulums.map(({ x, length, lane }, i) => (
        <Group key={`n-${i}`} offset={[x, PIVOT_Y]} origin="at" rotate={lane}>
          <Shape
            geometry={line([0, 0], [0, length])}
            stroke={{ color: theme.muted, width: 2, cap: "round" }}
          />
          <Shape geometry={circle(11)} at={[0, length]} anchor="center" fill={theme.orange} />
          <Shape
            geometry={circle(4)}
            at={[-3.5, length - 3.5]}
            anchor="center"
            fill={theme.background}
            opacity={0.55}
          />
        </Group>
      ))}
      <Text font={mono} size={12} at={[912, 512]} anchor="baseline-right" fill={theme.muted}>
        {"t = "}
        {count(elapsed, { format: numeral({ decimals: 1 }) })}
        {" s"}
      </Text>
    </Group>
  ),
);

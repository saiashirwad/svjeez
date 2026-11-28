/** A potted plant sways while a robot arm waters it, drawn with brush, blob, scatter and <Limb>. */
import {
  Group,
  Shape,
  blob,
  brush,
  circle,
  ease,
  enter,
  exit,
  Limb,
  rect,
  scatter,
  scene,
  span,
  spline,
  track,
  type Vec,
} from "svjeez";

const STEM: Vec[] = [
  [320, 300],
  [312, 240],
  [330, 180],
  [318, 128],
];

const LEAF = blob(
  [
    [0, 0],
    [14, -7],
    [34, 0],
    [14, 7],
  ],
  { round: 0.6 },
);

const PETAL = blob([
  [0, 0],
  [9, -6],
  [18, 0],
  [9, 6],
]);

const SHOULDER: Vec = [140, 372];
const BONES = [150, 140];
const PERIOD = 4;

/** Where the can is at time t: out over the plant and back. */
const reachAt = (t: number): Vec => {
  const u = (1 - Math.cos((2 * Math.PI * t) / PERIOD)) / 2;

  return [220 + 70 * u, 250 - 120 * u];
};

export default scene(
  { size: [640, 400], duration: PERIOD, title: "Robot arm watering a potted plant" },
  (canvas) => (
    <Group>
      <Shape geometry={canvas.rect} fill="#F4EFE6" />
      <Group
        rotate={track(0).to(3, span(0, 2), ease.inOut).to(0, span(2, 2), ease.inOut)}
        origin={{ frame: STEM[0]! }}
      >
        <Shape geometry={brush(STEM, [9, 3])} fill="#4F772D" />
        <Shape
          geometry={scatter(LEAF, {
            along: spline(STEM),
            count: 7,
            angle: 55,
            alternate: true,
            jitter: 0.3,
            seed: 2,
          })}
          fill="#90A955"
        />
        <Shape
          geometry={scatter(PETAL, { along: circle(9), count: 7, angle: -90 })}
          offset={STEM.at(-1)!}
          fill="#F2C14E"
        />
        <Shape geometry={circle(6)} offset={STEM.at(-1)!} fill="#E07A5F" />
      </Group>
      <Shape
        geometry={blob(
          [
            [256, 302],
            [384, 302],
            [368, 384],
            [272, 384],
          ],
          { round: 0.15 },
        )}
        fill="#C1663E"
      />
      <Shape geometry={rect(150, 18, { radius: 6 })} at={[245, 290]} fill="#A9512F" />
      <Limb
        root={SHOULDER}
        bones={BONES}
        reach={reachAt}
        over={span(0, PERIOD)}
        bend={-1}
        tolerance={0.2}
        step={PERIOD / 64}
        bone={(length, index) => (
          <Shape
            geometry={brush(
              [
                [0, 0],
                [length, 0],
              ],
              index === 0 ? [18, 12] : [12, 8],
            )}
            fill="#3D5A80"
          />
        )}
        joint={(index) => <Shape geometry={circle(index === 2 ? 9 : 7)} fill="#293241" />}
      />
      {[0, 1, 2].map((drop) => (
        <Shape
          key={`drop-${drop}`}
          geometry={circle(3)}
          offset={track<Vec>([290, 140]).to([296, 286], span(1.6 + drop * 0.25, 0.7), ease.in)}
          fill="#6FA8DC"
          motion={[enter(span(1.6 + drop * 0.25, 0.1)), exit(span(2.2 + drop * 0.25, 0.1))]}
        />
      ))}
    </Group>
  ),
);

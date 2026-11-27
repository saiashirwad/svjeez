/**
 * The same scene as ../drawing-primitives/index.tsx, written with only the geometry API that existed before brush, blob, scatter and limb:
 * Bézier handles, a placement loop and hand-written inverse kinematics. Kept for comparison.
 */
import {
  Group,
  Shape,
  around,
  circle,
  ease,
  enter,
  exit,
  line,
  moved,
  path,
  pointAt,
  random,
  rect,
  rotated,
  sampled,
  scaled,
  scene,
  span,
  spline,
  track,
  type Geometry,
  type Vec,
} from "svjeez";

const STEM: Vec[] = [
  [320, 300],
  [312, 240],
  [330, 180],
  [318, 128],
];

/** The stem's outline, traced by hand: up the left side, round the tip, down the right side. */
const STEM_OUTLINE = path()
  .moveTo([315.5, 300])
  .curveTo([308, 270], [305, 245], [309, 228])
  .curveTo([314, 205], [328, 195], [327.5, 178])
  .curveTo([326, 160], [314, 142], [316.5, 128])
  .curveTo([317, 125.5], [319.5, 125.5], [319.5, 128])
  .curveTo([318, 142], [331, 160], [332.5, 180])
  .curveTo([334, 198], [320, 210], [315, 232])
  .curveTo([311, 250], [317, 272], [324.5, 300])
  .close();

const LEAF = path()
  .moveTo([0, 0])
  .curveTo([5, -6], [24, -7], [34, 0])
  .curveTo([24, 7], [5, 6], [0, 0])
  .close();

const PETAL = path()
  .moveTo([0, 0])
  .curveTo([4, -7], [14, -7], [18, 0])
  .curveTo([14, 7], [4, 7], [0, 0])
  .close();

/** Seven leaves up the stem, alternating sides, each turned to the stem and nudged a little at random. */
const next = random(2);
const stemLine = spline(STEM);
const leaves: Geometry[] = [];

for (let i = 0; i < 7; i++) {
  const wobble = () => (next() * 2 - 1) * 0.3;
  const at = pointAt(stemLine, Math.min(1, Math.max(0, (i + 0.5 + wobble() * 0.4) / 7)));
  const flip = i % 2 === 1;
  const size = 1 + wobble() * 0.25;
  const turn = at.angle + (flip ? -55 : 55) + wobble() * 20;
  leaves.push(moved(rotated(scaled(LEAF, flip ? [size, -size] : size), turn), at.point));
}

const POT = path()
  .moveTo([262, 302])
  .lineTo([378, 302])
  .curveTo([386, 302], [384, 310], [383, 316])
  .lineTo([370, 376])
  .curveTo([368, 384], [362, 384], [356, 384])
  .lineTo([284, 384])
  .curveTo([278, 384], [272, 384], [270, 376])
  .lineTo([257, 316])
  .curveTo([256, 310], [254, 302], [262, 302])
  .close();

const SHOULDER: Vec = [140, 372];
const [UPPER, FORE] = [150, 140];
const PERIOD = 4;

const reachAt = (t: number): Vec => {
  const u = (1 - Math.cos((2 * Math.PI * t) / PERIOD)) / 2;

  return [220 + 70 * u, 250 - 120 * u];
};

/** Two-bone IK by the law of cosines: the elbow bows to the left of the shoulder-to-hand line. */
const elbowAt = (t: number): Vec => {
  const [hx, hy] = reachAt(t);
  const dx = hx - SHOULDER[0];
  const dy = hy - SHOULDER[1];
  const reach = Math.min(Math.hypot(dx, dy), UPPER + FORE - 0.01);
  const cos = (UPPER * UPPER + reach * reach - FORE * FORE) / (2 * UPPER * reach);
  const angle = Math.atan2(dy, dx) - Math.acos(Math.max(-1, Math.min(1, cos)));

  return [SHOULDER[0] + Math.cos(angle) * UPPER, SHOULDER[1] + Math.sin(angle) * UPPER];
};

const sample = { tolerance: 0.5, step: PERIOD / 64 };
const elbow = sampled(elbowAt, span(0, PERIOD), sample);
const hand = sampled(reachAt, span(0, PERIOD), sample);

export default scene(
  { size: [640, 400], duration: PERIOD, title: "Robot arm watering a potted plant, by hand" },
  (canvas) => (
    <Group>
      <Shape geometry={canvas.rect} fill="#F4EFE6" />
      <Group
        rotate={track(0).to(3, span(0, 2), ease.inOut).to(0, span(2, 2), ease.inOut)}
        origin={{ frame: STEM[0]! }}
      >
        <Shape geometry={STEM_OUTLINE} fill="#4F772D" />
        {leaves.map((leaf, i) => (
          <Shape key={`leaf-${i}`} geometry={leaf} fill="#90A955" />
        ))}
        <Shape
          geometry={around(7, (deg) => rotated(moved(PETAL, [9, 0]), deg))}
          offset={STEM.at(-1)!}
          fill="#F2C14E"
        />
        <Shape geometry={circle(6)} offset={STEM.at(-1)!} fill="#E07A5F" />
      </Group>
      <Shape geometry={POT} fill="#C1663E" />
      <Shape geometry={rect(150, 18, { radius: 6 })} at={[245, 290]} fill="#A9512F" />
      <Shape
        geometry={sampled((t) => line(SHOULDER, elbowAt(t)), span(0, PERIOD), sample)}
        stroke={{ color: "#3D5A80", width: 18, cap: "round" }}
      />
      <Shape
        geometry={sampled((t) => line(elbowAt(t), reachAt(t)), span(0, PERIOD), sample)}
        stroke={{ color: "#3D5A80", width: 11, cap: "round" }}
      />
      <Shape geometry={circle(7)} offset={SHOULDER} fill="#293241" />
      <Shape geometry={circle(7)} offset={elbow} fill="#293241" />
      <Shape geometry={circle(9)} offset={hand} fill="#293241" />
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

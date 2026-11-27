/** A swimming octopus: blob mantle, brush tentacles rippling as travelling waves, scatter suckers, bubbles. */
import {
  Group,
  Shape,
  blob,
  brush,
  circle,
  ellipse,
  ease,
  enter,
  exit,
  sampled,
  scatter,
  scene,
  span,
  spline,
  track,
  type Vec,
} from "svjeez";

const D = 4;
const TAU = Math.PI * 2;
const ARMS = 7;
const JOINTS = 4;
const LENGTH = 165;
const STEP = D / 10;

const SUCKER = circle(1.9);

/** Spine of tentacle `i` at time t: it fans outward and ripples as a wave that travels toward the tip. */
const spineAt = (i: number, t: number): Vec[] => {
  const fan = (i - (ARMS - 1) / 2) / ((ARMS - 1) / 2);
  const base = Math.PI / 2 - fan * 0.8;
  const root: Vec = [320 + fan * 40, 216];
  const phase = (t / D) * TAU - i * 0.55;

  return Array.from({ length: JOINTS }, (_, j) => {
    const s = j / (JOINTS - 1);
    const sway = Math.sin(phase - s * 3.6) * s * 32 + Math.sin(phase * 2 - s * 6 + i) * s * s * 8;
    const angle = base + fan * s * 0.35;
    const out = s * LENGTH * (1 - Math.abs(fan) * 0.1);
    const dx = Math.cos(angle) * out;
    const dy = Math.sin(angle) * out;

    return [root[0] + dx - Math.sin(angle) * sway, root[1] + dy + Math.cos(angle) * sway];
  });
};

const sampling = { tolerance: 0.8, step: STEP };

const Tentacle = ({ i }: { i: number }) => (
  <Group>
    <Shape
      geometry={sampled((t) => brush(spineAt(i, t), [17, 2]), span(0, D), sampling)}
      fill={i % 2 ? "#E0527A" : "#EA6A8B"}
    />
    <Shape
      geometry={sampled(
        (t) => scatter(SUCKER, { along: spline(spineAt(i, t)), count: 6 }),
        span(0, D),
        sampling,
      )}
      fill="#F6C1D0"
      opacity={0.85}
    />
  </Group>
);

const BUBBLES = [
  { x: 90, r: 5, delay: 0 },
  { x: 150, r: 3, delay: 0.9 },
  { x: 520, r: 6, delay: 0.4 },
  { x: 570, r: 3, delay: 1.4 },
  { x: 470, r: 4, delay: 1.8 },
  { x: 60, r: 4, delay: 1.1 },
];

const RISE = 2;

const MANTLE = blob(
  [
    [262, 214],
    [270, 150],
    [320, 96],
    [376, 148],
    [378, 214],
    [320, 238],
  ],
  { round: 0.55 },
);

export default scene({ size: [640, 400], duration: D, title: "Swimming octopus" }, (canvas) => (
  <Group>
    <Shape geometry={canvas.rect} fill="#06182E" />
    <Group
      offset={track<Vec>([0, 0])
        .to([0, -10], span(0, D / 2), ease.inOut)
        .to([0, 0], span(D / 2, D / 2), ease.inOut)}
    >
      {Array.from({ length: ARMS }, (_, i) => (
        <Tentacle key={`arm-${i}`} i={i} />
      ))}
      <Shape geometry={MANTLE} fill="#F0668A" />
      <Shape geometry={ellipse(28, 18)} offset={[320, 214]} fill="#F0668A" />
      <Shape geometry={ellipse(30, 22)} offset={[318, 128]} fill="#FF9DB5" opacity={0.35} />
      {[-1, 1].map((side) => (
        <Group key={`eye-${side}`} offset={[320 + side * 24, 184]}>
          <Shape geometry={circle(12)} fill="#FFF4E0" />
          <Shape geometry={circle(6)} offset={[side * 2, 2]} fill="#101A2B" />
          <Shape geometry={circle(2)} offset={[side * 2 - 2, -1]} fill="#FFFFFF" />
        </Group>
      ))}
    </Group>
    {BUBBLES.map(({ x, r, delay }) => (
      <Shape
        key={`bubble-${x}`}
        geometry={circle(r)}
        fill="#9FD8F2"
        opacity={0.45}
        stroke={{ color: "#9FD8F2", width: 1.2 }}
        offset={track<Vec>([x, 410]).to([x + 14, -10], span(delay, RISE), ease.linear)}
        motion={[enter(span(delay, 0.05)), exit(span(delay + RISE - 0.05, 0.05))]}
      />
    ))}
  </Group>
));

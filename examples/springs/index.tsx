/** @jsxImportSource svjeez/scene */
import {
  Group,
  Shape,
  Text,
  canvas,
  circle,
  ease,
  enter,
  exit,
  motion,
  rect,
  scene,
  span,
  track,
  type Curve,
  type SceneElement,
  type Vec,
} from "svjeez/scene";
import { mono, theme } from "../theme";

const wobble = ease.spring({ stiffness: 150, damping: 11 });
const pop = ease.spring({ stiffness: 260, damping: 14 });

const HOME: Vec = [24, 60];

const STOPS: readonly Vec[] = [
  [130, 22],
  [220, 92],
  [296, 40],
];

/** Each move starts before the last one lands: a spring takes the dot from wherever it is, at its speed. */
const MOVES = [span(0.4, 0.6), span(1, 0.6), span(1.6, wobble.settle)];
const BACK = span(4.2, wobble.settle);

const route = (curve: Curve) => {
  let at = track(HOME);

  STOPS.forEach((stop, i) => {
    at = at.to(stop, MOVES[i]!, curve);
  });

  return at.to(HOME, BACK, curve);
};

const Lane = ({
  y,
  label,
  curve,
}: {
  readonly y: number;
  readonly label: string;
  readonly curve: Curve;
}): SceneElement => (
  <Group at={[24, y]}>
    <Shape
      geometry={rect(320, 116, { radius: 10 })}
      fill={theme.surface}
      stroke={{ color: theme.border, width: 1 }}
    />
    <Text font={mono} size={12} at={[12, 20]} fill={theme.muted}>
      {label}
    </Text>
    {[HOME, ...STOPS].map((stop) => (
      <Shape geometry={circle(9)} at={stop} stroke={{ color: theme.border, width: 1.5 }} />
    ))}
    <Shape geometry={circle(7)} at={route(curve)} fill={theme.blue} />
  </Group>
);

const Card = (): SceneElement => (
  <Group
    at={[380, 92]}
    motion={[
      enter(span(0.5, 0.2)),
      motion({ scale: 0.2 }).to({ scale: 1 }, span(0.5, pop.settle), pop),
      exit(span(5.3, 0.4), { opacity: 0, scale: 0.9 }, ease.in),
    ]}
  >
    <Shape
      geometry={rect(120, 96, { radius: 10 })}
      fill={theme.raised}
      stroke={{ color: theme.border, width: 1.5 }}
    />
    <Shape geometry={circle(12)} at={[26, 28]} fill={theme.magenta} />
    <Shape geometry={rect(56, 6, { radius: 3 })} at={[46, 20]} fill={theme.text} />
    <Shape geometry={rect(40, 6, { radius: 3 })} at={[46, 32]} fill={theme.muted} />
    <Shape geometry={rect(96, 6, { radius: 3 })} at={[12, 58]} fill={theme.border} />
    <Shape geometry={rect(72, 6, { radius: 3 })} at={[12, 72]} fill={theme.border} />
  </Group>
);

export default scene(
  {
    size: [520, 300],
    duration: 6,
    title: "Springs",
    desc: "A dot springs between three targets, each move starting before the last lands, beside the same moves with ease.out. A card pops in on a springy scale.",
    theme,
    reducedMotion: { at: 3 },
  },
  () => (
    <Group>
      <Shape geometry={canvas.rect} fill={theme.background} />
      <Lane y={24} label="ease.spring" curve={wobble} />
      <Lane y={160} label="ease.out" curve={ease.out} />
      <Card />
    </Group>
  ),
);

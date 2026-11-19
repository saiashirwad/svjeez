import {
  Group,
  Shape,
  Text,
  circle,
  ease,
  enter,
  exit,
  rect,
  scene,
  span,
  track,
  type Curve,
  type SceneElement,
  type Span,
  type Vec,
} from "svjeez";
import { mono, theme } from "../theme";

const wobble = ease.spring({ stiffness: 150, damping: 11 });
const pop = ease.spring({ stiffness: 260, damping: 14 });

const HOME: Vec = [24, 60];

const STOPS: readonly (readonly [point: Vec, move: Span])[] = [
  [[130, 22], span(0.4, 0.6)],
  [[220, 92], span(1, 0.6)],
  [[296, 40], span(1.6, wobble.settle)],
];

const BACK = span(4.2, wobble.settle);

const route = (curve: Curve) => {
  let at = track(HOME);

  for (const [stop, move] of STOPS) at = at.to(stop, move, curve);

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
  <Group offset={[24, y]}>
    <Shape
      geometry={rect(320, 116, { radius: 10 })}
      fill={theme.surface}
      stroke={{ color: theme.border, width: 1 }}
    />
    <Text font={mono} size={12} at={[12, 20]} anchor="baseline-left" fill={theme.muted}>
      {label}
    </Text>
    {[HOME, ...STOPS.map(([point]) => point)].map((stop) => (
      <Shape
        geometry={circle(9)}
        at={stop}
        anchor="center"
        stroke={{ color: theme.border, width: 1.5 }}
      />
    ))}
    <Shape geometry={circle(7)} at={route(curve)} anchor="center" fill={theme.blue} />
  </Group>
);

const Card = (): SceneElement => (
  <Group
    offset={[380, 92]}
    motion={[
      enter(span(0.5, 0.2)),
      { scale: track(0.2).to(1, span(0.5, pop.settle), pop) },
      exit(span(5.3, 0.4), { to: { opacity: 0, scale: 0.9 }, curve: ease.in }),
    ]}
  >
    <Shape
      geometry={rect(120, 96, { radius: 10 })}
      fill={theme.raised}
      stroke={{ color: theme.border, width: 1.5 }}
    />
    <Shape geometry={circle(12)} at={[26, 28]} anchor="center" fill={theme.magenta} />
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
    still: 3,
  },
  (canvas) => (
    <Group>
      <Shape geometry={canvas.rect} fill={theme.background} />
      <Lane y={24} label="ease.spring" curve={wobble} />
      <Lane y={160} label="ease.out" curve={ease.out} />
      <Card />
    </Group>
  ),
);

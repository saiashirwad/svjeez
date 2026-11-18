/** @jsxImportSource svjeez/scene */
import {
  Group,
  Shape,
  Text,
  arc,
  canvas,
  circle,
  ease,
  polygon,
  rect,
  scene,
  span,
  svgPath,
  track,
  type SceneElement,
  type Vec,
} from "svjeez/scene";
import { mono, theme } from "../theme";

const CELL = 128;
const MIDDLE = 92;

/** Where the i-th cell's center is. */
const center = (i: number): Vec => [CELL * i + CELL / 2, MIDDLE];

const Label = ({
  i,
  children,
}: {
  readonly i: number;
  readonly children: string;
}): SceneElement => (
  <Text font={mono} size={12} at={[center(i)[0], 186]} align="center" fill={theme.muted}>
    {children}
  </Text>
);

const star = polygon(
  Array.from({ length: 10 }, (_, k): Vec => {
    const reach = k % 2 === 0 ? 40 : 17;
    const angle = (k * Math.PI) / 5 - Math.PI / 2;

    return [reach * Math.cos(angle), reach * Math.sin(angle)];
  }),
);

const heart = svgPath(
  "M0 -14C8 -34 42 -28 34 0C29 16 10 26 0 36C-10 26 -29 16 -34 0C-42 -28 -8 -34 0 -14Z",
);

export default scene(
  {
    size: [640, 220],
    duration: 5,
    title: "Animated geometry",
    desc: "A rect grows and rounds its corners, an arc opens around its circle, a star morphs into a heart, a ring's stroke swells, and a trimmed window travels around a circle.",
    theme,
    reducedMotion: { at: 2.5 },
  },
  () => (
    <Group>
      <Shape geometry={canvas.rect} fill={theme.background} />

      <Shape
        geometry={track(rect(36, 36, { radius: 4 }))
          .to(rect(96, 64, { radius: 20 }), span(0.4, 1.4), ease.inOut)
          .rewind(0.8, ease.inOut)}
        at={track<Vec>([center(0)[0] - 18, MIDDLE - 18])
          .to([center(0)[0] - 48, MIDDLE - 32], span(0.4, 1.4), ease.inOut)
          .rewind(0.8, ease.inOut)}
        fill={theme.blue}
      />
      <Label i={0}>rect grows</Label>

      <Shape
        geometry={arc({ radius: 38, start: -90, sweep: 300 })}
        at={center(1)}
        stroke={{ color: theme.raised, width: 8, cap: "round" }}
      />
      <Shape
        geometry={track(arc({ radius: 38, start: -90, sweep: 0 }))
          .to(arc({ radius: 38, start: -90, sweep: 300 }), span(0.4, 1.8), ease.inOut)
          .rewind(0.8, ease.inOut)}
        at={center(1)}
        stroke={{ color: theme.cyan, width: 8, cap: "round" }}
      />
      <Label i={1}>arc opens</Label>

      <Shape
        geometry={track(star)
          .to(heart, span(0.6, 1.2), ease.inOut)
          .to(star, span(2.8, 1.2), ease.inOut)}
        at={center(2)}
        fill={theme.magenta}
      />
      <Label i={2}>star to heart</Label>

      <Shape
        geometry={circle(30)}
        at={center(3)}
        stroke={{
          color: theme.green,
          width: track(2).to(18, span(0.4, 1.4), ease.inOut).rewind(1.2, ease.inOut),
        }}
      />
      <Label i={3}>stroke swells</Label>

      <Shape geometry={circle(36)} at={center(4)} stroke={{ color: theme.raised, width: 6 }} />
      <Shape
        geometry={circle(36)}
        at={center(4)}
        rotate={-90}
        stroke={{ color: theme.orange, width: 6, cap: "round" }}
        trim={track<Vec>([0, 0])
          .to([0, 0.35], span(0.3, 0.8))
          .to([0.65, 1], span(1.1, 1.8), ease.inOut)
          .to([1, 1], span(2.9, 0.8), ease.in)}
      />
      <Label i={4}>trim travels</Label>
    </Group>
  ),
);

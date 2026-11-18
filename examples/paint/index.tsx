import {
  Group,
  Shape,
  Text,
  blur,
  canvas,
  circle,
  ease,
  linear,
  pathData,
  radial,
  rect,
  scene,
  shadow,
  span,
  track,
  type SceneElement,
  type Vec,
} from "svjeez";
import { mono, theme } from "../theme";

const TILE = 136;
const GAP = 16;
const CARD: Vec = [112, 112];

/** Where the i-th tile's card starts. */
const corner = (i: number): Vec => [GAP + i * (TILE + GAP) + (TILE - CARD[0]) / 2, 40];

const Label = ({
  i,
  children,
}: {
  readonly i: number;
  readonly children: string;
}): SceneElement => (
  <Text
    font={mono}
    size={12}
    at={[GAP + i * (TILE + GAP) + TILE / 2, 196]}
    anchor="baseline"
    fill={theme.muted}
  >
    {children}
  </Text>
);

/** A circle of radius `r` around `[x, y]`, as a path, so a clip can move it. */
const disc = ([x, y]: Vec, r: number) =>
  pathData(`M${x + r} ${y}A${r} ${r} 0 1 1 ${x - r} ${y}A${r} ${r} 0 1 1 ${x + r} ${y}Z`);

const card = rect(CARD[0], CARD[1], { radius: 14 });

/** The gradient's way turns a quarter and back, and its last stop warms from magenta to orange. */
const sky = track(linear.across({ angle: 0, stops: [theme.blue, theme.magenta] }))
  .to(linear.across({ angle: 90, stops: [theme.blue, theme.orange] }), span(0.4, 1.6), ease.inOut)
  .to(linear.across({ angle: 0, stops: [theme.blue, theme.magenta] }), span(3.4, 1.6), ease.inOut);

const stripes = Array.from({ length: 7 }, (_, k) => (
  <Shape
    geometry={rect(16, CARD[1])}
    at={[k * 16, 0]}
    fill={
      [theme.cyan, theme.green, theme.yellow, theme.orange, theme.red, theme.magenta, theme.blue][
        k
      ]!
    }
  />
));

/** A soft wipe: a band that is opaque up to its last 48px, which fade out, sliding across. */
const wipe = linear({
  from: [CARD[0], 0],
  to: [CARD[0] + 48, 0],
  stops: [
    [0, "#000000"],
    [1, "#00000000"],
  ],
});

export default scene(
  {
    size: [776, 220],
    duration: 6,
    title: "Paint and effects",
    desc: "A card whose gradient turns and warms, stripes seen through a moving round window while they turn, a soft masked wipe that reveals a card, a card that comes into focus, and a shadow that grows as a card lifts.",
    theme,
    reducedMotion: 2.2,
  },
  () => (
    <Group>
      <Shape geometry={canvas.rect} fill={theme.background} />

      <Shape geometry={card} at={corner(0)} fill={sky} />
      <Label i={0}>gradient shifts</Label>

      <Group
        at={corner(1)}
        rotate={track(0).to(30, span(0.4, 2), ease.inOut).to(0, span(3.4, 1.6), ease.inOut)}
        scale={track(1).to(0.85, span(0.4, 2), ease.inOut).to(1, span(3.4, 1.6), ease.inOut)}
        clip={track(disc([30, 34], 28))
          .to(disc([82, 78], 28), span(0.4, 2), ease.inOut)
          .to(disc([30, 34], 28), span(3.4, 1.6), ease.inOut)}
      >
        {stripes}
      </Group>
      <Label i={1}>moving clip</Label>

      <Group
        at={corner(2)}
        mask={
          <Shape
            geometry={rect(CARD[0] + 48, CARD[1])}
            at={track<Vec>([-CARD[0] - 48, 0]).to([0, 0], span(0.4, 1.8), ease.inOut)}
            fill={wipe}
          />
        }
      >
        <Shape
          geometry={card}
          fill={radial.across({ center: "top-left", stops: [theme.yellow, theme.red] })}
        />
        <Shape geometry={circle(18)} at={[56, 56]} anchor="center" fill={theme.background} />
      </Group>
      <Label i={2}>masked reveal</Label>

      <Shape
        geometry={card}
        at={corner(3)}
        fill={theme.green}
        opacity={track(0).to(1, span(0.4, 1.2))}
        effects={[blur(track(12).to(0, span(0.4, 1.6), ease.out))]}
      />
      <Label i={3}>blur-in</Label>

      <Shape
        geometry={card}
        at={corner(4)}
        fill={theme.surface}
        stroke={{ color: theme.border, width: 1 }}
        scale={track(1).to(1.06, span(1, 0.8), ease.out).to(1, span(3.4, 0.8), ease.inOut)}
        effects={[
          shadow({
            color: "#000000",
            opacity: 0.45,
            offset: track<Vec>([0, 2])
              .to([0, 12], span(1, 0.8), ease.out)
              .to([0, 2], span(3.4, 0.8)),
            blur: track(2).to(10, span(1, 0.8), ease.out).to(2, span(3.4, 0.8)),
          }),
        ]}
      />
      <Label i={4}>shadow grows</Label>
    </Group>
  ),
);

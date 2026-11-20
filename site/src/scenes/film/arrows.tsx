import {
  Arrow,
  Group,
  Stack,
  Text,
  ease,
  enter,
  ref,
  span,
  track,
  type SceneElement,
  type Vec,
} from "svjeez";
import { Listing } from "./listing";
import { Header, SHOTS, STAGE, mono, shown, spring, theme } from "./kit";

// The ref() slide. Two cards and an arrow between them, written by reference rather than by coordinate: one card
// drifts and the arrow keeps hold of it. Then two edits: the arrow bends, and it moves to the card's other edge.

const base = `const [a, b] = [ref(), ref()];
const drift = track([0, 0]).to([0, 120], span(0.5, 1)).rewind(1);

export default scene(opts, () => (
  <Group>
    <Card ref={a} at={[40, 100]} label="api" />
    <Card ref={b} at={[300, 40]} label="db" motion={{ offset: drift }} />
    <Arrow from={a.right} to={b.left} />
  </Group>
));`;

const states = [
  `export default scene(opts, () => (
  <Group />
));`,
  `export default scene(opts, () => (
  <Group>
    <Card ref={a} at={[40, 100]} label="api" />
    <Card ref={b} at={[300, 40]} label="db" />
  </Group>
));`,
  base
    .replace(" motion={{ offset: drift }}", "")
    .replace("const drift = track([0, 0]).to([0, 120], span(0.5, 1)).rewind(1);\n", ""),
  base,
  base.replace(
    "<Arrow from={a.right} to={b.left} />",
    "<Arrow from={a.right} to={b.left} bend={0.4} />",
  ),
  base.replace(
    "<Arrow from={a.right} to={b.left} />",
    "<Arrow from={a.right} to={b.bottom} bend={0.4} />",
  ),
];

const steps = [0.9, 1.8, 2.7, 6.0, 7.2].map((t) => span(t, spring.settle));
const aside = span(3.4, spring.settle);
const appear = 4.2;
const [bent, moved] = [steps[3]!.start + 0.1, steps[4]!.start + 0.1];

const [a, b] = [ref(), ref()];
const A: Vec = [760, 420];
const B: Vec = [1000, 250];

/** The db card bobs from the moment it appears to the end of the slide. */
const drift = track<Vec>([0, 0])
  .to([0, 150], span(appear + 0.3, 1), ease.inOut)
  .to([0, 0], span(appear + 1.5, 1), ease.inOut)
  .to([0, 150], span(appear + 2.7, 1), ease.inOut)
  .to([0, 60], span(appear + 3.9, 0.9), ease.inOut);

const Card = ({
  handle,
  at,
  label,
  motion,
}: {
  readonly handle: ReturnType<typeof ref>;
  readonly at: Vec;
  readonly label: string;
  readonly motion?: { readonly offset: typeof drift };
}): SceneElement => (
  <Stack
    ref={handle}
    at={at}
    width={120}
    height={64}
    align="center"
    justify="center"
    radius={10}
    fill={theme.background}
    stroke={{ color: theme.faint, width: 1 }}
    motion={motion}
  >
    <Text font={mono} size={18} fill={theme.text}>
      {label}
    </Text>
  </Stack>
);

const stroke = { color: theme.blue, width: 2, cap: "round" } as const;

/** Each version of the arrow shows only while its line of code is the current one. */
const window = (from: number, to?: number) =>
  to === undefined
    ? track(0).to(1, span(from, 0.2))
    : track(0).to(1, span(from, 0.2)).to(0, span(to, 0.2));

export const ArrowsSlide = (): SceneElement => {
  const { over } = SHOTS.arrows;

  return (
    <Group>
      <Header title="point at things, not coordinates" from="ref() · <Arrow>" over={over!} />
      <Group motion={shown(over!, 0.1)}>
        <Listing
          name="cards.tsx"
          states={states}
          steps={steps}
          edits={2}
          full={{ at: [STAGE.x + 110, STAGE.y + 30], size: [900, 400] }}
          aside={{ at: [STAGE.x + 20, STAGE.y + 90], scale: 0.6, when: aside }}
        />
        <Group
          motion={enter(span(appear, 0.4), {
            from: { opacity: 0, offset: [0, 10] },
            curve: ease.out,
          })}
        >
          <Card handle={a} at={A} label="api" />
          <Card handle={b} at={B} label="db" motion={{ offset: drift }} />
          <Arrow
            from={a.right}
            to={b.left}
            inset={6}
            stroke={stroke}
            opacity={window(appear, bent)}
          />
          <Arrow
            from={a.right}
            to={b.left}
            inset={6}
            bend={0.4}
            stroke={stroke}
            opacity={window(bent, moved)}
          />
          <Arrow
            from={a.right}
            to={b.bottom}
            inset={6}
            bend={0.4}
            stroke={stroke}
            opacity={window(moved)}
          />
        </Group>
      </Group>
    </Group>
  );
};

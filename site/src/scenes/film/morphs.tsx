import {
  Group,
  Shape,
  Text,
  ease,
  enter,
  rect,
  span,
  track,
  type Paint,
  type SceneElement,
  type Vec,
} from "svjeez";
import { Listing } from "./listing";
import { Header, SHOTS, STAGE, mono, shown, spring, theme } from "./kit";

// The morph() slide. The code writes itself across the stage, then steps aside; the bars it describes grow, morph
// from one quarter to the next, and change as the code is edited: a color, then a gap.

const states = [
  `export default scene(opts, () => (
  <Group />
));`,
  `export default scene(opts, () => (
  <Group>
    {morph(<Bars data={q1} />, <Bars data={q2} />, span(1, 0.8))}
  </Group>
));`,
  `const Bars = ({ data }: { data: Quarter }) => (
  <Stack direction="row" gap={12} align="end">
    {data.map(({ region, value }) => (
      <Shape key={region} geometry={rect(44, value)} fill={color} />
    ))}
  </Stack>
);

export default scene(opts, () => (
  <Group>
    {morph(<Bars data={q1} />, <Bars data={q2} />, span(1, 0.8))}
  </Group>
));`,
];

const withColor = (source: string, color: string) => `const color = theme.${color};\n${source}`;
const grown = withColor(states[2]!, "blue");
const recolored = withColor(states[2]!, "pink");
const spread = recolored.replace("gap={12}", "gap={28}");

const steps = [1.0, 1.9, 2.8, 6.6, 7.9].map((t) => span(t, spring.settle));
const aside = span(3.6, spring.settle);
const appear = 4.4;
const morphed = span(5.2, 0.8);
const [recolor, respace] = [steps[3]!.start + 0.1, steps[4]!.start + 0.1];

const q1 = [
  ["us", 150],
  ["eu", 110],
  ["apac", 80],
  ["latam", 40],
] as const;

const q2 = [
  ["apac", 190],
  ["us", 130],
  ["eu", 90],
  ["latam", 50],
] as const;

const BASE = 560;
const LEFT = 740;
const WIDTH = 44;
const xAt = (rank: number, gap: number) => LEFT + rank * (WIDTH + gap);

const Bar = ({ region }: { readonly region: string }): SceneElement => {
  const before = q1.findIndex(([name]) => name === region);
  const after = q2.findIndex(([name]) => name === region);
  const [h1, h2] = [q1[before]![1], q2[after]![1]];

  const at = track<Vec>([xAt(before, 12), BASE - h1])
    .to([xAt(after, 12), BASE - h2], morphed, ease.inOut)
    .to([xAt(after, 28), BASE - h2], span(respace, 0.6), ease.inOut);

  const label = track<Vec>([xAt(before, 12) + WIDTH / 2, BASE + 26])
    .to([xAt(after, 12) + WIDTH / 2, BASE + 26], morphed, ease.inOut)
    .to([xAt(after, 28) + WIDTH / 2, BASE + 26], span(respace, 0.6), ease.inOut);

  return (
    <Group>
      <Shape
        geometry={track(rect(WIDTH, h1, { radius: 4 })).to(
          rect(WIDTH, h2, { radius: 4 }),
          morphed,
          ease.inOut,
        )}
        at={at}
        fill={track<Paint>(theme.blue).to(theme.pink, span(recolor, 0.4))}
      />
      <Text font={mono} size={14} at={label} anchor="baseline" fill={theme.muted}>
        {region}
      </Text>
    </Group>
  );
};

export const MorphSlide = (): SceneElement => {
  const { over } = SHOTS.morph;

  return (
    <Group>
      <Header title="write two states, get the in-between" from="morph()" over={over!} />
      <Group motion={shown(over!, 0.1)}>
        <Listing
          name="bars.tsx"
          states={[states[0]!, states[1]!, states[2]!, grown, recolored, spread]}
          steps={steps}
          edits={2}
          full={{ at: [STAGE.x + 160, STAGE.y + 14], size: [800, 470] }}
          aside={{ at: [STAGE.x + 20, STAGE.y + 70], scale: 0.66, when: aside }}
        />
        <Group
          motion={enter(span(appear, 0.4), {
            from: { opacity: 0, offset: [0, 10] },
            curve: ease.out,
          })}
        >
          {["q1", "q2"].map((quarter, i) => (
            <Text
              font={mono}
              size={15}
              letterSpacing={1}
              at={[LEFT, STAGE.y + 110]}
              anchor="baseline-left"
              fill={theme.muted}
              opacity={
                i === 0
                  ? track(1).to(0, span(morphed.start, 0.2))
                  : track(0).to(1, span(morphed.start, 0.2))
              }
            >
              {`REVENUE · ${quarter.toUpperCase()}`}
            </Text>
          ))}
          {q1.map(([region]) => (
            <Bar region={region} />
          ))}
        </Group>
      </Group>
    </Group>
  );
};

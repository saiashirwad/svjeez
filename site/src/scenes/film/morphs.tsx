import {
  Group,
  Shape,
  Stack,
  Text,
  circle,
  ease,
  enter,
  morph,
  rect,
  span,
  type SceneElement,
} from "svjeez";
import { Listing } from "./listing";
import { CODE_COLUMN, Header, RESULT_COLUMN, SHOTS, mono, shown, spring, theme } from "./kit";

// The morph() slide. A deploy card is written as one component with two states; the code steps aside and the card
// morphs from building to ready. Two edits follow: the project is renamed, and a line is added, and the card follows.

const component = (name: string, extra: string) => `const Deploy = ({ ready = false }) => (
  <Stack gap={12} padding={24} stroke={line}>
    <Text key="name">${name}</Text>
    <Bar key="progress" done={ready ? 1 : 0.4} />
    <Status key="status" ready={ready} />
    {ready && <Text key="url">${name}.app</Text>}${extra}
  </Stack>
);`;

const use = `export default scene(opts, () =>
  morph(<Deploy />, <Deploy ready />, span(1, 0.6)),
);`;

const TIME = `\n    {ready && <Text key="time">built in 38s</Text>}`;

const states = [
  `export default scene(opts, () =>
  <Group />
);`,
  use,
  `${component("acme-web", "")}\n\n${use}`,
  `${component("acme-docs", "")}\n\n${use}`,
  `${component("acme-docs", TIME)}\n\n${use}`,
];

const steps = [1.0, 2.0, 6.4, 7.8].map((t) => span(t, spring.settle));
const aside = span(3.3, spring.settle);
const appear = 4.2;
const ready = span(5.0, 0.6);
const [renamed, timed] = [steps[2]!.start + 0.1, steps[3]!.start + 0.1];

const W = 460;
const BAR = W - 60;

interface CardProps {
  readonly ready: boolean;
  readonly name: string;
  readonly time?: boolean;
}

/** The card the code describes, in the film's own colors. */
const Card = ({ ready: done, name, time }: CardProps): SceneElement => (
  <Stack
    at={[RESULT_COLUMN[0] + (RESULT_COLUMN[2] - W) / 2, RESULT_COLUMN[1] + 120]}
    width={W}
    gap={18}
    padding={28}
    radius={12}
    fill={theme.background}
    stroke={{ color: theme.line, width: 1 }}
  >
    <Text key={`name-${name}`} font={mono} size={26} fill={theme.text}>
      {name}
    </Text>
    <Group key="progress">
      <Shape geometry={rect(BAR, 8, { radius: 4 })} fill={theme.line} />
      <Shape
        key="fill"
        geometry={rect(done ? BAR : BAR * 0.4, 8, { radius: 4 })}
        fill={done ? theme.green : theme.blue}
      />
    </Group>
    <Stack key="status" direction="row" gap={10} align="center">
      <Shape key="dot" geometry={circle(6)} fill={done ? theme.green : theme.clay} />
      <Text key={done ? "ready" : "building"} font={mono} size={20} fill={theme.muted}>
        {done ? "ready" : "building"}
      </Text>
    </Stack>
    {done && (
      <Text key={`url-${name}`} font={mono} size={20} fill={theme.blue}>
        {`${name}.app`}
      </Text>
    )}
    {done && time && (
      <Text key="time" font={mono} size={20} fill={theme.muted}>
        built in 38s
      </Text>
    )}
  </Stack>
);

export const MorphSlide = (): SceneElement => {
  const { over } = SHOTS.morph;

  return (
    <Group>
      <Header title="draw the before and the after" from="morph()" over={over!} />
      <Group motion={shown(over!, 0.1)}>
        <Listing
          name="deploy.tsx"
          size={20}
          states={states}
          steps={steps}
          edits={2}
          aside={{ box: CODE_COLUMN, when: aside }}
        />
        <Group
          motion={enter(span(appear, 0.4), {
            from: { opacity: 0, offset: [0, 10] },
            curve: ease.out,
          })}
        >
          {morph.between(
            [
              <Card ready={false} name="acme-web" />,
              <Card ready name="acme-web" />,
              <Card ready name="acme-docs" />,
              <Card ready name="acme-docs" time />,
            ],
            [ready, span(renamed, 0.5), span(timed, 0.6)],
            { curve: ease.inOut },
          )}
        </Group>
      </Group>
    </Group>
  );
};

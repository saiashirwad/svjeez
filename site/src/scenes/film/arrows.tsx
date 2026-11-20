import {
  Arrow,
  Group,
  Stack,
  Text,
  ease,
  enter,
  morph,
  ref,
  span,
  track,
  type SceneElement,
  type Vec,
} from "svjeez";
import { Listing } from "./listing";
import {
  CODE_COLUMN,
  Divider,
  Header,
  RESULT_COLUMN,
  SHOTS,
  mono,
  shown,
  spring,
  theme,
} from "./kit";

// The layout slide. An architecture diagram is written as a row of nodes with arrows between them by reference, not
// by coordinate. Two edits: a cache goes in the middle and the row makes room, then the gap tightens; the arrows hold
// on to the nodes through both.

const diagram = (nodes: readonly string[], gap: number) => `const [${nodes.join(", ")}] = refs();

export default scene(opts, () => (
  <Group>
    <Stack direction="row" gap={${gap}}>
${nodes.map((node) => `      <Node ref={${node}}>${node}</Node>`).join("\n")}
    </Stack>
${nodes
  .slice(1)
  .map((node, i) => `    <Arrow from={${nodes[i]}.right} to={${node}.left} />`)
  .join("\n")}
  </Group>
));`;

const states = [
  `export default scene(opts, () => (
  <Group />
));`,
  `export default scene(opts, () => (
  <Group>
    <Stack direction="row" gap={48}>
      <Node>web</Node>
      <Node>api</Node>
      <Node>db</Node>
    </Stack>
  </Group>
));`,
  diagram(["web", "api", "db"], 48),
  diagram(["web", "api", "cache", "db"], 48),
  diagram(["web", "api", "cache", "db"], 20),
];

const steps = [0.9, 1.9, 6.0, 7.4].map((t) => span(t, spring.settle));
const aside = span(3.1, spring.settle);
const appear = 4.0;
const [grown, tightened] = [steps[2]!.start + 0.1, steps[3]!.start + 0.1];

const NODE: Vec = [92, 60];
const handles = { web: ref(), api: ref(), cache: ref(), db: ref() } as const;

type Name = keyof typeof handles;

/** The row the code lays out, the middle of the diagram's area held still as it grows. */
const Row = ({
  nodes,
  gap,
}: {
  readonly nodes: readonly Name[];
  readonly gap: number;
}): SceneElement => {
  const width = nodes.length * NODE[0] + (nodes.length - 1) * gap;

  return (
    <Stack
      direction="row"
      gap={gap}
      at={[
        RESULT_COLUMN[0] + RESULT_COLUMN[2] / 2 - width / 2,
        RESULT_COLUMN[1] + RESULT_COLUMN[3] / 2 - NODE[1] / 2,
      ]}
    >
      {nodes.map((node) => (
        <Stack
          key={node}
          ref={handles[node]}
          width={NODE[0]}
          height={NODE[1]}
          align="center"
          justify="center"
          radius={10}
          fill={theme.background}
          stroke={{ color: theme.faint, width: 1 }}
        >
          <Text font={mono} size={20} fill={theme.text}>
            {node}
          </Text>
        </Stack>
      ))}
    </Stack>
  );
};

const stroke = { color: theme.blue, width: 2.5, cap: "round" } as const;

export const ArrowsSlide = (): SceneElement => {
  const { over } = SHOTS.arrows;

  return (
    <Group>
      <Header
        title="add a node, the diagram makes room"
        from="<Stack> · ref() · <Arrow>"
        over={over!}
      />
      <Group motion={shown(over!, 0.1)}>
        <Listing
          name="arch.tsx"
          size={20}
          states={states}
          steps={steps}
          edits={2}
          aside={{ box: CODE_COLUMN, when: aside }}
        />
        <Divider from={aside.end} />
        <Group
          motion={enter(span(appear, 0.4), {
            from: { opacity: 0, offset: [0, 10] },
            curve: ease.out,
          })}
        >
          {morph.between(
            [
              <Row nodes={["web", "api", "db"]} gap={48} />,
              <Row nodes={["web", "api", "cache", "db"]} gap={48} />,
              <Row nodes={["web", "api", "cache", "db"]} gap={20} />,
            ],
            [span(grown, 0.7), span(tightened, 0.6)],
            { curve: ease.inOut },
          )}
          <Arrow from={handles.web.right} to={handles.api.left} inset={6} stroke={stroke} />
          <Arrow
            from={handles.api.right}
            to={handles.db.left}
            inset={6}
            stroke={stroke}
            opacity={track(1).to(0, span(grown, 0.2))}
          />
          {[
            [handles.api, handles.cache],
            [handles.cache, handles.db],
          ].map(([from, to]) => (
            <Arrow
              from={from!.right}
              to={to!.left}
              inset={6}
              stroke={stroke}
              draw={track(0).to(1, span(grown + 0.5, 0.35), ease.out)}
            />
          ))}
        </Group>
      </Group>
    </Group>
  );
};

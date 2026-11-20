import { Icon } from "@svjeez/icons";
import { circleCheck, packageImport, rocket, testPipe } from "@svjeez/icons/tabler";
import {
  Arrow,
  Group,
  Shape,
  Stack,
  Text,
  ease,
  enter,
  rect,
  ref,
  span,
  track,
  type SceneElement,
  type Vec,
} from "svjeez";
import type { Child } from "svjeez/tools";
import { Builds } from "./builds";
import { RESULT_COLUMN, SHOTS, mono, theme } from "./kit";

// Two more code slides in the same shape as the basics: a list of steps becomes a pipeline, and named boxes become a
// diagram.

const SKELETON = `export default scene(opts, () => (
  <Group />
));`;

/** One tile filling the result column, appearing at `from`; bare, it has no background, and only its contents show. */
const Tile = ({
  from,
  bare = false,
  children,
}: {
  readonly from: number;
  readonly bare?: boolean;
  readonly children: Child;
}): SceneElement => (
  <Group
    offset={[RESULT_COLUMN[0], RESULT_COLUMN[1]]}
    motion={enter(span(from - 0.35, 0.3), {
      from: { opacity: 0, offset: [0, 8] },
      curve: ease.out,
    })}
  >
    {!bare && (
      <Shape
        geometry={rect(RESULT_COLUMN[2], RESULT_COLUMN[3], { radius: 12 })}
        fill={theme.surface}
        stroke={{ color: theme.line, width: 1 }}
      />
    )}
    {children}
  </Group>
);

// The pipeline: a few steps mapped to rows, each a drawn icon, a label, a translucent track that fills and a check that
// pops when it is done. No outline: just the pieces, composed, and moving.

const STEPS = [
  { name: "install", icon: packageImport },
  { name: "test", icon: testPipe },
  { name: "deploy", icon: rocket },
] as const;

const pipelineFile = (n: number): string => {
  if (n === 0) return SKELETON;

  return [
    'const steps = ["install", "test", "deploy"];',
    "",
    "export default scene(opts, () => (",
    "  <Stack gap={24}>",
    "    {steps.map((name, i) => (",
    "      <Step",
    "        icon={icons[i]}",
    "        label={name}",
    ...(n >= 2 ? ["        done={span(1 + i * 0.7, 0.6)}"] : []),
    "        motion={enter(span(i * 0.3, 0.5))}",
    "      />",
    "    ))}",
    "  </Stack>",
    "));",
  ].join("\n");
};

const ROW = { w: 530, h: 84, gap: 30, track: [232, 460] as const } as const;

const ROWS_TOP =
  RESULT_COLUMN[1] + (RESULT_COLUMN[3] - (STEPS.length * (ROW.h + ROW.gap) - ROW.gap)) / 2;

const ROWS_LEFT = RESULT_COLUMN[0] + (RESULT_COLUMN[2] - ROW.w) / 2;

/** Where Blip stands: on the first row, over its check. */
export const PIPELINE_TOP: Vec = [ROWS_LEFT + ROW.w - 20, ROWS_TOP + 6];

const Step = ({
  index,
  appears,
  done,
}: {
  readonly index: number;
  readonly appears: number;
  readonly done: number;
}): SceneElement => {
  const { name, icon } = STEPS[index]!;
  const fills = span(done, 0.6);
  const [from, to] = ROW.track;

  return (
    <Group
      offset={[ROWS_LEFT, ROWS_TOP + index * (ROW.h + ROW.gap)]}
      motion={enter(span(appears, 0.5), {
        from: { opacity: 0, offset: [-16, 0] },
        curve: ease.out,
      })}
    >
      <Icon
        icon={icon}
        size={44}
        at={[0, ROW.h / 2 - 22]}
        color={theme.text}
        stroke={{ width: 1.6 }}
        draw={(part) => track(0).to(1, span(appears + 0.1 + part * 0.08, 0.5))}
      />
      <Text
        font={mono}
        size={30}
        at={[64, ROW.h / 2 + 10]}
        anchor="baseline-left"
        fill={theme.text}
      >
        {name}
      </Text>
      <Shape
        geometry={rect(to - from, 10, { radius: 5 })}
        at={[from, ROW.h / 2 - 5]}
        fill={theme.blue}
        opacity={0.18}
      />
      <Shape
        geometry={track(rect(0.01, 10, { radius: 5 })).to(
          rect(to - from, 10, { radius: 5 }),
          fills,
          ease.inOut,
        )}
        at={[from, ROW.h / 2 - 5]}
        fill={theme.blue}
        opacity={0.85}
      />
      <Group
        motion={enter(span(fills.end, 0.4), { from: { opacity: 0, scale: 0.4 }, curve: ease.pop })}
      >
        <Icon
          icon={circleCheck}
          size={44}
          at={[ROW.w - 44, ROW.h / 2 - 22]}
          color={theme.green}
          stroke={{ width: 1.8 }}
        />
      </Group>
    </Group>
  );
};

export const PipelineSlide = (): SceneElement => (
  <Builds
    name="deploy.tsx"
    file={pipelineFile}
    lands={[1.0, 3.4]}
    over={SHOTS.pipeline.over!}
    result={([rows, done]) => (
      <Group>
        {STEPS.map((_, i) => (
          <Step index={i} appears={rows! + i * 0.3} done={done! + i * 0.7} />
        ))}
      </Group>
    )}
  />
);

const NODES = ["app", "api", "db"] as const;

const diagramFile = (n: number): string => {
  if (n === 0) return SKELETON;

  const arrows = [
    ["app", "api"],
    ["api", "db"],
  ]
    .slice(0, n - 1)
    .flatMap(([from, to]) => [
      "    <Arrow",
      `      from={${from}.right}`,
      `      to={${to}.left}`,
      "    />",
    ]);

  return [
    "const [app, api, db] = refs();",
    "",
    "export default scene(opts, () => (",
    "  <Group>",
    "    <Stack",
    '      direction="row"',
    "      gap={72}",
    "    >",
    ...NODES.map((node) => `      <Box ref={${node}}>${node}</Box>`),
    "    </Stack>",
    ...arrows,
    "  </Group>",
    "));",
  ].join("\n");
};

const handles = { app: ref(), api: ref(), db: ref() } as const;
const BOX = [110, 64] as const;
const GAP = 72;

export const DiagramSlide = (): SceneElement => (
  <Builds
    name="arch.tsx"
    file={diagramFile}
    lands={[1.0, 3.0, 4.4]}
    over={SHOTS.diagram.over!}
    result={([boxes, first, second]) => (
      <Tile from={boxes!}>
        <Stack
          direction="row"
          gap={GAP}
          at={[(RESULT_COLUMN[2] - 3 * BOX[0] - 2 * GAP) / 2, (RESULT_COLUMN[3] - BOX[1]) / 2]}
        >
          {NODES.map((node, i) => (
            <Stack
              ref={handles[node]}
              width={BOX[0]}
              height={BOX[1]}
              align="center"
              justify="center"
              radius={10}
              fill={theme.background}
              stroke={{ color: theme.faint, width: 1 }}
              motion={enter(span(boxes! + i * 0.12, 0.4), {
                from: { opacity: 0, scale: 0.7 },
                curve: ease.pop,
              })}
            >
              <Text font={mono} size={20} fill={theme.text}>
                {node}
              </Text>
            </Stack>
          ))}
        </Stack>
        <Arrow
          from={handles.app.right}
          to={handles.api.left}
          inset={6}
          stroke={{ color: theme.blue, width: 2.5, cap: "round" }}
          draw={track(0).to(1, span(first!, 0.6), ease.out)}
        />
        <Arrow
          from={handles.api.right}
          to={handles.db.left}
          inset={6}
          stroke={{ color: theme.blue, width: 2.5, cap: "round" }}
          draw={track(0).to(1, span(second!, 0.6), ease.out)}
        />
      </Tile>
    )}
  />
);

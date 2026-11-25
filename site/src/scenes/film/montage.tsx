import { Tex } from "@svjeez/math";
import { mermaid } from "@svjeez/mermaid";
import {
  Group,
  Shape,
  Text,
  ease,
  enter,
  morph,
  rect,
  span,
  type SceneElement,
  type Vec,
} from "svjeez";
import { Pivot } from "../blip";
import { DotMap, WeekChart } from "./data";
import { ACCENTS, SHOTS, STAGE, mono, shown, theme } from "./kit";

const TILE: Vec = [530, 214];
const GAP = 20;
const LEFT = STAGE.x + (STAGE.w - 2 * TILE[0] - GAP) / 2;
const TOP = STAGE.y + 26;
const beats = span(0.3, 0.4).cascade(4, 0.35);

const corner = (i: number): Vec => [
  LEFT + (i % 2) * (TILE[0] + GAP),
  TOP + Math.floor(i / 2) * (TILE[1] + GAP),
];

const flow = mermaid(
  `flowchart LR
  push([push]) --> build[build]
  build --> test{tests pass?}
  test -->|yes| ship([ship])`,
  {
    font: mono,
    textSize: 15,
    reveal: span(beats[0]!.start + 0.3, 0.25),
    colors: {
      background: theme.surface,
      text: theme.text,
      line: theme.faint,
      muted: theme.muted,
      accent: theme.blue,
      highlight: theme.pink,
      roles: {
        input: theme.blue,
        task: theme.purple,
        tool: theme.teal,
        output: theme.green,
        store: theme.purple,
        decision: theme.pink,
      },
    },
  },
);

const colors = { a: ACCENTS[0], b: ACCENTS[1], c: ACCENTS[2], x: ACCENTS[3] };
const [a, b, c, x] = ["a", "b", "c", "x"].map((v) => String.raw`\textcolor{${v}}{${v}}`);
const before = String.raw`${a}${x}^2 + ${b}${x} + ${c} = 0`;
const after = String.raw`${x} = \frac{-${b} \pm \sqrt{${b}^2 - 4${a}${c}}}{2${a}}`;
const TEX = 34;

const centered = (source: string): Vec => {
  const box = Tex.measure(source, { size: TEX });

  return [TILE[0] / 2 - box.width / 2 - box.x, TILE[1] / 2 - 10 - box.height / 2 - box.y];
};

/** A thing that fits a tile's middle, scaled down to fit if it needs to. */
const Fit = ({
  size,
  children,
}: {
  readonly size: Vec;
  readonly children: SceneElement;
}): SceneElement => {
  const fit = Math.min(1, (TILE[0] - 40) / size[0], (TILE[1] - 56) / size[1]);

  return (
    <Pivot
      around={[0, 0]}
      at={[(TILE[0] - size[0] * fit) / 2, 16 + (TILE[1] - 40 - size[1] * fit) / 2]}
      motion={{ scale: fit }}
    >
      {children}
    </Pivot>
  );
};

const tiles = [
  { label: "@svjeez/mermaid", body: <Fit size={flow.size}>{flow.node}</Fit> },
  {
    label: "@svjeez/geo",
    body: (
      <Fit size={[400, 200]}>
        <DotMap start={beats[1]!.start} />
      </Fit>
    ),
  },
  {
    label: "@svjeez/math",
    body: morph(
      <Tex size={TEX} at={centered(before)} fill={theme.text} colors={colors}>
        {before}
      </Tex>,
      <Tex size={TEX} at={centered(after)} fill={theme.text} colors={colors}>
        {after}
      </Tex>,
      span(beats[2]!.start + 1, 1),
    ),
  },
  {
    label: "@svjeez/charts",
    body: (
      <Group offset={[50, 22]}>
        <WeekChart start={beats[3]!.start + 0.2} size={[TILE[0] - 90, TILE[1] - 70]} />
      </Group>
    ),
  },
];

export const Montage = (): SceneElement => {
  const { over } = SHOTS.montage;

  return (
    <Group>
      <Group motion={shown(over!, 0)}>
        {tiles.map(({ label, body }, i) => (
          <Group
            offset={corner(i)}
            motion={enter(beats[i]!, { from: { opacity: 0, offset: [0, 12] }, curve: ease.out })}
          >
            <Shape
              geometry={rect(TILE[0], TILE[1], { radius: 12 })}
              fill={theme.surface}
              stroke={{ color: theme.line, width: 1 }}
            />
            {body}
            <Text
              font={mono}
              size={13}
              letterSpacing={0.6}
              at={[16, TILE[1] - 14]}
              anchor="baseline-left"
              fill={theme.muted}
            >
              {label}
            </Text>
          </Group>
        ))}
      </Group>
    </Group>
  );
};

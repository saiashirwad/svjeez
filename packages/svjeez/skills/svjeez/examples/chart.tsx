/** @jsxImportSource svjeez */
import {
  Group,
  Shape,
  Stack,
  Text,
  canvas,
  enter,
  morph,
  rect,
  scene,
  span,
  type Paint,
  type SceneElement,
} from "svjeez";
import { sans, theme } from "./style";

interface Quarter {
  readonly name: string;
  readonly bars: readonly {
    readonly region: string;
    readonly value: number;
    readonly color: Paint;
  }[];
}

const quarters: readonly Quarter[] = [
  {
    name: "Q1",
    bars: [
      { region: "north", value: 42, color: theme.blue },
      { region: "east", value: 68, color: theme.blue },
      { region: "south", value: 51, color: theme.blue },
    ],
  },
  {
    name: "Q2",
    bars: [
      { region: "north", value: 60, color: theme.blue },
      { region: "east", value: 45, color: theme.blue },
      { region: "south", value: 88, color: theme.green },
      { region: "west", value: 27, color: theme.cyan },
    ],
  },
  {
    name: "Q3",
    bars: [
      { region: "south", value: 96, color: theme.green },
      { region: "west", value: 70, color: theme.cyan },
      { region: "east", value: 52, color: theme.yellow },
    ],
  },
];

const PX_PER_UNIT = 1.4;

const chart = ({ name, bars }: Quarter): SceneElement => (
  <Group>
    <Text key="title" font={sans} weight={600} size={16} at={[40, 28]} fill={theme.text}>
      {`Signups by region, ${name}`}
    </Text>
    <Stack key="bars" direction="row" gap={20} align="end" at={[40, 250]} anchor="bottom-left">
      {bars.map(({ region, value, color }) => (
        <Stack key={region} gap={6} align="center">
          <Text key="value" font={sans} size={12} fill={theme.muted}>
            {value}
          </Text>
          <Shape key="bar" geometry={rect(56, value * PX_PER_UNIT, { radius: 6 })} fill={color} />
          <Text key="label" font={sans} size={12} fill={theme.text}>
            {region}
          </Text>
        </Stack>
      ))}
    </Stack>
  </Group>
);

const STEP = 2.6;
const TURN = 1;

const turns = [1, 2, 3].map((i) => span(STEP * i - TURN, TURN));

export default scene(
  {
    size: [400, 280],
    duration: STEP * 3,
    title: "Signups by region",
    desc: "A bar chart moves through three quarters and back: bars grow and shrink, recolor and trade places, a new region enters and another leaves.",
    theme,
    reducedMotion: STEP - TURN - 0.2,
  },
  () => (
    <Group>
      <Shape geometry={canvas.rect} fill={theme.background} />
      <Group motion={enter(span(0, 0.5))}>
        {morph.between([...quarters, quarters[0]!].map(chart), turns, {
          stagger: 0.05,
          enter: { opacity: 0, scale: 0.8 },
          exit: { opacity: 0, scale: 0.8 },
        })}
      </Group>
    </Group>
  ),
);
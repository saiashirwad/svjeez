import {
  Group,
  Shape,
  Text,
  canvas,
  circle,
  morph,
  rect,
  scene,
  span,
  type Paint,
  type SceneElement,
} from "svjeez";
import { mono, theme } from "../theme";

/** One quarter of the chart: a bar per region, in the order they stand, and the badge's change. */
interface Quarter {
  readonly name: string;
  readonly bars: readonly {
    readonly region: string;
    readonly value: number;
    readonly color: Paint;
  }[];
  readonly change: string;
}

const quarters: readonly Quarter[] = [
  {
    name: "Q1",
    bars: [
      { region: "north", value: 40, color: theme.blue },
      { region: "east", value: 72, color: theme.blue },
      { region: "south", value: 55, color: theme.blue },
    ],
    change: "",
  },
  {
    name: "Q2",
    bars: [
      { region: "north", value: 64, color: theme.blue },
      { region: "east", value: 48, color: theme.blue },
      { region: "south", value: 90, color: theme.green },
      { region: "west", value: 30, color: theme.cyan },
    ],
    change: "+18%",
  },
  {
    name: "Q3",
    bars: [
      { region: "south", value: 100, color: theme.green },
      { region: "west", value: 76, color: theme.cyan },
      { region: "east", value: 58, color: theme.orange },
    ],
    change: "+31%",
  },
];

const BASE = 236;
const LEFT = 64;
const SLOT = 104;
const WIDTH = 64;
const SCALE = 1.5;

/**
 * One state of the picture. Every node that changes has a key, which is how the morph knows a bar in one quarter
 * from the same bar in the next.
 */
const chart = ({ name, bars, change }: Quarter): SceneElement => (
  <Group>
    <Text
      key="quarter"
      font={mono}
      size={14}
      at={[LEFT, 40]}
      anchor="baseline-left"
      fill={theme.text}
    >
      {`Revenue, ${name}`}
    </Text>
    {bars.map(({ region, value, color }, i) => {
      const height = value * SCALE;
      const x = LEFT + i * SLOT;

      return (
        <Group key={region}>
          <Shape
            key="bar"
            geometry={rect(WIDTH, height, { radius: 6 })}
            at={[x, BASE - height]}
            fill={color}
          />
          <Text
            key="label"
            font={mono}
            size={12}
            at={[x + WIDTH / 2, BASE + 20]}
            anchor="baseline"
            fill={theme.muted}
          >
            {region}
          </Text>
        </Group>
      );
    })}
    <Group key="badge">
      {change === "" ? (
        <Shape
          key="shape"
          geometry={circle(14)}
          at={[520, 110]}
          anchor="center"
          fill={theme.raised}
        />
      ) : (
        <Shape
          key="shape"
          geometry={rect(96, 40, { radius: 10 })}
          at={[472, 90]}
          fill={change === "+31%" ? theme.magenta : theme.raised}
        />
      )}
      {change !== "" && (
        <Text
          key="change"
          font={mono}
          size={16}
          at={[520, 116]}
          anchor="baseline"
          fill={theme.text}
        >
          {change}
        </Text>
      )}
    </Group>
  </Group>
);

const STEP = 2.6;

export default scene(
  {
    size: [640, 280],
    duration: STEP * 3,
    title: "Morph",
    desc: "A bar chart moves through three quarters and back: bars grow, shrink, recolor and trade places, a new region enters, one leaves, the badge turns from a dot into a label, and the heading crossfades.",
    theme,
    reducedMotion: STEP * 2 - 0.2,
  },
  () => (
    <Group>
      <Shape geometry={canvas.rect} fill={theme.background} />
      <Shape geometry={rect(512, 1.5)} at={[48, BASE]} fill={theme.border} />
      {morph.between(
        [...quarters, quarters[0]!].map(chart),
        [span(STEP - 1.2, 1.2), span(STEP * 2 - 1.2, 1.2), span(STEP * 3 - 1.2, 1.2)],
        { stagger: 0.06, enter: { opacity: 0, scale: 0.6 }, exit: { opacity: 0, scale: 0.6 } },
      )}
    </Group>
  ),
);

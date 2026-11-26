// morph/index.tsx written with h() instead of JSX. Keys go in the props, as `key`.
import {
  Group,
  Shape,
  Text,
  circle,
  h,
  morph,
  rect,
  scene,
  span,
  type Paint,
  type SceneElement,
} from "svjeez";
import { mono, theme } from "../theme";

interface Quarter {
  readonly name: string;
  readonly bars: readonly {
    readonly region: string;
    readonly value: number;
    readonly color: Paint;
  }[];
  readonly change: string;
}

const quarters: readonly [Quarter, ...Quarter[]] = [
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

const Revenue = ({ name, bars, change }: Quarter): SceneElement =>
  h(
    Group,
    null,
    h(
      Text,
      {
        key: "quarter",
        font: mono,
        size: 14,
        at: [LEFT, 40],
        anchor: "baseline-left",
        fill: theme.text,
      },
      `Revenue, ${name}`,
    ),
    bars.map(({ region, value, color }, i) => {
      const height = value * SCALE;
      const x = LEFT + i * SLOT;

      return h(
        Group,
        { key: region },
        h(Shape, {
          key: "bar",
          geometry: rect(WIDTH, height, { radius: 6 }),
          at: [x, BASE - height],
          fill: color,
        }),
        h(
          Text,
          {
            key: "label",
            font: mono,
            size: 12,
            at: [x + WIDTH / 2, BASE + 20],
            anchor: "baseline",
            fill: theme.muted,
          },
          region,
        ),
      );
    }),
    h(
      Group,
      { key: "badge" },
      change === ""
        ? h(Shape, { key: "shape", geometry: circle(14), offset: [520, 110], fill: theme.raised })
        : h(Shape, {
            key: "shape",
            geometry: rect(96, 40, { radius: 10 }),
            at: [472, 90],
            fill: change === "+31%" ? theme.magenta : theme.raised,
          }),
      change !== "" &&
        h(
          Text,
          {
            key: "change",
            font: mono,
            size: 16,
            at: [520, 116],
            anchor: "baseline",
            fill: theme.text,
          },
          change,
        ),
    ),
  );

const STEP = 2.6;

export default scene(
  {
    size: [640, 280],
    duration: STEP * 3,
    title: "Morph",
    desc: "A bar chart moves through three quarters and back: bars grow, shrink, recolor and trade places, a new region enters, one leaves, the badge turns from a dot into a label, and the heading crossfades.",
    theme,
    still: STEP * 2 - 0.2,
  },
  (canvas) =>
    h(
      Group,
      null,
      h(Shape, { geometry: canvas.rect, fill: theme.background }),
      h(Shape, { geometry: rect(512, 1.5), at: [48, BASE], fill: theme.border }),
      morph.between(
        [...quarters, quarters[0]].map((quarter) => h(Revenue, quarter)),
        [span(STEP - 1.2, 1.2), span(STEP * 2 - 1.2, 1.2), span(STEP * 3 - 1.2, 1.2)],
        { stagger: 0.06, enter: { opacity: 0, scale: 0.6 }, exit: { opacity: 0, scale: 0.6 } },
      ),
    ),
);

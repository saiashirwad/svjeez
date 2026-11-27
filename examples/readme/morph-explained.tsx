import {
  Group,
  Shape,
  Text,
  ease,
  line,
  morph,
  rect,
  scene,
  span,
  type Paint,
  type SceneElement,
  type Vec,
} from "svjeez";
import { mono, theme } from "../theme";

const LEFT = 150;
const RIGHT = 570;
const MID = 360;
const ROWS = [90, 150, 210] as const;

interface Tile {
  readonly key: string;
  readonly row: number;
  readonly size: Vec;
  readonly color: Paint;
}

const A: readonly Tile[] = [
  { key: "a", row: 0, size: [40, 40], color: theme.blue },
  { key: "b", row: 1, size: [40, 40], color: theme.cyan },
  { key: "c", row: 2, size: [40, 40], color: theme.magenta },
];

const B: readonly Tile[] = [
  { key: "b", row: 0, size: [72, 40], color: theme.green },
  { key: "c", row: 1, size: [52, 52], color: theme.magenta },
  { key: "d", row: 2, size: [40, 40], color: theme.orange },
];

const corner = (x: number, { row, size: [w, h] }: Tile): Vec => [x - w / 2, ROWS[row]! - h / 2];

const tiles = (x: number, list: readonly Tile[]): SceneElement => (
  <Group>
    {list.map((tile) => (
      <Shape
        key={tile.key}
        geometry={rect(tile.size[0], tile.size[1], { radius: 8 })}
        at={corner(x, tile)}
        fill={tile.color}
      />
    ))}
  </Group>
);

const Slots = ({ x, list, side }: { x: number; list: readonly Tile[]; side: -1 | 1 }) => (
  <Group>
    {list.map((tile) => (
      <Group>
        <Shape
          geometry={rect(tile.size[0] + 8, tile.size[1] + 8, { radius: 11 })}
          at={corner(x, { ...tile, size: [tile.size[0] + 8, tile.size[1] + 8] })}
          stroke={{ color: theme.border, width: 1, dash: [3, 3] }}
        />
        <Text
          font={mono}
          size={12}
          at={[x + side * 58, ROWS[tile.row]!]}
          anchor={side < 0 ? "right" : "left"}
          fill={theme.muted}
        >
          {`"${tile.key}"`}
        </Text>
      </Group>
    ))}
  </Group>
);

const edge = (x: number, side: -1 | 1, tile: Tile): Vec => [
  x + side * (tile.size[0] / 2 + 10),
  ROWS[tile.row]!,
];

const at = (from: Vec, to: Vec, x: number): number =>
  from[1] + ((x - from[0]) / (to[0] - from[0])) * (to[1] - from[1]);

const find = (list: readonly Tile[], key: string): Tile => list.find((tile) => tile.key === key)!;

const matches = ["b", "c"].map((key) => {
  const from = edge(LEFT, 1, find(A, key));
  const to = edge(RIGHT, -1, find(B, key));

  return { from, to, y: at(from, to, MID) };
});

const hairline = { color: theme.border, width: 1, dash: [2, 4] };
const PILL: Vec = [56, 20];

const EXIT = MID - 72;
const ENTER = MID + 72;

const Pill = ({ x = MID, y }: { x?: number; y: number }) => (
  <Shape
    geometry={rect(PILL[0], PILL[1], { radius: 10 })}
    at={[x - PILL[0] / 2, y - PILL[1] / 2]}
    fill={theme.background}
    stroke={{ color: theme.border, width: 1 }}
  />
);

const Labels = ({ top, bottom, title }: { top: string; bottom: string; title: string }) => (
  <Group>
    <Text key="title" font={mono} size={12} at={[MID, 40]} anchor="baseline" fill={theme.text}>
      {title}
    </Text>
    <Text key="top" font={mono} size={11} at={[EXIT, ROWS[0]]} anchor="center" fill={theme.text}>
      {top}
    </Text>
    <Text
      key="bottom"
      font={mono}
      size={11}
      at={[ENTER, ROWS[2]]}
      anchor="center"
      fill={theme.text}
    >
      {bottom}
    </Text>
  </Group>
);

const forward = <Labels top="exit" bottom="enter" title="A → B" />;
const backward = <Labels top="enter" bottom="exit" title="B → A" />;

const GO = span(1, 1.4);
const BACK = span(3.9, 1.4);

export default scene(
  {
    size: [720, 300],
    duration: 6.2,
    title: "How morph() matches keys",
    desc: "Two states of keyed tiles: A holds a, b and c; B holds b, c and d. Dashed lines match b and c across the states, so they tween position, size and color; a exists only in A, so it exits, and d exists only in B, so it enters. The tiles morph from A to B and back, and the exit and enter labels swap with the direction.",
    theme,
    still: 3.2,
  },
  (canvas) => (
    <Group>
      <Shape geometry={canvas.rect} fill={theme.background} />
      <Shape
        geometry={rect(696, 276, { radius: 12 })}
        at={[12, 12]}
        fill={theme.background}
        stroke={{ color: theme.raised, width: 1 }}
      />

      <Text font={mono} size={12} at={[LEFT, 40]} anchor="baseline" fill={theme.muted}>
        state A
      </Text>
      <Text font={mono} size={12} at={[RIGHT, 40]} anchor="baseline" fill={theme.muted}>
        state B
      </Text>

      <Slots x={LEFT} list={A} side={-1} />
      <Slots x={RIGHT} list={B} side={1} />

      {matches.map(({ from, to }) => (
        <Shape geometry={line(from, to)} stroke={hairline} />
      ))}
      <Shape
        geometry={line(edge(LEFT, 1, A[0]!), [EXIT - PILL[0] / 2, ROWS[0]])}
        stroke={hairline}
      />
      <Shape
        geometry={line([ENTER + PILL[0] / 2, ROWS[2]], edge(RIGHT, -1, B[2]!))}
        stroke={hairline}
      />

      {matches.map(({ y }) => (
        <Group>
          <Pill y={y} />
          <Text font={mono} size={11} at={[MID, y]} anchor="center" fill={theme.text}>
            tween
          </Text>
        </Group>
      ))}
      <Pill x={EXIT} y={ROWS[0]} />
      <Pill x={ENTER} y={ROWS[2]} />
      {morph.between([forward, backward, forward], [span(3.3, 0.4), span(5.8, 0.4)])}

      {morph.between([tiles(LEFT, A), tiles(RIGHT, B), tiles(LEFT, A)], [GO, BACK], {
        curve: ease.inOut,
        stagger: 0.08,
        enter: { opacity: 0, scale: 0.4 },
        exit: { opacity: 0, scale: 0.4 },
      })}

      <Text font={mono} size={11} at={[MID, 268]} anchor="baseline" fill={theme.muted}>
        key in both → tween · only in source → exit · only in target → enter
      </Text>
    </Group>
  ),
);

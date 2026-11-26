import {
  Arrow,
  Group,
  Shape,
  Text,
  circle,
  count,
  ease,
  line,
  morph,
  numeral,
  path,
  rect,
  ref,
  scene,
  span,
  track,
  type Paint,
  type SceneElement,
  type Vec,
} from "svjeez";
import { mono, theme } from "../theme";

// The same track as the hero: spring up to 1, hold, spring back to 0.
const spring = ease.spring({ stiffness: 185, damping: 15 });
const UP = 0.4;
const DOWN = 3.4;
const DURATION = 6;

const signal = track(0)
  .to(1, span(UP, spring.settle), spring)
  .to(0, span(DOWN, spring.settle), spring);

const valueAt = (t: number): number => {
  const settle = spring.settle;

  if (t < UP) return 0;

  if (t < UP + settle) return ease.at(spring, (t - UP) / settle);

  if (t < DOWN) return 1;

  if (t < DOWN + settle) return 1 - ease.at(spring, (t - DOWN) / settle);

  return 0;
};

const clamp = (v: number, lo = 0, hi = 1): number => Math.max(lo, Math.min(hi, v));

const WIDTH = 720;
const HEIGHT = 392;

// Source panel.
const PANEL: Vec = [24, 94];
const PANEL_W = 224;
const PANEL_H = 204;
const PLOT: Vec = [PANEL[0] + 16, PANEL[1] + 40];
const PLOT_W = 192;
const PLOT_H = 112;
const AXIS_X = PLOT[0] + 14;
const AXIS_W = 166;
const ZERO_Y = PLOT[1] + 92;
const UNIT = 60;

const plotPoint = (t: number): Vec => [
  AXIS_X + (t / DURATION) * AXIS_W,
  ZERO_Y - valueAt(t) * UNIT,
];

const curve = Array.from({ length: 121 }, (_, i) => plotPoint((i / 120) * DURATION)).reduce(
  (d, point, i) => (i === 0 ? d.moveTo(point) : d.lineTo(point)),
  path(),
);

const clockX = track(0).to(AXIS_W, span(0, DURATION), ease.linear);

// Consumer rows.
const ROW_X = 300;
const ROW_W = 396;
const ROW_H = 56;
const ROW_GAP = 10;
const ROW_TOP = 26;
const PREVIEW_W = 112;
const PREVIEW_H = 40;

const rowY = (i: number): number => ROW_TOP + i * (ROW_H + ROW_GAP);

const previewAt = (i: number): Vec => [ROW_X + ROW_W - 8 - PREVIEW_W, rowY(i) + 8];

interface RowProps {
  readonly index: number;
  readonly dot: Paint;
  readonly name: string;
  readonly api: string;
  readonly children: SceneElement;
}

const Row = ({ index, dot, name, api, children }: RowProps): SceneElement => {
  const y = rowY(index);
  const [px, py] = previewAt(index);

  return (
    <Group>
      <Shape
        geometry={rect(ROW_W, ROW_H, { radius: 10 })}
        at={[ROW_X, y]}
        fill={theme.surface}
        stroke={{ color: theme.raised, width: 1 }}
      />
      <Shape geometry={circle(3.5)} offset={[ROW_X + 18, y + 20]} fill={dot} />
      <Text
        font={mono}
        size={12}
        at={[ROW_X + 28, y + 24]}
        anchor="baseline-left"
        fill={theme.text}
      >
        {name}
      </Text>
      <Text
        font={mono}
        size={11}
        at={[ROW_X + 14, y + 42]}
        anchor="baseline-left"
        fill={theme.muted}
      >
        {api}
      </Text>
      <Shape
        geometry={rect(PREVIEW_W, PREVIEW_H, { radius: 6 })}
        at={[px, py]}
        fill={theme.background}
        stroke={{ color: theme.raised, width: 1 }}
      />
      {children}
    </Group>
  );
};

const connector = (i: number): ReturnType<typeof path> => {
  const from: Vec = [PANEL[0] + PANEL_W, PANEL[1] + PANEL_H / 2];
  const to: Vec = [ROW_X, rowY(i) + ROW_H / 2];
  const mid = (from[0] + to[0]) / 2;

  return path().moveTo(from).curveTo([mid, from[1]], [mid, to[1]], to);
};

const ROWS = [0, 1, 2, 3, 4];

// Previews.
const [o1x, o1y] = previewAt(0);
const LIFT = 14;

const offsetPreview = (
  <Group>
    <Shape
      geometry={rect(40, 14, { radius: 3 })}
      at={[o1x + 36, o1y + 20]}
      stroke={{ color: theme.border, width: 1, dash: [2, 3] }}
    />
    <Shape
      geometry={rect(40, 14, { radius: 3 })}
      offset={signal.map((v): Vec => [o1x + 36, o1y + 20 - LIFT * v])}
      fill={theme.magenta}
    />
  </Group>
);

const [m1x, m1y] = previewAt(1);

const TILES = [
  { key: "a", color: theme.blue, height: 8 },
  { key: "b", color: theme.cyan, height: 16 },
  { key: "c", color: theme.magenta, height: 24 },
  { key: "d", color: theme.green, height: 12 },
] as const;

const gridState = (
  <Group>
    {TILES.map(({ key, color }, i) => (
      <Shape
        key={key}
        geometry={rect(11, 11, { radius: 2.5 })}
        at={[m1x + 44 + (i % 2) * 14, m1y + 6 + Math.floor(i / 2) * 14]}
        fill={color}
      />
    ))}
  </Group>
);

const barsState = (
  <Group>
    {TILES.map(({ key, color, height }, i) => (
      <Shape
        key={key}
        geometry={rect(11, height, { radius: 2.5 })}
        at={[m1x + 30 + i * 14, m1y + 32 - height]}
        fill={color}
      />
    ))}
  </Group>
);

const morphPreview = morph.between(
  [gridState, barsState, gridState],
  [span(UP, 0.7), span(DOWN, 0.7)],
  {
    curve: ease.pop,
    stagger: 0.05,
  },
);

const [a1x, a1y] = previewAt(2);
const [fixed, moving] = [ref(), ref()];

const arrowPreview = (
  <Group>
    <Shape
      ref={fixed}
      geometry={rect(18, 12, { radius: 3 })}
      at={[a1x + 18, a1y + 14]}
      fill={theme.raised}
      stroke={{ color: theme.border, width: 1 }}
    />
    <Shape
      ref={moving}
      geometry={rect(18, 12, { radius: 3 })}
      offset={signal.map((v): Vec => [a1x + 76, a1y + 20 - 12 * v])}
      fill={theme.magenta}
    />
    <Arrow
      from={fixed.right}
      to={moving.left}
      inset={4}
      stroke={{ color: theme.blue, width: 1.5 }}
    />
  </Group>
);

const [d1x, d1y] = previewAt(3);
const RING: Vec = [d1x + PREVIEW_W / 2, d1y + PREVIEW_H / 2];

const drawPreview = (
  <Group>
    <Shape geometry={circle(13)} offset={RING} stroke={{ color: theme.raised, width: 3.5 }} />
    <Shape
      geometry={circle(13)}
      offset={RING}
      origin="center"
      rotate={-90}
      stroke={{ color: theme.green, width: 3.5, cap: "round" }}
      draw={signal.map((v) => clamp(v, 0.02, 1))}
    />
  </Group>
);

const [c1x, c1y] = previewAt(4);

const countPreview = (
  <Text
    font={mono}
    size={16}
    at={[c1x + PREVIEW_W / 2, c1y + PREVIEW_H / 2]}
    anchor="center"
    fill={theme.text}
  >
    {count(
      signal.map((v) => clamp(v) * 100),
      { rate: 16 },
    )}
    %
  </Text>
);

export default scene(
  {
    size: [WIDTH, HEIGHT],
    duration: DURATION,
    title: "How the hero works",
    desc: "One spring track on the left is plotted with a playhead and a live value. Lines fan out from it to five rows, offset, morph, a ref-attached arrow, a drawn ring and a counter, and each row's preview moves in sync with the same track.",
    theme,
    still: 1.4,
  },
  (canvas) => (
    <Group>
      <Shape geometry={canvas.rect} fill={theme.background} />

      {ROWS.map((i) => (
        <Shape geometry={connector(i)} stroke={{ color: theme.border, width: 1, dash: [2, 3] }} />
      ))}
      <Group opacity={signal.map((v) => clamp(0.15 + 0.85 * v))}>
        {ROWS.map((i) => (
          <Shape geometry={connector(i)} stroke={{ color: theme.blue, width: 1.25 }} />
        ))}
      </Group>
      {ROWS.map((i) => (
        <Shape geometry={circle(2.5)} offset={[ROW_X, rowY(i) + ROW_H / 2]} fill={theme.blue} />
      ))}

      <Shape
        geometry={rect(PANEL_W, PANEL_H, { radius: 12 })}
        at={PANEL}
        fill={theme.surface}
        stroke={{ color: theme.raised, width: 1 }}
      />
      <Shape geometry={circle(4)} offset={[PANEL[0] + 18, PANEL[1] + 20]} fill={theme.blue} />
      <Text
        font={mono}
        size={12}
        at={[PANEL[0] + 28, PANEL[1] + 24]}
        anchor="baseline-left"
        fill={theme.text}
      >
        signal
      </Text>
      <Text
        font={mono}
        size={11}
        at={[PANEL[0] + PANEL_W - 14, PANEL[1] + 24]}
        anchor="baseline-right"
        fill={theme.muted}
      >
        track(0)
      </Text>

      <Shape geometry={rect(PLOT_W, PLOT_H, { radius: 8 })} at={PLOT} fill={theme.background} />
      <Shape
        geometry={line([AXIS_X, ZERO_Y - UNIT], [AXIS_X + AXIS_W, ZERO_Y - UNIT])}
        stroke={{ color: theme.border, width: 1, dash: [3, 4] }}
      />
      <Shape
        geometry={line([AXIS_X, ZERO_Y], [AXIS_X + AXIS_W, ZERO_Y])}
        stroke={{ color: theme.border, width: 1 }}
      />
      <Text
        font={mono}
        size={10}
        at={[AXIS_X - 5, ZERO_Y - UNIT]}
        anchor="right"
        fill={theme.muted}
      >
        1
      </Text>
      <Text font={mono} size={10} at={[AXIS_X - 5, ZERO_Y]} anchor="right" fill={theme.muted}>
        0
      </Text>
      <Shape
        geometry={curve}
        stroke={{ color: theme.blue, width: 1.75, join: "round", cap: "round" }}
      />
      <Group
        opacity={track(0)
          .to(1, span(0, 0.15))
          .to(0, span(DURATION - 0.15, 0.15))}
      >
        <Shape
          geometry={line([0, PLOT[1] + 8], [0, ZERO_Y + 8])}
          offset={clockX.map((x): Vec => [AXIS_X + x, 0])}
          stroke={{ color: theme.border, width: 1 }}
          opacity={0.6}
        />
        <Shape
          geometry={circle(4.5)}
          offset={clockX.with(signal).map((x, v): Vec => [AXIS_X + x, ZERO_Y - v * UNIT])}
          fill={theme.blue}
          stroke={{ color: theme.background, width: 2 }}
        />
      </Group>

      <Text
        font={mono}
        size={11}
        at={[PANEL[0] + 16, PANEL[1] + PANEL_H - 18]}
        anchor="baseline-left"
        fill={theme.text}
      >
        v = {count(signal, { format: numeral({ decimals: 2 }), rate: 14 })}
      </Text>
      <Text
        font={mono}
        size={11}
        at={[PANEL[0] + PANEL_W - 14, PANEL[1] + PANEL_H - 18]}
        anchor="baseline-right"
        fill={theme.muted}
      >
        spring 0 → 1 → 0
      </Text>

      <Row index={0} dot={theme.magenta} name="<Stack> offset" api="signal.map(v => [0, -24 * v])">
        {offsetPreview}
      </Row>
      <Row index={1} dot={theme.cyan} name="morph" api="morph.between([grid, bars, grid])">
        {morphPreview}
      </Row>
      <Row index={2} dot={theme.blue} name="<Arrow> ref" api="from={a.right} to={stage.left}">
        {arrowPreview}
      </Row>
      <Row
        index={3}
        dot={theme.green}
        name="<Shape> draw"
        api="geometry={circle(28)} draw={signal}"
      >
        {drawPreview}
      </Row>
      <Row index={4} dot={theme.yellow} name="<Text> count()" api="count(signal.map(v => v * 100))">
        {countPreview}
      </Row>

      <Text
        font={mono}
        size={11}
        at={[WIDTH / 2, HEIGHT - 16]}
        anchor="baseline"
        fill={theme.muted}
      >
        one track · every row moves in sync · no runtime JS
      </Text>
    </Group>
  ),
);

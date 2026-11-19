import {
  Align,
  Arrow,
  Group,
  Shape,
  Stack,
  Text,
  circle,
  count,
  ease,
  line,
  morph,
  path,
  pattern,
  rect,
  ref,
  scene,
  span,
  track,
  type Paint,
  type Ref,
  type SceneElement,
  type Vec,
} from "svjeez";
import { mono, theme } from "../theme";

const spring = ease.spring({ stiffness: 185, damping: 15 });
const forward = span(0.4, spring.settle);
const back = span(3.4, spring.settle);

const signal = track(0).to(1, forward, spring).to(0, back, spring);

const clamp = (v: number, lo = 0, hi = 1): number => Math.max(lo, Math.min(hi, v));

const coil = (v: number) => {
  const top = 52 - 28 * v;
  const bottom = 70;
  const turns = 5;
  const step = (bottom - top) / turns;
  const mid = 69;
  let d = path().moveTo([mid, bottom]);

  for (let i = 1; i < turns; i++) {
    const x = mid + (i % 2 === 1 ? -13 : 13);
    d = d.lineTo([x, bottom - i * step]);
  }

  return d.lineTo([mid, top]);
};

const TILES = [
  { key: "a", color: theme.blue, height: 20 },
  { key: "b", color: theme.cyan, height: 36 },
  { key: "c", color: theme.magenta, height: 50 },
  { key: "d", color: theme.green, height: 30 },
] as const;

const gridState = (
  <Group>
    {TILES.map(({ key, color }, i) => (
      <Shape
        key={key}
        geometry={rect(20, 20, { radius: 5 })}
        at={[50 + (i % 2) * 26, 15 + Math.floor(i / 2) * 26]}
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
        geometry={rect(20, height, { radius: 5 })}
        at={[22 + i * 27, 63 - height]}
        fill={color}
      />
    ))}
  </Group>
);

const [driver, stage, output] = [ref(), ref(), ref()];

interface CardProps {
  readonly handle: Ref;
  readonly dot: Paint;
  readonly title: string;
  readonly tag: string;
  readonly footer: SceneElement;
  readonly width: number;
  readonly lift?: boolean;
  readonly children: SceneElement;
}

const Card = ({
  handle,
  dot,
  title,
  tag,
  footer,
  width,
  lift,
  children,
}: CardProps): SceneElement => (
  <Stack
    ref={handle}
    width={width}
    height={160}
    padding={[14, 12]}
    justify="spread"
    radius={12}
    fill={theme.surface}
    stroke={{ color: theme.border, width: 1 }}
    motion={lift ? { offset: signal.map((v): Vec => [0, -24 * v]) } : undefined}
  >
    <Stack direction="row" width={width - 30} justify="spread" align="center">
      <Stack direction="row" gap={7} align="center">
        <Shape geometry={circle(4)} fill={dot} />
        <Text font={mono} size={12} fill={theme.text}>
          {title}
        </Text>
      </Stack>
      <Text font={mono} size={11} fill={theme.muted}>
        {tag}
      </Text>
    </Stack>
    {children}
    {footer}
  </Stack>
);

const dots = pattern({
  size: [20, 20],
  tile: (
    <Shape geometry={circle(1)} at={[10, 10]} anchor="center" fill={theme.border} opacity={0.35} />
  ),
});

export default scene(
  {
    size: [720, 276],
    duration: 6,
    title: "Composable zero-JS SVG",
    desc: "One spring track stretches a coil with a live readout, lifts a card whose tiles morph from a grid into bars while ref-attached arrows follow its edges, and drives a ring gauge with a zero-JS counter.",
    theme,
    still: 2.5,
  },
  (canvas) => (
    <Group>
      <Shape geometry={canvas.rect} fill={theme.background} />
      <Shape geometry={canvas.rect} fill={dots} />
      <Align place="center" motion={{ offset: [0, 6] }}>
        <Stack direction="row" gap={56} align="center">
          <Card
            handle={driver}
            dot={theme.blue}
            title="track"
            tag="spring"
            width={168}
            footer={
              <Text font={mono} size={11} fill={theme.muted}>
                value {count(signal, { decimals: 2, rate: 14 })}
              </Text>
            }
          >
            <Group>
              <Shape geometry={rect(138, 76, { radius: 8 })} fill={theme.background} />
              <Shape
                geometry={line([14, 24], [124, 24])}
                stroke={{ color: theme.border, width: 1, dash: [3, 4] }}
              />
              <Shape
                geometry={line([34, 70], [104, 70])}
                stroke={{ color: theme.border, width: 2, cap: "round" }}
              />
              <Shape
                geometry={signal.map(coil)}
                stroke={{ color: theme.blue, width: 2.2, cap: "round", join: "round" }}
              />
              <Shape
                geometry={circle(8.5)}
                at={signal.map((v): Vec => [69, 52 - 28 * v])}
                anchor="center"
                fill={theme.blue}
              />
            </Group>
          </Card>

          <Card
            handle={stage}
            dot={theme.magenta}
            title="morph"
            tag="ref()"
            width={176}
            lift
            footer={
              <Text font={mono} size={11} fill={theme.muted}>
                grid → bars · ref()
              </Text>
            }
          >
            <Group>
              <Shape geometry={rect(146, 76, { radius: 8 })} fill={theme.background} />
              {morph.between([gridState, barsState, gridState], [span(0.4, 0.7), span(3.4, 0.7)], {
                curve: ease.pop,
                stagger: 0.05,
              })}
            </Group>
          </Card>

          <Card
            handle={output}
            dot={theme.green}
            title="count"
            tag="0 KB JS"
            width={168}
            footer={
              <Text font={mono} size={11} fill={theme.muted}>
                pure css + smil
              </Text>
            }
          >
            <Group>
              <Shape geometry={rect(138, 76, { radius: 8 })} fill={theme.background} />
              <Shape
                geometry={circle(28)}
                at={[69, 38]}
                anchor="center"
                stroke={{ color: theme.raised, width: 5.5 }}
              />
              <Shape
                geometry={circle(28)}
                at={[69, 38]}
                anchor="center"
                origin="center"
                rotate={-90}
                stroke={{ color: theme.green, width: 5.5, cap: "round" }}
                draw={signal.map((v) => clamp(v, 0.02, 1))}
              />
              <Text font={mono} size={14} at={[69, 38]} anchor="center" fill={theme.text}>
                {count(
                  signal.map((v) => clamp(v) * 100),
                  { rate: 16 },
                )}
                %
              </Text>
            </Group>
          </Card>
        </Stack>
      </Align>

      <Arrow
        from={driver.right}
        to={stage.left}
        inset={8}
        stroke={{ color: theme.blue, width: 2 }}
      />
      <Arrow
        from={stage.right}
        to={output.left}
        inset={8}
        stroke={{ color: theme.magenta, width: 2 }}
      />

      <Align place="bottom" inset={16}>
        <Text font={mono} size={11} fill={theme.muted}>
          one spring track · keyed morph() · moving ref() anchors · zero-JS count()
        </Text>
      </Align>
    </Group>
  ),
);

import {
  Group,
  Sequence,
  Shape,
  Stack,
  Text,
  canvas,
  circle,
  ease,
  pathData,
  rect,
  ref,
  scene,
  span,
  track,
  type SceneElement,
  type Span,
  type Vec,
} from "svjeez";
import { mono, theme } from "../theme";

const DURATION = 9;
const IDLE: Vec = [244, 196];
const RADIUS = 7;
const LINE = 1.5;

const outlined = (width: number, height: number, radius: number) => ({
  geometry: rect(width, height, { radius }),
  stroke: { color: theme.border, width: 1.5 },
});

const keycap = (label: string) => {
  const lit = track(0);

  return {
    node: (
      <Group offset={[16, 184]}>
        <Shape {...outlined(48, 40, 9)} fill={theme.surface} />
        <Shape
          key="lit"
          geometry={rect(48, 40, { radius: 9 })}
          fill={theme.raised}
          stroke={{ color: theme.blue, width: 2 }}
          opacity={lit}
        />
        <Text font={mono} size={14} at={[24, 25]} anchor="baseline" fill={theme.text}>
          {label}
        </Text>
      </Group>
    ),
    press: (held: Span): void => {
      lit.to(1, span(held.start, 0.08)).to(0, span(held.start + held.over - 0.08, 0.08));
    },
  };
};

interface DesktopProps {
  readonly x: number;
  readonly start: number;
  readonly from: Vec;
  readonly to: Vec;
}

const Desktop = ({ x, start, from, to }: DesktopProps): SceneElement => {
  const win = ref("window");
  const cursor = ref("cursor");
  const grip = win.part("titlebar");
  const key = keycap("opt");
  const winAt = track<Vec>(from);
  const cursorAt = track<Vec>(IDLE).to(grip.center, span(0, 0.7), ease.inOut);
  const held = cursorAt.span.next(1.3, 0.05);
  const drag = span(held.start + 0.15, 1);

  key.press(held);
  winAt.to(to, drag, ease.inOut);
  cursorAt.to(grip.center, drag, ease.inOut).to(IDLE, held.next(0.5, 0.1), ease.inOut);
  winAt.to(from, span(DURATION - start - 0.8, 0.8), ease.out);

  return (
    <Group offset={[x, 30]}>
      <Shape
        geometry={rect(290, 240, { radius: 14 })}
        fill={theme.background}
        stroke={{ color: theme.raised, width: 1.5 }}
      />
      <Sequence when={span(start)}>
        {key.node}
        <Stack
          ref={win}
          at={winAt}
          width={104}
          height={72}
          align="stretch"
          radius={RADIUS}
          fill={theme.surface}
          stroke={{ color: theme.border, width: LINE }}
        >
          <Stack
            key="titlebar"
            direction="row"
            gap={5}
            padding={[9, 5]}
            radius={[RADIUS - LINE / 2, RADIUS - LINE / 2, 0, 0]}
            fill={theme.raised}
          >
            <Shape geometry={circle(3)} fill={theme.red} />
            <Shape geometry={circle(3)} fill={theme.yellow} />
            <Shape geometry={circle(3)} fill={theme.green} />
          </Stack>
          <Stack gap={7} padding={[13, 11]}>
            <Shape geometry={rect(60, 5, { radius: 2.5 })} fill={theme.border} />
            <Shape geometry={rect(44, 5, { radius: 2.5 })} fill={theme.border} />
          </Stack>
        </Stack>
        <Shape
          ref={cursor}
          geometry={pathData("M0 0V16l4.2-3.8 3 6.8 2.8-1.2-3-6.6H12Z")}
          fill={theme.text}
          stroke={{ color: theme.background, width: 1.2, join: "round" }}
          at={cursorAt}
        />
      </Sequence>
    </Group>
  );
};

export default scene(
  {
    size: [640, 300],
    duration: DURATION,
    title: "A clip",
    desc: "Two desktops play one gesture a few seconds apart: a cursor takes a window by its title bar and drags it while a key is held, then the window goes back.",
    theme,
    reducedMotion: 2,
  },
  () => (
    <Group>
      <Shape geometry={canvas.rect} fill={theme.background} />
      <Desktop x={20} start={1} from={[28, 36]} to={[150, 110]} />
      <Desktop x={330} start={4.4} from={[28, 96]} to={[150, 36]} />
    </Group>
  ),
);

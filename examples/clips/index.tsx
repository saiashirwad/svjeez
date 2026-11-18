/** @jsxImportSource svjeez/scene */
import {
  Group,
  Sequence,
  Shape,
  Stack,
  Text,
  canvas,
  circle,
  ease,
  rect,
  scene,
  show,
  span,
  svgPath,
  track,
  type SceneElement,
  type Span,
  type Vec,
} from "svjeez/scene";
import { mono, theme } from "../theme";

const reach = span(0, 0.7);
const grab = reach.next(1, 0.2);
const down = grab.pad(0.15);
const leave = span(down.end + 0.1, 0.5);

const IDLE: Vec = [244, 196];

const grip = ([x, y]: Vec): Vec => [x + 52, y + 9];

const outlined = (width: number, height: number, radius: number) => ({
  geometry: rect(width, height, { radius }),
  stroke: { color: theme.border, width: 1.5 },
});

interface WindowProps {
  readonly from: Vec;
  readonly to: Vec;
  readonly drag: Span;
}

const Window = ({ from, to, drag }: WindowProps): SceneElement => (
  <Group at={track(from).to(to, drag, ease.inOut).rewind(0.8)}>
    <Shape {...outlined(104, 72, 7)} fill={theme.surface} />
    <Shape key="titlebar" geometry={rect(104, 18, { radius: [7, 7, 0, 0] })} fill={theme.raised} />
    <Stack direction="row" gap={5} at={[10, 6]}>
      <Shape geometry={circle(3)} fill={theme.red} />
      <Shape geometry={circle(3)} fill={theme.yellow} />
      <Shape geometry={circle(3)} fill={theme.green} />
    </Stack>
    <Stack gap={7} at={[14, 30]}>
      <Shape geometry={rect(60, 5, { radius: 2.5 })} fill={theme.border} />
      <Shape geometry={rect(44, 5, { radius: 2.5 })} fill={theme.border} />
    </Stack>
  </Group>
);

const Key = ({ label, held }: { readonly label: string; readonly held: Span }): SceneElement => (
  <Group at={[16, 184]}>
    <Shape {...outlined(48, 40, 9)} fill={theme.surface} />
    <Shape
      geometry={rect(48, 40, { radius: 9 })}
      fill={theme.blue}
      opacity={show(held, { fade: 0.08 })}
    />
    <Text font={mono} size={14} at={[24, 25]} align="center" fill={theme.text}>
      {label}
    </Text>
  </Group>
);

interface CursorProps {
  readonly from: Vec;
  readonly moves: readonly (readonly [Vec, Span])[];
}

const Cursor = ({ from, moves }: CursorProps): SceneElement => {
  let at = track(from);

  for (const [to, when] of moves) at = at.to(to, when, ease.inOut);

  return (
    <Shape
      geometry={svgPath("M0 0V16l4.2-3.8 3 6.8 2.8-1.2-3-6.6H12Z")}
      fill={theme.text}
      stroke={{ color: theme.background, width: 1.2, join: "round" }}
      at={at}
    />
  );
};

interface DesktopProps {
  readonly x: number;
  readonly at: number;
  readonly from: Vec;
  readonly to: Vec;
}

const Desktop = ({ x, at, from, to }: DesktopProps): SceneElement => (
  <Group at={[x, 30]}>
    <Shape
      geometry={rect(290, 240, { radius: 14 })}
      fill={theme.background}
      stroke={{ color: theme.raised, width: 1.5 }}
    />
    <Sequence at={at}>
      <Key label="opt" held={down} />
      <Window from={from} to={to} drag={grab} />
      <Cursor
        from={IDLE}
        moves={[
          [grip(from), reach],
          [grip(to), grab],
          [IDLE, leave],
        ]}
      />
    </Sequence>
  </Group>
);

export default scene(
  {
    size: [640, 300],
    duration: 9,
    title: "A clip",
    desc: "Two desktops play one gesture a few seconds apart: a cursor takes a window by its title bar and drags it while a key is held, then the window goes back.",
    theme,
    reducedMotion: { at: 2 },
  },
  () => (
    <Group>
      <Shape geometry={canvas.rect} fill={theme.background} />
      <Desktop x={20} at={1} from={[28, 36]} to={[150, 110]} />
      <Desktop x={330} at={4.4} from={[28, 96]} to={[150, 36]} />
    </Group>
  ),
);

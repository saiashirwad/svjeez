import {
  Group,
  Sequence,
  Shape,
  Stack,
  Text,
  canvas,
  circle,
  ease,
  par,
  pathData,
  rect,
  ref,
  scene,
  seq,
  timeline,
  wait,
  type Action,
  type SceneElement,
  type Vec,
} from "svjeez";
import { mono, theme } from "../theme";

const IDLE: Vec = [244, 196];

const outlined = (width: number, height: number, radius: number) => ({
  geometry: rect(width, height, { radius }),
  stroke: { color: theme.border, width: 1.5 },
});

const keycap = (label: string) => {
  const cap = ref("key");
  const lit = cap.part("lit");

  return {
    node: (
      <Group ref={cap} at={[16, 184]}>
        <Shape {...outlined(48, 40, 9)} fill={theme.surface} />
        <Shape
          key="lit"
          geometry={rect(48, 40, { radius: 9 })}
          fill={theme.raised}
          stroke={{ color: theme.blue, width: 2 }}
          opacity={0}
        />
        <Text font={mono} size={14} at={[24, 25]} anchor="baseline" fill={theme.text}>
          {label}
        </Text>
      </Group>
    ),
    press: (hold: number): Action => seq(lit.show(0.08), wait(hold - 0.16), lit.hide(0.08)),
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

  const gesture = timeline(
    cursor.move(grip, 0.7, ease.inOut),
    wait(0.05),
    par(
      key.press(1.3),
      seq(wait(0.15), par(win.move(to, 1, ease.inOut), cursor.move(grip, 1, ease.inOut))),
    ),
    wait(0.1),
    cursor.move(IDLE, 0.5, ease.inOut),
    win.rewind(0.8),
  );

  return (
    <Group at={[x, 30]}>
      <Shape
        geometry={rect(290, 240, { radius: 14 })}
        fill={theme.background}
        stroke={{ color: theme.raised, width: 1.5 }}
      />
      <Sequence start={start} timeline={gesture}>
        {key.node}
        <Group ref={win} at={from}>
          <Shape {...outlined(104, 72, 7)} fill={theme.surface} />
          <Shape
            key="titlebar"
            geometry={rect(104, 18, { radius: [7, 7, 0, 0] })}
            fill={theme.raised}
          />
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
        <Shape
          ref={cursor}
          geometry={pathData("M0 0V16l4.2-3.8 3 6.8 2.8-1.2-3-6.6H12Z")}
          fill={theme.text}
          stroke={{ color: theme.background, width: 1.2, join: "round" }}
          at={IDLE}
        />
      </Sequence>
    </Group>
  );
};

export default scene(
  {
    size: [640, 300],
    duration: 9,
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

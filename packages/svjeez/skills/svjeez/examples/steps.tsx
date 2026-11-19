/** @jsxImportSource svjeez */
import {
  Align,
  Center,
  Group,
  Sequence,
  Shape,
  Stack,
  Text,
  circle,
  ease,
  enter,
  exit,
  rect,
  scene,
  span,
  track,
  type Paint,
  type SceneElement,
  type Span,
  type Vec,
} from "svjeez";
import { sans, theme } from "./style";

const [WIDTH, HEIGHT] = [52, 26];

/** A switch that turns on over `when`: the body and the rim are two chains from one base track. */
const Toggle = ({ label, when }: { readonly label: string; readonly when: Span }): SceneElement => {
  const base = track<Paint>(theme.raised);
  const body = base.to(theme.green, when);
  const rim = base.to(theme.green, when.next(0.2));
  const knob = track<Vec>([13, 13]).to([WIDTH - 13, 13], when, ease.pop);

  return (
    <Stack direction="row" gap={14} align="center" width={220} justify="spread">
      <Text font={sans} size={14} fill={theme.text}>
        {label}
      </Text>
      <Group>
        <Shape
          geometry={rect(WIDTH, HEIGHT, { radius: HEIGHT / 2 })}
          fill={body}
          stroke={{ color: rim, width: 1.5 }}
        />
        <Shape geometry={circle(9)} at={knob} anchor="center" fill="#FFFFFF" />
      </Group>
    </Stack>
  );
};

/** Written from 0 on its own clock: the <Sequence> that holds it says when it starts. */
const Saved = (): SceneElement => (
  <Center width={92} height={26} radius={13} fill={theme.green} motion={enter(span(0, 0.3))}>
    <Text font={sans} weight={600} size={12} fill={theme.background}>
      Saved
    </Text>
  </Center>
);

const [first, second, third] = span(0.5, 0.45).cascade(3, 0.6);
const saved = third.end + 0.4;

export default scene(
  {
    size: [320, 220],
    duration: 6,
    title: "Settings",
    desc: "Three switches turn on one after another, then a Saved badge appears and everything leaves before the loop restarts.",
    theme,
    still: 4,
  },
  (canvas) => (
    <Group>
      <Shape geometry={canvas.rect} fill={theme.background} />
      <Align>
        <Stack
          gap={16}
          padding={22}
          align="center"
          radius={14}
          fill={theme.surface}
          stroke={{ color: theme.border, width: 1 }}
          motion={exit(span(5.4, 0.4))}
        >
          <Toggle label="Notifications" when={first} />
          <Toggle label="Dark mode" when={second} />
          <Toggle label="Autosave" when={third} />
          <Sequence when={span(saved)}>
            <Saved />
          </Sequence>
        </Stack>
      </Align>
    </Group>
  ),
);

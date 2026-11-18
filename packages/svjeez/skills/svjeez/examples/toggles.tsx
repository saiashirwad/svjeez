/** @jsxImportSource svjeez */
import {
  Align,
  Group,
  Shape,
  Stack,
  Text,
  canvas,
  circle,
  ease,
  enter,
  par,
  pathData,
  rect,
  ref,
  scene,
  seq,
  span,
  timeline,
  wait,
  type Action,
  type Ref,
  type SceneElement,
  type Vec,
} from "svjeez";
import { sans, theme } from "./style";

const ROW: Vec = [300, 52];
const IDLE: Vec = [400, 230];
const flick = ease.spring({ stiffness: 320, damping: 22 });

/**
 * A switch and the verb that flips it on. A component makes its own refs and returns the actions that move them,
 * so the scene's timeline reads as a script: move there, press, flip.
 */
const toggle = (name: string) => {
  const handle = ref(name);
  const knob = handle.part("knob");
  const groove = handle.part("groove");

  return {
    handle,
    node: (
      <Group ref={handle}>
        <Shape key="groove" geometry={rect(44, 24, { radius: 12 })} fill={theme.raised} />
        <Shape key="knob" geometry={circle(9)} at={[3, 3]} fill="#FFFFFF" />
      </Group>
    ),
    on: par(knob.moveBy([20, 0], flick.settle, flick), groove.fill(theme.blue, 0.2)),
    /** Back off at the end of the clock: a rewind takes no time in a seq, it always runs last. */
    off: par(knob.rewind(0.5), groove.rewind(0.5)),
  };
};

/** A settings row: its label at the left edge, its switch at the right, both centered down the row. */
const Row = ({ label, children }: { readonly label: string; readonly children: SceneElement }) => {
  const row: Ref = ref("row");

  return (
    <Group>
      <Shape ref={row} geometry={rect(ROW[0], ROW[1], { radius: 10 })} fill={theme.surface} />
      <Align to={row} place="left" inset={16}>
        <Text font={sans} size={14} fill={theme.text}>
          {label}
        </Text>
      </Align>
      <Align to={row} place="right" inset={14}>
        {children}
      </Align>
    </Group>
  );
};

export default scene(
  {
    size: [480, 280],
    duration: 6,
    title: "Settings",
    desc: "A cursor turns on two switches in a settings panel, one after the other, then both switch back off before the loop.",
    theme,
    reducedMotion: 3.6,
  },
  () => {
    const cursor = ref("cursor");
    const dark = toggle("dark");
    const alerts = toggle("alerts");

    /** A click: the cursor dips and comes back. */
    const press = (): Action => seq(cursor.scale(0.85, 0.08), cursor.scale(1, 0.12));

    timeline(
      wait(0.4),
      cursor.move(dark.handle.center, 0.8, ease.inOut),
      press(),
      dark.on,
      wait(0.3),
      cursor.move(alerts.handle.center, 0.6, ease.inOut),
      press(),
      alerts.on,
      wait(0.4),
      cursor.move(IDLE, 0.7, ease.inOut),
      dark.off,
      alerts.off,
    );

    return (
      <Group>
        <Shape geometry={canvas.rect} fill={theme.background} />
        <Align>
          <Stack gap={8} motion={enter(span(0, 0.4), { from: { opacity: 0, offset: [0, 8] } })}>
            <Text font={sans} weight={600} size={16} fill={theme.text}>
              Settings
            </Text>
            <Row label="Dark mode">{dark.node}</Row>
            <Row label="Notifications">{alerts.node}</Row>
          </Stack>
        </Align>
        <Shape
          ref={cursor}
          geometry={pathData("M0 0V16l4.2-3.8 3 6.8 2.8-1.2-3-6.6H12Z")}
          at={IDLE}
          motion={enter(span(0.1, 0.3))}
          fill={theme.text}
          stroke={{ color: theme.background, width: 1.2, join: "round" }}
        />
      </Group>
    );
  },
);

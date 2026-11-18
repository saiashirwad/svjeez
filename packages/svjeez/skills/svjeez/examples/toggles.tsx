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
  type SceneElement,
  type Vec,
} from "svjeez";
import { sans, theme } from "./style";

const IDLE: Vec = [400, 230];
const flick = ease.spring({ stiffness: 320, damping: 22 });

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
    on: par(knob.moveBy([20, 0], flick), groove.fill(theme.blue, 0.2)),
    off: handle.rewind(0.5),
  };
};

const Row = ({ label, children }: { readonly label: string; readonly children: SceneElement }) => (
  <Stack
    direction="row"
    justify="space-between"
    align="center"
    width={300}
    height={52}
    padding={[16, 0]}
    radius={10}
    fill={theme.surface}
  >
    <Text font={sans} size={14} fill={theme.text}>
      {label}
    </Text>
    {children}
  </Stack>
);

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

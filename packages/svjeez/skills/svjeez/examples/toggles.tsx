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
  pathData,
  rect,
  ref,
  scene,
  span,
  type SceneElement,
  type Span,
  type Vec,
} from "svjeez";
import { sans, theme } from "./style";

const DURATION = 6;
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
    on: (after: Span) => {
      groove.to({ fill: theme.blue }, after.next(0.2));

      return knob.move([23, 3], after.next(flick.settle), flick);
    },
    off: (when: Span) => {
      groove.to({ fill: theme.raised }, when);
      knob.move([3, 3], when);
    },
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
    duration: DURATION,
    title: "Settings",
    desc: "A cursor turns on two switches in a settings panel, one after the other, then both switch back off before the loop.",
    theme,
    reducedMotion: 3.6,
  },
  () => {
    const cursor = ref("cursor");
    const dark = toggle("dark");
    const alerts = toggle("alerts");

    const press = (after: Span) =>
      cursor.to({ scale: 1 }, cursor.to({ scale: 0.85 }, after.next(0.08)).next(0.12));

    const darkOn = dark.on(press(cursor.move(dark.handle.center, span(0.4, 0.8), ease.inOut)));
    const toAlerts = cursor.move(alerts.handle.center, darkOn.next(0.6, 0.3), ease.inOut);
    const alertsOn = alerts.on(press(toAlerts));
    const back = span(DURATION - 0.5, 0.5);

    cursor.move(IDLE, alertsOn.next(0.7, 0.4), ease.inOut);
    dark.off(back);
    alerts.off(back);

    return (
      <Group>
        <Shape geometry={canvas.rect} fill={theme.background} />
        <Align>
          <Stack gap={8}>
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
          fill={theme.text}
          stroke={{ color: theme.background, width: 1.2, join: "round" }}
        />
      </Group>
    );
  },
);

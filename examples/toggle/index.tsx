import {
  Group,
  Sequence,
  Shape,
  Text,
  circle,
  clock,
  ease,
  rect,
  scene,
  span,
  track,
  type Vec,
} from "svjeez";
import { geist } from "../fonts/faces";
import { theme } from "../theme";

const flip = clock("flip", span(0.6, 0.4));

// The machines page inlines several scenes, so each keeps its ids to itself.
export const prefix = "toggle-";

export default scene(
  {
    size: [360, 220],
    duration: 2,
    title: "Toggle",
    desc: "A switch with two states on one clock: the knob slides, the track turns green and the label crossfades from Off to On. Page code rests the clock at 0 or 1 and flips it on a click, from wherever it is.",
    theme,
    loop: false,
    states: { off: { flip: 0 }, on: { flip: 1 } },
  },
  (canvas) => (
    <Group>
      <Shape geometry={canvas.rect} fill={theme.background} />
      <Text font={geist} weight={600} size={16} at={[180, 52]} anchor="baseline" fill={theme.text}>
        Notifications
      </Text>
      <Group hit="switch" offset={[120, 78]}>
        <Sequence clock={flip}>
          <Shape
            geometry={rect(120, 64, { radius: 32 })}
            fill={track(theme.raised).to(theme.green, span(0, 0.4))}
          />
          <Shape
            geometry={circle(26)}
            at={track<Vec>([32, 32]).to([88, 32], span(0, 0.4), ease.inOut)}
            anchor="center"
            fill="#FFFFFF"
          />
          <Text
            font={geist}
            size={15}
            at={[60, 104]}
            anchor="baseline"
            fill={theme.muted}
            opacity={track(1).to(0, span(0, 0.2))}
          >
            Off
          </Text>
          <Text
            font={geist}
            size={15}
            at={[60, 104]}
            anchor="baseline"
            fill={theme.text}
            opacity={track(0).to(1, span(0.2, 0.2))}
          >
            On
          </Text>
        </Sequence>
      </Group>
    </Group>
  ),
);

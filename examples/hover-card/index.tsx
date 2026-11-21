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

// One clock holds the whole hover: the lift, the shadow and the detail row each take their part of it.
const hover = clock("hover", span(0.6, 0.5));

const lift = span(0, 0.3);
const reveal = span(0.15, 0.35);

// The machines page inlines several scenes, so each keeps its ids to itself.
export const prefix = "card-";

export default scene(
  {
    size: [400, 260],
    duration: 2,
    title: "Hover card",
    desc: "A trail card that lifts, casts a shadow and reveals a detail row, all on one clock. Page code rests the clock at 1 when the pointer enters the card and at 0 when it leaves, so a quick in and out reverses smoothly.",
    theme,
    loop: false,
  },
  (canvas) => (
    <Group>
      <Shape geometry={canvas.rect} fill={theme.background} />
      <Group offset={[80, 50]}>
        <Sequence clock={hover}>
          <Shape
            geometry={rect(226, 120, { radius: 18 })}
            at={[7, 20]}
            fill={theme.text}
            opacity={track(0).to(0.05, lift, ease.out)}
          />
          <Shape
            geometry={rect(212, 112, { radius: 16 })}
            at={[14, 26]}
            fill={theme.text}
            opacity={track(0).to(0.1, lift, ease.out)}
          />
          <Group hit="card" offset={track<Vec>([0, 0]).to([0, -8], lift, ease.out)}>
            <Shape
              geometry={track(rect(240, 96, { radius: 16 })).to(
                rect(240, 140, { radius: 16 }),
                reveal,
                ease.out,
              )}
              fill={theme.surface}
              stroke={{ color: theme.raised, width: 1.5 }}
            />
            <Shape geometry={circle(15)} at={[34, 36]} anchor="center" fill={theme.green} />
            <Text
              font={geist}
              weight={600}
              size={15}
              at={[60, 34]}
              anchor="baseline-left"
              fill={theme.text}
            >
              Aurora Lake Trail
            </Text>
            <Text font={geist} size={12} at={[60, 54]} anchor="baseline-left" fill={theme.muted}>
              4.2 km, easy
            </Text>
            <Group
              offset={track<Vec>([0, 8]).to([0, 0], reveal, ease.out)}
              opacity={track(0).to(1, reveal, ease.out)}
            >
              <Shape geometry={rect(200, 1.5)} at={[20, 82]} fill={theme.raised} />
              <Text font={geist} size={12} at={[20, 112]} anchor="baseline-left" fill={theme.text}>
                Open 6am to 9pm
              </Text>
              <Text
                font={geist}
                size={12}
                at={[220, 112]}
                anchor="baseline-right"
                fill={theme.muted}
              >
                4.8 stars
              </Text>
            </Group>
          </Group>
        </Sequence>
      </Group>
    </Group>
  ),
);

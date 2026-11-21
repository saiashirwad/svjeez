import {
  Align,
  Arrow,
  Group,
  Shape,
  Stack,
  Text,
  circle,
  ease,
  enter,
  ref,
  scene,
  span,
  track,
  type Paint,
  type Ref,
  type SceneElement,
  type Span,
  type Vec,
} from "svjeez";
import { geist } from "../fonts/faces";
import { mono, theme } from "../theme";

const sans = geist.face(400);

const TEXT = 125;

interface CardProps {
  readonly handle: Ref;
  readonly title: string;
  readonly dot: Paint;
  readonly when: Span;
  readonly children: string;
  readonly drift?: boolean;
}

const Card = ({ handle, title, dot, when, children, drift }: CardProps): SceneElement => (
  <Stack
    ref={handle}
    gap={10}
    padding={14}
    height={112}
    radius={10}
    fill={theme.surface}
    stroke={{ color: theme.raised, width: 1.5 }}
    motion={[
      enter(when, { from: { offset: [0, 10] } }),
      drift && {
        offset: track<Vec>([0, 0])
          .to([0, 56], span(3.2, 1.1), ease.inOut)
          .to([0, 0], span(5.2, 1.1), ease.inOut),
      },
    ]}
  >
    <Stack direction="row" gap={8} align="center">
      <Shape geometry={circle(4)} fill={dot} />
      <Text font={mono} size={13} fill={theme.text}>
        {title}
      </Text>
    </Stack>
    <Text font={sans} size={12.5} lineHeight={1.4} width={TEXT} fill={theme.muted}>
      {children}
    </Text>
  </Stack>
);

const [measure, place, follow] = [ref(), ref(), ref()];
const [first, second, third] = span(0.3, 0.5).cascade(3, 0.25);

export default scene(
  {
    size: [640, 300],
    duration: 7,
    title: "Layout",
    desc: "Three cards in a row, each with a title and wrapped text laid out inside it. Arrows join them by their edges, and when the last card drifts down and back, the arrow into it follows.",
    theme,
    still: 2.4,
  },
  (canvas) => (
    <Group>
      <Shape geometry={canvas.rect} fill={theme.background} />
      <Group opacity={track(1).to(0, span(6.4, 0.5))}>
        <Align place="center">
          <Stack direction="row" gap={50}>
            <Card handle={measure} title="Measure" dot={theme.yellow} when={first}>
              Every node has a box the compiler knows, its text included.
            </Card>
            <Card handle={place} title="Place" dot={theme.green} when={second}>
              Stacks and grids put each box in its slot, wherever its origin is.
            </Card>
            <Card handle={follow} title="Follow" dot={theme.cyan} when={third} drift>
              Arrows attach to edges and follow the node when it moves.
            </Card>
          </Stack>
        </Align>
        <Arrow
          from={measure.right}
          to={place.left}
          inset={6}
          stroke={{ color: theme.blue }}
          draw={track(0).to(1, span(1.5, 0.5))}
        />
        <Arrow
          from={place.right}
          to={follow.left}
          inset={6}
          stroke={{ color: theme.blue }}
          draw={track(0).to(1, span(1.9, 0.5))}
        />
      </Group>
      <Align place="bottom" inset={22}>
        <Text font={mono} size={11} fill={theme.border}>
          each arrow is attached to two cards' edges, not to coordinates
        </Text>
      </Align>
    </Group>
  ),
);

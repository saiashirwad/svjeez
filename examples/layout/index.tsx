import {
  Align,
  Arrow,
  Group,
  Shape,
  Stack,
  Text,
  canvas,
  circle,
  draw,
  ease,
  enter,
  motion,
  rect,
  ref,
  scene,
  span,
  type Paint,
  type Ref,
  type SceneElement,
  type Span,
} from "svjeez";
import { geist } from "../fonts/faces";
import { mono, theme } from "../theme";

const sans = geist.face(400);

const WIDTH = 156;

const PAD = 14;

interface CardProps {
  readonly handle: Ref;
  readonly title: string;
  readonly dot: Paint;
  readonly when: Span;
  readonly children: string;
  readonly drift?: boolean;
}

/** A card whose size is set and whose text is laid out inside it: a dot and a title in a row, then a wrapped body. */
const Card = ({ handle, title, dot, when, children, drift }: CardProps): SceneElement => (
  <Group
    ref={handle}
    motion={[
      enter(when, { from: { opacity: 0, offset: [0, 10] } }),
      drift &&
        motion()
          .to({ offset: [0, 56] }, span(3.2, 1.1), ease.inOut)
          .to({ offset: [0, 0] }, span(5.2, 1.1), ease.inOut),
    ]}
  >
    <Shape
      geometry={rect(WIDTH, 112, { radius: 10 })}
      fill={theme.surface}
      stroke={{ color: theme.raised, width: 1.5 }}
    />
    <Stack gap={10} padding={PAD}>
      <Stack direction="row" gap={8} align="center">
        <Shape geometry={circle(4)} fill={dot} />
        <Text font={mono} size={13} fill={theme.text}>
          {title}
        </Text>
      </Stack>
      <Text font={sans} size={12.5} lineHeight={1.4} width={WIDTH - PAD * 2} fill={theme.muted}>
        {children}
      </Text>
    </Stack>
  </Group>
);

const [measure, place, follow] = [ref("measure"), ref("place"), ref("follow")];
const [first, second, third] = span(0.3, 0.5).cascade(3, 0.25);

export default scene(
  {
    size: [640, 300],
    duration: 7,
    title: "Layout",
    desc: "Three cards in a row, each with a title and wrapped text laid out inside it. Arrows join them by their edges, and when the last card drifts down and back, the arrow into it follows.",
    theme,
    reducedMotion: 2.4,
  },
  () => (
    <Group>
      <Shape geometry={canvas.rect} fill={theme.background} />
      <Align place="center">
        <Stack direction="row" gap={50}>
          <Card handle={measure} title="Measure" dot={theme.yellow} when={first!}>
            Every node has a box the compiler knows, its text included.
          </Card>
          <Card handle={place} title="Place" dot={theme.green} when={second!}>
            Stacks and grids put each box in its slot, wherever its origin is.
          </Card>
          <Card handle={follow} title="Follow" dot={theme.cyan} when={third!} drift>
            Arrows attach to edges and follow the node when it moves.
          </Card>
        </Stack>
      </Align>
      <Arrow
        from={measure.right}
        to={place.left}
        inset={6}
        stroke={{ color: theme.blue }}
        trim={draw(span(1.5, 0.5))}
      />
      <Arrow
        from={place.right}
        to={follow.left}
        inset={6}
        stroke={{ color: theme.blue }}
        trim={draw(span(1.9, 0.5))}
      />
      <Align place="bottom" inset={22}>
        <Text font={mono} size={11} fill={theme.border}>
          each arrow is attached to two cards' edges, not to coordinates
        </Text>
      </Align>
    </Group>
  ),
);

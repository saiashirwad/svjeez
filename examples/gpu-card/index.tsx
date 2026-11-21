import {
  Arrow,
  Center,
  Group,
  Sequence,
  Shape,
  Slot,
  Stack,
  Text,
  circle,
  clock,
  ease,
  line,
  linear,
  mix,
  rect,
  ref,
  scene,
  span,
  spread,
  track,
  type Anim,
  type Color,
  type SceneElement,
  type Vec,
} from "svjeez";
import { geist } from "../fonts/faces";
import { mono, theme } from "../theme";

// The React widgets page inlines several scenes, so each keeps its ids to itself.
export const prefix = "gpu-card-";

const WIDTH = 520;
const FIELD = 220;
const RADIUS = 12;

/** The page moves this clock between calm (0) and storm (1); a shader in the slot reads where it is. */
const storm = clock("storm", span(1.4, 1.2));

const states = { calm: { storm: 0 }, storm: { storm: 1 } };

const field = ref();

// The field's ground, in both schemes a shade of the card: deep in dark, pale in light.
const ground = mix(theme.blue, theme.background, 0.1);

const glow = (colors: readonly Color[], share: number) =>
  colors.map((one) => mix(one, ground, share));

// The sky turns evenly over the whole clock, as the shader reads it. Words swap halfway: the calm ones go over the
// first half and the stormy ones come over the second, so the two never sit on each other.
const turning = (): Anim<number> => track(0).to(1, span(0, storm.over), ease.linear);
const HALF = storm.over / 2;
const fading = (): Anim<number> => track(1).to(0, span(0, HALF), ease.linear);
const rising = (): Anim<number> => track(0).to(1, span(HALF, HALF), ease.linear);

const Sky = ({
  colors,
  opacity,
}: {
  readonly colors: readonly Color[];
  readonly opacity?: Anim<number>;
}) => (
  <Shape
    geometry={rect(WIDTH, FIELD, { radius: RADIUS })}
    fill={linear.across({ angle: 160, stops: glow(colors, 0.55) })}
    opacity={opacity}
  />
);

/** The fallback: a still aurora of gradients, what the plain SVG and a page with no WebGPU show. */
const Still = (): SceneElement => (
  <Center>
    <Shape geometry={rect(WIDTH, FIELD, { radius: RADIUS })} fill={ground} />
    <Sky colors={[ground, theme.cyan, theme.blue, ground]} />
    <Sequence clock={storm}>
      <Sky colors={[ground, theme.magenta, theme.orange, ground]} opacity={turning()} />
    </Sequence>
  </Center>
);

const Pill = ({
  text,
  color,
  opacity,
}: {
  readonly text: string;
  readonly color: Color;
  readonly opacity?: Anim<number>;
}) => (
  <Center
    width={88}
    height={26}
    radius={13}
    fill={mix(color, theme.surface, 0.14)}
    opacity={opacity}
  >
    <Stack direction="row" gap={7} align="center">
      <Shape geometry={circle(3.5)} fill={color} />
      <Text
        font={geist}
        weight={600}
        size={11}
        letterSpacing={1}
        fill={mix(color, theme.text, 0.62)}
      >
        {text}
      </Text>
    </Stack>
  </Center>
);

const TICKS = 26;
const STEP = WIDTH / (TICKS - 1);

/** A scale under the field: a tick every 20 Hz, a long one with its number every 100. */
const Scale = (): SceneElement => (
  <Group>
    {Array.from({ length: TICKS }, (_, index) => {
      const major = index % 5 === 0;
      const x = index * STEP;

      return (
        <Group>
          <Shape
            geometry={line([x, 0], [x, major ? 8 : 4])}
            stroke={{ color: theme.muted, width: 1 }}
          />
          {major && (
            <Text
              font={mono}
              size={10}
              fill={theme.muted}
              at={[x, 12]}
              anchor={index === 0 ? "top-left" : index === TICKS - 1 ? "top-right" : "top"}
            >
              {String(index * 20)}
            </Text>
          )}
        </Group>
      );
    })}
  </Group>
);

/** A readout whose value is `calm` at rest and `stormy` once the storm clock has run. */
const Readout = ({
  label,
  calm,
  stormy,
}: {
  readonly label: string;
  readonly calm: string;
  readonly stormy: string;
}) => (
  <Stack gap={4}>
    <Text font={mono} size={10} letterSpacing={1} fill={theme.muted}>
      {label}
    </Text>
    <Sequence clock={storm}>
      <Group>
        <Text font={mono} size={15} fill={theme.text} opacity={fading()}>
          {calm}
        </Text>
        <Text font={mono} size={15} fill={mix(theme.orange, theme.text, 0.35)} opacity={rising()}>
          {stormy}
        </Text>
      </Group>
    </Sequence>
  </Stack>
);

export default scene(
  {
    size: [WIDTH + 42, 418],
    duration: 4,
    title: "Signal",
    desc: "A signal card. Its title, a calm or storm badge, a scale and three readouts are vectors; the field in the middle is a slot that a page fills with a live WebGPU shader, and shows a still gradient aurora without one. Here the card goes from calm to storm: the badge turns orange, the readouts climb and the aurora turns from cyan and blue to magenta and orange.",
    theme,
    loop: false,
    still: 3.6,
    states,
  },
  () => (
    <Group>
      <Stack
        at={[1, 1]}
        gap={16}
        padding={20}
        radius={20}
        fill={theme.surface}
        stroke={{ color: theme.raised, width: 1 }}
      >
        <Stack direction="row" justify={spread} align="center" width={WIDTH}>
          <Stack gap={5}>
            <Text font={geist} weight={600} size={18} fill={theme.text}>
              Signal
            </Text>
            <Text font={mono} size={11} fill={theme.muted}>
              ch 07 · 2.4 GHz · aurora
            </Text>
          </Stack>
          <Sequence clock={storm}>
            <Center>
              <Pill text="CALM" color={theme.cyan} opacity={fading()} />
              <Pill text="STORM" color={theme.orange} opacity={rising()} />
            </Center>
          </Sequence>
        </Stack>
        <Slot ref={field} name="field" width={WIDTH} height={FIELD}>
          <Still />
        </Slot>
        <Scale />
        <Stack direction="row" justify={spread} width={WIDTH}>
          <Readout label="AMPLITUDE" calm="0.18 V" stormy="0.92 V" />
          <Readout label="FLOW" calm="0.4 m/s" stormy="3.1 m/s" />
          <Readout label="NOISE" calm="-62 dB" stormy="-31 dB" />
        </Stack>
      </Stack>
      <Center
        at={field.topRight.map(([x, y]): Vec => [x - 16, y + 16])}
        anchor="top-right"
        radius={6}
        fill={mix(theme.background, ground, 0.2)}
        padding={[8, 4]}
      >
        <Text font={mono} size={10} letterSpacing={0.5} fill={theme.text}>
          TypeGPU slot
        </Text>
      </Center>
      <Arrow
        from={field.topRight.map(([x, y]): Vec => [x - 70, y + 34])}
        to={field.center.map(([x, y]): Vec => [x + 70, y + 10])}
        bend={-0.25}
        stroke={{ color: theme.text, width: 1.5 }}
      />
    </Group>
  ),
);

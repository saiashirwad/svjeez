import {
  Arrow,
  Center,
  Group,
  Sequence,
  Shader,
  Shape,
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
import { d, std } from "typegpu";
import { geist } from "../fonts/faces";
import { mono, theme } from "../theme";

const WIDTH = 520;
const FIELD = 220;
const RADIUS = 12;

/** The page moves this clock between calm (0) and storm (1); the shader reads where it is. */
const storm = clock("storm", span(1.4, 1.2));

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

const hash = (p: d.v2f): number => {
  "use gpu";

  return std.fract(std.sin(std.dot(p, d.vec2f(127.1, 311.7))) * 43758.5453);
};

const noise = (p: d.v2f): number => {
  "use gpu";
  const cell = std.floor(p);
  const f = std.fract(p);
  const u = std.mul(std.mul(f, f), std.sub(d.vec2f(3), std.mul(f, 2)));
  const a = hash(cell);
  const b = hash(std.add(cell, d.vec2f(1, 0)));
  const c = hash(std.add(cell, d.vec2f(0, 1)));
  const e = hash(std.add(cell, d.vec2f(1, 1)));

  return std.mix(std.mix(a, b, u.x), std.mix(c, e, u.x), u.y);
};

/** Five octaves of noise, each twice as fine and half as strong. */
const fbm = (start: d.v2f): number => {
  "use gpu";
  let p = d.vec2f(start);
  let sum = d.f32(0);
  let weight = d.f32(0.5);

  for (let octave = 0; octave < 5; octave++) {
    sum += weight * noise(p);
    p = std.mul(p, 2.03);
    weight *= 0.5;
  }

  return sum;
};

const FIELD_COLORS = {
  ground,
  calmA: theme.cyan,
  calmB: theme.blue,
  stormA: theme.magenta,
  stormB: theme.orange,
};

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
        <Shader
          ref={field}
          name="field"
          width={WIDTH}
          height={FIELD}
          clip={rect(WIDTH, FIELD, { radius: RADIUS })}
          inputs={{ storm, ...FIELD_COLORS }}
          fragment={(uv, input) => {
            "use gpu";
            // Two noise fields warp a third; the storm speeds it up, roughens it and turns its colors.
            const s = input.storm;
            const t = input.time * std.mix(0.12, 0.55, s);
            const p = d.vec2f((uv.x * input.resolution.x) / input.resolution.y, uv.y);
            const scale = std.mix(1.3, 2.4, s);

            const q = d.vec2f(
              fbm(std.add(std.mul(p, scale), d.vec2f(t * 0.6, 0))),
              fbm(std.add(std.mul(p, scale), d.vec2f(5.2, 1.3 - t * 0.5))),
            );

            const n = fbm(
              std.add(
                std.add(std.mul(p, scale), std.mul(q, std.mix(1.2, 3.2, s))),
                d.vec2f(t, -t * 0.4),
              ),
            );

            const bend = (n - 0.5) * std.mix(0.7, 1.1, s);
            const ribbon = std.exp(-std.pow((uv.y - 0.55 - bend) * std.mix(5, 3.2, s), 2));

            const second =
              std.exp(-std.pow((uv.y - 0.3 + bend * 0.6) * std.mix(9, 5, s), 2)) * 0.55;

            const streaks = std.smoothstep(0.58, 0.85, n) * s;
            const flicker = 1 + s * 0.2 * std.sin(input.time * 11 + p.x * 9);
            const a = std.mix(input.calmA, input.stormA, s);
            const b = std.mix(input.calmB, input.stormB, s);
            const band = std.mix(a, b, std.clamp(n * 1.4 - 0.2, 0, 1));

            const glow = std.clamp(
              (ribbon + second) * flicker * 0.85 + n * 0.25 + streaks * 0.7,
              0,
              1,
            );

            const edge = std.smoothstep(0, 0.12, std.min(uv.x, 1 - uv.x));

            return d.vec4f(std.mix(input.ground, band, glow * edge), 1);
          }}
        >
          <Still />
        </Shader>
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
          TypeGPU shader
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

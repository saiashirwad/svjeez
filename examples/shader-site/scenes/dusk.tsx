import {
  Group,
  Sequence,
  Shader,
  Shape,
  Stack,
  circle,
  clock,
  ease,
  linear,
  mix,
  polygon,
  rect,
  scene,
  span,
  track,
  type Anim,
  type ShaderInputs,
  type Vec,
} from "svjeez";
import { d, std } from "typegpu";
import { theme } from "./theme";

const WIDTH = 1200;
const SKY = 450;
const LAKE = 225;
const PIVOT: Vec = [WIDTH / 2, 400];
const REACH = 330;
const SWING = 70;
const TURN = (SWING * Math.PI) / 180;

/** The page moves this clock: 0 is dawn, 1 is dusk. Both shaders, the sun and the fallbacks read it. */
const hour = clock("hour", span(0, 6));
const half = hour.over / 2;

const frame = rect(WIDTH, SKY + LAKE, { radius: 16 });

/** A ridge that stands at these heights, spread evenly across the scene and filled down to the lake. */
const ridge = (...heights: number[]) =>
  polygon(
    ...heights.map((y, index): Vec => [(index * WIDTH) / (heights.length - 1), y]),
    [WIDTH, SKY],
    [0, SKY],
  );

/** Four layers of warped sine ridges: where the ridges cross, light gathers, as on the floor of a pool. */
const caustic = (p: d.v2f, time: number): number => {
  "use gpu";
  let t = d.f32(time);
  let q = d.vec2f(p);
  let light = d.f32(0);

  for (let layer = 0; layer < 4; layer++) {
    q = std.add(
      p,
      d.vec2f(std.cos(t - q.x) + std.sin(t + q.y), std.sin(t - q.y) + std.cos(t + q.x)),
    );
    light += std.pow(1 - std.abs(std.sin(q.x * 1.3 + q.y * 0.8 + t)), 5);
    t *= 0.8;
  }

  return light / 4;
};

/** A plain gradient from the sky color down to `low`, which the warm one fades over. */
const Gradient = ({
  low,
  height,
  opacity,
}: {
  low: typeof theme.sky;
  height: number;
  opacity?: Anim<number>;
}) => (
  <Shape
    geometry={rect(WIDTH, height)}
    fill={linear.across({ angle: 90, stops: [theme.sky, low] })}
    opacity={opacity}
  />
);

const inputs = {
  hour,
  pivot: PIVOT,
  reach: REACH,
  top: theme.sky,
  low: theme.dusk,
  sun: theme.sun,
  hill: theme.hill,
} satisfies ShaderInputs;

export default scene(
  {
    size: [WIDTH, SKY + LAKE],
    duration: 6,
    title: "Dusk",
    desc: "A sun crosses a sky and a lake from dawn to dusk, over two ridges of hills, as the hour moves.",
    theme,
    loop: false,
    still: 3,
  },
  () => (
    <Group clip={frame}>
      <Stack gap={0}>
        <Shader
          name="sky"
          width={WIDTH}
          height={SKY}
          inputs={inputs}
          fragment={(uv, input) => {
            "use gpu";
            // Positions are in the scene's units, not device pixels, so the glow stays on the sun at any pixel ratio.
            const px = std.mul(uv, d.vec2f(WIDTH, SKY));
            const angle = (input.hour - 0.5) * 2 * TURN;

            const sun = std.add(
              input.pivot,
              std.mul(d.vec2f(std.sin(angle), -std.cos(angle)), input.reach),
            );

            // The sky turns warm toward the horizon, more so the lower the sun is, and ripples a little.
            const warm =
              std.smoothstep(0.3, 0.9, std.abs(angle) / TURN) * std.smoothstep(0.35, 1, uv.y);

            const ripple = 0.05 * std.sin(uv.x * 9 + uv.y * 26 + input.time * 0.3);
            const base = std.mix(input.top, input.low, std.clamp(warm * 1.3 + ripple, 0, 1));

            return d.vec4f(
              std.mix(base, input.sun, std.exp(-std.distance(px, sun) * 0.006) * 0.8),
              1,
            );
          }}
        >
          <Gradient low={mix(theme.sky, theme.sun, 0.3)} height={SKY} />
          <Sequence clock={hour}>
            <Gradient
              low={theme.dusk}
              height={SKY}
              opacity={track(1).to(0, span(0, half)).to(1, span(half, half))}
            />
          </Sequence>
        </Shader>
        <Shader
          name="lake"
          width={WIDTH}
          height={LAKE}
          inputs={inputs}
          fragment={(uv, input) => {
            "use gpu";
            const angle = (input.hour - 0.5) * 2 * TURN;
            const column = (input.pivot.x + std.sin(angle) * input.reach) / WIDTH;
            const warm = std.smoothstep(0.3, 0.9, std.abs(angle) / TURN);
            const p = std.mul(d.vec2f((uv.x * WIDTH) / LAKE, uv.y), 7);
            const shine = std.smoothstep(0.2, 0.9, caustic(p, input.time * 0.3));

            // The water takes the horizon's color, darkens with depth, and glitters under the sun.
            const deep = std.mix(
              std.mix(input.top, input.low, warm),
              input.hill,
              0.45 + 0.4 * uv.y,
            );

            const path = std.exp(-std.pow((uv.x - column) * 3.5, 2));

            return d.vec4f(std.mix(deep, input.sun, path * (0.15 + 0.85 * shine)), 1);
          }}
        >
          <Gradient low={theme.hill} height={LAKE} />
        </Shader>
      </Stack>
      <Sequence clock={hour}>
        <Group
          offset={PIVOT}
          origin="at"
          rotate={track(-SWING).to(SWING, span(0, hour.over), ease.linear)}
        >
          <Shape geometry={circle(36)} at={[0, -REACH]} anchor="center" fill={theme.sun} />
        </Group>
      </Sequence>
      <Shape
        geometry={ridge(330, 290, 325, 270, 330, 300)}
        fill={mix(theme.hill, theme.sky, 0.45)}
      />
      <Shape geometry={ridge(395, 360, 400, 365, 405)} fill={theme.hill} />
    </Group>
  ),
);

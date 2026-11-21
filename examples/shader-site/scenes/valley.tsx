import {
  Group,
  Sequence,
  Shader,
  Shape,
  circle,
  clock,
  moved,
  polygon,
  rect,
  sampled,
  scene,
  span,
  track,
  type Vec,
} from "svjeez";
import { d, std } from "typegpu";
import { Flock } from "./birds";
import { Lattice, corner, facet, noise } from "./lattice";
import { deep, horizon, land, shifting, sun, top } from "./palette";

const WIDTH = 1600;
const HEIGHT = 900;
const HORIZON = 545;
const LAKE = HEIGHT - HORIZON;

// The sun rides half an ellipse over the lake: up from just above the left horizon, and down past the right one.
const MIDDLE = 800;
const WIDE = 520;
const HIGH = 420;
const RISE = (-86 * Math.PI) / 180;
const SET = (120 * Math.PI) / 180;
const RADIUS = 26;

/** The page moves this clock: 0 is dawn, then day, dusk, and night at 1. Every color and the sun follow it. */
const hour = clock("hour", span(0, 6));

/** Where the sun is at `progress` on the hour clock, in the scene's units. The vector disc and every shader use it. */
const sunAt = (progress: number): d.v2f => {
  "use gpu";
  const angle = RISE + (SET - RISE) * progress;

  return d.vec2f(MIDDLE + std.sin(angle) * WIDE, HORIZON - std.cos(angle) * HIGH);
};

/** How high the sun stands, 1 at its top, 0 on the horizon and below 0 under it. */
const heightOf = (at: d.v2f): number => {
  "use gpu";

  return (HORIZON - at.y) / HIGH;
};

const SLOPE = 0.62;

/** A ridge's height above the horizon at `x`: the highest of three peaks, each a point [x, height]. */
const ridge = (x: number, a: d.v2f, b: d.v2f, c: d.v2f): number => {
  "use gpu";
  const tallest = std.max(a.y - std.abs(x - a.x) * SLOPE, b.y - std.abs(x - b.x) * SLOPE);

  return std.max(tallest, c.y - std.abs(x - c.x) * SLOPE);
};

/**
 * A facet's corner in 3D, x right and y up from the horizon: it stands out of the picture as far as it lies under the
 * ridge, give or take a little, so each facet faces the way its slope does.
 */
const lift = (point: d.v2f, seed: d.v2f, a: d.v2f, b: d.v2f, c: d.v2f, cell: number): d.v3f => {
  "use gpu";
  const under = ridge(point.x, a, b, c) - (HORIZON - point.y);

  return d.vec3f(point.x, HORIZON - point.y, under * 0.9 + noise(seed) * cell * 0.25);
};

/** The top edge of a ridge: the peaks, sampled every so often with a little roughness, never below the horizon. */
const skyline = (peaks: readonly [Vec, Vec, Vec], rough: number): Vec[] => {
  const height = (x: number) =>
    Math.max(...peaks.map(([px, py]) => py - Math.abs(x - px) * SLOPE), 0);

  const xs = [
    ...Array.from({ length: 35 }, (_, index) => index * 48 - 16),
    ...peaks.map(([px]) => px),
  ].sort((a, b) => a - b);

  return xs.map((x): Vec => {
    const bump = peaks.some(([px]) => px === x) ? 0 : Math.sin(x * 12.9898) * rough;

    return [x, HORIZON - Math.max(height(x) + bump, 0)];
  });
};

/** A ridge's outline down to the horizon, or with `mirrored`, its reflection hanging below it. */
const outline = (peaks: readonly [Vec, Vec, Vec], rough: number, mirrored = false) =>
  polygon(
    ...skyline(peaks, rough).map(([x, y]): Vec => [x, mirrored ? 2 * HORIZON - y : y]),
    [WIDTH + 16, HORIZON + (mirrored ? -1 : 1)],
    [-16, HORIZON + (mirrored ? -1 : 1)],
  );

/** Where the stars stand, scattered over the upper sky by a fixed rule so they stay put between builds. */
const STARS = Array.from({ length: 28 }, (_, index): Vec => [
  (Math.sin(index * 91.7) * 0.5 + 0.5) * WIDTH,
  (Math.sin(index * 47.3) * 0.5 + 0.5) ** 1.4 * 280 + 20,
]);

/** Three ridges from far to near: each farther one higher, hazier and cut into larger facets. */
const RANGES = [
  {
    name: "far",
    peaks: [
      [230, 215],
      [760, 265],
      [1390, 225],
    ],
    haze: 0.6,
    cell: 120,
  },
  {
    name: "middle",
    peaks: [
      [470, 170],
      [1080, 205],
      [1560, 160],
    ],
    haze: 0.32,
    cell: 100,
  },
  {
    name: "near",
    peaks: [
      [70, 140],
      [330, 95],
      [1420, 120],
    ],
    haze: 0,
    cell: 84,
  },
] as const satisfies readonly RangeProps[];

interface RangeProps {
  readonly name: string;
  readonly peaks: readonly [Vec, Vec, Vec];
  readonly haze: number;
  readonly cell: number;
}

/**
 * A ridge of mountains: a crisp vector outline over facets the GPU lights by where the sun stands. Its shader covers
 * only the band from just above the highest peak down to the horizon, so the sky above it costs the GPU nothing.
 */
const Range = ({ name, peaks, haze, cell }: RangeProps) => {
  const tall = Math.ceil(Math.max(...peaks.map(([, height]) => height)) + cell * 0.1);
  const crest = HORIZON - tall;

  return (
    <Shader
      name={name}
      at={[0, crest]}
      width={WIDTH}
      height={tall}
      clip={moved(outline(peaks, cell * 0.08), [0, -crest])}
      inputs={{ hour, a: peaks[0], b: peaks[1], c: peaks[2], haze, cell, crest }}
      fragment={(uv, input) => {
        "use gpu";
        const p = d.vec2f(uv.x * WIDTH, input.crest + uv.y * (HORIZON - input.crest));

        const lattice = Lattice({
          cell: d.vec2f(input.cell, input.cell * 0.82),
          loose: 0.8,
          time: 0,
          sway: 0,
        });

        const at = facet(p, lattice);
        const id = at.xy;

        const ia = std.add(id, d.vec2f(at.z, 0));
        const ib = std.add(id, d.vec2f(1, at.z));
        const ic = std.add(id, d.vec2f(0, 1));
        const a = lift(corner(ia, lattice), ia, input.a, input.b, input.c, input.cell);
        const b = lift(corner(ib, lattice), ib, input.a, input.b, input.c, input.cell);
        const c = lift(corner(ic, lattice), ic, input.a, input.b, input.c, input.cell);
        const facing = std.normalize(std.cross(std.sub(b, a), std.sub(c, a)));
        const normal = std.mul(facing, std.sign(facing.z));
        const middle = std.div(std.add(std.add(a, b), c), 3);

        const sunAtNow = sunAt(input.hour);

        const toward = std.normalize(
          d.vec3f(sunAtNow.x - middle.x, HORIZON - sunAtNow.y - middle.y, 380),
        );

        // With the sun down, a faint light from high on the left keeps the facets apart.
        const day = std.smoothstep(-0.08, 0.3, heightOf(sunAtNow));
        const from = std.normalize(std.mix(d.vec3f(-0.5, 0.7, 0.5), toward, day));
        const light = std.clamp(std.dot(normal, from), 0, 1) * (0.35 + 0.65 * day);

        // Nearer ridges are darker; farther ones and the foot of each fade toward the horizon's color.
        const ground = std.mul(land(input.hour), 0.62 + 0.38 * input.haze);
        const lit = std.mix(std.mul(ground, 1.14), sun(input.hour), 0.16 * day + 0.04);
        const shade = std.mul(std.mix(ground, top(input.hour), 0.25), 0.86);
        const foot = 1 - std.smoothstep(0, 130, middle.y);
        const mist = input.haze + (1 - input.haze) * 0.28 * foot;

        return d.vec4f(std.mix(std.mix(shade, lit, light), horizon(input.hour), mist), 1);
      }}
    >
      <Sequence clock={hour}>
        <Shape geometry={rect(WIDTH, tall)} fill={shifting("land", hour.over)} />
        {haze > 0 && (
          <Shape
            geometry={rect(WIDTH, tall)}
            fill={shifting("horizon", hour.over)}
            opacity={haze}
          />
        )}
      </Sequence>
    </Shader>
  );
};

export default scene(
  {
    size: [WIDTH, HEIGHT],
    duration: 6,
    title: "A lake below the mountains",
    desc: "A low-poly valley from dawn to night. The sun crosses the sky over three ridges and a lake, lighting their facets, while a few birds fly by.",
    loop: false,
    still: 3,
  },
  () => (
    <Group>
      <Shader
        name="sky"
        width={WIDTH}
        height={HORIZON}
        inputs={{ hour }}
        fragment={(uv, input) => {
          "use gpu";
          const p = std.mul(uv, d.vec2f(WIDTH, HORIZON));
          const at = sunAt(input.hour);
          const low = 1 - std.smoothstep(0.1, 0.6, heightOf(at));

          // Toward the horizon the sky warms, most under a low sun; the gradient rests in soft, barely there bands.
          const fall = std.pow(uv.y, 1.6);
          const banded = std.mix(fall, std.floor(fall * 16 + 0.5) / 16, 0.2);
          const near = std.exp(-std.abs(p.x - at.x) / 520) * low * 0.45;

          const base = std.mix(
            top(input.hour),
            std.mix(horizon(input.hour), sun(input.hour), near),
            banded,
          );

          const glow =
            std.exp(-std.distance(p, at) / 120) *
            (0.45 + 0.35 * low) *
            std.smoothstep(-0.25, 0.05, heightOf(at));

          return d.vec4f(std.mix(base, sun(input.hour), glow), 1);
        }}
      >
        <Sequence clock={hour}>
          <Shape geometry={rect(WIDTH, HORIZON)} fill={shifting("top", hour.over)} />
        </Sequence>
      </Shader>
      <Group clip={rect(WIDTH, HORIZON)}>
        <Sequence clock={hour}>
          <Group
            opacity={track(0)
              .to(0, span(0, hour.over * 0.84))
              .to(0.8, span(hour.over * 0.84, hour.over * 0.16))}
          >
            {STARS.map((at, index) => (
              <Shape
                key={String(index)}
                geometry={circle(index % 3 === 0 ? 1.8 : 1.1)}
                anchor="center"
                at={at}
                fill="#FFFFFF"
              />
            ))}
          </Group>
          <Shape
            hit="sun"
            geometry={circle(RADIUS)}
            anchor="center"
            fill={shifting("sun", hour.over)}
            at={sampled(
              (t): Vec => {
                const at = sunAt(t / hour.over);

                return [at.x, at.y];
              },
              span(0, hour.over),
              { tolerance: 0.25 },
            )}
          />
        </Sequence>
      </Group>
      {RANGES.map((range) => (
        <Range key={range.name} {...range} />
      ))}
      <Shader
        name="lake"
        at={[0, HORIZON]}
        width={WIDTH}
        height={LAKE}
        inputs={{ hour }}
        fragment={(uv, input) => {
          "use gpu";
          const p = d.vec2f(uv.x * WIDTH, HORIZON + uv.y * LAKE);

          const lattice = Lattice({
            cell: d.vec2f(190, 18),
            loose: 0.35,
            time: input.time,
            sway: 0.08,
          });

          const at = facet(p, lattice);
          const id = at.xy;

          const middle = std.div(
            std.add(
              std.add(
                corner(std.add(id, d.vec2f(at.z, 0)), lattice),
                corner(std.add(id, d.vec2f(1, at.z)), lattice),
              ),
              corner(std.add(id, d.vec2f(0, 1)), lattice),
            ),
            3,
          );

          // Far water mirrors the sky, near water goes deep; each facet sits a shade above or below its neighbors.
          const depth = std.clamp((middle.y - HORIZON) / LAKE, 0, 1);
          const sunNow = sunAt(input.hour);
          const low = 1 - std.smoothstep(0.1, 0.6, heightOf(sunNow));
          const warmth = std.exp(-std.abs(middle.x - sunNow.x) / 480) * low * 0.35;

          const sky = std.mix(
            std.mix(top(input.hour), horizon(input.hour), 0.6),
            sun(input.hour),
            warmth,
          );

          const mirror = std.mul(sky, 0.78);
          const tone = 1 + (noise(std.add(id, at.z * 7)) - 0.5) * 0.04;
          const water = std.mul(std.mix(mirror, deep(input.hour), std.sqrt(depth)), tone);

          // Under the sun a broken path of small facets catches its light, wider toward the viewer.
          const fine = Lattice({ cell: d.vec2f(64, 9), loose: 0.4, time: input.time, sway: 0.2 });
          const spark = facet(p, fine);

          const glint = std.div(
            std.add(
              std.add(
                corner(std.add(spark.xy, d.vec2f(spark.z, 0)), fine),
                corner(std.add(spark.xy, d.vec2f(1, spark.z)), fine),
              ),
              corner(std.add(spark.xy, d.vec2f(0, 1)), fine),
            ),
            3,
          );

          // A facet nearer the middle of the path is likelier to catch the light, so its edge breaks up.
          const near = 1 - std.abs(glint.x - sunNow.x) / (14 + depth * 90);
          const lit = std.step(0.15 + 0.85 * noise(std.add(std.mul(spark.xy, 3), spark.z)), near);
          const shine = lit * std.smoothstep(-0.02, 0.12, heightOf(sunNow)) * (1 - depth * 0.4);

          return d.vec4f(std.mix(water, sun(input.hour), shine * 0.8), 1);
        }}
      >
        <Sequence clock={hour}>
          <Shape geometry={rect(WIDTH, LAKE)} fill={shifting("deep", hour.over)} />
        </Sequence>
      </Shader>
      <Sequence clock={hour}>
        {RANGES.slice(1).map(({ name, peaks, cell }) => (
          <Shape
            key={name}
            geometry={outline(peaks, cell * 0.08, true)}
            fill={shifting("land", hour.over)}
            opacity={0.18}
          />
        ))}
      </Sequence>
      <Flock hour={hour} width={WIDTH} height={250} />
    </Group>
  ),
);

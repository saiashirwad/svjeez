import { def, ease, el, motion, sampled, voxel, wiggle, type Color, type Motion, type Seconds, type SvgNode } from "svg-motion";
import { BEAT, C, CAMERA, D, GRID, H, ORIGIN, W, clamp, lerp, random } from "./kit";
import { SKIN } from "./textures";
import { LIGHTS } from "./world";

type Keys = readonly (readonly [Seconds, Color])[];

/** Hold the first color, then ease to each next one by its time. */
function grade(first: Color, keys: Keys): Motion<"stopColor"> {
  let track = motion({ stopColor: first });
  let from = 0;
  for (const [at, color] of keys) {
    track = track.at(from).to({ stopColor: color }, at - from, ease.inOut);
    from = at;
  }
  return track;
}

const DAY_TOP = "#5aa9ee";
const DAY_HORIZON = "#bfe4ff";

const sky = def.linearGradient({ x1: 0, y1: 0, x2: 0, y2: 1 }, (
  <>
    <stop offset={0} stopColor={DAY_TOP} animation={grade(DAY_TOP, [[BEAT.dusk, DAY_TOP], [BEAT.dim, "#4c4fa8"], [BEAT.sunset, "#1a2250"], [BEAT.night, "#050a20"], [BEAT.snow, "#050a20"], [BEAT.dawn, "#36559c"], [BEAT.day, DAY_TOP]])} />
    <stop offset={1} stopColor={DAY_HORIZON} animation={grade(DAY_HORIZON, [[BEAT.dusk, DAY_HORIZON], [BEAT.dim, "#ffb070"], [BEAT.sunset, "#8a4a7a"], [BEAT.night, "#0b1236"], [BEAT.snow, "#0b1236"], [BEAT.dawn, "#ff9a6a"], [BEAT.day, DAY_HORIZON]])} />
  </>
));

export function Backdrop(): SvgNode {
  return <rect width={W} height={H} fill={sky} />;
}

const rand = random(8);

const STARS = Array.from({ length: 70 }, (_, i) => ({
  x: Math.round(rand() * W),
  y: Math.round(rand() * H * 0.75),
  size: rand() < 0.2 ? 3 : 2,
  twinkle: i % 5 === 0,
}));

export function Stars(): SvgNode {
  const dark = motion({ opacity: 0 }).at(BEAT.dim).to({ opacity: 1 }, BEAT.night - BEAT.dim).at(BEAT.dawn).to({ opacity: 0 }, BEAT.day - BEAT.dawn);
  return (
    <g fill={C.star} animation={dark}>
      {STARS.map(({ x, y, size, twinkle }, i) =>
        el.rect({ x, y, width: size, height: size, animation: twinkle ? wiggle({ opacity: 0.6 }, { seed: i, rate: 2, period: 5 }) : undefined }),
      )}
    </g>
  );
}

const halo = (color: Color) =>
  def.radialGradient({}, (
    <>
      <stop offset={0} stopColor={color} stopOpacity={0.45} />
      <stop offset={1} stopColor={color} stopOpacity={0} />
    </>
  ));

/** The sun is up from its rise to its set a lap of the loop later, so it is already high at t = 0. */
const SUN_UP = D - BEAT.sunRise + BEAT.night;

const sunPath = (t: Seconds) => {
  const away = t > BEAT.night && t < BEAT.sunRise;
  const along = clamp(away ? 1 : t <= BEAT.night ? (t + D - BEAT.sunRise) / SUN_UP : (t - BEAT.sunRise) / SUN_UP);
  return { x: lerp(-70, W + 70, along), y: 440 - 380 * Math.sin(Math.PI * along), opacity: away || (t >= BEAT.sunRise && t < BEAT.sunRise + 0.1) ? 0 : 1 };
};

const moonPath = (t: Seconds) => {
  const along = clamp((t - BEAT.moonRise) / (BEAT.day - BEAT.moonRise));
  return { x: lerp(-60, W + 60, along), y: 460 - 400 * Math.sin(Math.PI * along) };
};

const sunHalo = halo(C.sun);
const moonHalo = halo(C.moon);

export function Sun(): SvgNode {
  return (
    <g animation={sampled(sunPath, { duration: D, tolerance: { translate: 0.5, opacity: 0.05 } })}>
      <circle r={96} fill={sunHalo} />
      <rect x={-28} y={-28} width={56} height={56} fill={C.sun} />
      <rect x={-20} y={-20} width={40} height={40} fill={C.sunCore} />
    </g>
  );
}

export function Moon(): SvgNode {
  return (
    <g animation={sampled(moonPath, { duration: D, tolerance: { translate: 0.5 } })}>
      <circle r={80} fill={moonHalo} />
      <rect x={-22} y={-22} width={44} height={44} fill={C.moon} />
      <rect x={-14} y={-12} width={10} height={10} fill={C.moonShade} />
      <rect x={4} y={-4} width={12} height={12} fill={C.moonShade} />
      <rect x={-8} y={8} width={8} height={8} fill={C.moonShade} />
    </g>
  );
}

const CLOUDS = [
  { at: [150, 125], phase: 0.1, size: 9 },
  { at: [330, 215], phase: 0.55, size: 7 },
  { at: [60, 70], phase: 0.8, size: 8 },
] as const;

const SKY_HEIGHT = 12;
const MARGIN = 280;

/** A cloud slides along the world's x - z diagonal, which the camera sees as straight across. */
const wind = (cells: number) => CAMERA.project([cells, 0, -cells]);
const TRAVEL = (W + 2 * MARGIN) / wind(1).x;

const CELLS = Array.from({ length: 6400 }, (_, i): readonly [number, number] => [(i % 80) - 40, Math.floor(i / 80) - 40]);

/** The cell on the cloud layer that lands nearest a screen point. */
const cellNear = ([sx, sy]: readonly [number, number]): readonly [number, number] => {
  const miss = ([x, z]: readonly [number, number]) => {
    const p = CAMERA.project([x, SKY_HEIGHT, z]);
    return Math.hypot(p.x + ORIGIN.x - sx, p.y + ORIGIN.y - sy);
  };
  let [best, bestMiss] = [CELLS[0]!, miss(CELLS[0]!)];
  for (const cell of CELLS) {
    const distance = miss(cell);
    if (distance < bestMiss) [best, bestMiss] = [cell, distance];
  }
  return best;
};

export function Clouds(): SvgNode {
  return (
    <>
      {CLOUDS.map(({ at, phase, size }, k) => {
        const pick = random(40 + k);
        const [x0, z0] = cellNear([-MARGIN, at[1]]);
        const cells = Array.from({ length: size * 4 }, (_, i): readonly [number, number] => [i % size, Math.floor(i / size)]).filter(
          ([a, b]) => a > 0 && a < size - 1 && (b === 1 || b === 2 || pick() > 0.45),
        );
        const drift = motion(wind(phase * TRAVEL))
          .to(wind(TRAVEL), (1 - phase) * D, ease.linear)
          .set(wind(0))
          .to(wind(phase * TRAVEL), phase * D, ease.linear);
        return el.g({ animation: drift }, voxel.scene({ camera: CAMERA, blocks: cells.map(([a, b]) => ({ at: [x0 + a, SKY_HEIGHT, z0 + b] as const, skin: SKIN.cloud })) }));
      })}
    </>
  );
}

const dusk = def.linearGradient({ x1: 0, y1: 0, x2: 0, y2: 1 }, (
  <>
    <stop offset={0} stopColor="#ff8a3d" stopOpacity={0} />
    <stop offset={1} stopColor="#ff8a3d" stopOpacity={0.9} />
  </>
));

const dark = def.linearGradient({ x1: 0, y1: 0, x2: 0, y2: 1 }, (
  <>
    <stop offset={0} stopColor="#0a1440" stopOpacity={0.2} />
    <stop offset={1} stopColor="#0a1440" stopOpacity={1} />
  </>
));

/** Warm light at dusk and again at dawn, then the dark between, over everything but the stars and the glow. */
export function Night(): SvgNode {
  const evening = motion({ opacity: 0 })
    .at(BEAT.dusk).to({ opacity: 0.45 }, BEAT.dim - BEAT.dusk, ease.inOut)
    .at(BEAT.sunset).to({ opacity: 0 }, BEAT.night - BEAT.sunset, ease.inOut)
    .at(BEAT.dawn).to({ opacity: 0.4 }, (BEAT.day - BEAT.dawn) / 2, ease.inOut)
    .to({ opacity: 0 }, (BEAT.day - BEAT.dawn) / 2, ease.inOut);
  const night = motion({ opacity: 0 }).at(BEAT.dim).to({ opacity: 0.6 }, BEAT.night - BEAT.dim, ease.inOut).at(BEAT.dawn).to({ opacity: 0 }, BEAT.day - BEAT.dawn, ease.inOut);
  return (
    <>
      <rect width={W} height={H} fill={dusk} animation={evening} />
      <rect width={W} height={H} fill={dark} animation={night} />
    </>
  );
}

const lamplight = def.radialGradient({}, (
  <>
    <stop offset={0} stopColor={C.lamp} stopOpacity={0.7} />
    <stop offset={0.4} stopColor={C.lamp} stopOpacity={0.25} />
    <stop offset={1} stopColor={C.lamp} stopOpacity={0} />
  </>
));

/** Drawn above the dark, so the windows and the lantern stay warm. */
export function Glow(): SvgNode {
  const lit = motion({ opacity: 0 }).at(BEAT.lights).to({ opacity: 1 }, BEAT.sunset - BEAT.lights).at(BEAT.lightsOut).to({ opacity: 0 }, 1.5, ease.inOut);
  return (
    <g animation={lit}>
      {LIGHTS.map((light) => {
        const { x, y } = CAMERA.project(light);
        return el.circle({ cx: x + ORIGIN.x, cy: y + ORIGIN.y, r: 52, fill: lamplight });
      })}
    </g>
  );
}

const FLAKES = 120;
const FLAKE_TOP = 24;
const GROUND = 3;

/** A flake waits offscreen for its turn, falls for `fall` seconds, fades as it lands, and rests unseen until the loop restarts. */
const flake = (x: number, z: number, wait: Seconds, fall: Seconds, period: Seconds, phase: number) =>
  sampled(
    (t) => {
      const down = clamp((t - wait) / fall);
      const { x: sx, y: sy } = CAMERA.project([x + 0.4 * Math.sin(2 * Math.PI * (down * 1.5 + phase)), lerp(FLAKE_TOP, GROUND, down), z]);
      return { x: sx + ORIGIN.x, y: sy + ORIGIN.y, opacity: clamp((1 - down) * 10) };
    },
    { duration: period, tolerance: { translate: 0.5, opacity: 0.05 } },
  ).loop(period);

const FALLS = [[5, 3], [6, 3.6], [10, 4.2]] as const;

export function Snow(): SvgNode {
  const pick = random(77);
  const falling = motion({ opacity: 0 }).at(BEAT.snow).to({ opacity: 1 }, 1.5).at(BEAT.day - 1.5).to({ opacity: 0 }, 1.5);
  return (
    <g fill="#ffffff" animation={falling}>
      {Array.from({ length: FLAKES }, (_, i) => {
        const [period, fall] = FALLS[i % FALLS.length]!;
        const size = i % 3 ? 4 : 5;
        return el.rect({ width: size, height: size, animation: flake(pick() * 14, pick() * 14, pick() * (period - fall), fall, period, pick()) });
      })}
    </g>
  );
}

const shade = def.radialGradient({}, (
  <>
    <stop offset={0} stopColor="#000000" stopOpacity={0.3} />
    <stop offset={1} stopColor="#000000" stopOpacity={0} />
  </>
));

/** The island's shadow on the haze below it. */
export function Shadow(): SvgNode {
  const { x, y } = CAMERA.project([GRID / 2, -6, GRID / 2]);
  const life = motion({ opacity: 0 }).at(BEAT.rise).to({ opacity: 1 }, 4).at(BEAT.void).to({ opacity: 0 }, 4);
  return <ellipse cx={x + ORIGIN.x} cy={y + ORIGIN.y} rx={230} ry={52} fill={shade} animation={life} />;
}

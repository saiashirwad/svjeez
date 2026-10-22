import { def, ease, motion, wiggle, type Color, type SvgNode } from "svg-motion";
import { C, D, H, T, W, random } from "./kit";

const depth = def.linearGradient({ x1: 0, y1: 0, x2: 0, y2: 1 }, (
  <>
    <stop offset={0} stopColor={C.ink} />
    <stop offset={1} stopColor={C.void} />
  </>
));

const cloud = (cx: number, cy: number, colors: readonly [Color, Color, Color], opacity: number) =>
  def.radialGradient({ cx, cy, r: 0.6 }, (
    <>
      <stop
        offset={0}
        stopOpacity={opacity}
        animation={motion({ stopColor: colors[0] })
          .to({ stopColor: colors[1] }, D / 3, ease.inOut)
          .to({ stopColor: colors[2] }, D / 3, ease.inOut)
          .to({ stopColor: colors[0] }, D / 3, ease.inOut)}
      />
      <stop offset={1} stopColor={C.void} stopOpacity={0} />
    </>
  ));

const west = cloud(0.18, 0.3, ["#2B1E6B", "#123A6B", "#3A1450"], 0.55);
const east = cloud(0.86, 0.78, ["#4A1630", "#2B1E6B", "#5A2A12"], 0.35);

export function Backdrop(): SvgNode {
  return <rect width={W} height={H} fill={depth} />;
}

export function Nebula(): SvgNode {
  return (
    <>
      <rect x={-40} y={-40} width={W + 80} height={H + 80} fill={west} />
      <rect x={-40} y={-40} width={W + 80} height={H + 80} fill={east} />
    </>
  );
}

const rand = random(2026);
const TINTS: readonly Color[] = [C.star, "#CFE0FF", "#FFE6C7", C.star];

const STARS = Array.from({ length: 220 }, (_, i) => ({
  x: -30 + rand() * (W + 60),
  y: -30 + rand() * (H + 60),
  r: 0.3 + rand() ** 3 * 1.4,
  tint: TINTS[i % TINTS.length]!,
  twinkle: i % 6 === 0,
}));

/** A soft sprite instead of a blur filter: a canvas-wide filter over the whole sky costs a few fps. */
const halo = def.radialGradient({}, (
  <>
    <stop offset={0} stopColor={C.star} stopOpacity={0.5} />
    <stop offset={1} stopColor={C.star} stopOpacity={0} />
  </>
));

const sparkle = (x: number, y: number, r: number): string =>
  `M${x} ${y - r}Q${x} ${y} ${x + r} ${y}Q${x} ${y} ${x} ${y + r}Q${x} ${y} ${x - r} ${y}Q${x} ${y} ${x} ${y - r}Z`;

export function Stars(): SvgNode {
  return (
    <>
      {STARS.map(({ x, y, r, tint, twinkle }, i) => (
        <circle
          cx={x}
          cy={y}
          r={r}
          fill={tint}
          animation={twinkle ? wiggle({ opacity: 0.7 }, { seed: `star-${i}`, rate: 3, ease: ease.hold, period: D / 2 }) : undefined}
        />
      ))}
      {STARS.filter((star) => star.r > 1.35).map(({ x, y }, i) => (
        <g animation={wiggle({ opacity: 0.5, scale: 0.3 }, { seed: `flare-${i}`, rate: 1, period: D / 2 })}>
          <circle cx={x} cy={y} r={9} fill={halo} />
          <path d={sparkle(x, y, 7)} fill={C.star} />
        </g>
      ))}
    </>
  );
}

const STREAKS = Array.from({ length: 90 }, () => {
  const angle = rand() * Math.PI * 2;
  const from = 20 + rand() * 70;
  const length = 30 + rand() * 90;
  return {
    cos: Math.cos(angle),
    sin: Math.sin(angle),
    from,
    length,
    at: T.fall + rand() * 0.9,
    over: 0.5 + rand() * 0.4,
    width: 0.6 + rand() * 1.6,
  };
});

/** Falling in: starlight streaks past from the center. */
export function Warp(): SvgNode {
  const reach = 640;
  return (
    <g stroke="#DCE6FF" strokeLinecap="round">
      {STREAKS.map(({ cos, sin, from, length, at, over, width }) => (
        <line
          x1={cos * from}
          y1={sin * from}
          x2={cos * (from + length)}
          y2={sin * (from + length)}
          strokeWidth={width}
          animation={motion({ x: 0, y: 0, opacity: 0 })
            .at(at)
            .to({ x: cos * reach, y: sin * reach }, over, ease.in)
            .at(at)
            .to({ opacity: 0.9 }, 0.12)
            .to({ opacity: 0 }, over - 0.12, ease.in)}
        />
      ))}
    </g>
  );
}

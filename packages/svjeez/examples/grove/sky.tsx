import {
  def,
  ease,
  el,
  motion,
  sampled,
  wiggle,
  type Color,
  type Motion,
  type Seconds,
  type SvgNode,
} from "svjeez";
import { C, D, H, ORIGIN, W, alpha, at, clamp, lerp, mix, random } from "./kit";
import { leaf as leafPath } from "./draw";
import { TAU } from "./space";

type Keys = readonly (readonly [Seconds, Color])[];

const grade = (first: Color, keys: Keys): Motion<"stopColor"> => {
  let track = motion({ stopColor: first });
  let from = 0;

  for (const [time, color] of keys) {
    track = track.at(from).to({ stopColor: color }, time - from, ease.inOut);
    from = time;
  }

  return track;
};

const sky = def.linearGradient(
  { x1: 0, y1: 0, x2: 0, y2: 1 },
  <>
    <stop
      offset={0}
      stopColor={C.nightTop}
      animation={grade(C.nightTop, [
        [1.4, C.nightTop],
        [3.4, C.dawnTop],
        [8.6, C.dayTop],
        [14.8, C.dayTop],
        [20.2, C.duskTop],
        [23.6, C.nightTop],
        [D, C.nightTop],
      ])}
    />
    <stop
      offset={0.62}
      stopColor={C.nightMid}
      animation={grade(C.nightMid, [
        [1.4, C.nightMid],
        [3.6, C.dawnMid],
        [8.8, C.dayMid],
        [15, C.dayMid],
        [20.4, C.duskMid],
        [23.8, C.nightMid],
        [D, C.nightMid],
      ])}
    />
    <stop
      offset={1}
      stopColor={C.nightBot}
      animation={grade(C.nightBot, [
        [1.4, C.nightBot],
        [3.8, C.dawnBot],
        [9, C.dayBot],
        [15.2, C.dayBot],
        [20.6, C.duskBot],
        [24, C.nightBot],
        [D, C.nightBot],
      ])}
    />
  </>,
);

const horizon = def.radialGradient(
  { gradientUnits: "userSpaceOnUse", cx: 430, cy: 400, r: 430 },
  <>
    <stop offset={0} stopColor="#ffdc9e" stopOpacity={0.5} />
    <stop offset={0.5} stopColor="#f3b479" stopOpacity={0.18} />
    <stop offset={1} stopColor="#f3b479" stopOpacity={0} />
  </>,
);

export function Backdrop(): SvgNode {
  const warm = motion({ opacity: 0.15 })
    .at(3)
    .to({ opacity: 0.8 }, 4, ease.inOut)
    .at(14)
    .to({ opacity: 0.35 }, 4, ease.inOut)
    .at(19.6)
    .to({ opacity: 0.9 }, 2.4, ease.inOut)
    .at(23.6)
    .to({ opacity: 0.15 }, 2.4, ease.inOut);

  const vignette = def.radialGradient(
    { gradientUnits: "userSpaceOnUse", cx: W / 2, cy: H * 0.46, r: W * 0.62 },
    <>
      <stop offset={0.45} stopColor="#000000" stopOpacity={0} />
      <stop offset={1} stopColor="#000000" stopOpacity={0.45} />
    </>,
  );

  return (
    <>
      <rect width={W} height={H} fill={sky} />
      <rect width={W} height={H} fill={horizon} animation={warm} />
      <rect width={W} height={H} fill={vignette} />
    </>
  );
}

const STARS = (() => {
  const pick = random(19);

  return Array.from({ length: 62 }, (_, i) => ({
    x: Math.round(pick() * W),
    y: Math.round(pick() * H * 0.56),
    r: pick() < 0.18 ? 1.8 : pick() < 0.6 ? 1.2 : 0.8,
    twinkle: i % 3 === 0,
  }));
})();

const twinkle = [
  wiggle({ opacity: 0.55 }, { seed: "star-a", rate: 2, period: D / 4 }),
  wiggle({ opacity: 0.4 }, { seed: "star-b", rate: 1.5, period: D / 4 }),
] as const;

export function Stars(): SvgNode {
  const night = motion({ opacity: 1 })
    .at(3.4)
    .to({ opacity: 0 }, 2.6, ease.inOut)
    .at(20.6)
    .to({ opacity: 1 }, 3, ease.inOut);

  return (
    <g fill={C.star} animation={night}>
      {STARS.map(({ x, y, r, twinkle: flicker }, i) =>
        el.circle({
          cx: x,
          cy: y,
          r,
          opacity: flicker ? undefined : 0.8,
          animation: flicker ? twinkle[i % 2]! : undefined,
        }),
      )}
      {el.path({
        d: "M182 84l2.2 6.4 6.4 2.2-6.4 2.2-2.2 6.4-2.2-6.4-6.4-2.2 6.4-2.2z",
        fill: C.star,
        opacity: 0.8,
      })}
      {el.path({
        d: "M812 188l1.5 4.4 4.4 1.5-4.4 1.5-1.5 4.4-1.5-4.4-4.4-1.5 4.4-1.5z",
        fill: C.star,
        opacity: 0.55,
      })}
    </g>
  );
}

const sunHalo = def.radialGradient(
  {},
  <>
    <stop offset={0} stopColor={C.sun} stopOpacity={0.55} />
    <stop offset={0.18} stopColor={C.sun} stopOpacity={0.24} />
    <stop offset={0.46} stopColor={C.sun} stopOpacity={0.08} />
    <stop offset={1} stopColor={C.sun} stopOpacity={0} />
  </>,
);

const sunAt = (t: Seconds) => {
  const start = 2.4;
  const end = 21.4;
  const u = clamp((t - start) / (end - start));
  const alive = t < start || t > end ? 0 : Math.min(1, (t - start) / 1.2, (end - t) / 1.5);

  return {
    x: Math.round(lerp(292, 706, u)),
    y: Math.round(414 - 262 * Math.sin(Math.PI * u)),
    opacity: Math.round(alive * 100) / 100,
  };
};

export function Sun(): SvgNode {
  return el.g(
    { animation: sampled(sunAt, { duration: D, tolerance: { translate: 1, opacity: 0.02 } }) },
    [
      el.circle({ r: 210, fill: sunHalo, opacity: 0.55 }),
      el.circle({ r: 132, fill: sunHalo }),
      el.circle({ r: 44, fill: C.sun }),
      el.circle({ r: 31, fill: C.sunCore }),
    ],
  );
}

const moonHalo = def.radialGradient(
  {},
  <>
    <stop offset={0} stopColor={C.moon} stopOpacity={0.3} />
    <stop offset={1} stopColor={C.moon} stopOpacity={0} />
  </>,
);

const crescent = def.mask(
  { maskUnits: "userSpaceOnUse", x: 748, y: 72, width: 96, height: 96 },
  <>
    <circle cx={792} cy={120} r={23} fill="white" />
    <circle cx={801} cy={113} r={18} fill="black" />
  </>,
);

export function Moon(): SvgNode {
  const night = motion({ opacity: 0 })
    .at(20)
    .to({ opacity: 1 }, 3, ease.inOut)
    .at(2.2)
    .to({ opacity: 0 }, 2.2, ease.inOut);

  return el.g({ animation: night }, [
    el.circle({ cx: 792, cy: 120, r: 76, fill: moonHalo }),
    el.circle({ cx: 792, cy: 120, r: 23, fill: C.moon, mask: crescent }),
  ]);
}

const CLOUDS = [
  { x: 240, y: 232, w: 160, h: 22, phase: 0.2, opacity: 0.34 },
  { x: 690, y: 172, w: 120, h: 16, phase: 2.2, opacity: 0.25 },
  { x: 780, y: 300, w: 210, h: 18, phase: 4.1, opacity: 0.3 },
  { x: 130, y: 352, w: 150, h: 14, phase: 1.2, opacity: 0.22 },
] as const;

export function Clouds(): SvgNode {
  const cloud = def.linearGradient(
    { x1: 0, y1: 0, x2: 0, y2: 1 },
    <>
      <stop offset={0} stopColor="#fff2d6" stopOpacity={0.9} />
      <stop offset={1} stopColor="#f8cfa3" stopOpacity={0.15} />
    </>,
  );

  const day = motion({ opacity: 0.35 })
    .at(3)
    .to({ opacity: 1 }, 5, ease.inOut)
    .at(20)
    .to({ opacity: 0.3 }, 3, ease.inOut);

  return (
    <g fill={cloud} animation={day}>
      {CLOUDS.map(({ x, y, w, h, phase, opacity }) => {
        const drift = sampled(
          (t) => ({
            x: Math.round(x + 16 * Math.sin((TAU * t) / D + phase)),
            y: Math.round(y + 2.4 * Math.sin((TAU * t * 2) / D + phase)),
          }),
          { duration: D, tolerance: { translate: 0.7 } },
        );

        return el.g({ animation: drift, opacity }, [
          el.ellipse({ cx: 0, cy: 0, rx: w / 2, ry: h / 2 }),
          el.ellipse({ cx: -w * 0.22, cy: -h * 0.28, rx: w * 0.26, ry: h * 0.6 }),
          el.ellipse({ cx: w * 0.18, cy: -h * 0.2, rx: w * 0.22, ry: h * 0.48 }),
        ]);
      })}
    </g>
  );
}

export function Mist(): SvgNode {
  const haze = def.radialGradient(
    {},
    <>
      <stop offset={0} stopColor="#d8e7d2" stopOpacity={0.32} />
      <stop offset={1} stopColor="#d8e7d2" stopOpacity={0} />
    </>,
  );

  return (
    <g fill={haze}>
      <ellipse cx={ORIGIN.x - 20} cy={565} rx={260} ry={26} />
      <ellipse cx={ORIGIN.x + 90} cy={590} rx={190} ry={16} opacity={0.6} />
      <ellipse cx={ORIGIN.x - 120} cy={596} rx={150} ry={12} opacity={0.5} />
    </g>
  );
}

const shade = def.radialGradient(
  {},
  <>
    <stop offset={0} stopColor={C.shadow} stopOpacity={0.34} />
    <stop offset={1} stopColor={C.shadow} stopOpacity={0} />
  </>,
);

export function Shadow(): SvgNode {
  return <ellipse cx={ORIGIN.x - 6} cy={604} rx={286} ry={30} fill={shade} />;
}

const FAR_ISLES = [
  { x: 168, y: 306, scale: 0.5, phase: 0.4, tree: 1 },
  { x: 818, y: 256, scale: 0.36, phase: 2.8, tree: 0 },
  { x: 74, y: 408, scale: 0.25, phase: 4.6, tree: 0 },
] as const;

const farLeaf = mix("#416b53", C.haze, 0.5);
const farRock = mix("#2c403b", C.haze, 0.55);

export function FarIsles(): SvgNode {
  return (
    <>
      {FAR_ISLES.map(({ x, y, scale, phase, tree }) => {
        const bob = sampled(
          (t) => ({
            x: Math.round(x + 3 * Math.sin((TAU * t) / D + phase)),
            y: Math.round(y + 4 * Math.sin((TAU * t * 2) / D + phase)),
          }),
          { duration: D, tolerance: { translate: 0.6 } },
        );

        return el.g({ animation: bob }, [
          el.g({ transform: `scale(${scale})`, opacity: 0.6 }, [
            el.path({
              d: "M-64 0C-42-12-16-14 0-13 20-13 48-8 63 0 42 8 20 10 0 9-20 10-44 7-64 0Z",
              fill: mix("#628b60", C.haze, 0.35),
            }),
            el.path({
              d: "M-61 1C-46 8-26 13 0 12 27 13 47 8 60 1 47 22 30 38 16 52 5 62-2 76-6 84-10 67-15 58-25 45-40 26-53 15-61 1Z",
              fill: farRock,
            }),
            el.path({
              d: "M-48 4C-36 50-22 70-8 76-18 58-24 30-28 8Z",
              fill: mix("#8aa578", C.haze, 0.55),
              opacity: 0.35,
            }),
            tree
              ? el.g({}, [
                  el.path({
                    d: "M2-12C1-22 0-30 2-40 4-31 4-22 4-12Z",
                    fill: mix("#3d5d4a", C.haze, 0.35),
                  }),
                  el.path({
                    d: "M-14-40C-11-54 3-60 15-52 26-45 26-31 14-25-2-18-15-26-14-40Z",
                    fill: farLeaf,
                  }),
                  el.path({
                    d: "M-4-44C0-54 9-57 17-51 10-50 3-47-4-44Z",
                    fill: mix("#73976a", C.haze, 0.45),
                    opacity: 0.7,
                  }),
                ])
              : el.path({ d: "M-12-13C-8-22 6-24 12-16 6-16-2-13-12-13Z", fill: farLeaf }),
          ]),
        ]);
      })}
    </>
  );
}

const pollen = def.radialGradient(
  {},
  <>
    <stop offset={0} stopColor={C.pollen} stopOpacity={0.9} />
    <stop offset={0.3} stopColor={C.pollen} stopOpacity={0.32} />
    <stop offset={1} stopColor={C.pollen} stopOpacity={0} />
  </>,
);

const MOTE_FIELDS = [
  { cx: 404, cy: 300, rx: 34, ry: 15, phase: 0.4, count: 10 },
  { cx: 564, cy: 372, rx: 30, ry: 12, phase: 2.2, count: 9 },
  { cx: 330, cy: 404, rx: 26, ry: 10, phase: 4.4, count: 8 },
] as const;

export function Motes(): SvgNode {
  const pick = random(313);

  const day = motion({ opacity: 0 })
    .at(4.6)
    .to({ opacity: 1 }, 3)
    .at(21.2)
    .to({ opacity: 0.2 }, 2.4);

  return (
    <g animation={day}>
      {MOTE_FIELDS.map(({ cx, cy, rx, ry, phase, count }, field) => {
        const drift = sampled(
          (t) => ({
            x: Math.round(
              14 * Math.sin((TAU * t) / D + phase) + 5 * Math.sin((TAU * t * 3) / D + phase * 2),
            ),
            y: Math.round(7 * Math.sin((TAU * t * 2) / D + phase * 1.3)),
          }),
          { duration: D, tolerance: { translate: 0.5 } },
        );

        return el.g({ animation: drift, fill: pollen }, [
          ...Array.from({ length: count }, (_, i) => {
            const angle = pick() * TAU;
            const radius = Math.sqrt(pick());
            const x = cx + Math.cos(angle) * rx * radius;
            const y = cy + Math.sin(angle) * ry * radius;

            return el.circle({
              cx: x,
              cy: y,
              r: 5 + pick() * 5,
              animation: wiggle(
                { opacity: 0.55 },
                { seed: `mote-${field}-${i}`, rate: 1.6, period: D / 4 },
              ),
            });
          }),
          ...Array.from({ length: count }, (_, i) => {
            const angle = pick() * TAU;
            const radius = Math.sqrt(pick());
            const x = cx + Math.cos(angle) * rx * radius;
            const y = cy + Math.sin(angle) * ry * radius;

            return el.circle({ cx: x, cy: y, r: 1.2 + pick() * 1.2, fill: "#fff5ce" });
          }),
        ]);
      })}
    </g>
  );
}

const fireflyHalo = def.radialGradient(
  {},
  <>
    <stop offset={0} stopColor={C.firefly} stopOpacity={0.85} />
    <stop offset={0.35} stopColor={C.firefly} stopOpacity={0.28} />
    <stop offset={1} stopColor="#c9ff8a" stopOpacity={0} />
  </>,
);

const FIREFLIES = (() => {
  const pick = random(811);

  return Array.from({ length: 22 }, (_, i) => ({
    x: 300 + pick() * 380,
    y: 388 + pick() * 120,
    r: 6 + pick() * 8,
    core: 1.2 + pick() * 1.4,
    twinkle: i % 4,
  }));
})();

export function Fireflies(): SvgNode {
  const night = motion({ opacity: 0 })
    .at(19.4)
    .to({ opacity: 1 }, 3)
    .at(25.6)
    .to({ opacity: 0 }, 1.6, ease.inOut);

  const drift = sampled(
    (t) => ({
      x: Math.round(8 * Math.sin((TAU * t) / D + 1.2)),
      y: Math.round(5 * Math.sin((TAU * t * 2) / D + 0.4)),
    }),
    { duration: D, tolerance: { translate: 0.5 } },
  );

  const pulses = [0, 1, 2, 3].map((k) =>
    wiggle({ opacity: 0.85 }, { seed: `fly-${k}`, rate: 1.4 + k * 0.2, period: D / 4 }),
  );

  return (
    <g animation={[night, drift]}>
      {FIREFLIES.map(({ x, y, r, core, twinkle: k }) => (
        <g animation={pulses[k]!}>
          <circle cx={x} cy={y} r={r} fill={fireflyHalo} />
          <circle cx={x} cy={y} r={core} fill="#fff8d2" />
        </g>
      ))}
    </g>
  );
}

const blossomBase = at([-3.85, 0, -1.55]);
const PETAL_COLORS = ["#f7cfc3", "#f3b4ab", "#ffe7d2", "#eaa0a0"] as const;

export function Petals(): SvgNode {
  const pick = random(931);

  return (
    <>
      {Array.from({ length: 15 }, (_, i) => {
        const phase = pick() * D;
        const startX = blossomBase.x + (pick() - 0.5) * 150;
        const startY = blossomBase.y - 190 + pick() * 90;
        const fall = 230 + pick() * 90;
        const flap = 16 + pick() * 22;
        const spin = (pick() - 0.5) * 260;

        const flight = sampled(
          (t) => {
            const u = ((t + phase) % D) / D;

            return {
              x: Math.round(startX + Math.sin(u * TAU * 3 + phase) * flap + u * 38),
              y: Math.round(startY + fall * u),
              rotate: Math.round(spin * u),
              opacity: Math.round(Math.min(1, Math.sin(Math.PI * u) * 1.6) * 80) / 100,
            };
          },
          { duration: D, tolerance: { translate: 1, rotate: 2, opacity: 0.05 } },
        );

        const length = 3.6 + pick() * 2.8;
        const width = length * 0.4;

        return el.path({
          d: leafPath({ x: 0, y: 2 }, { x: 0, y: -2 }, { x: width, y: 0.5 }, { x: -width, y: 0.5 }),
          fill: PETAL_COLORS[i % PETAL_COLORS.length]!,
          stroke: "none",
          animation: flight,
        });
      })}
    </>
  );
}

const BIRDS = [
  { dy: 0, size: 1.15, period: 0.56 },
  { dy: 12, size: 0.9, period: 0.7 },
  { dy: -9, size: 0.72, period: 0.8 },
] as const;

export function Birds(): SvgNode {
  return (
    <>
      {BIRDS.map(({ dy, size, period }, i) => {
        const flight = sampled(
          (t) => {
            const u = clamp((t - 7.4 - i * 0.4) / 9.2);

            return {
              x: Math.round(lerp(-80, 1050, u)),
              y: Math.round(138 + dy - 38 * Math.sin(u * Math.PI) + 5 * Math.sin(u * TAU * 2)),
              opacity: Math.round(Math.min(1, Math.sin(Math.PI * u) * 2.4) * 100) / 100,
            };
          },
          { duration: D, tolerance: { translate: 1, opacity: 0.04 } },
        );

        const wing = (side: 1 | -1) =>
          motion({ rotate: -15 * side })
            .to({ rotate: 17 * side }, period / 2, ease.inOut)
            .to({ rotate: -15 * side }, period / 2, ease.inOut)
            .loop(period);

        const origin = (side: number) =>
          ({
            transformBox: "fill-box",
            transformOrigin: side === -1 ? "0% 100%" : "100% 100%",
          }) as const;

        return el.g({ animation: flight }, [
          el.g({ animation: wing(-1), style: origin(-1) }, [
            el.path({
              d: `M0 0Q${-4.6 * size} ${-6.4 * size} ${-9.4 * size} ${-1.7 * size}Q${-4.8 * size} ${-2.2 * size} 0 0Z`,
              fill: alpha(C.ink, 0.68),
            }),
          ]),
          el.g({ animation: wing(1), style: origin(1) }, [
            el.path({
              d: `M0 0Q${4.6 * size} ${-6.4 * size} ${9.4 * size} ${-1.7 * size}Q${4.8 * size} ${-2.2 * size} 0 0Z`,
              fill: alpha(C.ink, 0.68),
            }),
          ]),
          el.path({
            d: `M0 ${-0.6 * size}L0 ${2.6 * size}`,
            fill: "none",
            stroke: alpha(C.ink, 0.55),
            strokeWidth: 1.1 * size,
            strokeLinecap: "round",
          }),
        ]);
      })}
    </>
  );
}

const screenLeaf = (x: number, y: number, angle: number, length: number, width: number): string => {
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const nx = -dy;
  const ny = dx;
  const base = { x: x - (dx * length) / 2, y: y - (dy * length) / 2 };
  const tip = { x: x + (dx * length) / 2, y: y + (dy * length) / 2 };
  const waist = { x: x + dx * length * 0.06, y: y + dy * length * 0.06 };

  return leafPath(
    base,
    tip,
    { x: waist.x + nx * width * 0.5, y: waist.y + ny * width * 0.5 },
    { x: waist.x - nx * width * 0.5, y: waist.y - ny * width * 0.5 },
  );
};

export function Foreground(): SvgNode {
  const sway = wiggle({ rotate: 0.55, x: 0.9 }, { seed: "foreground", rate: 0.45, period: D });
  const dark = "#0d2925";
  const deeper = "#071c1a";

  const leaves = [
    [884, 8, -1.25, 40, 14],
    [906, 16, 0.35, 34, 12],
    [928, 24, -0.9, 32, 11],
    [860, 58, -2.2, 42, 15],
    [846, 34, -0.2, 36, 12],
    [898, 52, 1.4, 30, 11],
    [878, 88, 2.1, 38, 13],
    [852, 100, 0.3, 30, 11],
    [834, 78, -2.6, 34, 12],
    [940, 66, -1.6, 28, 10],
  ] as const;

  return (
    <g animation={sway} style={{ transformBox: "view-box", transformOrigin: "1010px -10px" }}>
      <path
        d="M1010-10C950 6 906 34 872 72"
        fill="none"
        stroke={deeper}
        strokeWidth={9}
        strokeLinecap="round"
      />
      <path
        d="M948 16C938 4 922 2 904 8"
        fill="none"
        stroke={deeper}
        strokeWidth={4.5}
        strokeLinecap="round"
      />
      <path
        d="M916 38C902 54 892 72 884 92"
        fill="none"
        stroke={deeper}
        strokeWidth={4}
        strokeLinecap="round"
      />
      <path
        d="M900 50C920 46 934 52 944 64"
        fill="none"
        stroke={dark}
        strokeWidth={3.2}
        strokeLinecap="round"
      />
      <g fill={dark}>
        {leaves.map(([x, y, angle, length, width]) => (
          <path d={screenLeaf(x, y, angle, length, width)} />
        ))}
      </g>
      <g fill={deeper} opacity={0.85}>
        <path d={screenLeaf(918, 12, 0.9, 30, 10)} />
        <path d={screenLeaf(868, 46, 2.6, 26, 9)} />
        <path d={screenLeaf(904, 82, -1.9, 24, 9)} />
      </g>
    </g>
  );
}

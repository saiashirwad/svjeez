import { def, ease, el, enter, motion, sampled, wiggle, type Color, type Motion, type Seconds, type SvgNode } from "svg-motion";
import { C, D, H, ORIGIN, T, W, alpha, at, clamp, hazed, lerp, mix, random } from "./kit";
import { leaf as leafPath } from "./draw";
import { TAU, type Vec3 } from "./space";

type Keys = readonly (readonly [Seconds, Color])[];

/** Hold the first color, then ease to each next one by its time. */
const grade = (first: Color, keys: Keys): Motion<"stopColor"> => {
  let track = motion({ stopColor: first });
  let from = 0;
  for (const [time, color] of keys) {
    track = track.at(from).to({ stopColor: color }, time - from, ease.inOut);
    from = time;
  }
  return track;
};

const sky = def.linearGradient({ x1: 0, y1: 0, x2: 0, y2: 1 }, (
  <>
    <stop offset={0} stopColor={C.nightTop} animation={grade(C.nightTop, [[1.4, C.nightTop], [3.4, C.dawnTop], [8.6, C.dayTop], [14.8, C.dayTop], [20.2, C.duskTop], [23.6, C.nightTop], [D, C.nightTop]])} />
    <stop offset={0.62} stopColor={C.nightMid} animation={grade(C.nightMid, [[1.4, C.nightMid], [3.6, C.dawnMid], [8.8, C.dayMid], [15, C.dayMid], [20.4, C.duskMid], [23.8, C.nightMid], [D, C.nightMid]])} />
    <stop offset={1} stopColor={C.nightBot} animation={grade(C.nightBot, [[1.4, C.nightBot], [3.8, C.dawnBot], [9, C.dayBot], [15.2, C.dayBot], [20.6, C.duskBot], [24, C.nightBot], [D, C.nightBot]])} />
  </>
));

const horizon = def.radialGradient({ gradientUnits: "userSpaceOnUse", cx: 430, cy: 400, r: 430 }, (
  <>
    <stop offset={0} stopColor="#ffdc9e" stopOpacity={0.5} />
    <stop offset={0.5} stopColor="#f3b479" stopOpacity={0.18} />
    <stop offset={1} stopColor="#f3b479" stopOpacity={0} />
  </>
));

export function Backdrop(): SvgNode {
  const warm = motion({ opacity: 0.15 }).at(3).to({ opacity: 0.8 }, 4, ease.inOut).at(14).to({ opacity: 0.35 }, 4, ease.inOut).at(19.6).to({ opacity: 0.9 }, 2.4, ease.inOut).at(23.6).to({ opacity: 0.15 }, 2.4, ease.inOut);
  const vignette = def.radialGradient({ gradientUnits: "userSpaceOnUse", cx: W / 2, cy: H * 0.46, r: W * 0.62 }, (
    <>
      <stop offset={0.45} stopColor="#000000" stopOpacity={0} />
      <stop offset={1} stopColor="#000000" stopOpacity={0.45} />
    </>
  ));
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
  const night = motion({ opacity: 1 }).at(3.4).to({ opacity: 0 }, 2.6, ease.inOut).at(20.6).to({ opacity: 1 }, 3, ease.inOut);
  return (
    <g fill={C.star} animation={night}>
      {STARS.map(({ x, y, r, twinkle: flicker }, i) =>
        el.circle({ cx: x, cy: y, r, opacity: flicker ? undefined : 0.8, animation: flicker ? twinkle[i % 2]! : undefined }),
      )}
      {el.path({ d: "M182 84l2.2 6.4 6.4 2.2-6.4 2.2-2.2 6.4-2.2-6.4-6.4-2.2 6.4-2.2z", fill: C.star, opacity: 0.8 })}
      {el.path({ d: "M812 188l1.5 4.4 4.4 1.5-4.4 1.5-1.5 4.4-1.5-4.4-4.4-1.5 4.4-1.5z", fill: C.star, opacity: 0.55 })}
    </g>
  );
}

const sunHalo = def.radialGradient({}, (
  <>
    <stop offset={0} stopColor={C.sun} stopOpacity={0.55} />
    <stop offset={0.42} stopColor={C.sun} stopOpacity={0.18} />
    <stop offset={1} stopColor={C.sun} stopOpacity={0} />
  </>
));

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
  return el.g({ animation: sampled(sunAt, { duration: D, tolerance: { translate: 1, opacity: 0.02 } }) }, [
    el.circle({ r: 154, fill: sunHalo }),
    el.circle({ r: 46, fill: C.sun }),
    el.circle({ r: 33, fill: C.sunCore }),
  ]);
}

const moonHalo = def.radialGradient({}, (
  <>
    <stop offset={0} stopColor={C.moon} stopOpacity={0.3} />
    <stop offset={1} stopColor={C.moon} stopOpacity={0} />
  </>
));

const crescent = def.mask({ maskUnits: "userSpaceOnUse", x: 748, y: 72, width: 96, height: 96 }, (
  <>
    <circle cx={792} cy={120} r={23} fill="white" />
    <circle cx={801} cy={113} r={18} fill="black" />
  </>
));

export function Moon(): SvgNode {
  const night = motion({ opacity: 0 }).at(20).to({ opacity: 1 }, 3, ease.inOut).at(2.2).to({ opacity: 0 }, 2.2, ease.inOut);
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
  const cloud = def.linearGradient({ x1: 0, y1: 0, x2: 0, y2: 1 }, (
    <>
      <stop offset={0} stopColor="#fff2d6" stopOpacity={0.9} />
      <stop offset={1} stopColor="#f8cfa3" stopOpacity={0.15} />
    </>
  ));
  const day = motion({ opacity: 0.35 }).at(3).to({ opacity: 1 }, 5, ease.inOut).at(20).to({ opacity: 0.3 }, 3, ease.inOut);
  return (
    <g fill={cloud} animation={day}>
      {CLOUDS.map(({ x, y, w, h, phase, opacity }) => {
        const drift = sampled(
          (t) => ({ x: Math.round(x + 16 * Math.sin((TAU * t) / D + phase)), y: Math.round(y + 2.4 * Math.sin((TAU * t * 2) / D + phase)) }),
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

/** Soft mist below the island. */
export function Mist(): SvgNode {
  const haze = def.radialGradient({}, (
    <>
      <stop offset={0} stopColor="#d8e7d2" stopOpacity={0.32} />
      <stop offset={1} stopColor="#d8e7d2" stopOpacity={0} />
    </>
  ));
  return (
    <g fill={haze}>
      <ellipse cx={ORIGIN.x - 20} cy={565} rx={260} ry={26} />
      <ellipse cx={ORIGIN.x + 90} cy={590} rx={190} ry={16} opacity={0.6} />
      <ellipse cx={ORIGIN.x - 120} cy={596} rx={150} ry={12} opacity={0.5} />
    </g>
  );
}

const shade = def.radialGradient({}, (
  <>
    <stop offset={0} stopColor={C.shadow} stopOpacity={0.34} />
    <stop offset={1} stopColor={C.shadow} stopOpacity={0} />
  </>
));

export function Shadow(): SvgNode {
  return <ellipse cx={ORIGIN.x - 6} cy={604} rx={286} ry={30} fill={shade} />;
}

/** Tiny islands adrift in the haze, quiet enough not to compete. */
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
          (t) => ({ x: Math.round(x + 3 * Math.sin((TAU * t) / D + phase)), y: Math.round(y + 4 * Math.sin((TAU * t * 2) / D + phase)) }),
          { duration: D, tolerance: { translate: 0.6 } },
        );
        return el.g({ animation: bob }, [
          el.g({ transform: `translate(${x} ${y}) scale(${scale})`, opacity: 0.75 }, [
            el.path({ d: "M-64 0C-42-12-16-14 0-13 20-13 48-8 63 0 42 8 20 10 0 9-20 10-44 7-64 0Z", fill: mix("#628b60", C.haze, 0.35) }),
            el.path({ d: "M-61 1C-46 8-26 13 0 12 27 13 47 8 60 1 47 22 30 38 16 52 5 62-2 76-6 84-10 67-15 58-25 45-40 26-53 15-61 1Z", fill: farRock }),
            el.path({ d: "M-48 4C-36 50-22 70-8 76-18 58-24 30-28 8Z", fill: mix("#8aa578", C.haze, 0.55), opacity: 0.35 }),
            tree
              ? el.g({}, [
                  el.path({ d: "M2-12C1-22 0-30 2-40 4-31 4-22 4-12Z", fill: mix("#3d5d4a", C.haze, 0.35) }),
                  el.path({ d: "M-14-40C-11-54 3-60 15-52 26-45 26-31 14-25-2-18-15-26-14-40Z", fill: farLeaf }),
                  el.path({ d: "M-4-44C0-54 9-57 17-51 10-50 3-47-4-44Z", fill: mix("#73976a", C.haze, 0.45), opacity: 0.7 }),
                ])
              : el.path({ d: "M-12-13C-8-22 6-24 12-16 6-16-2-13-12-13Z", fill: farLeaf }),
          ]),
        ]);
      })}
    </>
  );
}

const pollen = def.radialGradient({}, (
  <>
    <stop offset={0} stopColor={C.pollen} stopOpacity={0.9} />
    <stop offset={0.3} stopColor={C.pollen} stopOpacity={0.32} />
    <stop offset={1} stopColor={C.pollen} stopOpacity={0} />
  </>
));

const MOTE_FIELDS = [
  { cx: 404, cy: 300, rx: 34, ry: 15, phase: 0.4, count: 10 },
  { cx: 564, cy: 372, rx: 30, ry: 12, phase: 2.2, count: 9 },
  { cx: 330, cy: 404, rx: 26, ry: 10, phase: 4.4, count: 8 },
] as const;

/** Golden dust in the light, and brighter fireflies after dusk. */
export function Motes(): SvgNode {
  const pick = random(313);
  const day = motion({ opacity: 0 }).at(4.6).to({ opacity: 1 }, 3).at(21.2).to({ opacity: 0.2 }, 2.4);
  return (
    <g animation={day}>
      {MOTE_FIELDS.map(({ cx, cy, rx, ry, phase, count }, field) => {
        const drift = sampled(
          (t) => ({
            x: Math.round(14 * Math.sin((TAU * t) / D + phase) + 5 * Math.sin((TAU * t * 3) / D + phase * 2)),
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
              animation: wiggle({ opacity: 0.55 }, { seed: `mote-${field}-${i}`, rate: 1.6, period: D / 4 }),
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

const fireflyHalo = def.radialGradient({}, (
  <>
    <stop offset={0} stopColor={C.firefly} stopOpacity={0.85} />
    <stop offset={0.35} stopColor={C.firefly} stopOpacity={0.28} />
    <stop offset={1} stopColor="#c9ff8a" stopOpacity={0} />
  </>
));

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
  const night = motion({ opacity: 0 }).at(19.4).to({ opacity: 1 }, 3).at(25.6).to({ opacity: 0 }, 1.6, ease.inOut);
  const drift = sampled(
    (t) => ({ x: Math.round(8 * Math.sin((TAU * t) / D + 1.2)), y: Math.round(5 * Math.sin((TAU * t * 2) / D + 0.4)) }),
    { duration: D, tolerance: { translate: 0.5 } },
  );
  const pulses = [0, 1, 2, 3].map((k) => wiggle({ opacity: 0.85 }, { seed: `fly-${k}`, rate: 1.4 + k * 0.2, period: D / 4 }));
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

/** Petals shaken loose from the blossom tree, each on its own fall. */
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
  { dy: 0, phase: 0, size: 1 },
  { dy: 12, phase: -0.06, size: 0.8 },
  { dy: -9, phase: 0.09, size: 0.7 },
] as const;

export function Birds(): SvgNode {
  return (
    <>
      {BIRDS.map(({ dy, phase, size }, i) => {
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
        return el.g({ animation: flight }, [
          el.path({
            d: `M${-8 * size} 0Q${-4 * size} ${-5 * size} 0 0Q${4 * size} ${-5 * size} ${8 * size} 0`,
            fill: "none",
            stroke: alpha(C.ink, 0.55),
            strokeWidth: 1.2 * size,
            strokeLinecap: "round",
          }),
        ]);
      })}
    </>
  );
}

/** A dark branch and leaves out of focus at the top-right, framing the grove. */
export function Foreground(): SvgNode {
  const sway = wiggle({ rotate: 0.8, x: 1.1 }, { seed: "foreground", rate: 0.5, period: D });
  const dark = "#0a2221";
  const darker = "#071918";
  return (
    <g animation={sway} style={{ transformBox: "view-box", transformOrigin: "980px 30px" }}>
      <path d="M980 22C928 26 880 56 842 94 822 116 802 130 778 136" fill="none" stroke={darker} strokeWidth={13} strokeLinecap="round" />
      <path d="M880 54C872 36 856 24 838 20" fill="none" stroke={darker} strokeWidth={7} strokeLinecap="round" />
      <path d="M916 34C930 18 944 12 964 10" fill="none" stroke={dark} strokeWidth={5} strokeLinecap="round" />
      <g fill={dark}>
        <path d={leafPath({ x: 838, y: 20 }, { x: 820, y: 2 }, { x: 826, y: 22 }, { x: 842, y: 30 })} />
        <path d={leafPath({ x: 866, y: 40 }, { x: 882, y: 14 }, { x: 872, y: 30 }, { x: 866, y: 44 })} />
        <path d={leafPath({ x: 902, y: 44 }, { x: 900, y: 14 }, { x: 914, y: 28 }, { x: 906, y: 46 })} />
        <path d={leafPath({ x: 930, y: 26 }, { x: 952, y: 6 }, { x: 940, y: 22 }, { x: 930, y: 32 })} />
        <path d={leafPath({ x: 794, y: 122 }, { x: 770, y: 102 }, { x: 782, y: 120 }, { x: 800, y: 132 })} />
        <path d={leafPath({ x: 812, y: 124 }, { x: 826, y: 102 }, { x: 817, y: 120 }, { x: 808, y: 130 })} />
        <path d={leafPath({ x: 852, y: 84 }, { x: 848, y: 60 }, { x: 858, y: 72 }, { x: 858, y: 88 })} />
      </g>
      <g fill={darker} opacity={0.85}>
        <path d={leafPath({ x: 886, y: 60 }, { x: 902, y: 40 }, { x: 892, y: 54 }, { x: 884, y: 64 })} />
        <path d={leafPath({ x: 846, y: 104 }, { x: 826, y: 90 }, { x: 838, y: 102 }, { x: 850, y: 112 })} />
      </g>
    </g>
  );
}

/** Out-of-focus grass at the bottom-left, to sit in front of the island's edge. */
export function ForegroundGrass(): SvgNode {
  const sway = wiggle({ rotate: -1.1, x: -1.2 }, { seed: "front-grass", rate: 0.7, period: D });
  return (
    <g animation={sway} style={{ transformBox: "view-box", transformOrigin: "20px 640px" }} fill="none" stroke="#081d1c" strokeLinecap="round">
      <path d="M-8 650C24 560 66 518 122 492" strokeWidth={14} opacity={0.9} />
      <path d="M34 650C52 576 84 536 136 514" strokeWidth={9} opacity={0.8} />
      <path d="M62 650C82 584 108 552 156 538" strokeWidth={6} opacity={0.6} />
      <path d="M-16 632C12 572 32 542 62 522" strokeWidth={5} opacity={0.5} />
    </g>
  );
}

/** A gentle wash of warm light before the camera, and a cool weight after dusk. */
export function Tint(): SvgNode {
  const glow = def.radialGradient({ gradientUnits: "userSpaceOnUse", cx: 450, cy: 360, r: 520 }, (
    <>
      <stop offset={0} stopColor="#ffd79a" stopOpacity={0} />
      <stop offset={1} stopColor="#2a3f5e" stopOpacity={0.28} />
    </>
  ));
  const mood = motion({ opacity: 0.2 }).to({ opacity: 0.55 }, 7, ease.inOut).at(17).to({ opacity: 0.35 }, 4, ease.inOut).at(22).to({ opacity: 0.75 }, 3, ease.inOut).at(D - 3).to({ opacity: 0.2 }, 3, ease.inOut);
  return <rect width={W} height={H} fill={glow} animation={mood} style={{ mixBlendMode: "multiply" }} />;
}

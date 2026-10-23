import { def, ease, motion, render, wiggle, type Color, type SvgNode } from "svg-motion";

const W = 800;
const H = 1000;
const D = 24;
const TAU = Math.PI * 2;

const C = {
  paperTop: "#FCF8EE",
  paperMid: "#F5EFE2",
  paperBottom: "#E6E8DA",
  sun: "#FFF4D3",
  sunCore: "#FFF9E8",
  meadow: "#D6DFC7",
  haze: "#A8B393",
  stalk: "#B5A57B",
  stalkLight: "#D8C9A2",
  stem: "#7B926A",
  stemBack: "#667B5E",
  stemLight: "#C3CEAD",
  leaf: "#7E986D",
  leafDeep: "#6A8561",
  leafEdge: "#61765A",
  leafVein: "#C6D2B1",
  sepals: "#879B74",
  sepalsDeep: "#6A805D",
  flowerShadow: "#77634B",
  whiteBand: "#D8A3AE",
  blushBand: "#C58A98",
  ink: "#7B806C",
  inkFaint: "#8E927F",
} as const;

const CSS = `.serif{font-family:"Iowan Old Style","Palatino Linotype",Palatino,Georgia,serif}`;

interface P {
  readonly x: number;
  readonly y: number;
}

const n = (value: number): string => (Math.round(value * 10) / 10).toString();

const at = (points: readonly P[], index: number): P => points[Math.max(0, Math.min(points.length - 1, index))]!;

/** A smooth Catmull-Rom path through points. Closed paths return to the first point. */
const smoothPath = (points: readonly P[], closed = false): string => {
  if (points.length === 0) return "";
  const wrapped = (index: number): P => points[closed ? (index + points.length) % points.length : Math.max(0, Math.min(points.length - 1, index))]!;
  let d = `M${n(points[0]!.x)} ${n(points[0]!.y)}`;
  const segments = closed ? points.length : points.length - 1;
  for (let i = 0; i < segments; i++) {
    const p0 = wrapped(i - 1);
    const p1 = wrapped(i);
    const p2 = wrapped(i + 1);
    const p3 = wrapped(i + 2);
    d += `C${n(p1.x + (p2.x - p0.x) / 6)} ${n(p1.y + (p2.y - p0.y) / 6)} ${n(p2.x - (p3.x - p1.x) / 6)} ${n(p2.y - (p3.y - p1.y) / 6)} ${n(p2.x)} ${n(p2.y)}`;
  }
  return closed ? `${d}Z` : d;
};

const polar = (radius: number, angle: number): P => ({ x: Math.cos(angle) * radius, y: Math.sin(angle) * radius });

// ---------------------------------------------------------------------------
// The meadow stalk and the vine that winds around it

const clamp01 = (t: number): number => Math.max(0, Math.min(1, t));

const SOIL_Y = 1008;
const ROOT_Y = 900;
const TIP_Y = 276;
const PITCH = 160;

const axisX = (y: number): number => 430 + (1000 - y) * 0.012 + Math.sin((1000 - y) / 230 + 0.5) * 12;
const vineRadius = (y: number): number => 40 - (ROOT_Y - Math.min(y, ROOT_Y)) * 0.024;
const vinePhase = (y: number): number => Math.PI + ((ROOT_Y - Math.min(y, ROOT_Y)) * TAU) / PITCH;
const vinePoint = (y: number): P => {
  const lean = (clamp01((y - ROOT_Y) / (SOIL_Y - ROOT_Y)) ** 2) * 34;
  return { x: axisX(y) + Math.cos(vinePhase(y)) * vineRadius(y) - lean, y };
};
const inFront = (y: number): boolean => y >= ROOT_Y || Math.sin(vinePhase(y)) >= 0;
const sideOf = (y: number): 1 | -1 => (vinePoint(y).x >= axisX(y) ? 1 : -1);
const vineWidth = (y: number): number => 1.8 + clamp01((y - TIP_Y) / (SOIL_Y - TIP_Y)) * 1.6;

const STALK_TOP = 214;
const SUPPORT = Array.from({ length: 15 }, (_, i) => {
  const y = 1012 - (i * (1012 - STALK_TOP)) / 14;
  return { x: axisX(y), y };
});
const stalkWidth = (y: number): number => 1.2 + ((y - STALK_TOP) / (1012 - STALK_TOP)) * 2.6;
const ribbon = (spine: readonly P[], width: (t: number) => number): string => {
  const normal = (i: number): P => {
    const a = at(spine, i - 1);
    const b = at(spine, i + 1);
    const length = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    return { x: -(b.y - a.y) / length, y: (b.x - a.x) / length };
  };
  const offset = (sign: 1 | -1) =>
    spine.map((point, i) => {
      const half = (width(i / (spine.length - 1)) / 2) * sign;
      const normalAt = normal(i);
      return { x: point.x + normalAt.x * half, y: point.y + normalAt.y * half };
    });
  return smoothPath([...offset(1), ...offset(-1).reverse()], true);
};
const supportTaper = ribbon(SUPPORT, (t) => stalkWidth(SUPPORT[Math.round(t * (SUPPORT.length - 1))]!.y));
const STALK_NODES = [868, 676, 482] as const;
const SHEATH = ((): string => {
  const node = { x: axisX(STALK_NODES[0]), y: STALK_NODES[0] };
  const spine = [
    { x: 0, y: 0 },
    { x: 10, y: -14 },
    { x: 30, y: -28 },
    { x: 56, y: -33 },
    { x: 82, y: -27 },
    { x: 100, y: -12 },
    { x: 108, y: 4 },
  ].map((offset) => ({ x: node.x - offset.x * 0.82, y: node.y + offset.y * 0.9 }));
  return ribbon(spine, (t) => 6.5 * (1 - t) ** 0.8 + 0.3);
})();
const supportShine = smoothPath(SUPPORT.map((point) => ({ x: point.x - 0.5, y: point.y })));

const SEEDHEAD = ((): readonly P[] => {
  const top = SUPPORT[SUPPORT.length - 1]!;
  return [
    { x: 0, y: 0 },
    { x: 3, y: -14 },
    { x: 10, y: -30 },
    { x: 19, y: -46 },
    { x: 27, y: -61 },
    { x: 31, y: -74 },
    { x: 28, y: -84 },
  ].map((offset) => ({ x: top.x + offset.x, y: top.y + offset.y }));
})();

interface Run {
  readonly points: readonly P[];
  readonly width: number;
}

interface Runs {
  readonly front: readonly Run[];
  readonly back: readonly Run[];
}

const vineRuns = (): Runs => {
  const front: Run[] = [];
  const back: Run[] = [];
  let run: P[] = [];
  let side = inFront(SOIL_Y);
  const close = (): void => {
    const width = vineWidth(run.reduce((sum, point) => sum + point.y, 0) / run.length);
    (side ? front : back).push({ points: run, width });
  };
  for (let y = SOIL_Y; y >= TIP_Y; y -= 4) {
    const point = vinePoint(y);
    run.push(point);
    if (inFront(y) !== side) {
      close();
      run = [point];
      side = !side;
    }
  }
  close();
  return { front, back };
};

const VINE = vineRuns();

const shootTip = ((): string => {
  const end = vinePoint(TIP_Y);
  const before = vinePoint(TIP_Y + 4);
  const hook = [
    { x: -6, y: -12 },
    { x: -15, y: -25 },
    { x: -28, y: -34 },
    { x: -41, y: -36 },
    { x: -50, y: -30 },
    { x: -51, y: -21 },
    { x: -45, y: -16 },
  ];
  return smoothPath([before, end, ...hook.map((offset) => ({ x: end.x + offset.x, y: end.y + offset.y }))]);
})();

// ---------------------------------------------------------------------------
// Leaves

interface LeafSite {
  readonly y: number;
  readonly droop: number;
  readonly scale: number;
  readonly stalk: number;
  readonly mirror: boolean;
  readonly seed: string;
  readonly dark?: boolean;
  readonly dew?: boolean;
  readonly drip?: boolean;
  readonly ladybird?: boolean;
}

const LEAF_SITES: readonly LeafSite[] = [
  { y: 902, droop: 30, scale: 0.96, stalk: 18, mirror: true, seed: "leaf-root", dark: true },
  { y: 822, droop: 22, scale: 1.24, stalk: 24, mirror: false, seed: "leaf-1", dew: true },
  { y: 742, droop: 16, scale: 1.16, stalk: 22, mirror: true, seed: "leaf-2", drip: true },
  { y: 662, droop: 26, scale: 1.12, stalk: 26, mirror: true, seed: "leaf-3", dark: true, ladybird: true },
  { y: 584, droop: 12, scale: 1.08, stalk: 22, mirror: false, seed: "leaf-4", dew: true },
  { y: 504, droop: 36, scale: 1, stalk: 20, mirror: false, seed: "leaf-5" },
  { y: 424, droop: 20, scale: 0.94, stalk: 20, mirror: true, seed: "leaf-6", dark: true, drip: true },
  { y: 346, droop: 2, scale: 0.78, stalk: 18, mirror: false, seed: "leaf-7" },
  { y: 284, droop: 14, scale: 0.56, stalk: 13, mirror: true, seed: "leaf-8" },
];

const leafD = smoothPath(
  [
    { x: 0, y: 0 },
    { x: -4, y: -7 },
    { x: -11, y: -15 },
    { x: -12, y: -20 },
    { x: -5, y: -20.5 },
    { x: 7, y: -19 },
    { x: 20, y: -16 },
    { x: 33, y: -11.5 },
    { x: 46, y: -6.5 },
    { x: 57, y: -2.2 },
    { x: 64, y: 0 },
    { x: 57, y: 2.2 },
    { x: 46, y: 6.5 },
    { x: 33, y: 11.5 },
    { x: 20, y: 16 },
    { x: 7, y: 19 },
    { x: -5, y: 20.5 },
    { x: -12, y: 20 },
    { x: -11, y: 15 },
    { x: -4, y: 7 },
  ],
  true,
);
const leafShade = smoothPath(
  [
    { x: 64, y: 0 },
    { x: 57, y: 2.2 },
    { x: 46, y: 6.5 },
    { x: 33, y: 11.5 },
    { x: 20, y: 16 },
    { x: 7, y: 19 },
    { x: -5, y: 20.5 },
    { x: -12, y: 20 },
    { x: -11, y: 15 },
    { x: -4, y: 7 },
    { x: 0, y: 0 },
    { x: 32, y: 0.3 },
  ],
  true,
);
const leafMidrib = smoothPath([
  { x: 0, y: 0 },
  { x: 20, y: 0.4 },
  { x: 40, y: 0.2 },
  { x: 57, y: 0 },
]);
const leafVeins = [
  { d: "M10 0Q18 -6 24 -13", opacity: 0.4 },
  { d: "M25 0Q32 -5 38 -9", opacity: 0.34 },
  { d: "M11 0Q19 6 25 13", opacity: 0.36 },
  { d: "M26 0Q33 5 39 9", opacity: 0.28 },
  { d: "M1 -1Q-4 -9 -8 -16", opacity: 0.3 },
  { d: "M1 1Q-4 9 -8 16", opacity: 0.26 },
] as const;

interface LeafProps {
  readonly x: number;
  readonly y: number;
  readonly angle: number;
  readonly scale: number;
  readonly stalk: number;
  readonly seed: string;
  readonly mirror?: boolean;
  readonly dark?: boolean;
  readonly dew?: boolean;
  readonly drip?: boolean;
  readonly ladybird?: boolean;
}

const Ladybird = (): SvgNode => (
  <g transform="translate(27 5) rotate(-8) scale(1.45)" animation={wiggle({ rotate: 6 }, { seed: "ladybird", rate: 0.4, period: 24 })} style={{ transformBox: "fill-box", transformOrigin: "center" }}>
    <ellipse cx={0.6} cy={0.6} rx={4.6} ry={3.9} fill="#3E4A33" opacity={0.25} />
    <path d="M3.6 -2.2Q6.6 0 3.6 2.2Z" fill="#2E2A26" />
    <ellipse cx={0} cy={0} rx={4.3} ry={3.6} fill="#C9574A" />
    <path d="M-4.3 0H4" stroke="#3A2C27" strokeWidth={0.45} strokeOpacity={0.7} />
    <circle cx={1.6} cy={-1.7} r={0.85} fill="#2E2A26" />
    <circle cx={1.6} cy={1.7} r={0.85} fill="#2E2A26" />
    <circle cx={-1.8} cy={-1.9} r={0.7} fill="#2E2A26" />
    <circle cx={-1.8} cy={1.9} r={0.7} fill="#2E2A26" />
    <ellipse cx={1.2} cy={-1.4} rx={1.6} ry={0.7} fill="#FFF3E6" opacity={0.45} />
  </g>
);

const Leaf = ({ x, y, angle, scale, stalk, seed, mirror = false, dark = false, dew = false, drip = false, ladybird = false }: LeafProps): SvgNode => (
  <g style={{ transformBox: "view-box", transformOrigin: `${n(x)}px ${n(y)}px` }} animation={wiggle({ rotate: 2.2 }, { seed, rate: 0.6, period: 24 })}>
    <g transform={`translate(${n(x)} ${n(y)}) rotate(${n(angle)}) scale(${scale} ${mirror ? -scale : scale})`}>
      <path d={`M0 0Q${n(stalk * 0.5)} -3.5 ${n(stalk)} 0`} fill="none" stroke={C.stem} strokeWidth={1.5 / scale} strokeLinecap="round" />
      <g transform={`translate(${n(stalk)} 0)`}>
        <path d={leafD} fill={dark ? C.leafDeep : leafWash} stroke={C.leafEdge} strokeWidth={0.8} strokeOpacity={0.38} />
        <path d={leafShade} fill={C.leafEdge} opacity={0.2} />
        <path d={leafMidrib} fill="none" stroke={C.leafVein} strokeWidth={1.2} strokeOpacity={0.5} />
        {leafVeins.map((vein, index) => (
          <path key={index} d={vein.d} fill="none" stroke={C.leafVein} strokeWidth={0.7} strokeLinecap="round" strokeOpacity={vein.opacity} />
        ))}
        <path d="M6 -12C21 -13 38 -9 53 -3.4" fill="none" stroke="#E2EACF" strokeWidth={1.4} strokeLinecap="round" strokeOpacity={0.3} />
        {dew && (
          <g animation={dewGlint}>
            <ellipse cx={34} cy={-3.2} rx={2.3} ry={3} fill="#FFFDF4" fillOpacity={0.6} />
            <circle cx={33.3} cy={-4.2} r={0.7} fill="#FFFFFF" fillOpacity={0.95} />
          </g>
        )}
        {drip && (
          <g animation={dewGlint}>
            <circle cx={65.5} cy={0} r={2.4 / scale} fill="#FBFCF3" fillOpacity={0.55} stroke="#A9B897" strokeWidth={0.4} strokeOpacity={0.5} />
            <circle cx={65} cy={-0.6} r={0.6} fill="#FFFFFF" />
          </g>
        )}
        {ladybird && <Ladybird />}
      </g>
    </g>
  </g>
);

const leafAt = (site: LeafSite): LeafProps => {
  const anchor = vinePoint(site.y);
  const right = sideOf(site.y) > 0;
  return { ...site, x: anchor.x, y: anchor.y, angle: right ? site.droop : 180 - site.droop, mirror: right ? site.mirror : !site.mirror };
};

const LEAVES = LEAF_SITES.map(leafAt);

// ---------------------------------------------------------------------------
// Flowers

const WHITE_FACE = def.radialGradient({ cx: 0.5, cy: 0.48, r: 0.72 }, (
  <>
    <stop offset={0} stopColor="#F0CD84" />
    <stop offset={0.12} stopColor="#F8E3B1" />
    <stop offset={0.28} stopColor="#FFFDF5" />
    <stop offset={0.76} stopColor="#FFFCF3" />
    <stop offset={0.93} stopColor="#F7E6E3" />
    <stop offset={1} stopColor="#EFD9DD" />
  </>
));

const BLUSH_FACE = def.radialGradient({ cx: 0.5, cy: 0.48, r: 0.72 }, (
  <>
    <stop offset={0} stopColor="#EEC77F" />
    <stop offset={0.12} stopColor="#F7DDAF" />
    <stop offset={0.29} stopColor="#FDF5EE" />
    <stop offset={0.61} stopColor="#F9E4E6" />
    <stop offset={0.9} stopColor="#EECAD2" />
    <stop offset={1} stopColor="#E4B8C2" />
  </>
));

const THROAT = def.radialGradient({ cx: 0.5, cy: 0.5, r: 0.5 }, (
  <>
    <stop offset={0} stopColor="#FFF3C8" />
    <stop offset={0.4} stopColor="#F8DD9A" />
    <stop offset={0.8} stopColor="#F1CA80" stopOpacity={0.55} />
    <stop offset={1} stopColor="#F1CA80" stopOpacity={0} />
  </>
));

const BUD_WASH = def.linearGradient({ x1: 0.1, y1: 1, x2: 0.55, y2: 0 }, (
  <>
    <stop offset={0} stopColor="#E7E5D0" />
    <stop offset={0.24} stopColor="#F4EDE2" />
    <stop offset={0.64} stopColor="#F7E7E8" />
    <stop offset={1} stopColor="#EED3D8" />
  </>
));

const leafWash = def.linearGradient({ x1: 0, y1: 0.5, x2: 1, y2: 0.5 }, (
  <>
    <stop offset={0} stopColor="#5F7B52" />
    <stop offset={0.52} stopColor="#78935F" />
    <stop offset={1} stopColor="#93A977" />
  </>
));

const petalShadow = def.filter({ x: "-35%", y: "-35%", width: "170%", height: "180%" }, (
  <feDropShadow dx={0} dy={7} stdDeviation={8} floodColor={C.flowerShadow} floodOpacity={0.17} />
));

const rimPath = (radius: number, turn: number, squash: number, seed: number): string => {
  const points: P[] = [];
  for (let i = 0; i < 10; i++) {
    const angle = turn - Math.PI / 2 + (i / 10) * TAU;
    const wobble = 1 + 0.02 * Math.sin(seed + i * 2.17);
    const reach = radius * (i % 2 === 0 ? 1 : 0.855) * wobble;
    points.push({ x: Math.cos(angle) * reach, y: Math.sin(angle) * reach * squash });
  }
  return smoothPath(points, true);
};

const petalBand = (radius: number, angle: number, squash: number): string => {
  const p = (reach: number, theta: number): string => {
    const point = polar(reach, theta);
    return `${n(point.x)} ${n(point.y * squash)}`;
  };
  const width = 0.17;
  return `M${p(radius * 0.11, angle)}Q${p(radius * 0.55, angle - width)} ${p(radius * 0.86, angle - width * 0.5)}Q${p(radius * 0.985, angle)} ${p(radius * 0.86, angle + width * 0.5)}Q${p(radius * 0.55, angle + width)} ${p(radius * 0.11, angle)}Z`;
};

const sepalFan = (length: number, width: number): string => {
  const petals = Array.from({ length: 5 }, (_, i) => {
    const angle = -Math.PI / 2 + (i - 2) * 0.46;
    const tip = polar(length, angle);
    const left = polar(width, angle - 0.17);
    const right = polar(width, angle + 0.17);
    return `M0 0Q${n(left.x)} ${n(left.y)} ${n(tip.x)} ${n(tip.y)}Q${n(right.x)} ${n(right.y)} 0 0Z`;
  });
  return petals.join("");
};

const budPath = (length: number, width: number): string =>
  smoothPath(
    [
      { x: 0, y: -2 },
      { x: -width * 0.5, y: -length * 0.22 },
      { x: -width * 0.52, y: -length * 0.6 },
      { x: -width * 0.18, y: -length * 0.91 },
      { x: 0, y: -length },
      { x: width * 0.38, y: -length * 0.82 },
      { x: width * 0.48, y: -length * 0.48 },
      { x: width * 0.23, y: -length * 0.16 },
    ],
    true,
  );

const SQUASH = 0.8;

const TUBE = def.linearGradient({ x1: 0, y1: 1, x2: 0, y2: 0 }, (
  <>
    <stop offset={0} stopColor="#E3E3C6" />
    <stop offset={0.35} stopColor="#F6F0E2" />
    <stop offset={1} stopColor="#FDF8F2" />
  </>
));

const corolla = (radius: number, lift: number, tint: "white" | "blush"): SvgNode => {
  const rim = -lift + radius * SQUASH * 0.45;
  const flare = radius * 0.72;
  const side = (s: 1 | -1): string => `${n(s * 3.6)} -3C${n(s * 4.5)} ${n(-lift * 0.3)} ${n(s * flare * 0.3)} ${n(rim + 14)} ${n(s * flare)} ${n(rim)}`;
  const stripe = (s: number): string => `M${n(s * 0.8)} -4C${n(s * 1.5)} ${n(-lift * 0.3)} ${n(s * flare * 0.22)} ${n(rim + 16)} ${n(s * flare * 0.62)} ${n(rim + 2)}`;
  return (
    <g>
      <path d={`M${side(-1)}L${n(flare)} ${n(rim)}C${n(flare * 0.3)} ${n(rim + 14)} 4.5 ${n(-lift * 0.3)} 3.6 -3Z`} fill={TUBE} stroke="#E4D6CC" strokeWidth={0.6} strokeOpacity={0.6} />
      {[-1, 0, 1].map((s) => (
        <path key={s} d={stripe(s)} fill="none" stroke={tint === "white" ? C.whiteBand : C.blushBand} strokeWidth={s === 0 ? 2.2 : 1.6} strokeLinecap="round" strokeOpacity={0.3} />
      ))}
    </g>
  );
};

const bloomFace = (radius: number, tint: "white" | "blush", turn: number, seed: number): SvgNode => {
  const bands = Array.from({ length: 5 }, (_, i) => {
    const angle = turn - Math.PI / 2 + (i / 5) * TAU;
    return <path key={i} d={petalBand(radius, angle, SQUASH)} fill={tint === "white" ? C.whiteBand : C.blushBand} fillOpacity={tint === "white" ? 0.22 : 0.3} />;
  });
  const stamens = Array.from({ length: 5 }, (_, i) => {
    const angle = turn + 0.42 + (i / 5) * TAU;
    const base = polar(radius * 0.035, angle);
    const tip = polar(radius * 0.23, angle);
    return (
      <g key={i}>
        <path d={`M${n(base.x)} ${n(base.y)}L${n(tip.x)} ${n(tip.y * SQUASH)}`} stroke="#E7CE8D" strokeWidth={0.9} strokeOpacity={0.75} />
        <circle cx={tip.x} cy={tip.y * SQUASH} r={radius * 0.024} fill="#D8AD58" fillOpacity={0.9} />
      </g>
    );
  });
  return (
    <g filter={petalShadow}>
      <path d={rimPath(radius, turn, SQUASH, seed)} fill={tint === "white" ? WHITE_FACE : BLUSH_FACE} stroke="#E9CED2" strokeWidth={0.8} strokeOpacity={0.56} />
      {bands}
      <circle cx={0} cy={0} r={radius * 0.355} fill={THROAT} fillOpacity={0.82} />
      <circle cx={0} cy={0} r={radius * 0.105} fill="#EFC66C" fillOpacity={0.55} />
      {stamens}
      <path
        d={rimPath(radius * 0.9, turn + 0.16, SQUASH, seed + 5)}
        fill="none"
        stroke="#FFFDF7"
        strokeWidth={1.1}
        strokeOpacity={0.35}
      />
    </g>
  );
};

interface BloomProps {
  readonly x: number;
  readonly y: number;
  readonly lift: number;
  readonly radius: number;
  readonly angle: number;
  readonly tint: "white" | "blush";
  readonly turn: number;
  readonly seed: string;
  readonly openAt: number;
  readonly openOver: number;
  readonly closeAt: number;
  readonly closeOver: number;
}

const Bloom = ({ x, y, lift, radius, angle, tint, turn, seed, openAt, openOver, closeAt, closeOver }: BloomProps): SvgNode => {
  const opening = motion({ opacity: 0, scale: 0.54, rotate: -7 })
    .at(openAt)
    .to({ opacity: 1, scale: 1, rotate: 0 }, openOver, ease.out)
    .at(closeAt)
    .to({ opacity: 0, scale: 0.54, rotate: -7 }, closeOver, ease.inOut)
    .loop(D);
  const budding = motion({ opacity: 1, scale: 1 })
    .at(openAt + openOver * 0.16)
    .to({ opacity: 0, scale: 0.84 }, openOver * 0.5, ease.inOut)
    .at(closeAt + closeOver * 0.35)
    .to({ opacity: 1, scale: 1 }, closeOver * 0.65, ease.inOut)
    .loop(D);
  const sway = wiggle({ rotate: 1.6 }, { seed, rate: 0.6, period: 24 });
  return (
    <g style={{ transformBox: "view-box", transformOrigin: `${x}px ${y}px` }} animation={sway}>
      <g transform={`translate(${n(x)} ${n(y)}) rotate(${n(angle)})`}>
        <path d={sepalFan(21, 7)} fill={C.sepalsDeep} opacity={0.94} />
        <g style={{ transformBox: "fill-box", transformOrigin: "center" }} animation={budding}>
          <path d={budPath(radius * 1.18, radius * 0.5)} fill={BUD_WASH} stroke="#DFC5CB" strokeWidth={0.75} strokeOpacity={0.55} />
          <path d="M-1 -6C-11 -26 -5 -49 4 -61" fill="none" stroke="#E3C3CA" strokeWidth={1.1} strokeOpacity={0.6} strokeLinecap="round" />
          <path d="M5 -17C12 -32 10 -47 5 -57" fill="none" stroke="#FFF9EE" strokeWidth={1} strokeOpacity={0.55} strokeLinecap="round" />
          <ellipse cx={radius * 0.2} cy={-radius * 1.06} rx={1.2} ry={2} fill="#FFFDF2" fillOpacity={0.75} />
        </g>
        <g style={{ transformBox: "fill-box", transformOrigin: "center" }} animation={opening}>
          {corolla(radius, lift, tint)}
          <g transform={`translate(0 ${-lift})`}>{bloomFace(radius, tint, turn, openAt + radius)}</g>
        </g>
      </g>
    </g>
  );
};

interface Pedicel {
  readonly d: string;
  readonly start: P;
  readonly knee: P;
  readonly tip: P;
  readonly angle: number;
}

const pedicel = (fromY: number, tip: P): Pedicel => {
  const start = vinePoint(fromY);
  const reach = tip.x - start.x;
  const bend = { x: tip.x - reach * 0.1, y: tip.y + 18 };
  const knee = { x: start.x + reach * 0.42, y: Math.max(start.y, tip.y) + 8 };
  const d = smoothPath([start, knee, bend, tip]);
  const angle = (Math.atan2(tip.x - bend.x, bend.y - tip.y) * 180) / Math.PI;
  return { d, start, knee, tip, angle };
};

const BLOOMS = [
  {
    stem: pedicel(504, { x: 552, y: 452 }),
    lift: 76,
    radius: 64,
    tint: "white",
    turn: 0.12,
    seed: "hero-bloom",
    openAt: 3.2,
    openOver: 3.8,
    closeAt: 17.8,
    closeOver: 3.4,
  },
  {
    stem: pedicel(742, { x: 318, y: 718 }),
    lift: 58,
    radius: 47,
    tint: "blush",
    turn: -0.18,
    seed: "left-bloom",
    openAt: 5.4,
    openOver: 3.7,
    closeAt: 18.7,
    closeOver: 3.3,
  },
  {
    stem: pedicel(822, { x: 560, y: 808 }),
    lift: 51,
    radius: 41,
    tint: "white",
    turn: 0.26,
    seed: "low-bloom",
    openAt: 7.4,
    openOver: 3.5,
    closeAt: 19.6,
    closeOver: 3.2,
  },
] as const;

const BUDS = [
  { stem: pedicel(424, { x: 352, y: 404 }), size: 38, seed: "bud-left" },
  { stem: pedicel(584, { x: 376, y: 566 }), size: 26, seed: "bud-low" },
  { stem: pedicel(346, { x: 482, y: 318 }), size: 22, seed: "bud-high" },
] as const;

interface BudProps {
  readonly stem: Pedicel;
  readonly size: number;
  readonly seed: string;
}

const Bud = ({ stem, size, seed }: BudProps): SvgNode => (
  <g style={{ transformBox: "view-box", transformOrigin: `${n(stem.tip.x)}px ${n(stem.tip.y)}px` }} animation={wiggle({ rotate: 2 }, { seed, rate: 0.6, period: 24 })}>
    <g transform={`translate(${n(stem.tip.x)} ${n(stem.tip.y)}) rotate(${n(stem.angle)})`}>
      <path d={sepalFan(size * 0.4, size * 0.15)} fill={C.sepalsDeep} />
      <path d={budPath(size, size * 0.45)} fill={BUD_WASH} stroke="#DFC5CB" strokeWidth={0.65} strokeOpacity={0.55} />
      <path d={`M-1 -4C${n(-size * 0.16)} ${n(-size * 0.4)} ${n(-size * 0.08)} ${n(-size * 0.7)} ${n(size * 0.05)} ${n(-size * 0.9)}`} fill="none" stroke="#E3C3CA" strokeWidth={0.9} strokeOpacity={0.58} strokeLinecap="round" />
      <ellipse cx={size * 0.17} cy={-size * 0.92} rx={0.9} ry={1.5} fill="#FFFDF2" fillOpacity={0.7} />
    </g>
  </g>
);

// ---------------------------------------------------------------------------
// Atmosphere

const BG = def.linearGradient({ x1: 0, y1: 0, x2: 0, y2: 1 }, (
  <>
    <stop offset={0} stopColor={C.paperTop} />
    <stop offset={0.5} stopColor={C.paperMid} />
    <stop offset={1} stopColor={C.paperBottom} />
  </>
));

const SUN = def.radialGradient({ cx: 0.5, cy: 0.5, r: 0.5 }, (
  <>
    <stop offset={0} stopColor={C.sun} stopOpacity={0.92} />
    <stop offset={0.38} stopColor={C.sun} stopOpacity={0.48} />
    <stop offset={1} stopColor={C.sun} stopOpacity={0} />
  </>
));

const MEADOW = def.linearGradient({ x1: 0, y1: 0, x2: 0, y2: 1 }, (
  <>
    <stop offset={0} stopColor={C.meadow} stopOpacity={0} />
    <stop offset={1} stopColor={C.meadow} stopOpacity={0.76} />
  </>
));

const PAPER = def.pattern({ width: 11, height: 11, patternUnits: "userSpaceOnUse" }, (
  <>
    <circle cx={2} cy={3} r={0.55} fill="#756A55" opacity={0.1} />
    <circle cx={8} cy={8.5} r={0.4} fill="#756A55" opacity={0.07} />
  </>
));

const softBlur = def.filter({}, <feGaussianBlur stdDeviation={16} />);
const haze = def.filter({}, <feGaussianBlur stdDeviation={4.5} />);

const plantSway = motion({ rotate: -0.34 })
  .to({ rotate: 0.34 }, 12, ease.inOut)
  .to({ rotate: -0.34 }, 12, ease.inOut)
  .loop(D);

const sunBreath = motion({ opacity: 0.82 })
  .to({ opacity: 1 }, 10, ease.inOut)
  .to({ opacity: 0.82 }, 14, ease.inOut)
  .loop(D);

const grassSway = (seed: string, amount: number): ReturnType<typeof wiggle> => wiggle({ rotate: amount }, { seed, rate: 0.8, period: 24 });

interface Blade {
  readonly d: string;
  readonly base: P;
  readonly width: number;
  readonly color: Color;
  readonly opacity: number;
  readonly seed: string;
}

const BLADES: readonly Blade[] = [
  {
    d: smoothPath([{ x: 86, y: 1015 }, { x: 111, y: 900 }, { x: 130, y: 795 }, { x: 165, y: 675 }, { x: 186, y: 574 }]),
    base: { x: 86, y: 1015 },
    width: 6,
    color: "#A9B491",
    opacity: 0.28,
    seed: "meadow-left",
  },
  {
    d: smoothPath([{ x: 128, y: 1015 }, { x: 154, y: 919 }, { x: 180, y: 830 }, { x: 218, y: 735 }, { x: 239, y: 676 }]),
    base: { x: 128, y: 1015 },
    width: 3.2,
    color: "#92A47C",
    opacity: 0.26,
    seed: "meadow-left-two",
  },
  {
    d: smoothPath([{ x: 714, y: 1015 }, { x: 690, y: 904 }, { x: 704, y: 809 }, { x: 681, y: 714 }, { x: 675, y: 632 }]),
    base: { x: 714, y: 1015 },
    width: 7,
    color: "#AEB697",
    opacity: 0.24,
    seed: "meadow-right",
  },
  {
    d: smoothPath([{ x: 646, y: 1015 }, { x: 666, y: 928 }, { x: 651, y: 856 }, { x: 668, y: 778 }, { x: 694, y: 714 }]),
    base: { x: 646, y: 1015 },
    width: 4.2,
    color: "#9DAA87",
    opacity: 0.2,
    seed: "meadow-right-two",
  },
  {
    d: smoothPath([{ x: 500, y: 1015 }, { x: 510, y: 941 }, { x: 506, y: 875 }, { x: 520, y: 819 }]),
    base: { x: 500, y: 1015 },
    width: 2.8,
    color: "#B6BC9C",
    opacity: 0.2,
    seed: "meadow-centre",
  },
];

const BladeNode = ({ d, base, width, color, opacity, seed }: Blade): SvgNode => (
  <g style={{ transformBox: "view-box", transformOrigin: `${base.x}px ${base.y}px` }} animation={grassSway(seed, 0.9 + width * 0.14)}>
    <path d={d} fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" opacity={opacity} />
    <path d={d} fill="none" stroke="#E5E5C8" strokeWidth={width * 0.22} strokeLinecap="round" opacity={opacity * 0.9} transform="translate(-0.5 -1)" />
  </g>
);

const MOTES = [
  { x: 168, y: 510, r: 1.8, dx: 9, delay: 1.4, duration: 14, opacity: 0.5, color: "#FBF0C8" },
  { x: 632, y: 470, r: 2.4, dx: -12, delay: 3.8, duration: 14, opacity: 0.55, color: "#FFF7D9" },
  { x: 286, y: 760, r: 1.4, dx: 7, delay: 6.1, duration: 13, opacity: 0.42, color: "#FFF4CD" },
  { x: 584, y: 610, r: 1.6, dx: -6, delay: 2.3, duration: 14, opacity: 0.45, color: "#FAEBBE" },
  { x: 512, y: 290, r: 1.2, dx: 10, delay: 7.4, duration: 12, opacity: 0.5, color: "#FFF8DF" },
  { x: 214, y: 655, r: 1.1, dx: 5, delay: 9.2, duration: 12, opacity: 0.4, color: "#FBF0C7" },
  { x: 690, y: 804, r: 2.1, dx: -8, delay: 4.6, duration: 14, opacity: 0.36, color: "#F9EDC5" },
  { x: 362, y: 336, r: 1.5, dx: 8, delay: 0.7, duration: 14, opacity: 0.46, color: "#FFF6D6" },
  { x: 558, y: 866, r: 1.3, dx: 6, delay: 8.3, duration: 13, opacity: 0.4, color: "#FBF0C9" },
  { x: 262, y: 414, r: 1, dx: -4, delay: 5.4, duration: 12, opacity: 0.4, color: "#FFF8DF" },
  { x: 632, y: 232, r: 1.7, dx: -7, delay: 10.8, duration: 11, opacity: 0.42, color: "#FFF4CF" },
  { x: 448, y: 640, r: 1.1, dx: 4, delay: 11.7, duration: 11, opacity: 0.36, color: "#FCF1C8" },
] as const;

const Mote = ({ x, y, r, dx, delay, duration, opacity, color }: (typeof MOTES)[number]): SvgNode => {
  const drift = motion({ opacity: 0, x: 0, y: 0 })
    .at(delay)
    .to({ opacity, x: dx * 0.35, y: -13 }, duration * 0.28, ease.out)
    .to({ opacity: 0, x: dx, y: -48 }, duration * 0.72, ease.in)
    .loop(D);
  return (
    <g animation={drift}>
      <circle cx={x} cy={y} r={r} fill={color} />
    </g>
  );
};

const BOKEH = [
  { x: 208, y: 238, r: 33, opacity: 0.1 },
  { x: 673, y: 348, r: 26, opacity: 0.12 },
  { x: 150, y: 760, r: 19, opacity: 0.08 },
  { x: 718, y: 604, r: 30, opacity: 0.09 },
  { x: 340, y: 152, r: 15, opacity: 0.1 },
] as const;

const SHAFT = def.linearGradient({ x1: 0, y1: 0, x2: 0, y2: 1 }, (
  <>
    <stop offset={0} stopColor={C.sunCore} stopOpacity={0.85} />
    <stop offset={0.55} stopColor={C.sunCore} stopOpacity={0.35} />
    <stop offset={1} stopColor={C.sunCore} stopOpacity={0} />
  </>
));

const shaftBlur = def.filter({ x: "-50%", y: "-10%", width: "200%", height: "120%" }, <feGaussianBlur stdDeviation={14} />);

const SHAFTS = [
  { x: 600, width: 84, opacity: 0.42, delay: 0 },
  { x: 700, width: 44, opacity: 0.34, delay: 7 },
  { x: 500, width: 52, opacity: 0.26, delay: 11 },
] as const;

const Shaft = ({ x, width, opacity, delay }: (typeof SHAFTS)[number]): SvgNode => {
  const breath = motion({ opacity: opacity * 0.55 })
    .at(delay)
    .to({ opacity }, 5, ease.inOut)
    .to({ opacity: opacity * 0.55 }, 7, ease.inOut)
    .loop(D);
  return (
    <g animation={breath}>
      <rect x={x - width / 2} y={-60} width={width} height={1000} fill={SHAFT} filter={shaftBlur} transform={`rotate(24 ${x} -60)`} />
    </g>
  );
};

const FAR_BLOOMS = [
  { x: 146, y: 862, r: 15, turn: 0.3, opacity: 0.5 },
  { x: 236, y: 912, r: 10, turn: 1.1, opacity: 0.42 },
  { x: 618, y: 792, r: 11, turn: 0.7, opacity: 0.4 },
  { x: 700, y: 884, r: 19, turn: 0.1, opacity: 0.48 },
  { x: 742, y: 712, r: 8, turn: 1.4, opacity: 0.32 },
  { x: 548, y: 942, r: 9, turn: 0.9, opacity: 0.36 },
] as const;

const FarBlooms = (): SvgNode => (
  <g filter={farBlur}>
    {FAR_BLOOMS.map((bloom, index) => (
      <g key={index} transform={`translate(${bloom.x} ${bloom.y})`} opacity={bloom.opacity}>
        <path d={rimPath(bloom.r, bloom.turn, 0.62, index)} fill={index % 3 === 1 ? "#F6E1E4" : "#FFFDF6"} />
        <ellipse cx={0} cy={0} rx={bloom.r * 0.3} ry={bloom.r * 0.2} fill="#F3D798" />
      </g>
    ))}
  </g>
);

const farBlur = def.filter({}, <feGaussianBlur stdDeviation={2.6} />);

const FOREGROUND = [
  smoothPath([{ x: -6, y: 1015 }, { x: 10, y: 930 }, { x: 22, y: 850 }, { x: 46, y: 770 }]),
  smoothPath([{ x: 806, y: 1015 }, { x: 784, y: 940 }, { x: 772, y: 870 }, { x: 742, y: 806 }]),
  smoothPath([{ x: 770, y: 1015 }, { x: 760, y: 966 }, { x: 736, y: 930 }]),
] as const;

const deepBlur = def.filter({ x: "-50%", y: "-20%", width: "200%", height: "140%" }, <feGaussianBlur stdDeviation={5} />);

const Foreground = (): SvgNode => (
  <g filter={deepBlur} opacity={0.32}>
    {FOREGROUND.map((d, index) => (
      <g key={index} style={{ transformBox: "view-box", transformOrigin: "50% 100%" }} animation={grassSway(`front-${index}`, 1.2)}>
        <path d={d} fill="none" stroke="#7F9568" strokeWidth={index === 2 ? 9 : 14} strokeLinecap="round" />
      </g>
    ))}
  </g>
);

// ---------------------------------------------------------------------------
// A dacha garden outside Moscow: birches, a grey picket fence, chamomile, cornflowers, dandelion clocks

const hash = (seed: number): number => {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

const BIRCH_BARK = def.linearGradient({ x1: 0, y1: 0, x2: 1, y2: 0 }, (
  <>
    <stop offset={0} stopColor="#BDB8A8" />
    <stop offset={0.35} stopColor="#F2EFE5" />
    <stop offset={0.7} stopColor="#E3DFD2" />
    <stop offset={1} stopColor="#AFAA99" />
  </>
));

const birchBlur = def.filter({ x: "-60%", y: "-5%", width: "220%", height: "110%" }, <feGaussianBlur stdDeviation={2.4} />);

const BIRCHES = [
  { x: 46, width: 30, lean: 14, opacity: 0.72 },
  { x: 124, width: 14, lean: -8, opacity: 0.42 },
  { x: 756, width: 24, lean: -12, opacity: 0.6 },
] as const;

const Birch = ({ x, width, lean, opacity, index }: (typeof BIRCHES)[number] & { readonly index: number }): SvgNode => {
  const along = (t: number): P => ({ x: x + lean * t * t, y: 1012 - t * 1060 });
  const girth = (t: number): number => width * (1 - t * 0.35);
  const marks = Array.from({ length: 18 }, (_, i) => {
    const t = (i + hash(index * 31 + i)) / 18;
    const point = along(t);
    const side = hash(index * 17 + i * 13) > 0.5 ? 1 : -1;
    const reach = girth(t) * (0.25 + hash(index * 7 + i) * 0.45);
    const edge = point.x + (side * girth(t)) / 2;
    return (
      <path
        key={i}
        d={`M${n(edge)} ${n(point.y)}Q${n(edge - side * reach * 0.5)} ${n(point.y - 1.5)} ${n(edge - side * reach)} ${n(point.y + 0.5)}`}
        fill="none"
        stroke="#57544B"
        strokeWidth={1.2 + hash(index + i * 3) * 2.2}
        strokeLinecap="round"
        opacity={0.72}
      />
    );
  });
  return (
    <g filter={birchBlur} opacity={opacity}>
      <path d={ribbon(Array.from({ length: 9 }, (_, i) => along(i / 8)), (t) => girth(t))} fill={BIRCH_BARK} />
      {marks}
    </g>
  );
};

const BIRCH_SPRAYS = [
  { from: { x: -10, y: -10 }, spine: [{ x: 40, y: 30 }, { x: 78, y: 92 }, { x: 96, y: 168 }, { x: 102, y: 236 }], seed: "spray-1" },
  { from: { x: 30, y: -14 }, spine: [{ x: 96, y: 18 }, { x: 150, y: 70 }, { x: 178, y: 136 }, { x: 186, y: 188 }], seed: "spray-2" },
  { from: { x: -12, y: 60 }, spine: [{ x: 22, y: 104 }, { x: 44, y: 170 }, { x: 52, y: 250 }, { x: 50, y: 312 }], seed: "spray-3" },
] as const;

const sprayBlur = def.filter({}, <feGaussianBlur stdDeviation={1.3} />);

const BirchSpray = ({ from, spine, seed }: (typeof BIRCH_SPRAYS)[number]): SvgNode => {
  const points = [from, ...spine];
  const leaves = points.slice(1).flatMap((point, i) => {
    const prev = points[i]!;
    return Array.from({ length: 4 }, (_, j) => {
      const t = (j + 0.5) / 4;
      const x = prev.x + (point.x - prev.x) * t;
      const y = prev.y + (point.y - prev.y) * t;
      const side = (i * 4 + j) % 2 ? 1 : -1;
      const angle = 90 + side * (30 + hash(i * 9 + j) * 25);
      return (
        <path
          key={`${i}-${j}`}
          d="M0 0Q3 -3.6 9 0Q3 3.6 0 0Z"
          fill={hash(i * 5 + j * 3) > 0.5 ? "#A3B485" : "#8FA474"}
          transform={`translate(${n(x)} ${n(y)}) rotate(${n(angle)}) scale(${n(1 + hash(i + j * 11) * 0.5)})`}
        />
      );
    });
  });
  return (
    <g style={{ transformBox: "view-box", transformOrigin: `${from.x}px ${from.y}px` }} animation={wiggle({ rotate: 1.4 }, { seed, rate: 0.5, period: 24 })}>
      <path d={smoothPath(points)} fill="none" stroke="#7A7465" strokeWidth={1} strokeLinecap="round" />
      {leaves}
      <path d={`M${n(spine[3].x)} ${n(spine[3].y)}l1 14`} stroke="#A49A72" strokeWidth={2.6} strokeLinecap="round" />
    </g>
  );
};

const FENCE_TOP = 748;
const PICKETS = Array.from({ length: 22 }, (_, i) => ({
  x: -10 + i * 38 + (hash(i + 90) - 0.5) * 8,
  width: 22 + hash(i + 5) * 6,
  top: FENCE_TOP + (hash(i + 40) - 0.5) * 18,
  tilt: (hash(i + 70) - 0.5) * 2.6,
  tone: hash(i + 11),
}));

const fenceBlur = def.filter({}, <feGaussianBlur stdDeviation={2.2} />);

const Fence = (): SvgNode => (
  <g filter={fenceBlur} opacity={0.3}>
    <rect x={0} y={FENCE_TOP + 40} width={W} height={10} fill="#ABA796" />
    {PICKETS.map((picket, i) => {
      const { x, width, top, tilt, tone } = picket;
      return (
        <g key={i} transform={`rotate(${n(tilt)} ${n(x + width / 2)} 1010)`}>
          <path d={`M${n(x)} 1010V${n(top + 9)}L${n(x + width / 2)} ${n(top)}L${n(x + width)} ${n(top + 9)}V1010Z`} fill={tone > 0.66 ? "#BDB6A4" : tone > 0.33 ? "#C8C2B1" : "#D1CCBD"} />
          <path d={`M${n(x + width * 0.3)} ${n(top + 14)}V1010M${n(x + width * 0.68)} ${n(top + 22)}V1010`} stroke="#A9A493" strokeWidth={0.6} opacity={0.5} />
          <path d={`M${n(x + 1.2)} ${n(top + 9)}V1010`} stroke="#E4E1D5" strokeWidth={1.2} opacity={0.7} />
        </g>
      );
    })}
  </g>
);

interface Flower {
  readonly x: number;
  readonly y: number;
  readonly size: number;
  readonly tilt: number;
  readonly seed: string;
}

const flowerStem = ({ x, y }: Flower): readonly P[] => {
  const base = x + (hash(x) - 0.5) * 30;
  return [
    { x: base, y: 1014 },
    { x: base + (x - base) * 0.4 + (hash(y) - 0.5) * 8, y: y + (1014 - y) * 0.55 },
    { x, y },
  ];
};

const Swaying = ({ flower, children }: { readonly flower: Flower; readonly children: SvgNode }): SvgNode => {
  const stem = flowerStem(flower);
  const node = stem[1]!;
  const side = hash(flower.x + flower.y) > 0.5 ? 1 : -1;
  return (
    <g style={{ transformBox: "view-box", transformOrigin: `${n(flower.x)}px 1014px` }} animation={grassSway(flower.seed, 1.3)}>
      <path d={smoothPath(stem)} fill="none" stroke="#8DA173" strokeWidth={1.2} strokeLinecap="round" />
      <path d="M0 0Q9 -2 20 -12Q8 -1 0 0Z" fill="#93A779" transform={`translate(${n(node.x)} ${n(node.y)}) scale(${side} 1)`} />
      <g transform={`translate(${n(flower.x)} ${n(flower.y)}) rotate(${n(flower.tilt)})`}>{children}</g>
    </g>
  );
};

const chamomileRay = (r: number, angle: number): string => {
  const p = (reach: number, theta: number): string => `${n(Math.cos(theta) * reach)} ${n(Math.sin(theta) * reach * 0.5 + reach * 0.12)}`;
  return `M${p(r * 0.28, angle - 0.1)}Q${p(r * 1.02, angle - 0.13)} ${p(r * 1.06, angle)}Q${p(r * 1.02, angle + 0.13)} ${p(r * 0.28, angle + 0.1)}Z`;
};

const Chamomile = (flower: Flower): SvgNode => (
  <Swaying flower={flower}>
    <>
      {Array.from({ length: 15 }, (_, i) => (
        <path key={i} d={chamomileRay(flower.size, (i / 15) * TAU + hash(i) * 0.1)} fill="#FFFEF8" stroke="#E2DCCF" strokeWidth={0.5} />
      ))}
      <ellipse cx={0} cy={-1.5} rx={flower.size * 0.32} ry={flower.size * 0.26} fill="#E7BC52" />
      <ellipse cx={-flower.size * 0.08} cy={-flower.size * 0.18} rx={flower.size * 0.14} ry={flower.size * 0.08} fill="#F6DC8C" opacity={0.8} />
    </>
  </Swaying>
);

const CORNFLOWER_FLORET = "M0 0L-2.4 -9.5L-1.5 -11L-0.6 -10L0.3 -11.4L1.2 -10.1L2.2 -11L2.6 -9.4Z";

const Cornflower = (flower: Flower): SvgNode => (
  <Swaying flower={flower}>
    <g transform={`scale(${flower.size / 12})`}>
      {Array.from({ length: 9 }, (_, i) => {
        const angle = -84 + i * 21;
        return <path key={i} d={CORNFLOWER_FLORET} fill={i % 2 ? "#6F8FD0" : "#7E9CD8"} transform={`translate(0 -3) rotate(${angle}) scale(${1 - Math.abs(angle) / 260})`} />;
      })}
      <circle cx={0} cy={-4} r={2.4} fill="#4E4B86" />
      <ellipse cx={0} cy={2.2} rx={3.4} ry={4.6} fill="#7C9064" />
      <path d="M-2.4 0.6Q0 2 2.4 0.6M-2.6 3Q0 4.4 2.6 3M-2 5.2Q0 6.2 2 5.2" fill="none" stroke="#C8D2B4" strokeWidth={0.5} opacity={0.8} />
    </g>
  </Swaying>
);

const DandelionClock = (flower: Flower): SvgNode => (
  <Swaying flower={flower}>
    <g opacity={0.8}>
      {Array.from({ length: 34 }, (_, i) => {
        const angle = (i / 34) * TAU + hash(i + 3) * 0.08;
        const tip = polar(flower.size * (0.9 + hash(i) * 0.12), angle);
        return (
          <g key={i}>
            <path d={`M0 0L${n(tip.x)} ${n(tip.y)}`} stroke="#F2EFE4" strokeWidth={0.4} />
            <circle cx={tip.x} cy={tip.y} r={1.3} fill="#FFFFFF" opacity={0.7} />
          </g>
        );
      })}
      <circle cx={0} cy={0} r={2} fill="#C9BD94" />
    </g>
  </Swaying>
);

const CHAMOMILE: readonly Flower[] = [
  { x: 612, y: 880, size: 20, tilt: -6, seed: "chamomile-1" },
  { x: 660, y: 850, size: 23, tilt: 4, seed: "chamomile-2" },
  { x: 706, y: 902, size: 17, tilt: 8, seed: "chamomile-3" },
  { x: 752, y: 862, size: 19, tilt: -4, seed: "chamomile-4" },
  { x: 640, y: 936, size: 15, tilt: 2, seed: "chamomile-5" },
  { x: 214, y: 864, size: 18, tilt: -5, seed: "chamomile-6" },
  { x: 256, y: 892, size: 14, tilt: 6, seed: "chamomile-7" },
];

const CORNFLOWERS: readonly Flower[] = [
  { x: 690, y: 818, size: 19, tilt: 8, seed: "cornflower-1" },
  { x: 578, y: 912, size: 16, tilt: -10, seed: "cornflower-2" },
  { x: 138, y: 878, size: 17, tilt: -6, seed: "cornflower-3" },
];

const CLOCKS: readonly Flower[] = [
  { x: 176, y: 822, size: 19, tilt: 0, seed: "clock-1" },
  { x: 730, y: 828, size: 16, tilt: 0, seed: "clock-2" },
];

const SEEDS = [
  { x: 190, y: 812, dx: 120, rise: 210, delay: 0.5 },
  { x: 166, y: 816, dx: 90, rise: 260, delay: 4.2 },
  { x: 740, y: 820, dx: -70, rise: 240, delay: 2.4 },
  { x: 722, y: 822, dx: -110, rise: 190, delay: 6.6 },
] as const;

const DriftingSeed = ({ x, y, dx, rise, delay }: (typeof SEEDS)[number]): SvgNode => {
  const drift = motion({ opacity: 0, x: 0, y: 0 })
    .at(delay)
    .to({ opacity: 0.9, x: dx * 0.12, y: -rise * 0.12 }, 3, ease.out)
    .to({ opacity: 0.75, x: dx * 0.75, y: -rise * 0.78 }, 10, ease.inOut)
    .to({ opacity: 0, x: dx, y: -rise }, 4, ease.in)
    .loop(D);
  const tumble = wiggle({ rotate: 14 }, { seed: `seed-${x}-${delay}`, rate: 0.6, period: 24 });
  return (
    <g animation={drift}>
      <g transform={`translate(${x} ${y})`}>
        <g animation={tumble} style={{ transformBox: "fill-box", transformOrigin: "50% 100%" }}>
          <path d="M0 0V-8M0 -8L-3.4 -10.6M0 -8L-1.8 -11.6M0 -8V-12M0 -8L1.8 -11.6M0 -8L3.4 -10.6" fill="none" stroke="#FBF9F0" strokeWidth={0.5} strokeLinecap="round" />
          <ellipse cx={0} cy={0.8} rx={0.6} ry={1.4} fill="#A99C72" />
        </g>
      </g>
    </g>
  );
};

const Garden = (): SvgNode => (
  <>
    {CLOCKS.map((flower) => (
      <DandelionClock key={flower.seed} {...flower} />
    ))}
    {CORNFLOWERS.map((flower) => (
      <Cornflower key={flower.seed} {...flower} />
    ))}
    {CHAMOMILE.map((flower) => (
      <Chamomile key={flower.seed} {...flower} />
    ))}
  </>
);

// ---------------------------------------------------------------------------
// Scene

const dewGlint = motion({ opacity: 0.55 })
  .at(2)
  .to({ opacity: 0.95 }, 2.6, ease.inOut)
  .to({ opacity: 0.55 }, 5.4, ease.inOut)
  .loop(12);

const Meadow = (): SvgNode => (
  <g filter={haze}>
    {BLADES.map((blade) => (
      <BladeNode key={blade.seed} {...blade} />
    ))}
  </g>
);

const Stem = ({ d, width, color = C.stem }: { readonly d: string; readonly width: number; readonly color?: Color }): SvgNode => (
  <>
    <path d={d} fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" />
    <path d={d} fill="none" stroke={C.stemLight} strokeWidth={width * 0.28} strokeLinecap="round" opacity={0.42} transform="translate(-0.4 -0.35)" />
  </>
);

const Stalk = (): SvgNode => (
  <>
    <path d={SHEATH} fill={C.stalkLight} stroke={C.stalk} strokeWidth={0.6} strokeOpacity={0.7} opacity={0.85} />
    <path d={supportTaper} fill={C.stalk} opacity={0.92} />
    <path d={supportShine} fill="none" stroke={C.stalkLight} strokeWidth={0.6} strokeLinecap="round" opacity={0.7} />
    {STALK_NODES.map((y) => (
      <ellipse key={y} cx={axisX(y)} cy={y} rx={stalkWidth(y) / 2 + 0.8} ry={2.3} fill="#9C8B60" opacity={0.8} />
    ))}
    {[598, 786].map((y) => (
      <g key={y} animation={dewGlint}>
        <circle cx={axisX(y) + stalkWidth(y) / 2 + 1.6} cy={y} r={2.1} fill="#FBFCF3" fillOpacity={0.6} stroke="#B5A57B" strokeWidth={0.35} strokeOpacity={0.5} />
        <circle cx={axisX(y) + stalkWidth(y) / 2 + 1.1} cy={y - 0.7} r={0.55} fill="#FFFFFF" />
      </g>
    ))}
    <g opacity={0.82}>
      <path d={smoothPath(SEEDHEAD)} fill="none" stroke={C.stalk} strokeWidth={1.1} strokeLinecap="round" />
      {SEEDHEAD.slice(1).map((point, i) => {
        const side = i % 2 ? 1 : -1;
        const tip = { x: point.x + side * 11, y: point.y + 5 };
        return (
          <g key={i}>
            <path d={`M${n(point.x)} ${n(point.y)}Q${n(point.x + side * 6)} ${n(point.y - 2)} ${n(tip.x)} ${n(tip.y)}`} fill="none" stroke={C.stalk} strokeWidth={0.8} strokeLinecap="round" />
            <ellipse cx={tip.x + side * 2} cy={tip.y + 1} rx={2.8} ry={1.15} fill={C.stalkLight} transform={`rotate(${side * 30} ${n(tip.x + side * 2)} ${n(tip.y + 1)})`} />
          </g>
        );
      })}
    </g>
  </>
);

const Vine = (): SvgNode => (
  <>
    {VINE.back.map((run, index) => (
      <path key={`back-${index}`} d={smoothPath(run.points)} fill="none" stroke={C.stemBack} strokeWidth={run.width * 0.9} strokeLinecap="round" opacity={0.85} />
    ))}

    <Stalk />

    {VINE.front.map((run, index) => (
      <Stem key={`front-${index}`} d={smoothPath(run.points)} width={run.width} />
    ))}
    <Stem d={shootTip} width={1.4} />
    <Leaf x={vinePoint(TIP_Y).x - 45} y={TIP_Y - 16} angle={118} scale={0.32} stalk={8} seed="tip-leaf" dark />

    {BLOOMS.map((bloom) => (
      <Stem key={bloom.seed} d={bloom.stem.d} width={1.8} />
    ))}
    {BUDS.map((bud) => (
      <Stem key={bud.seed} d={bud.stem.d} width={1.4} />
    ))}

    {[...BLOOMS, ...BUDS].map(({ stem, seed }) => (
      <g key={seed} transform={`translate(${n(stem.knee.x)} ${n(stem.knee.y)})`} fill={C.sepals}>
        <path d="M0 0Q-2 -4 -1 -8Q1 -4 0 0Z" transform="rotate(-24)" />
        <path d="M0 0Q-2 -4 -1 -8Q1 -4 0 0Z" transform="rotate(30)" />
      </g>
    ))}

    {LEAVES.map((leaf) => (
      <Leaf key={leaf.seed} {...leaf} />
    ))}
    {LEAVES.map((leaf) => (
      <ellipse key={leaf.seed} cx={leaf.x} cy={leaf.y} rx={2.3} ry={1.7} fill={C.leafDeep} />
    ))}

    {BUDS.map((bud) => (
      <Bud key={bud.seed} {...bud} />
    ))}
    {BLOOMS.map(({ stem, ...bloom }) => (
      <Bloom key={bloom.seed} x={stem.tip.x} y={stem.tip.y} angle={stem.angle} {...bloom} />
    ))}
  </>
);

export function buildBindweed(): string {
  return render(
    {
      width: W,
      height: H,
      duration: D,
      title: "Bindweed in a summer garden",
      desc: "Field bindweed, Convolvulus arvensis, twines up a dry grass stalk in a quiet dacha garden outside Moscow. Pale trumpet flowers open one after another with the morning light and fold closed again. Birches lean in from the edges, an old grey fence rests behind, and chamomile, cornflowers and dandelion clocks stand in the grass while dandelion seeds drift past.",
      css: CSS,
      reducedMotion: { at: 12.8 },
      comment: "Generated by svg-motion. Edit examples/bindweed/index.tsx instead of this file.",
    },
    <>
      <rect width={W} height={H} fill={BG} />
      <rect x={80} y={0} width={W - 160} height={H} fill={SUN} opacity={0.9} />
      <g animation={sunBreath}>
        <circle cx={526} cy={332} r={174} fill={C.sunCore} opacity={0.5} filter={softBlur} />
        <circle cx={526} cy={332} r={116} fill={C.sunCore} opacity={0.38} filter={softBlur} />
      </g>
      {SHAFTS.map((shaft) => (
        <Shaft key={shaft.x} {...shaft} />
      ))}
      {BIRCHES.map((birch, index) => (
        <Birch key={birch.x} {...birch} index={index} />
      ))}
      <g filter={sprayBlur} opacity={0.6}>
        {BIRCH_SPRAYS.map((spray) => (
          <BirchSpray key={spray.seed} {...spray} />
        ))}
      </g>
      <Fence />
      <rect y={724} width={W} height={276} fill={MEADOW} />
      <Meadow />
      <FarBlooms />
      <g>
        {BOKEH.map((dot, index) => (
          <circle key={index} cx={dot.x} cy={dot.y} r={dot.r} fill="#FBF1CE" opacity={dot.opacity} filter={softBlur} />
        ))}
      </g>
      <rect width={W} height={H} fill={PAPER} opacity={0.55} />

      <ellipse cx={417} cy={994} rx={232} ry={26} fill="#8C896E" opacity={0.13} filter={softBlur} />

      <g style={{ transformBox: "view-box", transformOrigin: "432px 1000px" }} animation={plantSway}>
        <Vine />
      </g>

      <Garden />
      <Foreground />
      {SEEDS.map((seed) => (
        <DriftingSeed key={`${seed.x}-${seed.delay}`} {...seed} />
      ))}

      <g>
        {MOTES.map((mote, index) => (
          <Mote key={index} {...mote} />
        ))}
      </g>

      <g opacity={0.8}>
        <path d="M64 927H128" stroke={C.inkFaint} strokeWidth={0.8} strokeOpacity={0.55} />
        <text x={64} y={955} class="serif" fontSize={12.5} letterSpacing={3} fill={C.ink}>
          CONVOLVULUS ARVENSIS
        </text>
        <text x={64} y={978} class="serif" fontSize={9.5} letterSpacing={1.55} fill={C.inkFaint} opacity={0.86}>
          ВЬЮНОК ПОЛЕВОЙ · FIELD BINDWEED
        </text>
      </g>
    </>,
  );
}

export default buildBindweed;

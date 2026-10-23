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
  stem: "#6F895C",
  stemBack: "#5B744F",
  stemLight: "#AFBF94",
  leaf: "#78935F",
  leafDeep: "#5D7A53",
  leafEdge: "#4E6848",
  leafVein: "#B9C8A0",
  sepals: "#7E9368",
  sepalsDeep: "#637B54",
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

const axisX = (y: number): number => 424 + (1000 - y) * 0.012 + Math.sin((1000 - y) / 240) * 10;
const vineRadius = (y: number): number => 48 - (900 - y) * 0.012;
const vinePhase = (y: number): number => Math.PI + ((900 - y) * TAU) / 152;
const vinePoint = (y: number): P => ({ x: axisX(y) + Math.cos(vinePhase(y)) * vineRadius(y), y });
const vineAnchor = (y: number): P => vinePoint(y);

const supportPath = smoothPath(Array.from({ length: 13 }, (_, i) => ({ x: axisX(1010 - i * 62), y: 1010 - i * 62 })));

interface Runs {
  readonly front: readonly (readonly P[])[];
  readonly back: readonly (readonly P[])[];
}

const vineRuns = (): Runs => {
  const front: P[][] = [];
  const back: P[][] = [];
  let run: P[] = [];
  let wasFront = Math.sin(vinePhase(900)) >= 0;
  for (let y = 900; y >= 260; y -= 7) {
    const point = vinePoint(y);
    const isFront = Math.sin(vinePhase(y)) >= 0;
    if (isFront !== wasFront && run.length > 1) {
      (wasFront ? front : back).push(run);
      run = [];
    }
    wasFront = isFront;
    run.push(point);
  }
  if (run.length > 1) (wasFront ? front : back).push(run);
  return { front, back };
};

const VINE = vineRuns();
const baseStem = smoothPath([
  { x: 268, y: 1004 },
  { x: 287, y: 987 },
  { x: 309, y: 971 },
  { x: 333, y: 950 },
  { x: 354, y: 928 },
  { x: 369, y: 911 },
  { x: 381, y: 900 },
]);

const topTendril = smoothPath([
  { x: 424, y: 260 },
  { x: 408, y: 242 },
  { x: 390, y: 225 },
  { x: 372, y: 212 },
  { x: 356, y: 203 },
  { x: 342, y: 200 },
  { x: 331, y: 204 },
  { x: 324, y: 214 },
  { x: 325, y: 226 },
  { x: 333, y: 233 },
  { x: 343, y: 233 },
  { x: 349, y: 226 },
  { x: 348, y: 217 },
  { x: 342, y: 213 },
  { x: 336, y: 214 },
]);

// ---------------------------------------------------------------------------
// Leaves

const LEAF_SITES = [
  { y: 824, angle: -23, scale: 1.08, flip: false, seed: "leaf-1", tone: 1 },
  { y: 758, angle: 204, scale: 0.98, flip: true, seed: "leaf-2", tone: 0.9 },
  { y: 672, angle: -13, scale: 0.92, flip: false, seed: "leaf-3", tone: 0.94 },
  { y: 606, angle: 197, scale: 0.84, flip: true, seed: "leaf-4", tone: 0.86 },
  { y: 520, angle: -29, scale: 1, flip: false, seed: "leaf-5", tone: 1 },
  { y: 454, angle: 207, scale: 0.9, flip: true, seed: "leaf-6", tone: 0.92 },
  { y: 302, angle: 194, scale: 0.82, flip: true, seed: "leaf-7", tone: 0.88 },
] as const;

const leafShape = [
  { x: 18, y: 0 },
  { x: 17, y: -7 },
  { x: 13, y: -20 },
  { x: 11, y: -27 },
  { x: 23, y: -25 },
  { x: 35, y: -19 },
  { x: 46, y: -14 },
  { x: 61, y: -8 },
  { x: 78, y: 0 },
  { x: 61, y: 8 },
  { x: 46, y: 14 },
  { x: 35, y: 19 },
  { x: 23, y: 25 },
  { x: 11, y: 27 },
  { x: 13, y: 20 },
  { x: 17, y: 7 },
] as const;

const leafD = smoothPath(leafShape, true);
const leafMidrib = smoothPath([
  { x: 18, y: 0 },
  { x: 38, y: 0.5 },
  { x: 58, y: 0 },
  { x: 77, y: 0 },
]);
const leafVein = (x: number, y: number, tipX: number, tipY: number): string =>
  smoothPath([
    { x, y: y * 0.18 },
    { x: tipX, y: tipY * 0.5 },
    { x: tipX + 5, y: tipY },
  ]);
const leafVeins = [
  { d: leafVein(32, 0, 42, -14), opacity: 0.42 },
  { d: leafVein(46, 0, 54, -8), opacity: 0.34 },
  { d: leafVein(33, 0, 42, 14), opacity: 0.38 },
  { d: leafVein(48, 0, 55, 8), opacity: 0.3 },
] as const;

interface LeafProps {
  readonly x: number;
  readonly y: number;
  readonly angle: number;
  readonly scale: number;
  readonly seed: string;
  readonly dark?: boolean;
  readonly dew?: boolean;
}

const Leaf = ({ x, y, angle, scale, seed, dark = false, dew = false }: LeafProps): SvgNode => (
  <g style={{ transformBox: "view-box", transformOrigin: `${x}px ${y}px` }} animation={wiggle({ rotate: 1.5, y: 0.8 }, { seed, rate: 1.2, period: 12 })}>
    <g transform={`translate(${n(x)} ${n(y)}) rotate(${n(angle)}) scale(${scale})`}>
      <path d={leafD} fill={dark ? C.leafDeep : leafWash} stroke={C.leafEdge} strokeWidth={0.8} strokeOpacity={0.42} />
      <path d={leafMidrib} fill="none" stroke={C.leafVein} strokeWidth={1.3} strokeOpacity={0.55} />
      {leafVeins.map((vein, index) => (
        <path key={index} d={vein.d} fill="none" stroke={C.leafVein} strokeWidth={0.75} strokeOpacity={vein.opacity} />
      ))}
      <path
        d="M26 -11C39 -15 55 -11 70 -3"
        fill="none"
        stroke="#DCE7C9"
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeOpacity={0.34}
      />
      {dew && (
        <g>
          <ellipse cx={51} cy={-3.5} rx={2.5} ry={3.4} fill="#FFFDF4" fillOpacity={0.55} />
          <circle cx={50.2} cy={-4.6} r={0.7} fill="#FFFFFF" fillOpacity={0.9} />
        </g>
      )}
    </g>
  </g>
);

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

const bloomFace = (radius: number, tint: "white" | "blush", turn: number, seed: number): SvgNode => {
  const squash = 0.95;
  const bands = Array.from({ length: 5 }, (_, i) => {
    const angle = turn - Math.PI / 2 + (i / 5) * TAU;
    return <path key={i} d={petalBand(radius, angle, squash)} fill={tint === "white" ? C.whiteBand : C.blushBand} fillOpacity={tint === "white" ? 0.22 : 0.3} />;
  });
  const stamens = Array.from({ length: 5 }, (_, i) => {
    const angle = turn + 0.42 + (i / 5) * TAU;
    const base = polar(radius * 0.035, angle);
    const tip = polar(radius * 0.23, angle);
    return (
      <g key={i}>
        <path d={`M${n(base.x)} ${n(base.y)}L${n(tip.x)} ${n(tip.y * squash)}`} stroke="#E7CE8D" strokeWidth={0.9} strokeOpacity={0.75} />
        <circle cx={tip.x} cy={tip.y * squash} r={radius * 0.024} fill="#D8AD58" fillOpacity={0.9} />
      </g>
    );
  });
  return (
    <g filter={petalShadow}>
      <path d={rimPath(radius, turn, squash, seed)} fill={tint === "white" ? WHITE_FACE : BLUSH_FACE} stroke="#E9CED2" strokeWidth={0.8} strokeOpacity={0.56} />
      {bands}
      <circle cx={0} cy={0} r={radius * 0.355} fill={THROAT} fillOpacity={0.82} />
      <circle cx={0} cy={0} r={radius * 0.105} fill="#EFC66C" fillOpacity={0.55} />
      {stamens}
      <path
        d={rimPath(radius * 0.9, turn + 0.16, squash, seed + 5)}
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
  const sway = wiggle({ rotate: 1.25, x: 1.1, y: 0.45 }, { seed, rate: 1, period: 8 });
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
          <g transform={`translate(0 ${-lift})`}>{bloomFace(radius, tint, turn, openAt + radius)}</g>
        </g>
      </g>
    </g>
  );
};

const PEDICELS = [
  { d: smoothPath([{ x: 462, y: 438 }, { x: 502, y: 447 }, { x: 526, y: 438 }, { x: 548, y: 424 }]), width: 2.1 },
  { d: smoothPath([{ x: 411, y: 681 }, { x: 376, y: 695 }, { x: 351, y: 693 }, { x: 331, y: 682 }]), width: 1.9 },
  { d: smoothPath([{ x: 454, y: 801 }, { x: 490, y: 808 }, { x: 520, y: 803 }, { x: 547, y: 790 }]), width: 1.8 },
] as const;

const PEDUNCLE = smoothPath([
  { x: 408, y: 529 },
  { x: 382, y: 538 },
  { x: 358, y: 531 },
  { x: 343, y: 514 },
]);

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

const Vine = (): SvgNode => (
  <>
    {VINE.back.map((run, index) => (
      <path key={`back-${index}`} d={smoothPath(run)} fill="none" stroke={C.stemBack} strokeWidth={2.15} strokeLinecap="round" opacity={0.86} />
    ))}

    <path d={supportPath} fill="none" stroke={C.stalk} strokeWidth={2.4} strokeLinecap="round" opacity={0.9} />
    <path d={supportPath} fill="none" stroke={C.stalkLight} strokeWidth={0.8} strokeLinecap="round" opacity={0.8} transform="translate(-0.55 -0.4)" />
    <g opacity={0.8}>
      <path d={smoothPath([{ x: 431, y: 226 }, { x: 438, y: 209 }, { x: 456, y: 183 }, { x: 474, y: 158 }, { x: 469, y: 143 }])} fill="none" stroke={C.stalk} strokeWidth={1.15} strokeLinecap="round" />
      {Array.from({ length: 7 }, (_, i) => {
        const t = i / 6;
        const x = 434 + t * 38;
        const y = 221 - t * 70;
        const side = i % 2 ? 1 : -1;
        return (
          <g key={i}>
            <path d={`M${n(x)} ${n(y)}q${side * 7} -2 ${side * 12} ${6}`} fill="none" stroke={C.stalk} strokeWidth={0.85} strokeLinecap="round" />
            <ellipse cx={x + side * 13} cy={y + 5.5} rx={2.7} ry={1.15} fill={C.stalkLight} transform={`rotate(${side * 28} ${x + side * 13} ${y + 5.5})`} />
          </g>
        );
      })}
    </g>

    <path d={baseStem} fill="none" stroke={C.stem} strokeWidth={2.6} strokeLinecap="round" />
    <path d={baseStem} fill="none" stroke={C.stemLight} strokeWidth={0.75} strokeLinecap="round" opacity={0.48} transform="translate(-0.4 -0.4)" />

    <path d={topTendril} fill="none" stroke={C.stem} strokeWidth={1.5} strokeLinecap="round" opacity={0.9} />

    {VINE.front.map((run, index) => (
      <g key={`front-${index}`}>
        <path d={smoothPath(run)} fill="none" stroke={C.stem} strokeWidth={2.55} strokeLinecap="round" />
        <path d={smoothPath(run)} fill="none" stroke={C.stemLight} strokeWidth={0.72} strokeLinecap="round" opacity={0.44} transform="translate(-0.5 -0.35)" />
      </g>
    ))}

    <Leaf x={318} y={962} angle={204} scale={0.7} seed="base-leaf" dark dew />
    <Leaf x={359} y={205} angle={201} scale={0.54} seed="tip-leaf" dark />

    {LEAF_SITES.map((site) => {
      const anchor = vineAnchor(site.y);
      return (
        <Leaf
          key={site.seed}
          x={anchor.x}
          y={anchor.y}
          angle={site.angle}
          scale={site.scale}
          seed={site.seed}
          dark={site.tone < 0.9}
          dew={site.seed === "leaf-2" || site.seed === "leaf-5"}
        />
      );
    })}

    {PEDICELS.map((pedicel, index) => (
      <g key={index}>
        <path d={pedicel.d} fill="none" stroke={C.stem} strokeWidth={pedicel.width} strokeLinecap="round" />
        <path d={pedicel.d} fill="none" stroke={C.stemLight} strokeWidth={0.55} strokeLinecap="round" opacity={0.4} transform="translate(-0.35 -0.35)" />
      </g>
    ))}
    <path d={PEDUNCLE} fill="none" stroke={C.stem} strokeWidth={1.8} strokeLinecap="round" />
    <path d={PEDUNCLE} fill="none" stroke={C.stemLight} strokeWidth={0.5} strokeLinecap="round" opacity={0.4} transform="translate(-0.35 -0.35)" />

    <Bloom
      x={548}
      y={428}
      lift={60}
      radius={66}
      angle={-6}
      tint="white"
      turn={0.12}
      seed="hero-bloom"
      openAt={3.2}
      openOver={3.8}
      closeAt={17.8}
      closeOver={3.4}
    />
    <Bloom
      x={331}
      y={682}
      lift={50}
      radius={48}
      angle={6}
      tint="blush"
      turn={-0.18}
      seed="left-bloom"
      openAt={5.4}
      openOver={3.7}
      closeAt={18.7}
      closeOver={3.3}
    />
    <Bloom
      x={547}
      y={790}
      lift={44}
      radius={42}
      angle={-4}
      tint="white"
      turn={0.26}
      seed="low-bloom"
      openAt={7.4}
      openOver={3.5}
      closeAt={19.6}
      closeOver={3.2}
    />

    <g style={{ transformBox: "view-box", transformOrigin: "343px 514px" }} animation={wiggle({ rotate: 1.1, y: 0.6 }, { seed: "bud-sway", rate: 1, period: 8 })}>
      <g transform="translate(343 514) rotate(-14)">
        <path d={sepalFan(15, 5.5)} fill={C.sepalsDeep} />
        <path d={budPath(38, 17)} fill={BUD_WASH} stroke="#DFC5CB" strokeWidth={0.65} strokeOpacity={0.55} />
        <path d="M-1 -4C-6 -15 -3 -27 2 -34" fill="none" stroke="#E3C3CA" strokeWidth={0.9} strokeOpacity={0.58} strokeLinecap="round" />
        <ellipse cx={6.5} cy={-35} rx={0.9} ry={1.5} fill="#FFFDF2" fillOpacity={0.7} />
      </g>
    </g>
  </>
);

export function buildBindweed(): string {
  return render(
    {
      width: W,
      height: H,
      duration: D,
      title: "Field bindweed at first light",
      desc: "Field bindweed, Convolvulus arvensis, twines around a dry grass stalk in a quiet summer meadow. Pale trumpet flowers open one after another with the morning light, then fold closed again, while arrow-shaped leaves and seed motes drift in the still air.",
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
      <rect y={724} width={W} height={276} fill={MEADOW} />
      <Meadow />
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

      <g animation={dewGlint}>
        <circle cx={0} cy={0} r={1} fill="#FFFFFF" opacity={0} />
      </g>

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

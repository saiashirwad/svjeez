// The flight the lab edits, the same math the scene source runs, and the scene source itself as tokens.
export type Pt = readonly [number, number];

export interface Leg {
  readonly to: Pt;
  readonly over: number;
  readonly feel: number;
}

export interface Flight {
  readonly launch: number;
  readonly from: Pt;
  readonly legs: readonly Leg[];
}

export const DURATION = 8;
export const WIDTH = 640;
export const HEIGHT = 300;
/** The flight must land by then, so reactions and puffs finish inside the loop. */
export const LATEST_END = DURATION - 1.2;
export const MIN_OVER = 0.25;

export const INITIAL: Flight = {
  launch: 0.4,
  from: [-30, 215],
  legs: [
    { to: [150, 80], over: 1.5, feel: 0.5 },
    { to: [300, 175], over: 1.2, feel: 0 },
    { to: [450, 70], over: 1.4, feel: -0.4 },
    { to: [680, 125], over: 1.6, feel: 0.3 },
  ],
};

export const TREES: readonly Pt[] = [
  [90, 232],
  [250, 238],
  [372, 246],
  [560, 236],
];

export const curve = (u: number, f: number) => (f < 0 ? u ** (1 - 3 * f) : 1 - (1 - u) ** (1 + 3 * f));

export const points = (flight: Flight): Pt[] => [flight.from, ...flight.legs.map((leg) => leg.to)];

export const along = (pts: readonly Pt[], i: number, u: number, d = 0) => {
  const [a, b, c, e] = [i - 1, i, i + 1, i + 2].map((k) => pts[Math.max(0, Math.min(pts.length - 1, k))]!);

  return [0, 1].map((k) => {
    const [p0, p1, p2, p3] = [a![k]!, b![k]!, c![k]!, e![k]!];
    const [A, B, C] = [3 * p1 - p0 - 3 * p2 + p3, 2 * p0 - 5 * p1 + 4 * p2 - p3, p2 - p0];

    return d ? (C + 2 * B * u + 3 * A * u * u) / 2 : (2 * p1 + C * u + B * u * u + A * u ** 3) / 2;
  }) as [number, number];
};

export const starts = (flight: Flight) => {
  let start = flight.launch;

  return flight.legs.map((leg) => {
    const s = start;
    start += leg.over;

    return s;
  });
};

export const end = (flight: Flight) => flight.launch + flight.legs.reduce((sum, leg) => sum + leg.over, 0);

export const fly = (flight: Flight, t: number) => {
  const pts = points(flight);
  let start = flight.launch;
  let i = 0;

  while (i < flight.legs.length - 1 && t > start + flight.legs[i]!.over) start += flight.legs[i++]!.over;
  const leg = flight.legs[i]!;
  const s = Math.min(1, Math.max(0, (t - start) / leg.over));
  const u = curve(s, leg.feel);
  const [x, y] = along(pts, i, u);
  const [dx, dy] = along(pts, i, u, 1);

  return { x, y, rotate: (Math.atan2(dy, dx) * 180) / Math.PI, leg: i, s, u };
};

export const when = (flight: Flight, x: number) => {
  for (let t = 0; t < DURATION - 2; t += 0.02) if (fly(flight, t).x >= x) return t;

  return undefined;
};

/** A piece of the scene source. Tokens with an id are values the lab edits, so the code view can flash them. */
export interface Token {
  readonly text: string;
  readonly id?: string;
}

const num = (n: number, digits: number) => {
  const fixed = n.toFixed(digits);
  const text = fixed.includes(".") ? fixed.replace(/\.?0+$/, "") : fixed;

  return text === "-0" ? "0" : text;
};

export const sourceTokens = (flight: Flight): Token[] => {
  const out: Token[] = [];
  const t = (text: string) => out.push({ text });
  const v = (id: string, text: string) => out.push({ id, text });
  const pt = (id: string, p: Pt) => {
    t("[");
    v(`${id}.x`, num(p[0], 0));
    t(", ");
    v(`${id}.y`, num(p[1], 0));
    t("]");
  };

  t(`import { ease, motion, render, sampled, shake } from "svjeez";

// A paper plane's flight, leg by leg: fly to \`to\` in \`over\` seconds.
// feel > 0 leaves fast and lands slow; feel < 0 leaves slow and lands fast.
const launch = `);
  v("launch", num(flight.launch, 2));
  t(";\nconst from = ");
  pt("from", flight.from);
  t(";\nconst legs = [\n");
  flight.legs.forEach((leg, i) => {
    t("  { to: ");
    pt(`leg${i}.to`, leg.to);
    t(", over: ");
    v(`leg${i}.over`, num(leg.over, 2));
    t(", feel: ");
    v(`leg${i}.feel`, num(leg.feel, 2));
    t(" },\n");
  });
  t(`];

const duration = ${DURATION};
const pts = [from, ...legs.map((leg) => leg.to)];
const curve = (u: number, f: number) => (f < 0 ? u ** (1 - 3 * f) : 1 - (1 - u) ** (1 + 3 * f));

// Catmull-Rom through the points: where leg i is at u, or with d = 1, which way it points.
const along = (i: number, u: number, d = 0) => {
  const [a, b, c, e] = [i - 1, i, i + 1, i + 2].map((k) => pts[Math.max(0, Math.min(pts.length - 1, k))]);
  return [0, 1].map((k) => {
    const [p0, p1, p2, p3] = [a[k], b[k], c[k], e[k]];
    const [A, B, C] = [3 * p1 - p0 - 3 * p2 + p3, 2 * p0 - 5 * p1 + 4 * p2 - p3, p2 - p0];
    return d ? (C + 2 * B * u + 3 * A * u * u) / 2 : (2 * p1 + C * u + B * u * u + A * u ** 3) / 2;
  });
};

const fly = (t: number) => {
  let start = launch, i = 0;
  while (i < legs.length - 1 && t > start + legs[i].over) start += legs[i++].over;
  const u = curve(Math.min(1, Math.max(0, (t - start) / legs[i].over)), legs[i].feel);
  const [x, y] = along(i, u), [dx, dy] = along(i, u, 1);
  return { x, y, rotate: (Math.atan2(dy, dx) * 180) / Math.PI };
};
const when = (x: number) => { for (let t = 0; t < duration - 2; t += 0.02) if (fly(t).x >= x) return t; };
const end = launch + legs.reduce((sum, leg) => sum + leg.over, 0);
const puffs = Array.from({ length: 60 }, (_, k) => launch + k * 0.12).filter((t) => t < end);

export default () => render({ width: 640, height: 300, duration, title: "Paper plane",
  desc: "A paper plane loops over hills, trees shiver as it passes and birds scatter." }, <>
  <rect width={640} height={300} fill="#CFE8FF" />
  <circle cx={540} cy={70} r={30} fill="#FFD66B" />
  <path d="M0 230Q160 170 330 225T640 210V300H0Z" fill="#A8D8B0" />
  <path d="M0 262Q200 236 420 258T640 250V300H0Z" fill="#5FB27F" />
  {${JSON.stringify(TREES)}.map(([x, y]) => {
    const t = when(x), close = t === undefined ? 0 : Math.max(0, 1 - Math.abs(fly(t).y - y) / 150);
    return <g animation={close > 0.05 && shake({ at: t, over: 1 }, { rotate: 24 * close })}>
      <rect x={x - 2} y={y} width={4} height={16} fill="#6B4A32" /><circle cx={x} cy={y - 4} r={14} fill="#2F7A4E" /></g>;
  })}
  {[0, 1, 2].map((k) => { const t = when(470 + 12 * k);
    return <path d={\`M\${464 + 12 * k} \${250 - k}l4 3 4-3\`} fill="none" stroke="#24324A" strokeWidth={1.6}
      animation={t !== undefined && motion({ opacity: 1 }).at(t).to({ x: 40 + 20 * k, y: -110 - 14 * k, opacity: 0 }, 1.2, ease.in)
        .at(duration - 0.5).set({ x: 0, y: 0 }).to({ opacity: 1 }, 0.4)} />; })}
  {puffs.map((t) => <circle cx={fly(t).x} cy={fly(t).y} r={5} fill="#FFFFFF"
    animation={motion({ opacity: 0, scale: 0.5 }).at(t).to({ opacity: 0.9, scale: 1 }, 0.1).to({ opacity: 0, scale: 2.4 }, 1)} />)}
  <g animation={sampled(fly, { duration, tolerance: { translate: 0.5, rotate: 1 } })}>
    <path d="M-19 -12L22 0L-19 12L-11 0Z" fill="#FFFFFF" stroke="#24324A" strokeWidth={2} strokeLinejoin="round" />
  </g>
</>);
`);

  return out;
};

export const source = (flight: Flight) =>
  sourceTokens(flight)
    .map((token) => token.text)
    .join("");

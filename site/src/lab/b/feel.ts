// The feel of the scene, and the scene source it writes. The page compiles exactly the text source() returns.

export interface Feel {
  readonly bpm: number;
  /** Beats between one gummy's hop and the next. Negative runs right to left. */
  readonly stagger: number;
  /** How far a landing squashes, 0 to 0.6. */
  readonly squash: number;
  /** The landing spring's natural frequency in wobbles per second. */
  readonly hz: number;
  /** Damping ratio, 0.03 (jelly) to 0.9 (dead). */
  readonly damping: number;
  /** The fall's cubic-bezier. The rise is the same curve run backwards. */
  readonly fall: readonly [number, number, number, number];
  /** Hour of the day, 0 to 24. */
  readonly hour: number;
}

export const DEFAULT_FEEL: Feel = {
  bpm: 104,
  stagger: 0.25,
  squash: 0.34,
  hz: 3.2,
  damping: 0.16,
  fall: [0.5, 0, 0.9, 0.5],
  hour: 14,
};

export const COLORS = ["#FF5FA8", "#FFB23E", "#3EE6D6", "#7C6CFF", "#9BE15D"] as const;

const STOPS: readonly (readonly [number, string])[] = [
  [0, "#14163A"],
  [5, "#1E2150"],
  [6.5, "#FFB38A"],
  [9, "#8CCBFF"],
  [16, "#8CCBFF"],
  [18.5, "#FF7E5F"],
  [20, "#2B2F66"],
  [24, "#14163A"],
];

const hex = (s: string) => [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16));

export const skyAt = (hour: number): string => {
  const h = ((hour % 24) + 24) % 24;
  const i = STOPS.findIndex(([at]) => at > h);
  const [a, ca] = STOPS[i - 1]!;
  const [b, cb] = STOPS[i]!;
  const p = (h - a) / (b - a);
  const [x, y] = [hex(ca), hex(cb)];

  return `#${x
    .map((v, k) => Math.round(v + (y[k]! - v) * p).toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase()}`;
};

export const isDay = (hour: number) => {
  const h = ((hour % 24) + 24) % 24;

  return h >= 6 && h < 18;
};

/** Where the sun (by day) or moon (by night) sits in the 640×360 scene. */
export const lightAt = (hour: number) => {
  const h = ((hour % 24) + 24) % 24;
  const day = isDay(h);
  const a = (Math.PI * (((day ? h - 6 : h - 18) + 24) % 24)) / 12;

  return {
    x: Math.round(320 - 250 * Math.cos(a)),
    y: Math.round(300 - 220 * Math.sin(a)),
    r: day ? 26 : 18,
    fill: day ? "#FFD60A" : "#F4F1E6",
  };
};

const fmt = (n: number, digits = 2) => String(Number(n.toFixed(digits)));

export type Part = string | { readonly key: string; readonly text: string };

/** The scene source as parts, where each object part is a value an instrument controls. */
export const parts = (f: Feel): Part[] => {
  const light = lightAt(f.hour);
  const v = (key: string, text: string) => ({ key, text });
  const [x1, y1, x2, y2] = f.fall;

  return [
    `import { ease, motion, render, sampled } from "svjeez";

const BPM = `,
    v("bpm", fmt(f.bpm, 0)),
    `;
const STAGGER = `,
    v("stagger", fmt(f.stagger)),
    ` * (60 / BPM); // seconds between hops
const SPRING = { squash: `,
    v("squash", fmt(f.squash)),
    `, hz: `,
    v("hz", fmt(f.hz, 1)),
    `, damping: `,
    v("damping", fmt(f.damping)),
    ` };
const FALL = ease.bezier(`,
    v("fall", `${fmt(x1)}, ${fmt(y1)}, ${fmt(x2)}, ${fmt(y2)}`),
    `);
const RISE = ease.bezier(`,
    v("fall", `${fmt(1 - x2)}, ${fmt(1 - y2)}, ${fmt(1 - x1)}, ${fmt(1 - y1)}`),
    `);
const SKY = "`,
    v("sky", skyAt(f.hour)),
    `", LIGHT = `,
    v("sky", `{ x: ${light.x}, y: ${light.y}, r: ${light.r}, fill: "${light.fill}" }`),
    `;

const beat = 60 / BPM, W = 64, H = 64, GROUND = 300;
const colors = ["${COLORS.join('", "')}"];

/** Squash at time t: anticipation, stretch in the air, then a damped spring on landing. */
const squash = (t: number, launch: number, land: number) => {
  const { squash: A, hz, damping: z } = SPRING, w = 2 * Math.PI * hz;
  if (t < launch - beat / 4) return 0;
  if (t < launch) return 0.6 * A * Math.sin(((t - launch) / beat + 0.25) * 2 * Math.PI);
  if (t < land) return -0.5 * A * Math.abs(Math.cos((Math.PI * (t - launch)) / (land - launch)));
  const s = t - land;
  return A * Math.exp(-z * w * s) * Math.cos(w * Math.sqrt(1 - z * z) * s);
};

export default function build(): string {
  const duration = 8 * beat;
  const gummies = colors.map((fill, i) => {
    const order = STAGGER < 0 ? colors.length - 1 - i : i;
    const launch = beat * 0.75 + order * Math.abs(STAGGER), land = launch + 2 * beat;
    const s = (t: number) => squash(t, launch, land);
    const cx = 120 + i * 100;
    const body = sampled((t) => {
      const w = W * (1 + 0.8 * s(t)), h = H * (1 - s(t));
      return { x: (W - w) / 2, y: H - h, width: w, height: h };
    }, { duration, step: 1 / 60, tolerance: { translate: 0.4, width: 0.4, height: 0.4 } });
    const eyes = sampled((t) => ({ y: H * s(t) * 0.75 }), { duration, step: 1 / 60, tolerance: { translate: 0.4 } });
    const hop = motion({ y: 0 }).at(launch).to({ y: -150 }, beat, RISE).to({ y: 0 }, beat, FALL);
    const shadow = motion({ scale: 1, opacity: 0.3 }).at(launch).to({ scale: 0.4, opacity: 0.1 }, beat, RISE).to({ scale: 1, opacity: 0.3 }, beat, FALL);
    return (
      <g>
        <ellipse cx={cx} cy={GROUND + 4} rx={34} ry={6} fill="#000" animation={shadow} />
        <g animation={hop}>
          <rect x={cx - W / 2} y={GROUND - H} width={W} height={H} rx={24} fill={fill} animation={body} />
          <g animation={eyes}>
            <circle cx={cx - 11} cy={GROUND - 40} r={5} fill="#1B1B2F" />
            <circle cx={cx + 11} cy={GROUND - 40} r={5} fill="#1B1B2F" />
          </g>
        </g>
      </g>
    );
  });
  return render(
    { width: 640, height: 360, duration, title: "Five gummies hop in a rhythm" },
    <>
      <rect width={640} height={360} fill={SKY} />
      <circle cx={LIGHT.x} cy={LIGHT.y} r={LIGHT.r} fill={LIGHT.fill} />
      <rect y={GROUND} width={640} height={60} fill="#1B1B2F" />
      {gummies}
    </>,
  );
}
`,
  ];
};

export const source = (f: Feel) => parts(f).map((p) => (typeof p === "string" ? p : p.text)).join("");

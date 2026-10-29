import type { Point, Spectrum, Term } from "./fourier";

/** What one compile draws: the first `n` circles of a spectrum, and the formula it morphs from. */
export interface Frame {
  readonly spectrum: Spectrum;
  readonly n: number;
  /** The formula on screen before this file: its terms and count. Equal to this frame's when nothing changed. */
  readonly before: { readonly terms: readonly Term[]; readonly n: number };
  /** Circles from this index on are new in this file and pop in. */
  readonly freshFrom: number;
  /** Seconds the pen takes to go once around. */
  readonly loop: number;
}

/** Terms written out in the formula; the rest hide behind a ⋯. */
export const SHOWN = 10;

const fix = (v: number, digits: number) => Number(v.toFixed(digits));

const pack = (terms: readonly Term[]) =>
  JSON.stringify(terms.map(({ k, r, phase }) => [k, fix(r, 5), fix(phase, 4)]));

const outlinePath = (outline: readonly Point[]) => {
  const step = Math.max(1, Math.floor(outline.length / 256));
  const kept = outline.filter((_, i) => i % step === 0);

  return `${kept.map(([x, y], i) => `${i ? "L" : "M"}${fix(x, 3)} ${fix(-y, 3)}`).join("")}Z`;
};

export const fileName = "fourier.tsx";

/** The scene as TSX source, the file the worker compiles. */
export const sceneSource = ({
  spectrum,
  n,
  before,
  freshFrom,
  loop,
}: Frame): string => `import { tex } from "@svjeez/math";
import { css, ease, el, enter, fx, motion, render, sampled } from "svjeez";
import { morph } from "svjeez/extras";

const W = 960;
const H = 540;
const D = ${loop};

/** [turns per loop, radius, phase], largest first. One unit is half the drawing's longer side, y up. */
const TERMS: [number, number, number][] = ${pack(spectrum.terms.slice(0, n))};
const BEFORE: [number, number, number][] = ${pack(before.terms.slice(0, Math.min(before.n, SHOWN)))};
const BEFORE_N = ${before.n};
const FRESH_FROM = ${freshFrom};
/** What was drawn, in the same units, y down. */
const DRAWN = "${outlinePath(spectrum.outline)}";

const UNIT = 168;
const CX = 300;
const CY = 270;

const hue = (k: number) => {
  const turns = Math.min(1, Math.log2(Math.abs(k)) / 6);
  return k > 0 ? 18 + 150 * turns : 190 + 140 * turns;
};
const hex = (h: number, l = 0.66) => {
  const s = 0.86;
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const c = l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(255 * c).toString(16).padStart(2, "0");
  };
  return "#" + f(0) + f(8) + f(4);
};
const color = (k: number) => hex(hue(k));

/** The pen at s of one loop, in scene pixels. */
const pen = (s: number): [number, number] => {
  let x = 0;
  let y = 0;
  for (const [k, r, phase] of TERMS) {
    x += r * Math.cos(2 * Math.PI * k * s + phase);
    y += r * Math.sin(2 * Math.PI * k * s + phase);
  }
  return [CX + UNIT * x, CY - UNIT * y];
};

const STEPS = 720;
const trace = Array.from({ length: STEPS + 1 }, (_, j) => pen(j / STEPS));
const along = [0];
for (let j = 1; j <= STEPS; j++)
  along.push(along[j - 1]! + Math.hypot(trace[j]![0] - trace[j - 1]![0], trace[j]![1] - trace[j - 1]![1]));
const length = along[STEPS]! || 1;
const d = trace.map(([x, y], j) => (j ? "L" : "M") + x.toFixed(1) + " " + y.toFixed(1)).join("") + "Z";

const inked = sampled(
  (t) => {
    const u = Math.min(STEPS - 1e-6, (t / D) * STEPS);
    const j = Math.floor(u);
    return { draw: (along[j]! + (along[j + 1]! - along[j]!) * (u - j)) / length };
  },
  { duration: D, step: D / 240, tolerance: { draw: 0.001 } },
);

/** Each circle turns relative to the one it rides, so its own arm points at its true angle. */
const chain = TERMS.reduceRight<ReturnType<typeof el.g> | undefined>((inner, [k, r, phase], i) => {
  const ride = i ? TERMS[i - 1]! : undefined;
  const from = ride ? [ride[1] * Math.cos(ride[2]) * UNIT, -ride[1] * Math.sin(ride[2]) * UNIT] : [CX, CY];
  const arm = [r * Math.cos(phase) * UNIT, -r * Math.sin(phase) * UNIT];
  const turns = k - (ride ? ride[0] : 0);
  const big = r * UNIT > 1.2;
  const fresh = i >= FRESH_FROM;
  const tint = color(k);
  return el.g({ transform: "translate(" + from[0]!.toFixed(2) + " " + from[1]!.toFixed(2) + ")" }, [
    el.g(
      {
        style: { transformOrigin: "0 0", transformBox: "view-box" },
        animation: motion({ rotate: 0 }).to({ rotate: -360 * turns }, D, ease.linear),
      },
      [
        big
          ? el.g({ class: fresh ? "once" : undefined, animation: fresh ? enter({ at: 0, over: 0.7 }, { scale: 0 }, ease.pop) : undefined }, [
              el.circle({ r: (r * UNIT).toFixed(2), fill: "none", stroke: tint, strokeOpacity: 0.32, strokeWidth: 1 }),
            ])
          : [],
        big ? el.line({ x2: arm[0]!.toFixed(2), y2: arm[1]!.toFixed(2), stroke: tint, strokeOpacity: 0.9, strokeWidth: i < 3 ? 2 : 1.25, strokeLinecap: "round" }) : [],
        inner ??
          el.g({ transform: "translate(" + arm[0]!.toFixed(2) + " " + arm[1]!.toFixed(2) + ")" }, [
            el.circle({ r: 9, fill: "#fff3c4", opacity: 0.18 }),
            el.circle({ r: 3.5, fill: "#fff8e0" }),
          ]),
      ],
    ),
  ]);
}, undefined);

const num = (v: number) => v.toFixed(2);
const term = ([k, r, phase]: [number, number, number]) => {
  const kt = k === 1 ? "t" : k === -1 ? "-t" : k + "t";
  const p = Math.abs(phase) < 0.005 ? "" : (phase < 0 ? "-" : "+") + num(Math.abs(phase));
  return "\\\\color{" + color(k) + "}{" + (r >= 0.01 ? num(r) : String(Number(r.toPrecision(1)))) + "\\\\,e^{i(" + kt + p + ")}}";
};
const formula = (terms: [number, number, number][], count: number) => {
  const shown = terms.slice(0, ${SHOWN});
  const rows: string[] = [];
  for (let i = 0; i < shown.length; i += 2)
    rows.push((i ? "&+" : "&=") + shown.slice(i, i + 2).map(term).join("+"));
  if (count > shown.length) rows.push("&+\\\\cdots");
  return "\\\\begin{aligned}z(t)&=\\\\sum_{n=1}^{" + count + "}c_n\\\\,e^{ik_nt}\\\\\\\\" + rows.join("\\\\\\\\") + "\\\\end{aligned}";
};

const at = { x: 600, y: 42, fontSize: 21, color: "#d9d6cf" };
const was = tex(formula(BEFORE, BEFORE_N), at);
const now = tex(formula(TERMS, TERMS.length), at);
const swap = morph([was, now], { at: [0.05], over: 0.55 });

/** The spectrum: one bar per circle at its frequency, height by radius, frequencies squeezed by a square root. */
const SX = 770;
const SY = 500;
const biggest = TERMS[0]![1];
const bars = TERMS.map(([k, r], i) => {
  const x = SX + Math.sign(k) * Math.sqrt(Math.min(Math.abs(k), 200)) * 11;
  const h = Math.max(2, 92 * Math.sqrt(r / biggest));
  const bar = <rect x={x - 1.5} y={SY - h} width={3} height={h} rx={1.5} fill={color(k)} />;
  return i >= FRESH_FROM ? <g class="once" animation={enter({ at: 0, over: 0.6 }, { scale: 0, y: 12 }, ease.pop)}>{bar}</g> : bar;
});
const zero = tex("0", { x: SX, y: SY + 8, fontSize: 13, color: "#8a8790", anchor: [0.5, 0] });
const kLabel = tex("k", { x: 934, y: SY + 6, fontSize: 15, color: "#8a8790", anchor: [1, 0] });

export default function build(): string {
  return render(
    {
      width: W,
      height: H,
      duration: D,
      title: "Fourier",
      desc: TERMS.length + " circles, each spinning on the tip of the last, trace a drawing, beside the sum that draws it.",
      css: css\`.once{--t0:0s}.once.a,.once .a{animation-iteration-count:1}\`,
      reducedMotion: { at: D * 0.999 },
    },
    <>
      <rect width={W} height={H} fill="#111015" />
      <path d={DRAWN} transform={"translate(" + CX + " " + CY + ") scale(" + UNIT + ")"} fill="none" stroke="#ffffff" strokeOpacity={0.14} strokeWidth={1.5 / UNIT} strokeDasharray={3 / UNIT + " " + 4 / UNIT} />
      <path d={d} fill="none" stroke="#ffd36b" strokeOpacity={0.22} strokeWidth={1.5} strokeLinejoin="round" />
      <g filter={fx.glow({ blur: 4 })}>
        <path d={d} fill="none" stroke="#ffd36b" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" animation={inked} />
      </g>
      {chain}
      <g class="once">{swap.node}</g>
      <line x1={606} x2={934} y1={SY + 0.5} y2={SY + 0.5} stroke="#ffffff" strokeOpacity={0.18} />
      {bars}
      {zero.node}
      {kLabel.node}
    </>,
  );
}
`;

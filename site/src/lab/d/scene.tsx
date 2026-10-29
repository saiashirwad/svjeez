import { fourier, tex, type FourierTerm } from "@svjeez/math";
import {
  ease,
  enter,
  fx,
  motion,
  Once,
  polylinePath,
  render,
  sampled,
  type Hex,
  type SvgNode,
} from "svjeez";
import { morph } from "svjeez/extras";
import type { Outline } from "./outline";

/** What one compile draws: the first `n` circles of a drawing's Fourier series, and the formula it morphs from. */
export interface Frame {
  readonly outline: Outline;
  readonly n: number;
  /** The formula on screen before this file: its drawing and count. The same outline object when only the count changed. */
  readonly before: { readonly outline: Outline; readonly n: number };
  /** Circles from this index on are new in this file and pop in. */
  readonly freshFrom: number;
  /** Seconds the pen takes to go once around. */
  readonly loop: number;
}

/** Terms written out in the formula; the rest hide behind a ⋯. */
const SHOWN = 10;

const W = 960;
const H = 540;

/** Scene pixels per unit, where one unit is half the drawing's longer side. */
const UNIT = 168;
const CX = 300;
const CY = 270;
const STEPS = 720;

/** Points the series is taken from, evenly around the drawing. */
const SAMPLES = 512;

/** Where the spectrum's zero frequency sits on its axis. */
const SX = 770;
const SY = 500;

const hue = (k: number) => {
  const turns = Math.min(1, Math.log2(Math.abs(k)) / 6);

  return k > 0 ? 18 + 150 * turns : 190 + 140 * turns;
};

const hex = (h: number, l = 0.66): Hex => {
  const s = 0.86;

  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const c = l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k - 3, 9 - k, 1));

    return Math.round(255 * c)
      .toString(16)
      .padStart(2, "0");
  };

  return `#${f(0)}${f(8)}${f(4)}`;
};

const color = (k: number) => hex(hue(k));

const fix = (v: number, digits: number) => Number(v.toFixed(digits));

/** The series' samples as path data in units around their mean, y down, thinned to 256 points. */
const drawnPath = ({ mean: [mx, my], points }: ReturnType<typeof fourier>) => {
  const step = Math.max(1, Math.floor(points.length / 256));
  const kept = points.filter((_, i) => i % step === 0);

  return polylinePath(
    kept.map(([x, y]) => ({ x: x - mx, y: my - y })),
    { closed: true, precision: 3 },
  );
};

const term = ({ k, r, phase }: FourierTerm) => {
  const kt = k === 1 ? "t" : k === -1 ? "-t" : `${k}t`;
  const p = Math.abs(phase) < 0.005 ? "" : `${phase < 0 ? "-" : "+"}${Math.abs(phase).toFixed(2)}`;
  const size = r >= 0.01 ? r.toFixed(2) : String(Number(r.toPrecision(1)));

  return `\\color{${color(k)}}{${size}\\,e^{i(${kt}${p})}}`;
};

const formula = (terms: readonly FourierTerm[], count: number) => {
  const shown = terms.slice(0, Math.min(count, SHOWN));
  const rows: string[] = [];

  for (let i = 0; i < shown.length; i += 2)
    rows.push(
      `${i ? "&+" : "&="}${shown
        .slice(i, i + 2)
        .map(term)
        .join("+")}`,
    );

  if (count > shown.length) rows.push("&+\\cdots");

  return `\\begin{aligned}z(t)&=\\sum_{n=1}^{${count}}c_n\\,e^{ik_nt}\\\\${rows.join("\\\\")}\\end{aligned}`;
};

/** The circles, each spinning on the tip of the last, the pen they steer, the sum, and the spectrum. */
export const build = ({ outline, n, before, freshFrom, loop: D }: Frame): string => {
  const series = fourier(outline, { samples: SAMPLES });
  const terms = series.terms.slice(0, n);

  const beforeTerms =
    before.outline === outline ? series.terms : fourier(before.outline, { samples: SAMPLES }).terms;

  /** The pen at s of one loop, in scene pixels. */
  const pen = (s: number): [number, number] => {
    let x = 0;
    let y = 0;

    for (const { k, r, phase } of terms) {
      x += r * Math.cos(2 * Math.PI * k * s + phase);
      y += r * Math.sin(2 * Math.PI * k * s + phase);
    }

    return [CX + UNIT * x, CY - UNIT * y];
  };

  const trace = Array.from({ length: STEPS + 1 }, (_, j) => pen(j / STEPS));
  const along = [0];

  for (let j = 1; j <= STEPS; j++)
    along.push(
      along[j - 1]! + Math.hypot(trace[j]![0] - trace[j - 1]![0], trace[j]![1] - trace[j - 1]![1]),
    );

  const length = along[STEPS]! || 1;

  const d = polylinePath(
    trace.map(([x, y]) => ({ x, y })),
    { closed: true, precision: 1 },
  );

  const inked = sampled(
    (t) => {
      const u = Math.min(STEPS - 1e-6, (t / D) * STEPS);
      const j = Math.floor(u);

      return { draw: (along[j]! + (along[j + 1]! - along[j]!) * (u - j)) / length };
    },
    { duration: D, step: D / 240, tolerance: { draw: 0.001 } },
  );

  /** Each circle turns relative to the one it rides, so its own arm points at its true angle. */
  const chain = terms.reduceRight<SvgNode | undefined>((inner, { k, r, phase }, i) => {
    const ride = i ? terms[i - 1]! : undefined;

    const from = ride
      ? [ride.r * Math.cos(ride.phase) * UNIT, -ride.r * Math.sin(ride.phase) * UNIT]
      : [CX, CY];

    const arm = [r * Math.cos(phase) * UNIT, -r * Math.sin(phase) * UNIT] as const;
    const turns = k - (ride ? ride.k : 0);
    const big = r * UNIT > 1.2;
    const fresh = i >= freshFrom;
    const tint = color(k);

    return (
      <g transform={`translate(${from[0]!.toFixed(2)} ${from[1]!.toFixed(2)})`}>
        <g
          style={{ transformOrigin: "0 0", transformBox: "view-box" }}
          animation={motion({ rotate: 0 }).to({ rotate: -360 * turns }, D, ease.linear)}
        >
          {big && (
            <Once
              animation={fresh ? enter({ at: 0, over: 0.7 }, { scale: 0 }, ease.pop) : undefined}
            >
              <circle
                r={fix(r * UNIT, 2)}
                fill="none"
                stroke={tint}
                strokeOpacity={0.32}
                strokeWidth={1}
              />
            </Once>
          )}
          {big && (
            <line
              x2={fix(arm[0], 2)}
              y2={fix(arm[1], 2)}
              stroke={tint}
              strokeOpacity={0.9}
              strokeWidth={i < 3 ? 2 : 1.25}
              strokeLinecap="round"
            />
          )}
          {inner ?? (
            <g transform={`translate(${arm[0].toFixed(2)} ${arm[1].toFixed(2)})`}>
              <circle r={9} fill="#fff3c4" opacity={0.18} />
              <circle r={3.5} fill="#fff8e0" />
            </g>
          )}
        </g>
      </g>
    );
  }, undefined);

  const at = { x: 600, y: 42, fontSize: 21, color: "#d9d6cf" } as const;
  const was = tex(formula(beforeTerms, before.n), at);
  const now = tex(formula(terms, terms.length), at);
  const swap = morph([was, now], { at: [0.05], over: 0.55 });

  /** One bar per circle at its frequency, height by radius, frequencies squeezed by a square root. */
  const biggest = terms[0]!.r;

  const bars = terms.map(({ k, r }, i) => {
    const x = SX + Math.sign(k) * Math.sqrt(Math.min(Math.abs(k), 200)) * 11;
    const h = Math.max(2, 92 * Math.sqrt(r / biggest));
    const bar = <rect x={x - 1.5} y={SY - h} width={3} height={h} rx={1.5} fill={color(k)} />;

    return i >= freshFrom ? (
      <Once animation={enter({ at: 0, over: 0.6 }, { scale: 0, y: 12 }, ease.pop)}>{bar}</Once>
    ) : (
      bar
    );
  });

  const zero = tex("0", { x: SX, y: SY + 8, fontSize: 13, color: "#8a8790", anchor: [0.5, 0] });
  const kLabel = tex("k", { x: 934, y: SY + 6, fontSize: 15, color: "#8a8790", anchor: [1, 0] });

  return render(
    {
      width: W,
      height: H,
      duration: D,
      title: "Fourier",
      desc: `${terms.length} circles, each spinning on the tip of the last, trace a drawing, beside the sum that draws it.`,
      reducedMotion: { at: D * 0.999 },
    },
    <>
      <rect width={W} height={H} fill="#111015" />
      <path
        d={drawnPath(series)}
        transform={`translate(${CX} ${CY}) scale(${UNIT})`}
        fill="none"
        stroke="#ffffff"
        strokeOpacity={0.14}
        strokeWidth={1.5 / UNIT}
        strokeDasharray={`${3 / UNIT} ${4 / UNIT}`}
      />
      <path
        d={d}
        fill="none"
        stroke="#ffd36b"
        strokeOpacity={0.22}
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
      <g filter={fx.glow({ blur: 4 })}>
        <path
          d={d}
          fill="none"
          stroke="#ffd36b"
          strokeWidth={2.5}
          strokeLinejoin="round"
          strokeLinecap="round"
          animation={inked}
        />
      </g>
      {chain}
      <Once>{swap.node}</Once>
      <line x1={606} x2={934} y1={SY + 0.5} y2={SY + 0.5} stroke="#ffffff" strokeOpacity={0.18} />
      {bars}
      {zero.node}
      {kLabel.node}
    </>,
  );
};

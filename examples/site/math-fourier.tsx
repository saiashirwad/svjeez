import { tex } from "@svjeez/math";
import { enter, motion, render, sampled } from "svjeez";
import { morph } from "svjeez/extras";
import { CSS, chrome, outro } from "./kit";
import { theme } from "../style";

// A square wave from epicycles: circles for the odd harmonics join one at a time, each spinning on the tip of the last, and the tip's height traces a partial Fourier sum that grows squarer with every circle.
const W = 504;
const H = 340;
const D = 12;
const win = chrome(W, H, "fourier.tsx");

/** Pixels for a square wave of height 1. */
const A = 46;
const CX = 116;
const CY = 204;
const X0 = 248;
const X1 = 480;

const HARMONICS = [
  { n: 1, color: theme.base0D },
  { n: 3, color: theme.base0B },
  { n: 5, color: theme.base09 },
  { n: 7, color: theme.base0E },
].map((h) => ({ ...h, r: (4 * A) / (Math.PI * h.n) }));

const PEN = theme.base0A;

/** Each circle spins one base period while the pen crosses the plot, then rests while the pen returns and the next circle grows. */
const PERIOD = 1.8;
const GAP = 0.45;
const RUNS = [1.2, 3.45, 5.7, 7.95, 10.2];

const smooth = (u: number) => {
  const v = Math.min(1, Math.max(0, u));

  return v * v * (3 - 2 * v);
};

/** Where the story is at time t: how far each circle has grown, the base angle, and the pen's x. */
const state = (t: number) => {
  const grow = HARMONICS.map((_, i) =>
    i === 0 ? smooth((t - 0.5) / 0.6) : smooth((t - RUNS[i - 1]! - PERIOD) / GAP),
  );

  const run = RUNS.findLast((s) => t >= s);

  if (run === undefined) return { grow, theta: 0, pen: X0 };
  const u = (t - run) / PERIOD;

  if (u <= 1) return { grow, theta: 2 * Math.PI * u, pen: X0 + (X1 - X0) * u };

  return { grow, theta: 0, pen: X1 - (X1 - X0) * smooth((t - run - PERIOD) / GAP) };
};

/** The center of circle i, or the chain's tip for i = HARMONICS.length. */
const center = (t: number, i: number) => {
  const { grow, theta } = state(t);
  let x = CX;
  let y = CY;

  for (let j = 0; j < i; j++) {
    const { n, r } = HARMONICS[j]!;
    x += grow[j]! * r * Math.cos(n * theta);
    y -= grow[j]! * r * Math.sin(n * theta);
  }

  return { x, y };
};

const FINE = { duration: D, step: 1 / 120 };

const circles = HARMONICS.map(({ n, r, color }, i) => ({
  r,
  color,
  place: sampled((t) => center(t, i), { ...FINE, tolerance: { translate: 0.5 } }),
  grow: sampled((t) => ({ scale: Math.max(0.001, state(t).grow[i]!) }), {
    ...FINE,
    tolerance: { scale: 0.01 },
  }),
  spin: sampled((t) => ({ rotate: (-n * state(t).theta * 180) / Math.PI }), {
    ...FINE,
    tolerance: { rotate: 1 },
  }),
}));

const tip = sampled((t) => center(t, HARMONICS.length), { ...FINE, tolerance: { translate: 0.5 } });

const pen = sampled((t) => ({ x: state(t).pen, y: center(t, HARMONICS.length).y }), {
  ...FINE,
  tolerance: { translate: 0.5 },
});

const connector = sampled(
  (t) => {
    const end = center(t, HARMONICS.length);

    return { x: end.x, y: end.y - 0.5, width: Math.max(0, state(t).pen - end.x) };
  },
  { ...FINE, tolerance: { translate: 0.5, width: 0.5 } },
);

/** The partial sum with the first k harmonics, as a path across the plot, and how much of its length lies before each base angle. */
const trace = (k: number) => {
  const points = Array.from({ length: 241 }, (_, i) => {
    const theta = (2 * Math.PI * i) / 240;
    const sum = HARMONICS.slice(0, k).reduce((s, { n, r }) => s + r * Math.sin(n * theta), 0);

    return [X0 + ((X1 - X0) * i) / 240, CY - sum] as const;
  });

  const cumulative = [0];

  for (let i = 1; i < points.length; i++) {
    const [[ax, ay], [bx, by]] = [points[i - 1]!, points[i]!];
    cumulative.push(cumulative[i - 1]! + Math.hypot(bx - ax, by - ay));
  }

  const total = cumulative.at(-1)!;
  const d = points.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join("");
  const run = RUNS[k - 1]!;

  return {
    d,
    progress: sampled(
      (t) => {
        const u = Math.min(1, Math.max(0, (t - run) / PERIOD)) * 240;
        const i = Math.min(239, Math.floor(u));

        return {
          draw: (cumulative[i]! + (cumulative[i + 1]! - cumulative[i]!) * (u - i)) / total,
        };
      },
      { ...FINE, tolerance: { draw: 0.002 } },
    ),
    dim: k < HARMONICS.length ? RUNS[k]! - GAP : undefined,
  };
};

const traces = HARMONICS.map((_, i) => trace(i + 1));

const at = { x: 0, y: 56, fontSize: 17, theme } as const;

const terms = HARMONICS.map(({ n, color }) =>
  n === 1
    ? String.raw`\color{${color}}{\sin t}`
    : String.raw`\color{${color}}{\frac{\sin ${n}t}{${n}}}`,
);

const formula = (k: number, more = false) =>
  String.raw`f(t) \approx \frac{4}{\pi}\Bigl(${terms.slice(0, k).join(" + ")}${more ? String.raw` + \cdots` : ""}\Bigr)`;

const widest = tex(formula(HARMONICS.length, true), at);
const placed = { ...at, x: Math.round((W - widest.width) / 2) };

const versions = [
  ...HARMONICS.map((_, i) => tex(formula(i + 1), placed)),
  tex(formula(HARMONICS.length, true), placed),
];

const m = morph(versions, { at: RUNS.slice(1).map((s) => s - GAP), over: 0.5 });
const WRITTEN = 2;

const square = `M${X0} ${CY - A}H${(X0 + X1) / 2}V${CY + A}H${X1}`;

export default function build(): string {
  return render(
    {
      width: W,
      height: H,
      duration: D,
      title: "Fourier series",
      desc: "Four circles for the odd harmonics join one at a time, each spinning on the tip of the one before at 1, 3, 5 and 7 times the base rate. A faint line carries the tip's height to a plot on the right, which traces sin t, then sin t + sin 3t / 3, and so on, each sum closer to the square wave drawn faintly behind, while the formula above gains a colored term for every circle.",
      css: CSS,
      reducedMotion: { at: RUNS[4]! + PERIOD / 4 },
    },
    <>
      {win.node}
      <g animation={outro(D)}>
        <g animation={enter({ at: 0.3, over: 0.6 })}>
          <line x1={X0 - 6} y1={CY} x2={X1 + 4} y2={CY} stroke={theme.base02} />
          <line x1={X0} y1={CY - A - 22} x2={X0} y2={CY + A + 22} stroke={theme.base02} />
          <path
            d={square}
            fill="none"
            stroke={theme.base03}
            strokeWidth={1.25}
            strokeDasharray="3 4"
            animation={motion({ opacity: 0.6 })
              .at(RUNS[4]! - GAP)
              .to({ opacity: 1 }, 0.6)}
          />
        </g>
        {traces.map(({ d, progress, dim }) => (
          <g
            animation={
              dim === undefined
                ? undefined
                : motion({ opacity: 1 }).at(dim).to({ opacity: 0.24 }, GAP)
            }
          >
            <path
              d={d}
              fill="none"
              stroke={PEN}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
              animation={progress}
            />
          </g>
        ))}
        <g animation={enter({ at: 0.9, over: 0.4 })}>
          <rect height={1} fill={theme.base03} opacity={0.7} animation={connector} />
        </g>
        {circles.map(({ r, color, place, grow, spin }) => (
          <g animation={place}>
            <g animation={grow}>
              <circle r={r} fill="none" stroke={color} strokeOpacity={0.45} strokeWidth={1.25} />
              <line
                x1={-r}
                x2={r}
                stroke={color}
                strokeWidth={2}
                strokeDasharray={`0 ${r} ${r}`}
                animation={spin}
              />
              <circle r={2} fill={color} />
            </g>
          </g>
        ))}
        <g animation={enter({ at: 0.9, over: 0.4 })}>
          <g animation={tip}>
            <circle r={3} fill={theme.base07} />
          </g>
          <g animation={pen}>
            <circle r={4} fill={PEN} />
          </g>
        </g>
        <g class="sans" animation={enter({ at: 1.8, over: 0.6 })}>
          <text x={X0} y={H - 22} fontSize={12} fill={theme.base03}>
            {"sampled((t) => tip(t), { duration })"}
          </text>
        </g>
        <g animation={motion({ opacity: 1 }).at(WRITTEN).set({ opacity: 0 })}>
          {versions[0]!.write({ at: 0.25, over: 1.2 })}
        </g>
        <g animation={motion({ opacity: 0 }).at(WRITTEN).set({ opacity: 1 })}>{m.node}</g>
      </g>
    </>,
  );
}

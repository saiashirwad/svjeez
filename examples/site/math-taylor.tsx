import { plane, tex } from "@svjeez/math";
import { def, draw, enter, motion, render, type Color, morph, span } from "svjeez";
import { rect } from "svjeez/geometry";
import { CSS, chrome, outro } from "./lib/kit";
import { theme } from "../style";

const W = 504;
const H = 340;
const D = 12;
const win = chrome(W, H, "taylor.tsx");

const COS = theme.base0D;

const graph = plane({
  xRange: [-2 * Math.PI, 2 * Math.PI],
  yRange: [-1.7, 1.7],
  frame: rect(28, 130, 448, 158),
  labels: false,
  theme,
});

const { x: bx, y: by, w: bw, h: bh } = graph.bounds;
const clip = def.clipPath({}, <rect x={bx} y={by} width={bw} height={bh} />);

const stages: { n: number; color: Color; op?: string; term: string; at: number }[] = [
  { n: 0, color: theme.base0A, term: "1", at: 2.4 },
  { n: 2, color: theme.base0B, op: "-", term: String.raw`\frac{x^2}{2!}`, at: 4.0 },
  { n: 4, color: theme.base09, op: "+", term: String.raw`\frac{x^4}{4!}`, at: 5.6 },
  { n: 6, color: theme.base08, op: "-", term: String.raw`\frac{x^6}{6!}`, at: 7.2 },
  { n: 8, color: theme.base0E, op: "+", term: String.raw`\frac{x^8}{8!}`, at: 8.8 },
];

const factorial = (k: number): number => (k <= 1 ? 1 : k * factorial(k - 1));

const taylor =
  (n: number) =>
  (x: number): number => {
    let sum = 0;

    for (let k = 0; k <= n; k += 2) sum += ((-1) ** (k / 2) * x ** k) / factorial(k);

    return sum;
  };

const half = (f: (x: number) => number, to: number): string => {
  const steps = 160;
  let d = "";

  for (let i = 0; i <= steps; i++) {
    const x = (to * i) / steps;
    const y = f(x);
    const p = graph.point(x, Math.max(-3, Math.min(3, y)));

    d += `${i ? "L" : "M"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`;

    if (Math.abs(y) > 3) break;
  }

  return d;
};

const at = { x: W / 2, y: 92, fontSize: 21, anchor: [0.5, 0.5], theme } as const;

const versions = stages.map((_, i) =>
  tex(
    String.raw`\color{${COS}}{\cos x} \approx ` +
      stages
        .slice(0, i + 1)
        .map((s) => `${s.op ?? ""} \\color{${s.color}}{${s.term}}`)
        .join(" "),
    at,
  ),
);

const WRITE = { at: 1.2, over: 1 };
const m = morph(versions, { at: stages.slice(1).map((s) => s.at - 0.3), over: 0.7 });
const handoff = WRITE.at + WRITE.over + 0.2;

const cosine = graph.plot({ at: 0.5, over: 1.4 }, Math.cos, { color: COS, strokeWidth: 2.5 });

const origin = graph.point(0, 1);

const ticks = [-2, -1, 1, 2].map((k) => {
  const p = graph.point(k * Math.PI, 0);
  const label = Math.abs(k) === 1 ? "\\pi" : "2\\pi";

  return tex(k < 0 ? `-${label}` : label, {
    x: p.x,
    y: p.y + 14,
    fontSize: 13,
    anchor: [0.5, 0.5],
    color: theme.base03,
    display: false,
  });
});

export default function build(): string {
  return render(
    {
      width: W,
      height: H,
      duration: D,
      title: "Taylor series",
      desc: "The cosine curve draws in, then its Taylor polynomials around 0 follow one by one: 1, then 1 − x²/2!, then + x⁴/4!, − x⁶/6! and + x⁸/8!, each hugging the curve further out while the formula above grows a term at a time.",
      css: CSS,
      reducedMotion: { at: D - 1 },
    },
    <>
      {win.node}
      <g animation={outro(D)}>
        <g animation={enter({ at: 0.2, over: 0.6 })}>
          {graph.node}
          {ticks.map((t) => t.node)}
        </g>
        {cosine}
        <g clipPath={clip}>
          {stages.map((s, i) => {
            const f = taylor(s.n);
            const next = stages[i + 1];

            const fade = next
              ? motion({ opacity: 1 }).to({ opacity: 0 }, span(next.at, 0.6))
              : undefined;

            return (
              <g animation={fade}>
                {[-1, 1].map((side) => (
                  <path
                    d={half(f, side * 2 * Math.PI)}
                    fill="none"
                    stroke={s.color}
                    strokeWidth={2.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    animation={draw({ at: s.at, over: 1 })}
                  />
                ))}
              </g>
            );
          })}
        </g>
        <g transform={`translate(${origin.x} ${origin.y})`}>
          <circle
            r={4}
            fill={theme.base07}
            animation={enter({ at: 2.2, over: 0.4 }, { opacity: 0, scale: 0 })}
          />
        </g>
        <g animation={motion({ opacity: 1 }).set({ opacity: 0 }, handoff)}>
          {versions[0]!.write(WRITE)}
        </g>
        <g class="sans" animation={enter({ at: 2.6, over: 0.6 })}>
          <text x={W / 2} y={H - 18} fontSize={12} textAnchor="middle" fill={theme.base03}>
            {"tex(cos).write({ at: 1.2, over: 1 })"}
          </text>
        </g>
        <g animation={motion({ opacity: 0 }).set({ opacity: 1 }, handoff)}>{m.node}</g>
      </g>
    </>,
  );
}

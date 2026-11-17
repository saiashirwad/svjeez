import { chain, ease, motion, render, sampled, show, span, type Color } from "svjeez";
import { flowchart } from "@svjeez/diagrams";
import { CSS, chrome, outro } from "./lib/kit";
import { mono, theme } from "../style";
import { GROUND, blip } from "./lib/blip";

const BAR = 40;

type Point = { readonly x: number; readonly y: number };

type Leg =
  | { readonly kind: "hop"; readonly to: Point; readonly over: number }
  | { readonly kind: "walk"; readonly along: readonly Point[]; readonly over: number }
  | { readonly kind: "rest"; readonly over: number };

/** Where Blip is `t` seconds into its legs, starting from `from`. */
const placeOf =
  (from: Point, legs: readonly Leg[]) =>
  (t: number): Point => {
    let at = from;
    let clock = t;

    for (const leg of legs) {
      if (clock > leg.over) {
        clock -= leg.over;
        at = leg.kind === "hop" ? leg.to : leg.kind === "walk" ? leg.along.at(-1)! : at;
        continue;
      }

      const u = clock / leg.over;

      if (leg.kind === "rest") return at;

      if (leg.kind === "hop") {
        const e = u < 0.5 ? 2 * u * u : 1 - (2 - 2 * u) ** 2 / 2;
        const lift = 4 * 34 * u * (1 - u);

        return { x: at.x + (leg.to.x - at.x) * e, y: at.y + (leg.to.y - at.y) * u - lift };
      }

      const runs = leg.along.slice(1).map((p, i) => ({
        a: leg.along[i]!,
        b: p,
        l: Math.hypot(p.x - leg.along[i]!.x, p.y - leg.along[i]!.y),
      }));

      let left = u * runs.reduce((s, r) => s + r.l, 0);

      for (const r of runs) {
        if (left <= r.l) {
          const k = r.l ? left / r.l : 0;

          return {
            x: r.a.x + (r.b.x - r.a.x) * k,
            y: r.a.y + (r.b.y - r.a.y) * k - Math.abs(Math.sin(u * Math.PI * 8)) * 4,
          };
        }

        left -= r.l;
      }

      return leg.along.at(-1)!;
    }

    return at;
  };

export const make = (tall = false): string => {
  const W = tall ? 358 : 1032;
  const H = tall ? 560 : 300;
  const win = chrome(W, H, "pipeline.tsx");

  const chart = flowchart(
    {
      nodes: {
        prompt: { label: "Prompt", role: "input" },
        agent: { label: "Write scene", role: "task" },
        frames: { label: "Render frames", role: "tool" },
        ok: { label: "Frames ok?", role: "decision" },
        ship: { label: "One SVG", role: "output" },
      },
      edges: [
        ["prompt", "agent"],
        ["agent", "frames"],
        ["frames", "ok"],
        ["ok", "ship", "yes"],
        ["ok", "agent", "no"],
      ],
    },
    {
      theme,
      x: W / 2,
      y: BAR + (H - BAR) / 2,
      anchor: "center",
      direction: tall ? "TB" : "LR",
      fontSize: 13,
      class: "sans",
    },
  );

  const top = (id: "prompt" | "agent" | "frames" | "ok" | "ship"): Point => chart.part(id).box.top;
  const no = chart.edge("ok", "agent");
  const yes = chart.edge("ok", "ship");
  const HOP = 0.55;
  const REST = 0.25;
  const PUZZLE = 1.3;
  const NOD = 0.9;

  const legs: Leg[] = [
    { kind: "hop", to: top("agent"), over: HOP },
    { kind: "rest", over: REST },
    { kind: "hop", to: top("frames"), over: HOP },
    { kind: "rest", over: REST },
    { kind: "hop", to: top("ok"), over: HOP },
    { kind: "rest", over: PUZZLE },
    { kind: "hop", to: no[1]!, over: HOP },
    { kind: "walk", along: no.slice(1, -1), over: 1.6 },
    { kind: "hop", to: top("agent"), over: HOP },
    { kind: "rest", over: REST },
    { kind: "hop", to: top("frames"), over: HOP },
    { kind: "rest", over: REST },
    { kind: "hop", to: top("ok"), over: HOP },
    { kind: "rest", over: NOD },
    { kind: "hop", to: yes[0]!, over: HOP },
    { kind: "walk", along: yes.slice(0, -1), over: 1.1 },
    { kind: "hop", to: top("ship"), over: HOP },
  ];

  const START = 0.8;
  const length = legs.reduce((s, l) => s + l.over, 0);
  const until = (n: number) => START + legs.slice(0, n).reduce((s, l) => s + l.over, 0);
  const where = placeOf(top("prompt"), legs);

  const path = sampled({ at: START, over: length }, (t) => where(t), {
    tolerance: { translate: 0.6 },
  });

  const D = Math.ceil(START + length) + 3;

  const bubble = (text: string, at: number, over: number, color: Color) => {
    const w = text.length * 8 + 22;
    const { x, y } = top("ok");

    return (
      <g transform={`translate(${x + 16} ${y - 52})`}>
        <g
          animation={[
            show({ at, over }, { fade: 0.15 }),
            motion({ scale: 0.4 }).to({ scale: 1 }, span(at, 0.35), ease.pop),
          ]}
        >
          <rect x={0} y={0} width={w} height={26} rx={13} fill={color} />
          <path d="M8 22L4 32L16 25Z" fill={color} />
          <text
            x={w / 2}
            y={18}
            textAnchor="middle"
            fontFamily={mono}
            fontSize={13}
            fontWeight={600}
            fill={theme.base00}
          >
            {text}
          </text>
        </g>
      </g>
    );
  };

  const puzzled = until(5);
  const sure = until(13);

  const tilt = chain(span(puzzled + 0.1, 0.2), 0.3, 0.3, 0.25).reduce(
    (m, swing, i) => m.to({ rotate: [-12, 10, -6, 0][i]! }, swing, i ? ease.inOut : ease.out),
    motion({ rotate: 0 }),
  );

  const [hop, land, again, down] = chain(span(sure + 0.1, 0.15), 0.15, 0.12, 0.12);

  const bounce = motion({ y: 0 })
    .to({ y: -10 }, hop, ease.out)
    .to({ y: 0 }, land, ease.in)
    .to({ y: -6 }, again, ease.out)
    .to({ y: 0 }, down, ease.in);

  return render(
    {
      width: W,
      height: H,
      duration: D,
      title: "A diagram that builds itself",
      desc: "A flowchart from prompt to finished SVG appears node by node. Blip hops along it, is puzzled at Frames ok? the first time and walks the no line back to try again, then says yes and walks on to the finished SVG.",
      css: CSS,
      reducedMotion: { at: D - 1 },
    },
    <>
      {win.node}
      <g animation={outro(D)}>
        {chart.layers.under}
        {chart.layers.over}
        {bubble("???", puzzled + 0.1, PUZZLE - 0.1, theme.base0E)}
        {bubble("yes!", sure + 0.1, NOD + 0.3, theme.base0B)}
        <g animation={[show({ at: START - 0.3, over: length + 1.3 }, { fade: 0.2 }), path]}>
          <g animation={[tilt, bounce]}>
            <g transform={`scale(0.22) translate(${-GROUND.x} ${-GROUND.y})`}>
              {blip({ blinks: [5.2, puzzled + 0.6], feet: {} })}
            </g>
          </g>
        </g>
      </g>
    </>,
  );
};

export default () => make();

import { Glyphs, def, draw, ease, enter, motion, sampled } from "svjeez";
import { cut, flow, flowchart } from "svjeez/extras";
import { mono, theme } from "../style";
import { C, Caption, H, W, centered, display, rise } from "./kit";
import { CODE } from "./editor";

// The spring and the flowchart hold a beat longer than the other two.
const CARDS = [2.7, 2.7, 2.1, 2.1];

export const MONTAGE = {
  at: CODE.at + CODE.over,
  over: CARDS.reduce((sum, over) => sum + over, 0),
};

const card = (i: number) => ({
  at: MONTAGE.at + CARDS.slice(0, i).reduce((sum, over) => sum + over, 0),
  over: CARDS[i]!,
});

// a. sampled(): a damped spring, simulated. The weight and the plot's playhead share one function of time.
const SPRING = {
  at: card(0).at + 0.25,
  over: 1.75,
  amp: 120,
  x: 300,
  y: 300,
  plot: { x: 470, w: 680 },
};

const spring = (t: number) => {
  const s = Math.min(Math.max(t - SPRING.at, 0), SPRING.over);

  return SPRING.amp * Math.exp(-2.6 * s) * Math.cos(2 * Math.PI * 2.1 * s);
};

const plotX = (t: number) =>
  SPRING.plot.x + (Math.min(Math.max(t - SPRING.at, 0), SPRING.over) / SPRING.over) * SPRING.plot.w;

const curve = Array.from({ length: 141 }, (_, i) => SPRING.at + (i / 140) * SPRING.over)
  .map((t, i) => `${i ? "L" : "M"}${plotX(t).toFixed(1)} ${(SPRING.y + spring(t)).toFixed(1)}`)
  .join("");

const weight = sampled((t) => ({ y: spring(t) }), {
  duration: SPRING.at + SPRING.over + 0.1,
  step: 1 / 60,
  tolerance: { translate: 0.4 },
});

const playhead = sampled((t) => ({ x: plotX(t), y: SPRING.y + spring(t) }), {
  duration: SPRING.at + SPRING.over + 0.1,
  step: 1 / 60,
  tolerance: { translate: 0.4 },
});

// The plot reveals left to right with time, so its tip stays under the playhead.
const traced = def.clipPath(
  {},
  <rect
    x={SPRING.plot.x - 4}
    y={0}
    width={4}
    height={H}
    animation={motion({ width: 4 })
      .at(SPRING.at)
      .to({ width: SPRING.plot.w + 8 }, SPRING.over, ease.linear)}
  />,
);

const anchored = def.clipPath({}, <rect x={SPRING.x - 60} y={110} width={120} height={500} />);

// b. flowchart(): the loop this whole video is about.
const chart = flowchart(
  {
    nodes: {
      you: { label: "your prompt", role: "input" },
      agent: { label: "Claude", role: "tool" },
      scene: "scene.tsx",
      frames: "look at frames",
      svg: { label: "launch.svg", role: "output" },
    },
    edges: [
      ["you", "agent"],
      ["agent", "scene"],
      ["scene", "frames"],
      ["frames", "scene", { label: "fix" }],
      ["frames", "svg", { label: "ship" }],
    ],
  },
  {
    theme,
    font: mono,
    fontSize: 18,
    x: W / 2,
    y: H / 2 - 40,
    anchor: "center",
    direction: "LR",
    play: { at: card(1).at + 0.1, step: 0.14 },
  },
);

const comet = flow(chart.route("you", "svg"), {
  at: card(1).at + 0.75,
  over: 0.95,
  style: "comet",
  arrive: true,
  color: C.accent,
  size: 5,
});

// c. <Glyphs>: a word as outlines, inked on, then filled.
const BIG = "SVG";
const bigX = centered(BIG, 280);

// d. Data: weekly stars, bars growing from the baseline, then the trend drawn through their tops.
const STARS = [42, 61, 55, 88, 120, 164, 230, 312];
const BARS = { x: 250, base: 470, w: 56, gap: 44, scale: 1.05 };
const barX = (i: number) => BARS.x + i * (BARS.w + BARS.gap);

const trend = STARS.map(
  (v, i) => `${i ? "L" : "M"}${barX(i) + BARS.w / 2} ${BARS.base - v * BARS.scale}`,
).join("");

const bars = (
  <>
    <path
      d={`M${BARS.x - 30} ${BARS.base}H${barX(STARS.length - 1) + BARS.w + 30}`}
      stroke={C.hairline}
    />
    {STARS.map((v, i) => (
      <g transform={`translate(0 ${BARS.base}) scale(1 -1)`}>
        <rect
          x={barX(i)}
          y={0}
          width={BARS.w}
          height={0}
          rx={3}
          fill={i === STARS.length - 1 ? C.accent : C.hairline}
          animation={motion({ height: 0 })
            .at(card(3).at + 0.15 + i * 0.07)
            .to({ height: v * BARS.scale }, 0.55, ease.out)}
        />
      </g>
    ))}
    <path
      d={trend}
      fill="none"
      stroke={C.ink}
      strokeWidth={2}
      strokeLinejoin="round"
      animation={draw({ at: card(3).at + 0.95, over: 0.7 }, ease.inOut)}
    />
    {STARS.map((v, i) => (
      <circle
        cx={barX(i) + BARS.w / 2}
        cy={BARS.base - v * BARS.scale}
        r={4}
        fill={C.page}
        stroke={C.ink}
        strokeWidth={2}
        animation={enter(
          { at: card(3).at + 0.95 + (i / (STARS.length - 1)) * 0.7, over: 0.2 },
          { scale: 0 },
        )}
      />
    ))}
    <g animation={rise(card(3).at + 1.6, 0.35, 6)}>
      <text
        x={barX(STARS.length - 1) + BARS.w / 2}
        y={BARS.base - 312 * BARS.scale - 22}
        fontSize={18}
        textAnchor="middle"
        fill={C.accent}
      >
        312 ★
      </text>
    </g>
  </>
);

export const montage = (
  <g animation={cut(MONTAGE)}>
    <g animation={cut(card(0))}>
      <path d={`M${SPRING.x - 40} 110H${SPRING.x + 40}`} stroke={C.muted} strokeWidth={2} />
      <g clipPath={anchored}>
        <g animation={weight}>
          <path d={`M${SPRING.x} ${SPRING.y - 400}V${SPRING.y}`} stroke={C.muted} strokeWidth={2} />
          <rect x={SPRING.x - 26} y={SPRING.y - 26} width={52} height={52} rx={8} fill={C.ink} />
        </g>
      </g>
      <path
        d={`M${SPRING.plot.x} ${SPRING.y}H${SPRING.plot.x + SPRING.plot.w}`}
        stroke={C.hairline}
        strokeDasharray="3 5"
      />
      <g clipPath={traced}>
        <path d={curve} fill="none" stroke={C.accent} strokeWidth={2.5} strokeLinecap="round" />
      </g>
      <circle r={6} fill={C.accent} animation={playhead} />
      <Caption
        at={card(0).at + 0.1}
        tag="01 / 04"
        call="sampled(t => spring(t))"
        line="real physics, baked into keyframes"
      />
    </g>
    <g animation={cut(card(1))}>
      {chart.layers.under}
      {comet.node}
      {chart.layers.over}
      <Caption
        at={card(1).at + 0.1}
        tag="02 / 04"
        call="flowchart({ … })"
        line="typed diagrams that build themselves"
      />
    </g>
    <g animation={cut(card(2))}>
      <Glyphs
        font={display}
        text={BIG}
        size={280}
        x={bigX}
        y={420}
        fill="none"
        stroke={C.ink}
        strokeWidth={2}
        animation={(_, i) => draw({ at: card(2).at + i * 0.12, over: 0.7 }, ease.inOut)}
      />
      <Glyphs
        font={display}
        text={BIG}
        size={280}
        x={bigX}
        y={420}
        fill={C.ink}
        alt=""
        animation={(_, i) => enter({ at: card(2).at + 0.7 + i * 0.1, over: 0.4 }, { opacity: 0 })}
      />
      <Caption
        at={card(2).at + 0.1}
        tag="03 / 04"
        call="<Glyphs font={display} />"
        line="real fonts, as outlines you can draw on"
      />
    </g>
    <g animation={cut(card(3))}>
      {bars}
      <Caption
        at={card(3).at + 0.1}
        tag="04 / 04"
        call="motion({ height }).to(…)"
        line="your numbers, animated right in the README"
      />
    </g>
  </g>
);

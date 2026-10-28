import { ease, enter, motion, render } from "svjeez";
import { Marker, code } from "svjeez/extras";
import { CSS, chrome, highlight, outro, theme } from "./kit";

// A motion() chain on the left, the same chain drawn as tracks on the right, and a square that obeys it.
// `tall` stacks the three for a phone: the chain, the square, then the tracks.
const BAR = 40;

const shown = `motion({ opacity: 0, y: 40 })
  .at(0.5)
  .to({ opacity: 1, y: 0 }, 0.6, ease.pop)
  .wait(1.5)
  .to({ scale: 1.5, fill: "#FF9F0A" }, 0.5)
  .to({ scale: 1 }, 0.4, ease.inOut)`;

const chain = (t0: number) =>
  motion({ opacity: 0, y: 40 })
    .at(t0 + 0.5)
    .to({ opacity: 1, y: 0 }, 0.6, ease.pop)
    .wait(1.5)
    .to({ scale: 1.5, fill: "#FF9F0A" }, 0.5)
    .to({ scale: 1 }, 0.4, ease.inOut);

export const make = (tall = false): string => {
const W = tall ? 358 : 1032;
const H = tall ? 504 : 420;
const SPLIT = 452;
const win = chrome(W, H, "motion.ts");
const src = code(highlight(shown), tall ? { theme, fontSize: 12.5, lineHeight: 1.9, x: 22, y: BAR + 18 } : { theme, fontSize: 14, lineHeight: 1.9, x: 28, y: BAR + 28 });
const panel = tall ? { x: 20, y: 214, w: 318, h: 96 } : { x: SPLIT + 24, y: BAR + 22, w: W - SPLIT - 48, h: 132 };
const labelY = tall ? 342 : BAR + 186;
const lineTop = labelY + 6;
const rowY0 = lineTop + 4;
const gap = tall ? 36 : 40;
const T0 = 0.9;
const lit = [
  { during: { at: T0 + 0.5, over: 0.6 }, target: src.lines(2, 3).pad(3) },
  { during: { at: T0 + 1.1, over: 1.5 }, target: src.lines(4, 4).pad(3) },
  { during: { at: T0 + 2.6, over: 0.5 }, target: src.lines(5, 5).pad(3) },
  { during: { at: T0 + 3.1, over: 0.4 }, target: src.lines(6, 6).pad(3) },
];
const D = Math.ceil(T0 + 3.5 + 2.2);

const AXIS = tall ? { x: 76, w: 258, span: 4 } : { x: SPLIT + 96, w: W - SPLIT - 96 - 36, span: 4 };
const px = (t: number) => AXIS.x + (t / AXIS.span) * AXIS.w;
const ROWS = [
  { name: "opacity", color: theme.base0D, bars: [[0.5, 1.1]] },
  { name: "y", color: theme.base0D, bars: [[0.5, 1.1]] },
  { name: "scale", color: theme.base0E, bars: [[2.6, 3.1], [3.1, 3.5]] },
  { name: "fill", color: theme.base09, bars: [[2.6, 3.1]] },
] as const;
const rowY = (i: number) => rowY0 + i * gap;

  return render(
    {
      width: W,
      height: H,
      duration: D,
      title: "Motions on a timeline",
      desc: "A motion chain types out. Beside it the same chain is drawn as one track per channel, a playhead sweeps across them, and a square fades in, drops into place, grows and turns orange exactly as the chain says.",
      css: CSS,
      reducedMotion: { at: D - 1 },
    },
    <>
      {win.node}
      <path d={tall ? `M0 ${BAR + 172}H${W}` : `M${SPLIT} ${BAR}V${H}`} stroke={theme.base02} />
      <g class="mono" animation={outro(D)}>
        <g animation={enter({ at: 0.1, over: 0.5 }, { opacity: 0, y: 6 })}>{src.node}</g>
        <Marker theme={theme} stops={lit} color={theme.base0D} />
      </g>
      <g animation={outro(D)}>
        <rect x={panel.x} y={panel.y} width={panel.w} height={panel.h} rx={10} fill={theme.base01} />
        <rect x={panel.x + panel.w / 2 - 28} y={panel.y + panel.h / 2 - 28} width={56} height={56} rx={14} fill={theme.base0D} animation={chain(T0)} />
        <g class="round" fontSize={11} fill={theme.base03}>
          {[0, 1, 2, 3, 4].map((s) => (
            <g>
              <text x={px(s)} y={labelY} textAnchor="middle">{s}s</text>
              <path d={`M${px(s)} ${lineTop}V${rowY(3) + 24}`} stroke={theme.base02} strokeDasharray="2 4" />
            </g>
          ))}
        </g>
        {ROWS.map((row, i) => (
          <g>
            <text x={tall ? 24 : SPLIT + 28} y={rowY(i) + 14} class="sans" fontSize={12} fill={theme.base04}>{row.name}</text>
            {row.bars.map(([a, b]) => (
              <>
                <rect x={px(a)} y={rowY(i) + 2} width={px(b) - px(a)} height={16} rx={8} fill={theme.base02} />
                <rect x={px(a)} y={rowY(i) + 2} width={0} height={16} rx={8} fill={row.color} animation={motion({ width: 0 }).at(T0 + a).to({ width: px(b) - px(a) }, b - a, ease.linear)} />
              </>
            ))}
          </g>
        ))}
        <g animation={motion({ x: 0 }).at(T0).to({ x: AXIS.w * (3.5 / AXIS.span) }, 3.5, ease.linear)}>
          <path d={`M${AXIS.x} ${lineTop}V${rowY(3) + 24}`} stroke={theme.base06} strokeWidth={1.5} />
          <circle cx={AXIS.x} cy={lineTop} r={4} fill={theme.base06} />
        </g>
      </g>
    </>,
  );
};

export default () => make();

import { ease, motion, render } from "svjeez";
import { code, typewriter } from "svjeez/extras";
import { CSS, chrome, highlight, outro, theme } from "./kit";

// A motion() chain on the left, the same chain drawn as tracks on the right, and a square that obeys it.
const W = 1032;
const H = 420;
const BAR = 40;
const SPLIT = 452;

const shown = `motion({ opacity: 0, y: 40 })
  .at(0.5)
  .to({ opacity: 1, y: 0 }, 0.6, ease.pop)
  .wait(1.5)
  .to({ scale: 1.5, fill: "#FF9F0A" }, 0.5)
  .to({ scale: 1 }, 0.4, ease.inOut)`;

const chain = (t0: number, fill: string) =>
  motion({ opacity: 0, y: 40 })
    .at(t0 + 0.5)
    .to({ opacity: 1, y: 0 }, 0.6, ease.pop)
    .wait(1.5)
    .to({ scale: 1.5, fill }, 0.5)
    .to({ scale: 1 }, 0.4, ease.inOut);

const win = chrome(W, H, "motion.ts");
const src = code(highlight(shown), { theme, fontSize: 13, lineHeight: 1.9, x: 28, y: BAR + 28 });
const typed = typewriter(src, { at: 0.5, cps: 55, cursor: theme.base0D, blink: false });
const T0 = typed.end + 0.7;
const D = Math.ceil(T0 + 3.5 + 2.2);

const AXIS = { x: SPLIT + 96, w: W - SPLIT - 96 - 36, span: 4 };
const px = (t: number) => AXIS.x + (t / AXIS.span) * AXIS.w;
const ROWS = [
  { name: "opacity", color: theme.base0D, bars: [[0.5, 1.1]] },
  { name: "y", color: theme.base0D, bars: [[0.5, 1.1]] },
  { name: "scale", color: theme.base0E, bars: [[2.6, 3.1], [3.1, 3.5]] },
  { name: "fill", color: theme.base09, bars: [[2.6, 3.1]] },
] as const;
const rowY = (i: number) => BAR + 196 + i * 40;

export default function build(): string {
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
      <path d={`M${SPLIT} ${BAR}V${H}`} stroke={theme.base02} />
      <g class="mono" animation={outro(D)}>{typed.node}</g>
      <g animation={outro(D)}>
        <rect x={SPLIT + 24} y={BAR + 22} width={W - SPLIT - 48} height={132} rx={10} fill={theme.base01} />
        <rect x={(SPLIT + W) / 2 - 28} y={BAR + 60} width={56} height={56} rx={14} fill={theme.base0D} animation={chain(T0, theme.base09)} />
        <g class="round" fontSize={11} fill={theme.base03}>
          {[0, 1, 2, 3, 4].map((s) => (
            <g>
              <text x={px(s)} y={BAR + 186} textAnchor="middle">{s}s</text>
              <path d={`M${px(s)} ${BAR + 192}V${rowY(3) + 24}`} stroke={theme.base02} strokeDasharray="2 4" />
            </g>
          ))}
        </g>
        {ROWS.map((row, i) => (
          <g>
            <text x={SPLIT + 28} y={rowY(i) + 14} class="sans" fontSize={12} fill={theme.base04}>{row.name}</text>
            {row.bars.map(([a, b]) => (
              <>
                <rect x={px(a)} y={rowY(i) + 2} width={px(b) - px(a)} height={16} rx={8} fill={theme.base02} />
                <rect x={px(a)} y={rowY(i) + 2} width={0} height={16} rx={8} fill={row.color} animation={motion({ width: 0 }).at(T0 + a).to({ width: px(b) - px(a) }, b - a, ease.linear)} />
              </>
            ))}
          </g>
        ))}
        <g animation={motion({ x: 0 }).at(T0).to({ x: AXIS.w * (3.5 / AXIS.span) }, 3.5, ease.linear)}>
          <path d={`M${AXIS.x} ${BAR + 192}V${rowY(3) + 24}`} stroke={theme.base06} strokeWidth={1.5} />
          <circle cx={AXIS.x} cy={BAR + 192} r={4} fill={theme.base06} />
        </g>
      </g>
    </>,
  );
}

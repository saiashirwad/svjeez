import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { draw, ease, enter, render } from "svjeez";
import { Marker, code } from "svjeez/extras";
import { CSS, chrome, highlight, outro, theme } from "./kit";

// Without JSX: the same scene built from el() calls, shown from the real file so it type-checks.
const W = 1032;
const H = 392;
const SPLIT = 604;
const BAR = 40;
const D = 11;
const source = readFileSync(fileURLToPath(new URL("./plain.ts", import.meta.url)), "utf8").trimEnd();
const win = chrome(W, H, "plain.ts");
const src = code(highlight(source), { theme, fontSize: 12, lineHeight: 1.75, x: 28, y: BAR + 22 });
const T0 = 0.9;
const lit = [
  { during: { at: T0 + 0.2, over: 1.4 }, target: src.lines(9, 11).pad(3) },
  { during: { at: T0 + 1.2, over: 1.2 }, target: src.lines(12, 13).pad(3) },
];

export default function build(): string {
  return render(
    {
      width: W,
      height: H,
      duration: D,
      title: "Without JSX",
      desc: "A scene written with el() calls instead of JSX types out. Its prefix option namespaces ids and classes, so the result can be inlined in a page next to other scenes. The preview below plays it.",
      css: CSS,
      reducedMotion: { at: D - 2 },
    },
    <>
      {win.node}
      <path d={`M${SPLIT} ${BAR}V${H}`} stroke={theme.base02} />
      <g animation={outro(D)}>
        <g class="mono">
          <g animation={enter({ at: 0.1, over: 0.5 }, { opacity: 0, y: 6 })}>{src.node}</g>
          <Marker theme={theme} stops={lit} color={theme.base0D} />
        </g>
        <g animation={enter({ at: T0, over: 0.5 }, { opacity: 0, y: 8 })}>
          <rect x={SPLIT + 36} y={BAR + 30} width={W - SPLIT - 72} height={230} rx={12} fill={theme.base01} />
          <g transform={`translate(${SPLIT + 36 + (W - SPLIT - 72 - 120 * 2.6) / 2} ${BAR + 30 + (230 - 80 * 2.6) / 2}) scale(2.6)`}>
            <path d="M20 66Q60 -6 100 66" fill="none" stroke="#34C759" strokeWidth={4} strokeLinecap="round" animation={draw({ at: T0 + 0.2, over: 1 })} />
            <circle cx={60} cy={30} r={6} fill="#0A6CFF" animation={enter({ at: T0 + 1, over: 0.4 }, { scale: 0 }, ease.pop)} />
          </g>
        </g>
        <g class="sans" animation={enter({ at: T0 + 0.8, over: 0.5 }, { opacity: 0, y: 6 })}>
          <text x={(SPLIT + W) / 2} y={BAR + 292} fontSize={13} textAnchor="middle" fill={theme.base04}>
            <tspan fill={theme.base0D} fontWeight={600}>prefix</tspan> namespaces every id and class,
          </text>
          <text x={(SPLIT + W) / 2} y={BAR + 312} fontSize={13} textAnchor="middle" fill={theme.base04}>so scenes inlined in one page never collide.</text>
        </g>
      </g>
    </>,
  );
}

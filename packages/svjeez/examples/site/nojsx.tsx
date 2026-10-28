import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { draw, ease, enter, render } from "svjeez";
import { Marker, code } from "svjeez/extras";
import { CSS, chrome, highlight, outro, theme } from "./kit";

// Without JSX: the same scene built from el() calls, shown from the real file so it type-checks.
const BAR = 40;
const D = 11;
const read = (name: string) => readFileSync(fileURLToPath(new URL(name, import.meta.url)), "utf8").trimEnd();
const T0 = 0.9;

/** `tall` stacks the code above the preview for a phone, and shows the part of the file that builds the scene, set in a narrower measure. */
export const make = (tall = false): string => {
  const W = tall ? 358 : 1032;
  const H = tall ? 596 : 392;
  const SPLIT = 604;
  const win = chrome(W, H, "plain.ts");
  const full = read(tall ? "./plain-narrow.ts" : "./plain.ts").split("\n");
  const lines = tall ? full.slice(full.findIndex((l) => l.startsWith("    g({}")) ).map((l) => l.slice(4)) : full;
  const src = code(highlight(lines.join("\n")), tall ? { theme, fontSize: 12, lineHeight: 1.7, x: 22, y: BAR + 16 } : { theme, fontSize: 12, lineHeight: 1.75, x: 28, y: BAR + 22 });
  const lit = tall
    ? [
        { during: { at: T0 + 0.2, over: 1.4 }, target: src.lines(2, 8).pad(3) },
        { during: { at: T0 + 1.2, over: 1.2 }, target: src.lines(9, 14).pad(3) },
      ]
    : [
        { during: { at: T0 + 0.2, over: 1.4 }, target: src.lines(9, 11).pad(3) },
        { during: { at: T0 + 1.2, over: 1.2 }, target: src.lines(12, 13).pad(3) },
      ];
  const panel = tall ? { x: 20, y: 376, w: W - 40, h: 130 } : { x: SPLIT + 36, y: BAR + 30, w: W - SPLIT - 72, h: 230 };
  const scale = tall ? 1.8 : 2.6;
  const note = tall ? { x: W / 2, y: 540 } : { x: (SPLIT + W) / 2, y: BAR + 292 };
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
      <path d={tall ? `M0 ${panel.y - 10}H${W}` : `M${SPLIT} ${BAR}V${H}`} stroke={theme.base02} />
      <g animation={outro(D)}>
        <g class="mono">
          <g animation={enter({ at: 0.1, over: 0.5 }, { opacity: 0, y: 6 })}>{src.node}</g>
          <Marker theme={theme} stops={lit} color={theme.base0D} />
        </g>
        <g animation={enter({ at: T0, over: 0.5 }, { opacity: 0, y: 8 })}>
          <rect x={panel.x} y={panel.y} width={panel.w} height={panel.h} rx={12} fill={theme.base01} />
          <g transform={`translate(${panel.x + (panel.w - 120 * scale) / 2} ${panel.y + (panel.h - 80 * scale) / 2}) scale(${scale})`}>
            <path d="M20 66Q60 -6 100 66" fill="none" stroke="#34C759" strokeWidth={4} strokeLinecap="round" animation={draw({ at: T0 + 0.2, over: 1 })} />
            <circle cx={60} cy={30} r={6} fill="#0A6CFF" animation={enter({ at: T0 + 1, over: 0.4 }, { scale: 0 }, ease.pop)} />
          </g>
        </g>
        <g class="sans" animation={enter({ at: T0 + 0.8, over: 0.5 }, { opacity: 0, y: 6 })}>
          <text x={note.x} y={note.y} fontSize={13} textAnchor="middle" fill={theme.base04}>
            <tspan fill={theme.base0D} fontWeight={600}>prefix</tspan> namespaces every id and class,
          </text>
          <text x={note.x} y={note.y + 20} fontSize={13} textAnchor="middle" fill={theme.base04}>so scenes inlined in one page never collide.</text>
        </g>
      </g>
    </>,
  );
};

export default () => make();

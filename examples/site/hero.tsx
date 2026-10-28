import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { draw, ease, enter, motion, rect, render } from "svjeez";
import { Marker, appWindow, code, terminal } from "svjeez/extras";
import hello from "./hello";
import { CSS, highlight, termTheme, theme } from "./kit";

// The product window: the editor types hello.tsx, the terminal builds it, and the preview plays the file it wrote.
// The code on screen is the file itself, so it cannot drift from what the build compiles.
const W = 1032;
const H = 560;
const BAR = 44;
const SIDE = 150;
const SPLIT = 612;
const CARD = W - SPLIT - 48;
const source = readFileSync(fileURLToPath(new URL("./hello.tsx", import.meta.url)), "utf8").trimEnd();
const built = hello();
const bytes = Buffer.byteLength(built);
const keyframes = built.match(/@keyframes /g)?.length ?? 0;

const win = appWindow(rect(0.5, 0.5, W - 1, H - 1), { theme, title: "hello.tsx", dots: "traffic", bar: BAR, radius: 12, class: "sans" });
const src = code(highlight(source), { theme, fontSize: 12, lineHeight: 1.85, gutter: true, x: SIDE + 48, y: BAR + 22 });

const TERM_AT = 0.7;
const term = terminal(
  [{ cmd: "npx svjeez svg hello.tsx --out hello.svg" }, { cmd: "wc -c hello.svg", output: [[["number", String(bytes)], " hello.svg"]] }, { cmd: "open hello.svg" }],
  { theme: termTheme, at: TERM_AT, x: SPLIT + 40, y: BAR + 42 + CARD * 0.625 + 36, fontSize: 12.5, lineHeight: 1.75, cps: 90, gap: 0.3 },
);
const PLAY = term.end + 0.4;
const D = Math.ceil(PLAY + 4 + 2.5);
const BUILT = TERM_AT + 1.2;
const editing = [
  { during: { at: PLAY + 0.2, over: 1.9 }, target: src.lines(8, 10).pad(3) },
  { during: { at: PLAY + 1.5, over: 1.3 }, target: src.lines(11, 13).pad(3) },
];

const stats = [
  ["File size", String(bytes), "B"],
  ["Keyframes", String(keyframes), ""],
  ["JavaScript", "0", "B"],
] as const;
const files = [
  { name: "hello.tsx", color: theme.base0D, on: true },
  { name: "kit.ts", color: theme.base0E },
  { name: "hello.svg", color: theme.base09, after: BUILT },
  { name: "README.md", color: theme.base03 },
];

const play = (at: number) => ({ arc: draw({ at: at + 0.3, over: 1.5 }), dot: enter({ at: at + 1.6, over: 0.5 }, { scale: 0 }, ease.pop) });
const scene = play(PLAY);

export default function build(): string {
  return render(
    {
      width: W,
      height: H,
      duration: D,
      title: "svjeez in one window",
      desc: "An editor types a short TSX scene. A terminal runs npx svjeez svg on it and prints the size of the file it wrote. Then the preview plays that file: an arc draws and a dot pops onto it.",
      css: CSS,
      reducedMotion: { at: D - 1 },
    },
    <>
      {win.node}
      <path d={`M0.5 ${BAR}H${SIDE}V${H - 12.5}a12 12 0 0 1 -12 12H12.5a12 12 0 0 1 -12 -12Z`} fill={theme.base01} />
      <path d={`M${SIDE} ${BAR}V${H}`} stroke={theme.base02} />
      <path d={`M${SPLIT} ${BAR}V${H}`} stroke={theme.base02} />
      <g class="sans" fontSize={12}>
        <text x={20} y={BAR + 26} fontSize={11} fontWeight={600} fill={theme.base03} letterSpacing={0.6}>FILES</text>
        {files.map((file, i) => {
          const y = BAR + 40 + i * 30;
          return (
            <g animation={file.after ? motion({ opacity: 0 }).at(file.after).to({ opacity: 1 }, 0.4) : undefined}>
              {file.on && <rect x={10} y={y} width={SIDE - 20} height={26} rx={7} fill={theme.base0D} />}
              <rect x={22} y={y + 7} width={12} height={12} rx={3.5} fill={file.on ? "#fff" : file.color} />
              <text x={44} y={y + 17} fontSize={13} fill={file.on ? "#fff" : theme.base05}>{file.name}</text>
            </g>
          );
        })}
      </g>
      <g class="mono">
        <g animation={motion({ opacity: 1 }).at(D - 0.5).to({ opacity: 0 }, 0.5)}>
          <g animation={enter({ at: 0.15, over: 0.5 }, { opacity: 0, y: 6 })}>{src.node}</g>
          <Marker theme={theme} stops={editing} color={theme.base0D} />
        </g>
      </g>
      <g class="sans">
        <text x={SPLIT + 24} y={BAR + 28} fontSize={11} fontWeight={600} fill={theme.base03} letterSpacing={0.6}>PREVIEW</text>
        <rect x={SPLIT + 24} y={BAR + 42} width={CARD} height={CARD * 0.625} rx={10} fill={theme.base01} />
      </g>
      <g animation={[enter({ at: PLAY, over: 0.3 }), motion({ opacity: 1 }).at(D - 0.5).to({ opacity: 0 }, 0.5)]}>
        <g transform={`translate(${SPLIT + 24} ${BAR + 42}) scale(${CARD / 320})`}>
          <path d="M40 150C100 30 220 30 280 150" fill="none" stroke="#34C759" strokeWidth={6} strokeLinecap="round" animation={scene.arc} />
          <circle cx={160} cy={62} r={9} fill="#0A6CFF" animation={scene.dot} />
        </g>
      </g>
      <rect x={SPLIT + 24} y={BAR + 42 + CARD * 0.625 + 20} width={CARD} height={150} rx={10} fill={termTheme.base00} />
      <g class="mono">
        <g animation={motion({ opacity: 1 }).at(D - 0.5).to({ opacity: 0 }, 0.5)}>{term.node}</g>
      </g>
      <g class="round" animation={[enter({ at: PLAY, over: 0.5 }, { opacity: 0, y: 8 }), motion({ opacity: 1 }).at(D - 0.5).to({ opacity: 0 }, 0.5)]}>
        {stats.map(([label, value, unit], i) => (
          <g>
            <text x={SPLIT + 24 + (i * CARD) / 3} y={H - 60} fontSize={11} fill={theme.base04}>{label}</text>
            <text x={SPLIT + 24 + (i * CARD) / 3} y={H - 30} fontSize={26} fontWeight={700} fill={theme.base06}>{value}<tspan fontSize={13} fontWeight={600} fill={theme.base03} dx={3}>{unit}</tspan></text>
          </g>
        ))}
      </g>
    </>,
  );
}

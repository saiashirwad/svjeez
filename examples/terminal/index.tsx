import { ease, motion, render, type Color } from "svg-motion";
import { code, during, timeline, typewriter } from "svjeez/explain";

const W = 960;
const H = 440;

const C = {
  bg: "#0a0b0e",
  window: "#111318",
  edge: "#ffffff12",
  text: "#d7dae0",
  dim: "#626a7c",
  ok: "#99ffe4",
  accent: "#ffc799",
} as const satisfies Record<string, Color>;

const frame = { x: 80, y: 50, w: 800, h: 340 };
const metrics = { fontSize: 16, lineHeight: 1.75 };
const row = metrics.fontSize * metrics.lineHeight;
const left = frame.x + 32;
const top = frame.y + 44 + 24;

interface Command {
  readonly cmd: string;
  readonly output: readonly { readonly text: string; readonly color: Color }[];
}

const session: readonly Command[] = [
  { cmd: "bun add svjeez", output: [{ text: "installed svjeez@0.2.0", color: C.dim }] },
  {
    cmd: "bun run build",
    output: [
      { text: "✓ dist/explainer.svg  29.4 KB", color: C.ok },
      { text: "✓ dist/terminal.svg   11.2 KB", color: C.ok },
    ],
  },
  { cmd: "open dist/explainer.svg", output: [] },
];

const tl = timeline({ play: 9.5, rest: 1.5 });

export default function build(): string {
  let line = 0;
  let clock = 0.6;
  const blocks = session.map(({ cmd, output }, n) => {
    const y = top + line * row;
    const prompt = code([[{ content: "❯", color: C.accent }]], { x: left, y, ...metrics });
    const last = n === session.length - 1;
    const typed = typewriter(code([[{ content: cmd, color: C.text }]], { x: left + 2 * prompt.bounds.w, y, ...metrics }), { at: clock, cps: 18, cursor: last && C.accent });
    const shownAt = typed.end + 0.35;
    const lines = output.map(({ text, color }, i) => {
      const out = code([[{ content: text, color }]], { x: left, y: y + (i + 1) * row, ...metrics });
      return <g animation={motion({ opacity: 0 }).at(shownAt + i * 0.12).to({ opacity: 1 }, 0.2)}>{out.node}</g>;
    });
    const block = (
      <g>
        <g animation={motion({ opacity: 0 }).at(clock - 0.25).to({ opacity: 1 }, 0.15)}>{prompt.node}</g>
        <g animation={last ? motion({ opacity: 0 }).at(clock - 0.25).set({ opacity: 1 }) : undefined}>{typed.node}</g>
        {lines}
      </g>
    );
    line += 1 + output.length;
    clock = shownAt + output.length * 0.12 + 0.7;
    return block;
  });

  return render(
    {
      width: W,
      height: H,
      title: "Terminal",
      desc: "Installing svjeez and building the examples, typed out in a terminal.",
      duration: tl.duration,
      reducedMotion: { at: tl.play.over },
      css: ".code text,.mono{font-family:'JetBrains Mono','SF Mono',ui-monospace,Menlo,Consolas,monospace;font-variant-ligatures:none}",
    },
    <>
      <rect width={W} height={H} fill={C.bg} />
      <rect x={frame.x} y={frame.y} width={frame.w} height={frame.h} rx={14} fill={C.window} stroke={C.edge} />
      <path d={`M${frame.x} ${frame.y + 44}h${frame.w}`} stroke={C.edge} />
      {[0, 1, 2].map((i) => (
        <circle cx={frame.x + 22 + i * 18} cy={frame.y + 22} r={5.5} fill="#ffffff1c" />
      ))}
      <text x={frame.x + frame.w / 2} y={frame.y + 26.5} class="mono" fontSize={12} textAnchor="middle" fill={C.dim}>
        ~/hello
      </text>
      <g class="code" animation={during(tl.play, 0.4)}>
        {blocks}
      </g>
    </>,
  );
}

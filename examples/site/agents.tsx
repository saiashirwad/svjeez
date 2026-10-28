import { def, ease, enter, motion, rect, render } from "svjeez";
import { appWindow, code, reveal, terminal } from "svjeez/extras";
import { CSS, termTheme, theme } from "./kit";

// A desktop: a soft wallpaper, a menu bar, a terminal installing the skill, and an agent writing a scene with it.
const W = 1032;
const H = 560;
const MENU = 30;
const wallpaper = def.linearGradient({ x1: 0, y1: 0, x2: 1, y2: 1 }, (
  <>
    <stop offset={0} stopColor="var(--wall-a)" />
    <stop offset={1} stopColor="var(--wall-b)" />
  </>
));
const WALL_CSS = "svg{--wall-a:#1B2748;--wall-b:#173A36;--bar:#0D0F14}\n@media (prefers-color-scheme:light){svg{--wall-a:#D9E7FB;--wall-b:#DDF3E6;--bar:#FFFFFF}}";

const shadowed = (x: number, y: number, w: number, h: number) =>
  [18, 10, 4].map((grow, i) => <rect x={x - grow} y={y - grow + 8} width={w + 2 * grow} height={h + 2 * grow} rx={14 + grow} fill="#000" opacity={0.012 + i * 0.01} />);

const shell = appWindow(rect(44, 64, 440, 290), { theme: termTheme, title: "~/project, zsh", dots: "traffic", class: "sans" });
const session = terminal(
  [
    { cmd: "npx svjeez skill --install", output: [[["muted", "installed the svjeez skill in"]], [["muted", ".claude/skills/svjeez"]]] },
    { cmd: "ls .claude/skills/svjeez", output: [["SKILL.md  examples"]] },
  ],
  { theme: termTheme, at: 0.6, x: shell.body.x + 22, y: shell.body.y + 18, fontSize: 12.5, lineHeight: 1.75, cps: 90, gap: 0.3 },
);

const agentWin = appWindow(rect(516, 112, 472, 396), { theme, title: "agent", dots: "traffic", class: "sans" });
const you = (text: string) => [["fn", "you"], "   ", text] as const;
const step = (verb: string, what: string) => [["muted", "▸"], " ", ["keyword", verb.padEnd(6)], what] as const;
const transcript = code(
  [
    you("make a loading spinner svg, 2s loop"),
    [],
    step("read", ".claude/skills/svjeez/SKILL.md"),
    step("write", "spinner.tsx"),
    step("run", "svjeez frames spinner.tsx --sheet"),
    step("look", "frames/sheet.png"),
    [],
    [["green", "✓"], " The arc closes at 2s and the loop is seamless."],
  ],
  { theme, x: agentWin.body.x + 24, y: agentWin.body.y + 22, fontSize: 12.5, lineHeight: 1.85 },
);
const SHOW = session.end + 0.6;
const shown = reveal(transcript, { at: SHOW, blocks: "line", step: 0.6, over: 0.3 });
const D = Math.ceil((shown.end + 4) / 2) * 2;
const spin = { x: agentWin.body.x + 24, y: agentWin.body.y + 250 };

export default function build(): string {
  return render(
    {
      width: W,
      height: H,
      duration: D,
      title: "Agents write scenes too",
      desc: "On a desktop, a terminal installs the svjeez skill. Beside it an agent reads the skill, writes a scene, renders frames, looks at them and reports the result, and a small spinner it made turns.",
      css: `${CSS}\n${WALL_CSS}`,
      reducedMotion: { at: D - 1 },
    },
    <>
      <rect width={W} height={H} rx={12} fill={wallpaper} />
      <path d={`M0 ${MENU}H${W}V12a12 12 0 0 0 -12 -12H12A12 12 0 0 0 0 12Z`} fill="var(--bar)" opacity={0.72} />
      <g class="sans" fontSize={13} fill={theme.base05}>
        <rect x={18} y={8} width={14} height={14} rx={4} fill={theme.base0B} />
        <text x={46} y={20} fontWeight={700}>Terminal</text>
        {["Shell", "Edit", "View", "Window", "Help"].map((name, i) => (
          <text x={116 + i * 58} y={20}>{name}</text>
        ))}
        <text x={W - 20} y={20} textAnchor="end">Wed 9:41</text>
      </g>
      {shadowed(44, 64, 440, 290)}
      {shell.node}
      {shadowed(516, 112, 472, 396)}
      {agentWin.node}
      <g animation={motion({ opacity: 1 }).at(D - 0.5).to({ opacity: 0 }, 0.5)}>
        <g class="mono">{session.node}</g>
        <g class="mono">{shown.node}</g>
        <g animation={enter({ at: shown.spans[4]!.at + 0.3, over: 0.5 }, { opacity: 0, scale: 0.9 }, ease.out)}>
          <rect x={spin.x} y={spin.y} width={120} height={84} rx={10} fill={theme.base01} />
          <g transform={`translate(${spin.x + 60} ${spin.y + 42})`}>
            <circle r={18} fill="none" stroke={theme.base02} strokeWidth={5} />
            <g animation={motion({ rotate: 0 }).at(0).to({ rotate: 360 }, 1, ease.linear).loop(1)}>
              <circle r={18} fill="none" stroke={theme.base0D} strokeWidth={5} strokeLinecap="round" pathLength={1} strokeDasharray="0.28 1" />
            </g>
          </g>
        </g>
      </g>
    </>,
  );
}

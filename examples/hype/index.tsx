import { Glyphs, Stroke, brush, draw, ease, enter, font, motion, rect, render, sampled, type Motion, type SvgNode } from "svjeez";
import { Marker, adaptive, base16, code, cut, flow, flowchart, typewriter, window, type Piece } from "svjeez/extras";

const W = 1280;
const H = 720;

const display = await font.load(new URL("../fonts/ArchivoBlack-Regular.ttf", import.meta.url));
const mono = await font.load(new URL("../fonts/JetBrainsMono.ttf", import.meta.url), { fallback: ["ui-monospace", "Menlo", "monospace"], ligatures: false });

// One accent on quiet neutrals, in both schemes. Slots follow base16: 00 page, 01 surface, 02 hairline, 03–07 text.
const { theme, css } = adaptive({
  dark: base16("#0B0B0C", "#141416", "#26262A", "#5C5C64", "#8E8E97", "#D9D9DE", "#F2F2F4", "#FFFFFF", "#F07178", "#E8875F", "#E6C07B", "#7BC896", "#6CC4C4", "#82AAFF", "#C792EA", "#A16946"),
  light: base16("#FAFAF9", "#FFFFFF", "#E4E4E7", "#A1A1AA", "#71717A", "#3F3F46", "#18181B", "#09090B", "#D14D41", "#C8643B", "#A67C00", "#2F8F5B", "#1F8A8A", "#3B6FD8", "#8E5BC9", "#A16946"),
});
const C = {
  page: theme.base00,
  surface: theme.base01,
  hairline: theme.base02,
  muted: theme.base03,
  soft: theme.base04,
  text: theme.base05,
  ink: theme.base06,
  red: theme.base08,
  accent: theme.base09,
  green: theme.base0B,
} as const;

/** The house move: rise a little out of a soft blur. */
const rise = (at: number, over = 0.45, y = 16) => enter({ at, over }, { opacity: 0, y, blur: 6 }, ease.out);

const centered = (text: string, size: number) => (W - display.measure(text, size)) / 2;

const Kicker = ({ n, label }: { n: string; label: string }) => (
  <text x={64} y={64} fontSize={13} letterSpacing={2.5} fill={C.soft}>
    <tspan fill={C.accent}>{n}</tspan>
    {`  —  ${label}`}
  </text>
);

// ─── Shot 1: cold open. Three words, three beats. ────────────────────────────

const COLD = { at: 0, over: 2.7 };
const WORDS = ["Prompt.", "Animate.", "Ship."] as const;
const BEAT = 0.8;

const coldOpen = (
  <g animation={cut(COLD)}>
    {WORDS.map((word, i) => (
      <g animation={cut({ at: 0, over: 0.3 + (i + 1) * BEAT })}>
        <g animation={enter({ at: 0.3 + i * BEAT, over: 0.4 }, { opacity: 0, y: 40, blur: 12 }, ease.out)}>
          <Glyphs font={display} text={word} size={150} x={centered(word, 150)} y={H / 2 + 52} fill={i === 2 ? C.accent : C.ink} />
        </g>
      </g>
    ))}
  </g>
);

// ─── Shot 2: Claude Code builds the scene. ───────────────────────────────────

const TERM_AT = COLD.at + COLD.over;
const FS = 16;
const ROW = FS * 1.6;
const shell = window(rect(140, 96, 1000, 568), { theme, title: "~/launch — claude", dots: "traffic" });
const left = shell.body.x + 28;
const top = (row: number) => shell.body.y + 18 + row * ROW;
const mid = (row: number) => top(row) + ROW / 2;
const say = (pieces: readonly Piece[], row: number, indent = 0) => code([pieces], { theme, font: mono, fontSize: FS, lineHeight: 1.6, x: left + indent, y: top(row) });

/** Claude's spinner: an eight-spoke asterisk. */
const asterisk = (x: number, y: number, r: number, animation?: Motion<"rotate">) => (
  <g transform={`translate(${x} ${y})`}>
    <path
      d={[0, 1, 2, 3].map((i) => `M${(r * Math.cos((i * Math.PI) / 4)).toFixed(2)} ${(r * Math.sin((i * Math.PI) / 4)).toFixed(2)}L${(-r * Math.cos((i * Math.PI) / 4)).toFixed(2)} ${(-r * Math.sin((i * Math.PI) / 4)).toFixed(2)}`).join("")}
      stroke={C.accent}
      strokeWidth={2.2}
      strokeLinecap="round"
      animation={animation}
    />
  </g>
);

const launch = typewriter(say([["blue", "❯"], " claude"], 0), { at: TERM_AT + 0.35, cps: 20, cursor: true, blink: false });
const welcomeAt = launch.end + 0.2;
const INPUT_ROW = 18.6;
const ask = typewriter(say([["muted", ">"], " make our launch page pop with svjeez"], INPUT_ROW, 4), { at: welcomeAt + 0.45, cps: 34, cursor: true, blink: false });
const SENT = ask.end + 0.25;

type Step = { tool?: string; args?: string; text?: readonly Piece[]; result?: string; row: number; at: number; done: number };
const STEPS: Step[] = [
  { tool: "Read", args: "skills/svjeez/SKILL.md", result: "Read 299 lines", row: 6, at: SENT + 0.35, done: SENT + 0.75 },
  { tool: "Write", args: "launch.tsx", result: "Wrote 13 lines to launch.tsx", row: 8, at: SENT + 0.95, done: SENT + 1.35 },
  { tool: "Bash", args: "svjeez render launch.tsx --times 0,0.6,1.2,1.8 --sheet", result: "Wrote 4 frames and sheet.png", row: 10, at: SENT + 1.55, done: SENT + 2 },
  { tool: "Read", args: "sheet.png", result: "Read image (48 KB)", row: 12, at: SENT + 2.2, done: SENT + 2.55 },
  { text: ["The dot lands late at 1.2s. Tightening its ease."], row: 14.4, at: SENT + 2.85, done: SENT + 2.85 },
];
const DONE_AT = SENT + 3.4;
const TERM = { at: TERM_AT, over: DONE_AT + 1.5 - TERM_AT };

const elbow = (row: number) => <path d={`M${left + 14} ${top(row) + 4}V${mid(row)}h9`} fill="none" stroke={C.muted} strokeWidth={1.3} />;

const step = ({ tool, args, text, result, row, at, done }: Step) => (
  <g animation={rise(at, 0.3, 6)}>
    {tool ? (
      <>
        <circle cx={left + 5} cy={mid(row)} r={4.5} fill={C.muted} animation={motion({ opacity: 1 }).to({ opacity: 0.3 }, 0.2).to({ opacity: 1 }, 0.2).loop(0.4)} />
        <circle cx={left + 5} cy={mid(row)} r={4.5} fill={C.green} animation={motion({ opacity: 0 }).at(done).set({ opacity: 1 })} />
        {say([["plain", tool], ["muted", `(${args})`]], row, 20).node}
        <g animation={motion({ opacity: 0 }).at(done).set({ opacity: 1 })}>
          {elbow(row + 1)}
          {say([["muted", result!]], row + 1, 36).node}
        </g>
      </>
    ) : (
      <>
        <circle cx={left + 5} cy={mid(row)} r={4.5} fill={C.ink} />
        {say(text!, row, 20).node}
      </>
    )}
  </g>
);

const terminalShot = (
  <g animation={cut(TERM)}>
    <Kicker n="01" label="YOU ASK CLAUDE" />
    <g animation={rise(TERM.at, 0.5, 20)}>
      {shell.node}
      {launch.node}
      <g animation={rise(welcomeAt, 0.35, 6)}>
        <rect x={left - 4} y={top(1.3)} width={470} height={ROW * 3.1} rx={8} fill="none" stroke={C.accent} />
        {asterisk(left + 16, mid(1.6) + 4, 7)}
        {say([["plain", "Welcome to Claude Code!"]], 1.6, 34).node}
        {say([["muted", "/help for help · cwd: ~/launch"]], 2.7, 34).node}
      </g>
      <g animation={rise(SENT, 0.3, 6)}>{say([["muted", ">"], ["plain", " make our launch page pop with svjeez"]], 4.4).node}</g>
      {STEPS.map(step)}
      <g animation={rise(DONE_AT, 0.4, 8)}>
        <circle cx={left + 5} cy={mid(15.6)} r={4.5} fill={C.green} />
        {say([["plain", "Done. "], ["green", "dist/launch.svg"], ["muted", " · 18.4 KB · 0 bytes of JavaScript"]], 15.6, 20).node}
      </g>
      <g animation={motion({ opacity: 0 }).at(SENT).set({ opacity: 1 }).at(DONE_AT).set({ opacity: 0 })}>
        {asterisk(left + 6, mid(17.4), 6, motion({ rotate: 0 }).to({ rotate: 90 }, 0.6, ease.linear).loop(0.6))}
        {say([["number", "Animating…"], ["muted", " (esc to interrupt)"]], 17.4, 20).node}
      </g>
      <rect x={left - 8} y={top(INPUT_ROW) - 3} width={shell.body.w - 40} height={ROW + 6} rx={6} fill="none" stroke={C.hairline} />
      <g animation={motion({ opacity: 1 }).at(SENT).set({ opacity: 0 })}>{ask.node}</g>
      <g animation={motion({ opacity: 0 }).at(SENT).set({ opacity: 1 })}>{say([["muted", ">"]], INPUT_ROW, 4).node}</g>
    </g>
  </g>
);

// ─── Shot 3: the code streams in and the preview renders as each line lands. ──

const KEYWORDS = new Set(["import", "from", "export", "default"]);
const TOKEN = /("[^"]*")|(\d+(?:\.\d+)?)|(<\/?)([a-z]+)|([A-Za-z_]\w*)(?=\()|([A-Za-z_]\w*)(?==)|([A-Za-z_]\w*)|([^\sA-Za-z_\d"]+)|(\s+)/g;

/** Just enough TSX highlighting for one screen of code. */
const highlight = (source: string): Piece[] =>
  [...source.matchAll(TOKEN)].flatMap(([all, str, num, open, tag, fn, attr, word, punct]): Piece[] => {
    if (str) return [["string", str]];
    if (num) return [["number", num]];
    if (open && tag) return [["punct", open], ["tag", tag]];
    if (fn) return [["fn", fn]];
    if (attr) return [["type", attr]];
    if (word) return [KEYWORDS.has(word) ? ["keyword", word] : ["plain", word]];
    if (punct) return [["punct", punct]];
    return [all];
  });

const SOURCE = [
  `import { draw, ease, enter, motion, render } from "svjeez";`,
  ``,
  `export default () => render(`,
  `  { width: 420, height: 440, duration: 4, title: "Launch" },`,
  `  <>`,
  `    <path d={wave} animation={draw({ at: 0, over: 1.2 })} />`,
  `    <circle r={18} fill={ink}`,
  `      animation={enter({ at: 1, over: 0.4 }, { scale: 0 }, ease.pop)} />`,
  `    <g animation={motion().to({ rotate: 360 }, 2).loop(2)}>`,
  `      {ring}`,
  `    </g>`,
  `  </>,`,
  `);`,
];

const CODE_AT = TERM.at + TERM.over;
const editor = window(rect(40, 96, 810, 568), { theme, title: "launch.tsx" });
const preview = window(rect(870, 96, 370, 568), { theme, title: "dist/launch.svg" });
const src = code(SOURCE.map(highlight), { theme, font: mono, fontSize: 16.5, lineHeight: 1.95, x: editor.body.x + 24, y: editor.body.y + 40 });
const typed = typewriter(src, { at: CODE_AT + 0.45, cps: 150, cursor: C.accent, blink: false });
const landed = (n: number) => typed.lines[n - 1]!.at + typed.lines[n - 1]!.over;
const CODE = { at: CODE_AT, over: typed.end - CODE_AT + 3 };

const P = preview.body.center;
const WAVE = `M${P.x - 135} ${P.y + 110}c30 -54 56 -54 90 0s60 54 90 0s60 -54 90 0`;
const RING = 60;
const spinAt = landed(9);
const runAt = typed.end + 0.25;

const previewArt = (
  <>
    <path d={WAVE} fill="none" stroke={C.accent} strokeWidth={4} strokeLinecap="round" animation={draw({ at: landed(6), over: 1.1 }, ease.inOut)} />
    <g transform={`translate(${P.x} ${P.y - 50})`}>
      <circle r={16} fill={C.ink} animation={enter({ at: landed(8), over: 0.45 }, { scale: 0 }, ease.pop)} />
      <g animation={[enter({ at: spinAt, over: 0.5 }, { opacity: 0, scale: 0.6 }), motion({ rotate: 0 }).at(spinAt).to({ rotate: 360 * 2 }, CODE.at + CODE.over - spinAt, ease.linear)]}>
        <circle r={RING} fill="none" stroke={C.muted} strokeWidth={1.5} strokeDasharray="2 8" strokeLinecap="round" />
        {[0, 1, 2].map((i) => (
          <circle cx={RING * Math.cos((i * 2 * Math.PI) / 3)} cy={RING * Math.sin((i * 2 * Math.PI) / 3)} r={i === 0 ? 6 : 4} fill={i === 0 ? C.accent : C.soft} />
        ))}
      </g>
    </g>
  </>
);

const lineRect = (first: number, last = first) => src.lines(first, last).pad(4);

const codeShot = (
  <g animation={cut(CODE)}>
    <Kicker n="02" label="CLAUDE WRITES TSX. SVJEEZ COMPILES IT." />
    <g animation={rise(CODE.at, 0.45, 20)}>
      {editor.node}
      <g animation={motion({ opacity: 0 }).at(landed(6) - 0.05).set({ opacity: 1 }).at(runAt).to({ opacity: 0 }, 0.3)}>
        <Marker color={C.accent} over={0.2} stops={[lineRect(6), lineRect(7, 8), lineRect(9, 11)].map((r, i) => ({ at: { at: landed([6, 8, 9][i]!) - 0.05, over: 0.2 }, rect: r }))} />
      </g>
      {typed.node}
    </g>
    <g animation={rise(CODE.at + 0.12, 0.45, 20)}>
      {preview.node}
      {previewArt}
    </g>
    <g animation={rise(runAt, 0.4, 8)}>
      <text x={P.x} y={preview.body.bottom.y - 28} fontSize={12} letterSpacing={1} textAnchor="middle" fill={C.soft}>
        <tspan fill={C.green}>●</tspan>
        {"  CSS keyframes · no runtime · 2.1 KB"}
      </text>
    </g>
  </g>
);

// ─── Shot 4: montage. Four capabilities, one beat each. ──────────────────────

const CARD = 1.9;
const MONTAGE = { at: CODE.at + CODE.over, over: 4 * CARD };
const card = (i: number) => ({ at: MONTAGE.at + i * CARD, over: CARD });

const Caption = ({ i, call, line }: { i: number; call: string; line: string }) => (
  <g animation={rise(card(i).at + 0.1, 0.4, 10)}>
    <text x={64} y={H - 88} fontSize={30} fill={C.ink}>{call}</text>
    <text x={64} y={H - 56} fontSize={14} fill={C.soft}>{line}</text>
    <text x={W - 64} y={H - 56} fontSize={13} textAnchor="end" fill={C.muted}>{`0${i + 1} / 04`}</text>
  </g>
);

// a. sampled(): seven points on Lissajous curves, each a function of time baked into keyframes.
const ORBIT = 2;
const swarm = Array.from({ length: 5 }, (_, k) => {
  const [a, b] = ([[1, 2], [3, 2], [2, 1], [3, 4], [1, 3], [5, 4], [2, 3]] as const)[k]!;
  const phase = (k * Math.PI) / 7;
  const at = (t: number) => ({ x: 340 * Math.sin((a * 2 * Math.PI * t) / ORBIT + phase), y: 160 * Math.sin((b * 2 * Math.PI * t) / ORBIT) });
  const curve = Array.from({ length: 161 }, (_, i) => at((i / 160) * ORBIT)).map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(0)} ${p.y.toFixed(0)}`).join("");
  return (
    <>
      <path d={curve} fill="none" stroke={C.hairline} strokeWidth={1} />
      <circle r={k === 0 ? 7 : 5} fill={k === 0 ? C.accent : C.ink} animation={sampled(at, { duration: ORBIT, tolerance: { translate: 0.6 } }).loop(ORBIT)} />
    </>
  );
});

// b. flowchart(): the loop this whole video is about.
const chart = flowchart(
  {
    direction: "LR",
    nodes: { you: { label: "your prompt", role: "input" }, agent: { label: "Claude", role: "tool" }, scene: "scene.tsx", frames: "look at frames", svg: { label: "launch.svg", role: "output" } },
    edges: [["you", "agent"], ["agent", "scene"], ["scene", "frames"], ["frames", "scene", { label: "fix" }], ["frames", "svg", { label: "ship" }]],
  },
  { theme, font: mono, fontSize: 18, x: W / 2, y: H / 2 - 40, anchor: "center", reveal: { at: card(1).at + 0.1, step: 0.14 } },
);
const comet = flow(chart.route("you", "svg"), { at: card(1).at + 0.75, over: 0.95, style: "comet", arrive: true, color: C.accent, size: 5 });

// c. <Glyphs>: a word as outlines, inked on, then filled.
const BIG = "SVG";
const bigX = centered(BIG, 280);

// d. <Stroke>: three brush strokes.
const SWOOSH = [
  { d: "M170 380C340 200 520 500 720 310S1010 200 1110 330", color: C.ink, size: 16, seed: 3 },
  { d: "M200 460C390 340 560 540 780 420S1000 340 1090 440", color: C.accent, size: 10, seed: 7 },
  { d: "M280 260C430 180 620 300 820 220S990 190 1040 240", color: C.soft, size: 6, seed: 11 },
];

const montage = (
  <g animation={cut(MONTAGE)}>
    <Kicker n="03" label="EVERYTHING MOVES" />
    <g animation={cut(card(0))}>
      <g transform={`translate(${W / 2} ${H / 2 - 50})`}>{swarm}</g>
      <Caption i={0} call="sampled(t => …)" line="any function of time, baked into keyframes" />
    </g>
    <g animation={cut(card(1))}>
      {chart.layers.under}
      {comet.node}
      {chart.layers.over}
      <Caption i={1} call="flowchart({ … })" line="typed diagrams that build themselves" />
    </g>
    <g animation={cut(card(2))}>
      <Glyphs font={display} text={BIG} size={280} x={bigX} y={420} fill="none" stroke={C.ink} strokeWidth={2} animation={(_, i) => draw({ at: card(2).at + i * 0.12, over: 0.7 }, ease.inOut)} />
      <Glyphs font={display} text={BIG} size={280} x={bigX} y={420} fill={C.ink} alt="" animation={(_, i) => enter({ at: card(2).at + 0.7 + i * 0.1, over: 0.4 }, { opacity: 0 })} />
      <Caption i={2} call="<Glyphs font={display} />" line="real fonts, as outlines you can draw on" />
    </g>
    <g animation={cut(card(3))}>
      {SWOOSH.map((s, i) => (
        <Stroke d={s.d} tool={brush({ size: s.size, seed: s.seed })} color={s.color} draw={{ at: card(3).at + 0.05 + i * 0.18, over: 0.9 }} />
      ))}
      <Caption i={3} call="<Stroke tool={brush()} />" line="hand-inked strokes: pen, brush, nib and pencil" />
    </g>
  </g>
);

// ─── Shot 5: the numbers. ────────────────────────────────────────────────────

const FACTS = [
  { lead: "0 bytes", rest: " of runtime JS." },
  { lead: "1 file.", rest: " Self-contained." },
  { lead: "CSS + SMIL.", rest: " That's it." },
] as const;
const FACT = 64;
const FACTS_SPAN = { at: MONTAGE.at + MONTAGE.over, over: 3.4 };

const facts = (
  <g animation={cut(FACTS_SPAN)}>
    <Kicker n="04" label="NOTHING RUNS IN THE BROWSER" />
    {FACTS.map((fact, i) => {
      const x = (W - display.measure(fact.lead + fact.rest, FACT)) / 2;
      const y = 270 + i * 110;
      return (
        <g animation={rise(FACTS_SPAN.at + 0.2 + i * 0.7, 0.45, 24)}>
          <Glyphs font={display} text={fact.lead} size={FACT} x={x} y={y} fill={C.accent} />
          <Glyphs font={display} text={fact.rest} size={FACT} x={x + display.measure(fact.lead, FACT)} y={y} fill={C.ink} />
        </g>
      );
    })}
  </g>
);

// ─── Shot 6: the logo, the install line, and the reveal. ─────────────────────

const END_AT = FACTS_SPAN.at + FACTS_SPAN.over;
const LOGO = "svjeez";
const logoX = centered(LOGO, 190);
const TAG = "Give Claude a motion designer.";
const INSTALL = "npx svjeez skill --install";
const installW = mono.measure(`❯ ${INSTALL}`, 20) + 52;
const installCode = code([[["blue", "❯"], " ", ["plain", INSTALL]]], { theme, font: mono, fontSize: 20, x: (W - installW) / 2 + 26, y: 448 });
const install = typewriter(installCode, { at: END_AT + 1.8, cps: 34, cursor: C.accent });
const D = install.end + 3.2;

const finale = (size: string) => (
  <g animation={motion({ opacity: 0 }).at(END_AT).set({ opacity: 1 })}>
    <Glyphs font={display} text={LOGO} size={190} x={logoX} y={320} fill="none" stroke={C.ink} strokeWidth={2} animation={(_, i) => draw({ at: END_AT + 0.1 + i * 0.1, over: 0.8 }, ease.inOut)} />
    <Glyphs font={display} text={LOGO} size={190} x={logoX} y={320} fill={C.ink} alt="" animation={(_, i) => enter({ at: END_AT + 0.75 + i * 0.07, over: 0.45 }, { opacity: 0 })} />
    <rect x={logoX} y={350} width={display.measure(LOGO, 190)} height={3} rx={1.5} fill={C.accent} animation={motion({ scale: 0 }).at(END_AT + 1.1).to({ scale: 1 }, 0.7, ease.inOut)} />
    <g animation={rise(END_AT + 1.35, 0.5, 10)}>
      <Glyphs font={display} text={TAG} size={24} x={centered(TAG, 24)} y={402} fill={C.soft} />
    </g>
    <g animation={rise(END_AT + 1.6, 0.4, 8)}>
      <rect x={(W - installW) / 2} y={436} width={installW} height={56} rx={28} fill={C.surface} stroke={C.hairline} />
    </g>
    {install.node}
    <g animation={rise(install.end + 0.5, 0.6, 8)}>
      <text x={W / 2} y={620} fontSize={14} textAnchor="middle" fill={C.soft}>
        {"this entire video is "}
        <tspan fill={C.ink}>{`one ${size} SVG`}</tspan>
        {". no video file, no JavaScript."}
      </text>
    </g>
  </g>
);

// ─── Assembly. ───────────────────────────────────────────────────────────────

/** A hairline progress bar along the bottom edge, one tick per shot. */
const progress = (): SvgNode => {
  const ticks = [TERM.at, CODE.at, MONTAGE.at, FACTS_SPAN.at, END_AT];
  return (
    <g animation={motion({ opacity: 0 }).at(TERM.at).to({ opacity: 1 }, 0.4)}>
      <rect x={0} y={H - 3} width={W} height={3} fill={C.hairline} />
      <rect x={0} y={H - 3} width={0} height={3} fill={C.accent} animation={motion({ width: 0 }).to({ width: W }, D, ease.linear)} />
      {ticks.map((t) => <rect x={(t / D) * W - 1} y={H - 9} width={2} height={6} fill={C.muted} />)}
    </g>
  );
};

const scene = (size: string) =>
  render(
    {
      width: W,
      height: H,
      duration: D,
      title: "svjeez",
      desc: "A hype reel for svjeez that follows the viewer's light or dark mode. Three words: prompt, animate, ship. In Claude Code, Claude reads the svjeez skill, writes a scene, renders frames, looks at them and ships an SVG. The scene's TSX streams into an editor while a preview draws each line's effect. A montage shows sampled motion, a typed flowchart, a word inked on as outlines and brush strokes. Three facts: zero bytes of runtime JS, one self-contained file, CSS and SMIL. The svjeez logo draws on above the install command.",
      css,
      reducedMotion: { at: D - 1 },
      comment: "Generated by svjeez. Edit examples/hype/index.tsx instead of this file.",
    },
    <g fontFamily={mono}>
      <rect width={W} height={H} fill={C.page} />
      {coldOpen}
      {terminalShot}
      {codeShot}
      {montage}
      {facts}
      {finale(size)}
      {progress()}
      <rect width={W} height={H} fill={C.page} animation={motion({ opacity: 0 }).at(D - 0.7).to({ opacity: 1 }, 0.6, ease.in)} />
    </g>,
  );

/** The finale names the file's own size, so render to measure it. */
export default function build(): string {
  const kb = (svg: string) => `${Math.round(new TextEncoder().encode(svg).length / 1024)} KB`;
  return scene(kb(scene(kb(scene("000 KB")))));
}

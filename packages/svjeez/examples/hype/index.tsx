import {
  Glyphs,
  Ink,
  def,
  draw,
  ease,
  enter,
  font,
  motion,
  rect,
  render,
  sampled,
  strokeFont,
  tool,
  type Color,
  type Motion,
  type Stack,
  type SvgNode,
} from "svjeez";
import {
  Marker,
  code,
  cut,
  flow,
  flowchart,
  typewriter,
  appWindow,
  type CodePiece,
} from "svjeez/extras";
import { css, mono, theme } from "../style";

const W = 1280;
const H = 720;

const display = await font.load(new URL("../fonts/ArchivoBlack-Regular.ttf", import.meta.url));
const hand = await strokeFont.load(new URL("../fonts/EMSAllure.svg", import.meta.url));

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
const rise = (at: number, over = 0.45, y = 16) =>
  enter({ at, over }, { opacity: 0, y, blur: 6 }, ease.out);

const centered = (text: string, size: number) => (W - display.measure(text, size)) / 2;

// ─── Shot 1: cold open. The install, alone on the page. ──────────────────────

const INSTALL_FS = 40;
const INSTALL_CMD = "npm i svjeez";
const installAt = (W - [...`$ ${INSTALL_CMD}`].length * INSTALL_FS * 0.6) / 2;

const opening = typewriter(
  code([[["muted", "$"], " ", ["plain", INSTALL_CMD]]], {
    theme,
    font: mono,
    fontSize: INSTALL_FS,
    lineHeight: 1.4,
    x: installAt,
    y: H / 2 - 40,
  }),
  { at: 0.5, cps: 13, cursor: C.accent, blink: false },
);

const enterAt = opening.end + 0.35;
const COLD = { at: 0, over: enterAt + 1.9 };

const coldOpen = (
  <g animation={cut(COLD)}>
    <g animation={motion({ y: 0 }).at(enterAt).to({ y: -28 }, 0.5, ease.inOut)}>
      {opening.node}
      <g animation={rise(enterAt + 0.15, 0.45, 10)}>
        <text x={installAt} y={H / 2 + 52} fontSize={20} fill={C.soft}>
          added 1 package in 0.4s
        </text>
      </g>
      <g animation={rise(enterAt + 0.55, 0.45, 10)}>
        <text x={installAt} y={H / 2 + 84} fontSize={20} fill={C.muted}>
          <tspan fill={C.accent}>0</tspan>
          {" dependencies. "}
          <tspan fill={C.accent}>0</tspan>
          {" bytes of runtime JS."}
        </text>
      </g>
    </g>
  </g>
);

// ─── Shot 2: Claude Code builds the scene. ───────────────────────────────────

const TERM_AT = COLD.at + COLD.over;
const FS = 15;
const ROW = FS * 1.6;
const CELL = FS * 0.6;

const shell = appWindow(rect(140, 96, 1000, 568), {
  theme,
  title: "~/launch — claude",
  dots: "traffic",
});

const body = def.clipPath(
  {},
  <rect x={shell.body.x} y={shell.body.y} width={shell.body.w} height={shell.body.h - 6} />,
);

const VISIBLE = Math.floor((shell.body.h - 18) / ROW);
const left = shell.body.x + 24;
const top = (row: number) => shell.body.y + 12 + row * ROW;
const mid = (row: number) => top(row) + ROW / 2;

const sayAt = (pieces: readonly CodePiece[], row: number, x: number) =>
  code([pieces], { theme, font: mono, fontSize: FS, lineHeight: 1.6, x, y: top(row) }).node;

const say = (pieces: readonly CodePiece[], row: number, indent = 0) =>
  sayAt(pieces, row, left + indent);

const bold = (content: string, color: Color = C.ink): CodePiece => ({
  content,
  color,
  fontStyle: 2,
});

const width = (text: string) => [...text].length * CELL;

/** Claude's spinner glyph, drawn: a six-spoke asterisk that breathes as it turns. */
const asterisk = (x: number, y: number, r: number, animation?: Stack<"rotate" | "scale">) => (
  <g transform={`translate(${x} ${y})`}>
    <path
      d={[0, 1, 2]
        .map(
          (i) =>
            `M${(r * Math.cos((i * Math.PI) / 3)).toFixed(2)} ${(r * Math.sin((i * Math.PI) / 3)).toFixed(2)}L${(-r * Math.cos((i * Math.PI) / 3)).toFixed(2)} ${(-r * Math.sin((i * Math.PI) / 3)).toFixed(2)}`,
        )
        .join("")}
      stroke={C.accent}
      strokeWidth={2.4}
      strokeLinecap="round"
      animation={animation}
    />
  </g>
);

/** The welcome mascot, built from the same block-character quadrants the terminal draws it with. */
const MASCOT = [" ▐▛███▜▌ ", "▝▜█████▛▘", "  ▘▘ ▝▝  "];

const QUADRANTS: Record<string, readonly number[]> = {
  "█": [0, 1, 2, 3],
  "▐": [1, 3],
  "▌": [0, 2],
  "▛": [0, 1, 2],
  "▜": [0, 1, 3],
  "▝": [1],
  "▘": [0],
};

const mascot = (x: number, row: number) =>
  MASCOT.flatMap((line, r) =>
    [...line].flatMap((ch, c) =>
      (QUADRANTS[ch] ?? []).map((q) => (
        <rect
          x={x + c * CELL + (q % 2) * (CELL / 2)}
          y={top(row + r) + Math.floor(q / 2) * (ROW / 2)}
          width={CELL / 2 + 0.3}
          height={ROW / 2 + 0.3}
          fill={C.accent}
        />
      )),
    ),
  );

const BOX = { x: left - 8, w: shell.body.w - 32, top: 1.2, rows: 8 };
const split = BOX.x + BOX.w * 0.56;

const centerAt = (text: string, row: number, color: CodePiece) =>
  sayAt([color], row, BOX.x + (split - BOX.x) / 2 - width(text) / 2);

const welcome = (
  <>
    <rect
      x={BOX.x}
      y={top(BOX.top)}
      width={BOX.w}
      height={BOX.rows * ROW}
      rx={6}
      fill="none"
      stroke={C.accent}
    />
    <rect
      x={BOX.x + 18}
      y={top(BOX.top) - 2}
      width={width(" Claude Code ")}
      height={4}
      fill={C.page}
    />
    {sayAt([["number", " Claude Code "]], BOX.top - 0.5, BOX.x + 18)}
    {centerAt("Welcome back!", BOX.top + 1, bold("Welcome back!"))}
    {mascot(BOX.x + (split - BOX.x) / 2 - (9 * CELL) / 2, BOX.top + 2.4)}
    {centerAt("Opus 5.5 · Claude Max", BOX.top + 5.6, ["muted", "Opus 5.5 · Claude Max"])}
    {centerAt("~/launch", BOX.top + 6.6, ["muted", "~/launch"])}
    <path
      d={`M${split} ${top(BOX.top + 0.6)}V${top(BOX.top + BOX.rows - 0.6)}`}
      stroke={C.accent}
      strokeOpacity={0.6}
    />
    {sayAt([bold("Tips for getting started", C.accent)], BOX.top + 1, split + 24)}
    {sayAt(["Run /init to create a CLAUDE.md file"], BOX.top + 2, split + 24)}
    {sayAt(["with instructions for Claude"], BOX.top + 3, split + 24)}
    <path
      d={`M${split + 24} ${mid(BOX.top + 4.2)}H${BOX.x + BOX.w - 24}`}
      stroke={C.accent}
      strokeOpacity={0.6}
    />
    {sayAt([bold("Recent activity", C.accent)], BOX.top + 5, split + 24)}
    {sayAt([["muted", "No recent activity"]], BOX.top + 6, split + 24)}
  </>
);

const launch = typewriter(
  code([[["blue", "❯"], " claude"]], {
    theme,
    font: mono,
    fontSize: FS,
    lineHeight: 1.6,
    x: left,
    y: top(0),
  }),
  { at: TERM_AT + 0.35, cps: 18, cursor: true, blink: false },
);

const welcomeAt = launch.end + 0.25;
const PROMPT = "make our launch page pop with svjeez";

const ask = typewriter(
  code([[["muted", ">"], " ", PROMPT]], {
    theme,
    font: mono,
    fontSize: FS,
    lineHeight: 1.6,
    x: left,
    y: 0,
  }),
  { at: welcomeAt + 0.5, cps: 32, cursor: true, blink: false },
);

const SENT = ask.end + 0.3;

/** One transcript line: where it sits, when it shows, what it draws. */
type Line = { row: number; at: number; node: SvgNode };

const lines: Line[] = [];
const line = (row: number, at: number, node: SvgNode) => lines.push({ row, at, node });

const dot = (row: number, color: Color, pending?: { until: number }) =>
  pending ? (
    <>
      <circle
        cx={left + 4}
        cy={mid(row)}
        r={4}
        fill={C.muted}
        animation={motion({ opacity: 1 })
          .to({ opacity: 0.25 }, 0.25)
          .to({ opacity: 1 }, 0.25)
          .loop(0.5)}
      />
      <circle
        cx={left + 4}
        cy={mid(row)}
        r={4}
        fill={color}
        animation={motion({ opacity: 0 }).at(pending.until).set({ opacity: 1 })}
      />
    </>
  ) : (
    <circle cx={left + 4} cy={mid(row)} r={4} fill={color} />
  );

const elbow = (row: number) => (
  <path
    d={`M${left + 13} ${top(row) + 3}V${mid(row)}h8`}
    fill="none"
    stroke={C.muted}
    strokeWidth={1.2}
  />
);

const toolCall = (
  row: number,
  at: number,
  done: number,
  name: string,
  args: string,
  results: readonly (readonly CodePiece[])[],
) => {
  line(
    row,
    at,
    <>
      {dot(row, C.green, { until: done })}
      {say([bold(name), ["plain", `(${args})`]], row, 18)}
    </>,
  );
  results.forEach((pieces, i) =>
    line(
      row + 1 + i,
      done,
      <>
        {i === 0 && elbow(row + 1)}
        {say(pieces, row + 1 + i, 36)}
      </>,
    ),
  );
};

const reply = (row: number, at: number, pieces: readonly CodePiece[]) =>
  line(
    row,
    at,
    <>
      {dot(row, C.ink)}
      {say(pieces, row, 18)}
    </>,
  );

line(0, TERM_AT + 0.35, launch.node);

line(BOX.top + BOX.rows - 1, welcomeAt, welcome);

line(
  BOX.top + BOX.rows + 0.4,
  SENT,
  <>
    <rect
      x={left - 6}
      y={top(BOX.top + BOX.rows + 0.4)}
      width={width(`> ${PROMPT}`) + 12}
      height={ROW}
      rx={3}
      fill={C.surface}
    />
    {say([["muted", ">"], " ", PROMPT], BOX.top + BOX.rows + 0.4)}
  </>,
);

const R = BOX.top + BOX.rows + 1.8;

toolCall(R, SENT + 0.35, SENT + 0.75, "Read", "skills/svjeez/SKILL.md", [
  [["muted", "Read "], bold("299", C.muted), ["muted", " lines (ctrl+o to expand)"]],
]);

toolCall(R + 2.2, SENT + 0.95, SENT + 1.35, "Write", "launch.tsx", [
  [["muted", "Wrote "], bold("13", C.muted), ["muted", " lines to "], bold("launch.tsx", C.muted)],
  [
    ["muted", "  1 "],
    ["keyword", "import"],
    " { draw, ease, enter, motion, render } ",
    ["keyword", "from"],
    " ",
    ["string", '"svjeez"'],
    ";",
  ],
  [["muted", "  2"]],
  [["muted", "  3 "], ["keyword", "export default"], " () => ", ["fn", "render"], "("],
  [["muted", "… +10 lines (ctrl+o to expand)"]],
]);

toolCall(
  R + 8.4,
  SENT + 1.6,
  SENT + 2.05,
  "Bash",
  "svjeez frames launch.tsx --times 0,0.6,1.2,1.8 --sheet",
  [[["muted", "Wrote 4 frames and sheet.png"]]],
);

toolCall(R + 10.6, SENT + 2.25, SENT + 2.6, "Read", "sheet.png", [
  [["muted", "Read image (48KB)"]],
]);

reply(R + 12.8, SENT + 2.95, ["The dot lands late at 1.2s, so I tightened its ease."]);

const DONE_AT = SENT + 3.5;

reply(R + 14.2, DONE_AT, [
  "Done. ",
  bold("dist/launch.svg"),
  " is 18.4 KB, with 0 bytes of JavaScript.",
]);

const TERM = { at: TERM_AT, over: DONE_AT + 1.6 - TERM_AT };

// The input box follows the transcript down, and the whole session scrolls once it outgrows the window.
const spinning = (t: number) => t >= SENT && t < DONE_AT;

const bottom = (t: number) =>
  Math.max(...lines.filter((l) => l.at <= t + 1e-6).map((l) => l.row + 1));

const spinnerRow = (t: number) => bottom(t) + 0.4;
const inputRow = (t: number) => bottom(t) + (spinning(t) ? 1.8 : 0.5);
const scroll = (t: number) => Math.max(0, inputRow(t) + 2.6 - VISIBLE);

const beats = [...new Set([welcomeAt, SENT, ...lines.map((l) => l.at), DONE_AT])]
  .filter((t) => t >= welcomeAt)
  .sort((a, b) => a - b);

// Every follower eases over the same span, so the input box holds still on screen while the session scrolls under it.
const follow = (y: (t: number) => number, over = 0.25): Motion<"y"> =>
  beats.reduce(
    (track, t, i) =>
      i > 0 && y(t) !== y(beats[i - 1]!)
        ? track
            .at(t)
            .to({ y: y(t) }, Math.min(over, (beats[i + 1] ?? Infinity) - t - 0.02), ease.out)
        : track,
    motion({ y: y(welcomeAt) }),
  );

const inputBox = (
  <g animation={follow((t) => top(inputRow(t)))}>
    <path
      d={`M${left - 8} 0H${left - 8 + BOX.w}M${left - 8} ${ROW * 1.5}H${left - 8 + BOX.w}`}
      stroke={C.muted}
      strokeOpacity={0.7}
    />
    <g transform={`translate(0 ${ROW * 0.25})`}>
      <g animation={motion({ opacity: 1 }).at(SENT).set({ opacity: 0 })}>{ask.node}</g>
      <g animation={motion({ opacity: 0 }).at(SENT).set({ opacity: 1 })}>
        {sayAt([["muted", ">"]], -(shell.body.y + 12) / ROW, left)}
      </g>
    </g>
    {sayAt([["muted", "? for shortcuts"]], 1.6 - (shell.body.y + 12) / ROW, left + 2)}
  </g>
);

const spinner = (
  <g
    animation={[
      motion({ opacity: 0 }).at(SENT).set({ opacity: 1 }).at(DONE_AT).set({ opacity: 0 }),
      follow((t) => top(spinnerRow(t)) - top(0)),
    ]}
  >
    {asterisk(left + 4, mid(0), 6, [
      motion({ rotate: 0 }).to({ rotate: 180 }, 1.5, ease.linear).loop(1.5),
      motion({ scale: 1 })
        .to({ scale: 0.6 }, 0.375, ease.inOut)
        .to({ scale: 1 }, 0.375, ease.inOut)
        .loop(0.75),
    ])}
    {say(
      [
        ["number", "Animating…"],
        ["muted", " (esc to interrupt · "],
        ["muted", "↓ 1.2k tokens)"],
      ],
      0,
      18,
    )}
  </g>
);

const terminalShot = (
  <g animation={cut(TERM)}>
    <g animation={rise(TERM.at, 0.5, 20)}>
      {shell.node}
      <g clipPath={body}>
        <g animation={follow((t) => -scroll(t) * ROW)}>
          {lines.map(({ at, node }) => (
            <g animation={motion({ opacity: 0 }).at(at).set({ opacity: 1 })}>{node}</g>
          ))}
          {spinner}
          <g animation={motion({ opacity: 0 }).at(welcomeAt).set({ opacity: 1 })}>{inputBox}</g>
        </g>
      </g>
    </g>
  </g>
);

// ─── Shot 3: the code streams in and the preview renders as each line lands. ──

const KEYWORDS = new Set(["import", "from", "export", "default"]);

const TOKEN =
  /("[^"]*")|(\d+(?:\.\d+)?)|(<\/?)([a-z]+)|([A-Za-z_]\w*)(?=\()|([A-Za-z_]\w*)(?==)|([A-Za-z_]\w*)|([^\sA-Za-z_\d"]+)|(\s+)/g;

/** Just enough TSX highlighting for one screen of code. */
const highlight = (source: string): CodePiece[] =>
  [...source.matchAll(TOKEN)].flatMap(
    ([all, str, num, open, tag, fn, attr, word, punct]): CodePiece[] => {
      if (str) return [["string", str]];

      if (num) return [["number", num]];

      if (open && tag)
        return [
          ["punct", open],
          ["tag", tag],
        ];

      if (fn) return [["fn", fn]];

      if (attr) return [["type", attr]];

      if (word) return [KEYWORDS.has(word) ? ["keyword", word] : ["plain", word]];

      if (punct) return [["punct", punct]];

      return [all];
    },
  );

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
const editor = appWindow(rect(40, 96, 810, 568), { theme, title: "launch.tsx" });
const preview = appWindow(rect(870, 96, 370, 568), { theme, title: "dist/launch.svg" });

const src = code(SOURCE.map(highlight), {
  theme,
  font: mono,
  fontSize: 16.5,
  lineHeight: 1.95,
  x: editor.body.x + 24,
  y: editor.body.y + 40,
});

const typed = typewriter(src, { at: CODE_AT + 0.45, cps: 150, cursor: C.accent, blink: false });
const landed = (n: number) => typed.spans[n - 1]!.at + typed.spans[n - 1]!.over;
const runAt = typed.end + 0.25;

/** Live edits after the first run: each swaps one value in the source, and the preview follows a beat later. */
const EDITS = [
  { from: "18", to: "32", role: "number" },
  { from: "ink", to: "sky", role: "plain" },
  { from: "360", to: "720", role: "number" },
  { from: "1.2", to: "0.4", role: "number" },
] as const;

const editAt = (i: number) => runAt + 0.8 + i * 1.4;
const applied = (i: number) => editAt(i) + 0.3;
const CODE = { at: CODE_AT, over: applied(EDITS.length - 1) + 1.6 - CODE_AT };

const edit = ({ from, to, role }: (typeof EDITS)[number], i: number) => {
  const at = editAt(i);
  const word = src.find(from);

  const swapped = code([[[role, to]]], {
    theme,
    font: mono,
    fontSize: 16.5,
    lineHeight: 1.95,
    x: word.x,
    y: word.y,
  });

  const box = word.pad(3);

  return (
    <>
      <g animation={motion({ opacity: 0 }).at(applied(i)).set({ opacity: 1 })}>
        <rect x={word.x - 1} y={word.y} width={word.w + 2} height={word.h} fill={C.page} />
        {swapped.node}
      </g>
      <rect
        x={box.x}
        y={box.y}
        width={box.w}
        height={box.h}
        rx={4}
        fill={C.accent}
        animation={motion({ opacity: 0 })
          .at(at)
          .to({ opacity: 0.3 }, 0.12)
          .at(applied(i))
          .set({ opacity: 0 })}
      />
      <rect
        x={box.x}
        y={box.y}
        width={box.w}
        height={box.h}
        rx={4}
        fill={C.green}
        animation={motion({ opacity: 0 })
          .at(applied(i))
          .set({ opacity: 0.3 })
          .to({ opacity: 0 }, 0.8)}
      />
    </>
  );
};

const P = preview.body.center;
const WAVE = `M${P.x - 135} ${P.y + 110}c30 -54 56 -54 90 0s60 54 90 0s60 -54 90 0`;
const RING = 60;
const spinAt = landed(9);
const react = (i: number) => applied(i) + 0.1;

// The ring turns at 180°/s until the edit doubles it, then at 360°/s to the cut.
const turned = 180 * (react(2) - spinAt);

const spin = motion({ rotate: 0 })
  .at(spinAt)
  .to({ rotate: turned }, react(2) - spinAt, ease.linear)
  .to(
    { rotate: turned + 360 * (CODE.at + CODE.over - react(2)) },
    CODE.at + CODE.over - react(2),
    ease.linear,
  );

const previewArt = (
  <>
    <path
      d={WAVE}
      fill="none"
      stroke={C.accent}
      strokeWidth={4}
      strokeLinecap="round"
      animation={motion({ draw: 0 })
        .at(landed(6))
        .to({ draw: 1 }, 1.2, ease.inOut)
        .at(react(3))
        .set({ draw: 0 })
        .to({ draw: 1 }, 0.4, ease.inOut)}
    />
    <g transform={`translate(${P.x} ${P.y - 50})`}>
      <g
        animation={motion({ scale: 1 })
          .at(react(0))
          .to({ scale: 32 / 18 }, 0.45, ease.pop)}
      >
        <circle
          r={16}
          fill={C.ink}
          animation={enter({ at: landed(8), over: 0.45 }, { scale: 0 }, ease.pop)}
        />
        <circle
          r={16}
          fill={theme.base0D}
          animation={motion({ opacity: 0 }).at(react(1)).to({ opacity: 1 }, 0.3)}
        />
      </g>
      <g animation={[enter({ at: spinAt, over: 0.5 }, { opacity: 0, scale: 0.6 }), spin]}>
        <circle
          r={RING + 14}
          fill="none"
          stroke={C.muted}
          strokeWidth={1.5}
          strokeDasharray="2 8"
          strokeLinecap="round"
        />
        {[0, 1, 2].map((i) => (
          <circle
            cx={(RING + 14) * Math.cos((i * 2 * Math.PI) / 3)}
            cy={(RING + 14) * Math.sin((i * 2 * Math.PI) / 3)}
            r={i === 0 ? 6 : 4}
            fill={i === 0 ? C.accent : C.soft}
          />
        ))}
      </g>
    </g>
  </>
);

const lineRect = (first: number, last = first) => src.lines(first, last).pad(4);

const codeShot = (
  <g animation={cut(CODE)}>
    <g animation={rise(CODE.at, 0.45, 20)}>
      {editor.node}
      <g
        animation={motion({ opacity: 0 })
          .at(landed(6) - 0.05)
          .set({ opacity: 1 })
          .at(runAt)
          .to({ opacity: 0 }, 0.3)}
      >
        <Marker
          color={C.accent}
          over={0.2}
          stops={[lineRect(6), lineRect(7, 8), lineRect(9, 11)].map((r, i) => ({
            during: { at: landed([6, 8, 9][i]!) - 0.05, over: 0.2 },
            target: r,
          }))}
        />
      </g>
      {typed.node}
      {EDITS.map(edit)}
    </g>
    <g animation={rise(CODE.at + 0.12, 0.45, 20)}>
      {preview.node}
      {previewArt}
    </g>
    <g animation={rise(runAt, 0.4, 8)}>
      <circle
        cx={preview.body.x + 36}
        cy={preview.body.bottom.y - 32}
        r={4}
        fill={C.green}
        animation={EDITS.reduce(
          (m, _, i) => m.at(applied(i)).set({ opacity: 0.15 }).to({ opacity: 1 }, 0.5),
          motion({ opacity: 1 }),
        )}
      />
      <text
        x={preview.body.x + 48}
        y={preview.body.bottom.y - 28}
        fontSize={12}
        letterSpacing={1}
        fill={C.soft}
      >
        CSS keyframes · no runtime · 2.1 KB
      </text>
    </g>
  </g>
);

// ─── Shot 4: montage. Four capabilities, one beat each. ──────────────────────

// The spring and the flowchart hold a beat longer than the other two.
const CARDS = [2.7, 2.7, 2.1, 2.1];
const MONTAGE = { at: CODE.at + CODE.over, over: CARDS.reduce((sum, over) => sum + over, 0) };

const card = (i: number) => ({
  at: MONTAGE.at + CARDS.slice(0, i).reduce((sum, over) => sum + over, 0),
  over: CARDS[i]!,
});

const Caption = ({ i, call, line }: { i: number; call: string; line: string }) => (
  <g animation={rise(card(i).at + 0.1, 0.4, 10)}>
    <text x={64} y={H - 88} fontSize={30} fill={C.ink}>
      {call}
    </text>
    <text x={64} y={H - 56} fontSize={14} fill={C.soft}>
      {line}
    </text>
    <text
      x={W - 64}
      y={H - 56}
      fontSize={13}
      textAnchor="end"
      fill={C.muted}
    >{`0${i + 1} / 04`}</text>
  </g>
);

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

const montage = (
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
      <Caption i={0} call="sampled(t => spring(t))" line="real physics, baked into keyframes" />
    </g>
    <g animation={cut(card(1))}>
      {chart.layers.under}
      {comet.node}
      {chart.layers.over}
      <Caption i={1} call="flowchart({ … })" line="typed diagrams that build themselves" />
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
        i={2}
        call="<Glyphs font={display} />"
        line="real fonts, as outlines you can draw on"
      />
    </g>
    <g animation={cut(card(3))}>
      {bars}
      <Caption
        i={3}
        call="motion({ height }).to(…)"
        line="your numbers, animated right in the README"
      />
    </g>
  </g>
);

// ─── Shot 5: handwriting. A single-line script, inked with a nib, stroke by stroke. ──

const HAND_AT = MONTAGE.at + MONTAGE.over;
const WRITTEN = "Write anything.";
const HAND_SIZE = 150;
const handX = (W - hand.measure(WRITTEN, HAND_SIZE)) / 2;
const SPEED = 1500;

/** Roughly how far the pen travels: along the control polygon, close enough to pace the writing. */
const lengthOf = (d: string) => {
  const xy = (d.match(/-?[\d.]+/g) ?? []).map(Number);
  let sum = 0;

  for (let i = 2; i + 1 < xy.length; i += 2)
    sum += Math.hypot(xy[i]! - xy[i - 2]!, xy[i + 1]! - xy[i - 1]!);

  return sum;
};

/** Each stroke of the pen in turn, at one speed, with a breath between lifts. */
const strokes = hand
  .path(WRITTEN, { size: HAND_SIZE, x: handX, y: 360 })
  .d.split(/(?=M)/)
  .reduce<{ d: string; at: number; over: number }[]>((out, d) => {
    const at = out.length ? out.at(-1)!.at + out.at(-1)!.over + 0.04 : HAND_AT + 0.35;

    return [...out, { d, at, over: lengthOf(d) / SPEED }];
  }, []);

const inked = strokes.at(-1)!.at + strokes.at(-1)!.over;
const HAND = { at: HAND_AT, over: inked - HAND_AT + 1.8 };
const nibTool = tool.nib({ size: 6, angle: 35, thin: 0.25 });

const handwriting = (
  <g animation={cut(HAND)}>
    {strokes.map(({ d, at, over }) => (
      <Ink d={d} tool={nibTool} fill={C.ink} draw={{ at, over }} ease={ease.linear} />
    ))}
    <Ink
      d={`M${handX + 40} 452C${W / 2 - 100} 436 ${W / 2 + 200} 436 ${W - handX - 30} 446`}
      tool={tool.brush({ size: 7, seed: 5 })}
      fill={C.accent}
      draw={{ at: inked + 0.1, over: 0.5 }}
    />
    <g animation={rise(HAND.at + 0.2, 0.4, 10)}>
      <text x={64} y={H - 88} fontSize={30} fill={C.ink}>
        {"<Ink tool={tool.nib()} />"}
      </text>
      <text x={64} y={H - 56} fontSize={14} fill={C.soft}>
        single-line fonts, inked stroke by stroke
      </text>
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
const FACTS_SPAN = { at: HAND.at + HAND.over, over: 3.4 };

const facts = (
  <g animation={cut(FACTS_SPAN)}>
    {FACTS.map((fact, i) => {
      const x = (W - display.measure(fact.lead + fact.rest, FACT)) / 2;
      const y = 270 + i * 110;

      return (
        <g animation={rise(FACTS_SPAN.at + 0.2 + i * 0.7, 0.45, 24)}>
          <Glyphs font={display} text={fact.lead} size={FACT} x={x} y={y} fill={C.accent} />
          <Glyphs
            font={display}
            text={fact.rest}
            size={FACT}
            x={x + display.measure(fact.lead, FACT)}
            y={y}
            fill={C.ink}
          />
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

const installCode = code([[["blue", "❯"], " ", ["plain", INSTALL]]], {
  theme,
  font: mono,
  fontSize: 20,
  x: (W - installW) / 2 + 26,
  y: 448,
});

const install = typewriter(installCode, { at: END_AT + 1.8, cps: 34, cursor: C.accent });
const D = install.end + 3.2;

const finale = (size: string) => (
  <g animation={motion({ opacity: 0 }).at(END_AT).set({ opacity: 1 })}>
    <Glyphs
      font={display}
      text={LOGO}
      size={190}
      x={logoX}
      y={320}
      fill="none"
      stroke={C.ink}
      strokeWidth={2}
      animation={(_, i) => draw({ at: END_AT + 0.1 + i * 0.1, over: 0.8 }, ease.inOut)}
    />
    <Glyphs
      font={display}
      text={LOGO}
      size={190}
      x={logoX}
      y={320}
      fill={C.ink}
      alt=""
      animation={(_, i) => enter({ at: END_AT + 0.75 + i * 0.07, over: 0.45 }, { opacity: 0 })}
    />
    <rect
      x={logoX}
      y={350}
      width={display.measure(LOGO, 190)}
      height={3}
      rx={1.5}
      fill={C.accent}
      animation={motion({ scale: 0 })
        .at(END_AT + 1.1)
        .to({ scale: 1 }, 0.7, ease.inOut)}
    />
    <g animation={rise(END_AT + 1.35, 0.5, 10)}>
      <Glyphs font={display} text={TAG} size={24} x={centered(TAG, 24)} y={402} fill={C.soft} />
    </g>
    <g animation={rise(END_AT + 1.6, 0.4, 8)}>
      <rect
        x={(W - installW) / 2}
        y={436}
        width={installW}
        height={56}
        rx={28}
        fill={C.surface}
        stroke={C.hairline}
      />
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
  const ticks = [TERM.at, CODE.at, MONTAGE.at, HAND.at, FACTS_SPAN.at, END_AT];

  return (
    <g animation={motion({ opacity: 0 }).at(TERM.at).to({ opacity: 1 }, 0.4)}>
      <rect x={0} y={H - 3} width={W} height={3} fill={C.hairline} />
      <rect
        x={0}
        y={H - 3}
        width={0}
        height={3}
        fill={C.accent}
        animation={motion({ width: 0 }).to({ width: W }, D, ease.linear)}
      />
      {ticks.map((t) => (
        <rect x={(t / D) * W - 1} y={H - 9} width={2} height={6} fill={C.muted} />
      ))}
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
      {handwriting}
      {facts}
      {finale(size)}
      {progress()}
      <rect
        width={W}
        height={H}
        fill={C.page}
        animation={motion({ opacity: 0 })
          .at(D - 0.7)
          .to({ opacity: 1 }, 0.6, ease.in)}
      />
    </g>,
  );

/** The finale names the file's own size, so render to measure it. */
export default function build(): string {
  const kb = (svg: string) => `${Math.round(new TextEncoder().encode(svg).length / 1024)} KB`;

  return scene(kb(scene(kb(scene("000 KB")))));
}

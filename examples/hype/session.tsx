import { def, ease, motion, rect, type Color, type Motion, type Stack, type SvgNode } from "svjeez";
import { appWindow, code, cut, typewriter, type CodePiece } from "svjeez/extras";
import { mono, theme } from "../style";
import { COLD } from "./cold";
import { C, rise, show } from "./kit";

const TERM_AT = COLD.at + COLD.over;
const FS = 15;
const ROW = FS * 1.6;

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

const width = (text: string) => mono.measure(text, FS);

/** Claude's spinner glyph: a six-spoke asterisk that breathes as it turns. */
const asterisk = (x: number, y: number, animation?: Stack<"rotate" | "scale">) => (
  <g transform={`translate(${x} ${y})`}>
    <path
      d="M-6 0H6M-3 -5.2L3 5.2M3 -5.2L-3 5.2"
      stroke={C.accent}
      strokeWidth={2.4}
      strokeLinecap="round"
      animation={animation}
    />
  </g>
);

/** The welcome mascot, one `#` per half-cell. */
const MASCOT = [
  "...############...",
  "...##.######.##...",
  ".################.",
  "...############...",
  "....#.#....#.#....",
];

const BOX = { x: left - 8, w: shell.body.w - 32, top: 1.2, rows: 8 };
const split = BOX.x + BOX.w * 0.56;

const centerAt = (text: string, row: number, piece: (text: string) => CodePiece = (t) => t) =>
  sayAt([piece(text)], row, BOX.x + (split - BOX.x) / 2 - width(text) / 2);

const mascot = (row: number) => {
  const [w, h] = [width("W") / 2, ROW / 2];
  const x = BOX.x + (split - BOX.x) / 2 - (MASCOT[0]!.length * w) / 2;

  return MASCOT.flatMap((line, r) =>
    [...line.matchAll(/#+/g)].map((run) => (
      <rect
        x={x + run.index * w}
        y={top(row) + r * h}
        width={run[0].length * w}
        height={h + 0.3}
        fill={C.accent}
      />
    )),
  );
};

const muted = (text: string): CodePiece => ["muted", text];

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
    {centerAt("Welcome back!", BOX.top + 1, bold)}
    {mascot(BOX.top + 2.4)}
    {centerAt("Opus 5.5 · Claude Max", BOX.top + 5.6, muted)}
    {centerAt("~/launch", BOX.top + 6.6, muted)}
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
      <circle cx={left + 4} cy={mid(row)} r={4} fill={color} animation={show(pending.until)} />
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

export const TERM = { at: TERM_AT, over: DONE_AT + 1.6 - TERM_AT };

// The input box follows the transcript down, and the whole session scrolls once it outgrows the window.
const spinning = (t: number) => t >= SENT && t < DONE_AT;

const bottom = (t: number) =>
  Math.max(...lines.flatMap((l) => (l.at <= t + 1e-6 ? [l.row + 1] : [])));

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
      <g animation={show(SENT)}>{sayAt([["muted", ">"]], -(shell.body.y + 12) / ROW, left)}</g>
    </g>
    {sayAt([["muted", "? for shortcuts"]], 1.6 - (shell.body.y + 12) / ROW, left + 2)}
  </g>
);

const spinner = (
  <g
    animation={[
      show(SENT).at(DONE_AT).set({ opacity: 0 }),
      follow((t) => top(spinnerRow(t)) - top(0)),
    ]}
  >
    {asterisk(left + 4, mid(0), [
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

export const terminalShot = (
  <g animation={cut(TERM)}>
    <g animation={rise(TERM.at, 0.5, 20)}>
      {shell.node}
      <g clipPath={body}>
        <g animation={follow((t) => -scroll(t) * ROW)}>
          {lines.map(({ at, node }) => (
            <g animation={show(at)}>{node}</g>
          ))}
          {spinner}
          <g animation={show(welcomeAt)}>{inputBox}</g>
        </g>
      </g>
    </g>
  </g>
);

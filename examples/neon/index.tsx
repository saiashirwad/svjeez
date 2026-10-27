import { def, draw, ease, el, enter, exit, fx, motion, render, shake, type Attrs, type Color, type Motion, type SvgNode } from "svjeez";
import { schedule, tally, type Cell, type Game, type Move, type Script, type Tally } from "./game";
import { C, CSS, TALLY } from "./theme";

const W = 480;
const H = 600;
const BOARD = { x: 60, y: 120, cell: 120 };

const SCRIPTS: Script[] = [
  { first: "x", cells: [4, 1, 0, 8, 6, 2, 3] },
  { first: "o", cells: [0, 4, 8, 2, 6, 3, 7] },
  { first: "x", cells: [4, 0, 2, 6, 3, 5, 1, 7, 8] },
];

const { games: GAMES, end: END } = schedule(SCRIPTS, 0.9);
const D = END + 0.8;

const center = (cell: Cell) => ({
  x: BOARD.x + (cell % 3) * BOARD.cell + BOARD.cell / 2,
  y: BOARD.y + Math.floor(cell / 3) * BOARD.cell + BOARD.cell / 2,
});

const ink = (color: Color, width: number): Attrs<"path"> => ({
  fill: "none",
  stroke: color,
  strokeWidth: width,
  strokeLinecap: "round",
});

const bg = def.linearGradient({ x1: 0, y1: 0, x2: 0, y2: 1 }, (
  <>
    <stop offset={0} stopColor={C.bgTop} />
    <stop offset={1} stopColor={C.bgBottom} />
  </>
));
const magenta = def.radialGradient({ cx: 0.1, cy: 0.05, r: 0.7 }, (
  <>
    <stop offset={0} stopColor={C.magentaGlow} stopOpacity={0.16} />
    <stop offset={1} stopColor={C.magentaGlow} stopOpacity={0} />
  </>
));
const cyan = def.radialGradient({ cx: 0.95, cy: 1, r: 0.7 }, (
  <>
    <stop offset={0} stopColor={C.cyanGlow} stopOpacity={0.12} />
    <stop offset={1} stopColor={C.cyanGlow} stopOpacity={0} />
  </>
));
const glow = fx.glow({ blur: 5 });
const card = def.clipPath({}, <rect width={W} height={H} rx={24} />);

function Grid(): SvgNode {
  const { x, y, cell } = BOARD;
  const end = 3 * cell;
  const lines = [
    `M${x + cell} ${y}V${y + end}`,
    `M${x + 2 * cell} ${y}V${y + end}`,
    `M${x} ${y + cell}H${x + end}`,
    `M${x} ${y + 2 * cell}H${x + end}`,
  ];
  return (
    <>
      {lines.map((d, index) => el.path({ d, ...ink(C.grid, 3), animation: draw({ at: 0.1 + index * 0.12, over: 0.6 }) }))}
    </>
  );
}

const emphasis = (game: Game, move: Move): Motion<"scale" | "opacity"> => {
  const r = game.resolveAt;
  const { outcome } = game;
  if (outcome.kind === "win" && outcome.player === move.player && outcome.line.includes(move.cell)) {
    return motion().at(r + 0.3).to({ scale: 1.14 }, 0.25, ease.pop).to({ scale: 1 }, 0.35);
  }
  return motion().at(r).to({ opacity: outcome.kind === "draw" ? 0.5 : 0.25, scale: 0.92 }, 0.4);
};

const mark = (game: Game, move: Move, order: number): SvgNode => {
  const { x, y } = center(move.cell);
  const r = 30;
  return el.g(
    { filter: glow, animation: [emphasis(game, move), exit({ at: game.clearAt + order * 0.04, over: 0.3 })] },
    move.player === "x"
      ? [
          el.path({ d: `M${x - r} ${y - r}L${x + r} ${y + r}`, ...ink(TALLY.x.color, 9), animation: draw({ at: move.at, over: 0.24 }) }),
          el.path({ d: `M${x + r} ${y - r}L${x - r} ${y + r}`, ...ink(TALLY.x.color, 9), animation: draw({ at: move.at + 0.16, over: 0.24 }) }),
        ]
      : el.circle({ cx: x, cy: y, r: r + 2, transform: `rotate(-90 ${x} ${y})`, ...ink(TALLY.o.color, 9), animation: draw({ at: move.at, over: 0.4 }) }),
  );
};

const winLine = (game: Game): SvgNode | null => {
  if (game.outcome.kind !== "win") return null;
  const [first, , last] = game.outcome.line;
  const from = center(first);
  const to = center(last);
  const length = Math.hypot(to.x - from.x, to.y - from.y);
  const reach = 46 / length;
  const dx = (to.x - from.x) * reach;
  const dy = (to.y - from.y) * reach;
  return el.path({
    d: `M${from.x - dx} ${from.y - dy}L${to.x + dx} ${to.y + dy}`,
    filter: glow,
    ...ink(C.win, 7),
    animation: draw({ at: game.resolveAt, over: 0.45 }).at(game.clearAt).to({ opacity: 0 }, 0.35),
  });
};

const look = (move: Move) => ({ ...center(move.cell), color: TALLY[move.player].color });

function cursorMotion(): Motion<"opacity" | "x" | "y" | "color"> {
  const opening = GAMES[0]?.moves[0];
  if (!opening) throw new Error("No moves to follow.");
  let track: Motion<"opacity" | "x" | "y" | "color"> = motion({ opacity: 0, ...look(opening) });
  for (const game of GAMES) {
    const [first, ...rest] = game.moves;
    if (!first) continue;
    track = track.at(game.start).set(look(first)).to({ opacity: 1 }, 0.3);
    for (const move of rest) track = track.at(move.at - 0.4).to(look(move), 0.3, ease.inOut);
    track = track.at((rest.at(-1) ?? first).at + 0.2).to({ opacity: 0 }, 0.3);
  }
  return track;
}

function Cursor(): SvgNode {
  const half = BOARD.cell / 2 - 12;
  return el.g(
    { animation: cursorMotion() },
    el.rect({
      x: -half,
      y: -half,
      width: half * 2,
      height: half * 2,
      rx: 16,
      fill: "currentColor",
      fillOpacity: 0.07,
      stroke: "currentColor",
      strokeOpacity: 0.55,
      strokeWidth: 1.5,
    }),
  );
}

function Score({ who, x, anchor }: { who: Tally; x: number; anchor: "start" | "middle" | "end" }): SvgNode {
  const { color, label } = TALLY[who];
  const ticks = GAMES.filter((game) => tally(game.outcome) === who).map((game) => game.resolveAt + 0.5);
  const digit = (value: number): Motion<"opacity" | "y"> => {
    const arrive = ticks[value - 1];
    const leave = ticks[value];
    const shown = arrive === undefined ? motion() : enter({ at: arrive, over: 0.35 }, { opacity: 0, y: 12 });
    return leave === undefined ? shown : shown.at(leave).to({ opacity: 0, y: -12 }, 0.25);
  };
  return (
    <>
      {el.text({ x, y: 56, class: "mono", fontSize: 11, letterSpacing: 3, fill: color, fillOpacity: 0.7, textAnchor: anchor }, label)}
      {[0, ...ticks].map((_, value) =>
        el.text({ x, y: 92, class: "mono", fontSize: 32, fontWeight: 600, fill: color, textAnchor: anchor, filter: glow, animation: digit(value) }, value),
      )}
    </>
  );
}

const gameCaption = (game: Game): SvgNode => {
  const { color, caption } = TALLY[tally(game.outcome)];
  return el.text(
    {
      x: W / 2,
      y: 532,
      class: "mono",
      fontSize: 15,
      letterSpacing: 4,
      fill: color,
      textAnchor: "middle",
      filter: glow,
      animation: enter({ at: game.resolveAt + 0.5, over: 0.35 }, { opacity: 0, y: 8 }).at(game.clearAt).to({ opacity: 0 }, 0.3),
    },
    caption,
  );
};

function History(): SvgNode {
  return (
    <>
      {GAMES.map((game) => {
        const cx = W / 2 + (game.index - (GAMES.length - 1) / 2) * 18;
        return [
          el.circle({ cx, cy: 566, r: 4, fill: "none", stroke: C.faint }),
          el.circle({ cx, cy: 566, r: 4, fill: TALLY[tally(game.outcome)].color, animation: enter({ at: game.resolveAt + 0.5, over: 0.3 }) }),
        ];
      })}
    </>
  );
}

const draws = GAMES.filter((game) => game.outcome.kind === "draw");

export function buildNeon(): string {
  return render(
    {
      width: W,
      height: H,
      duration: D,
      title: "Neon tic-tac-toe",
      desc: "Three games of tic-tac-toe on a neon board. X wins down the left column, O wins along the bottom row, and the third game is a draw. A scoreboard and a row of dots keep track.",
      css: CSS,
      reducedMotion: { at: GAMES[0]!.resolveAt + 1.2 },
      comment: "Generated by svjeez. Edit examples/neon/index.tsx instead of this file.",
    },
    <g clipPath={card}>
      <rect width={W} height={H} fill={bg} />
      <rect width={W} height={H} fill={magenta} />
      <rect width={W} height={H} fill={cyan} />
      <g animation={enter({ at: 0, over: 0.4 }).at(END).to({ opacity: 0 }, 0.5)}>
        <Score who="x" x={BOARD.x} anchor="start" />
        <Score who="draw" x={W / 2} anchor="middle" />
        <Score who="o" x={W - BOARD.x} anchor="end" />
        {el.g({ animation: draws.map((game) => shake({ at: game.resolveAt + 0.1, over: 0.4 }, { x: 8 })) }, [
          <Grid />,
          <Cursor />,
          GAMES.map((game) => [game.moves.map((move, order) => mark(game, move, order)), winLine(game)]),
        ])}
        {GAMES.map(gameCaption)}
        <History />
      </g>
    </g>,
  );
}

export default buildNeon;

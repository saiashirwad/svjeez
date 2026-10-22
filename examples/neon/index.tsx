import { anim, drawWindow, EASE, frame, revealWindow, Scene, type Frame, type SvgNode } from "svg-motion";
import { schedule, tally, type Cell, type Game, type Move, type Script, type Tally } from "./game";
import { C, CSS, TALLY } from "./theme";

const W = 480;
const H = 600;
const BOARD = { x: 60, y: 120, cell: 120 };
const POP = "cubic-bezier(.34,1.56,.64,1)";

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

const stroke = (color: string, width: number) => ({
  fill: "none",
  stroke: color,
  strokeWidth: width,
  strokeLinecap: "round",
  pathLength: 1,
  strokeDasharray: 1,
});

function Defs(): SvgNode {
  return (
    <>
      <linearGradient id="bg" x1={0} y1={0} x2={0} y2={1}>
        <stop offset={0} stopColor={C.bgTop} />
        <stop offset={1} stopColor={C.bgBottom} />
      </linearGradient>
      <radialGradient id="magenta" cx=".1" cy=".05" r=".7">
        <stop offset={0} stopColor={C.magentaGlow} stopOpacity=".16" />
        <stop offset={1} stopColor={C.magentaGlow} stopOpacity="0" />
      </radialGradient>
      <radialGradient id="cyan" cx=".95" cy="1" r=".7">
        <stop offset={0} stopColor={C.cyanGlow} stopOpacity=".12" />
        <stop offset={1} stopColor={C.cyanGlow} stopOpacity="0" />
      </radialGradient>
      <filter id="glow" filterUnits="userSpaceOnUse" x={0} y={0} width={W} height={H}>
        <feGaussianBlur stdDeviation={5} result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <clipPath id="card">
        <rect width={W} height={H} rx={24} />
      </clipPath>
    </>
  );
}

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
      {lines.map((d, index) => (
        <path
          d={d}
          {...stroke(C.grid, 3)}
          animation={anim(`grid-${index}`, drawWindow({ in: [0.1 + index * 0.12, 0.7 + index * 0.12] }))}
        />
      ))}
    </>
  );
}

const emphasis = (game: Game, move: Move): Frame[] => {
  const r = game.resolveAt;
  const rest = { opacity: 1, scale: 1 };
  const { outcome } = game;
  if (outcome.kind === "win" && outcome.player === move.player && outcome.line.includes(move.cell)) {
    return [frame(r + 0.3, rest, POP), frame(r + 0.55, { opacity: 1, scale: 1.14 }), frame(r + 0.9, rest)];
  }
  return [frame(r, rest), frame(r + 0.4, { opacity: outcome.kind === "draw" ? 0.5 : 0.25, scale: 0.92 })];
};

function Mark({ game, move, order }: { game: Game; move: Move; order: number }): SvgNode {
  const { x, y } = center(move.cell);
  const name = `g${game.index}-${move.cell}`;
  const clear = game.clearAt + order * 0.04;
  const out: [number, number] = [clear, clear + 0.3];
  const r = 30;
  return (
    <g class="pop" filter="url(#glow)" animation={anim(`em-${name}`, emphasis(game, move))}>
      {move.player === "x" ? (
        <>
          <path
            d={`M${x - r} ${y - r}L${x + r} ${y + r}`}
            {...stroke(TALLY.x.color, 9)}
            animation={anim(`x-${name}-a`, drawWindow({ in: [move.at, move.at + 0.24], out }))}
          />
          <path
            d={`M${x + r} ${y - r}L${x - r} ${y + r}`}
            {...stroke(TALLY.x.color, 9)}
            animation={anim(`x-${name}-b`, drawWindow({ in: [move.at + 0.16, move.at + 0.4], out }))}
          />
        </>
      ) : (
        <circle
          cx={x}
          cy={y}
          r={r + 2}
          transform={`rotate(-90 ${x} ${y})`}
          {...stroke(TALLY.o.color, 9)}
          animation={anim(`o-${name}`, drawWindow({ in: [move.at, move.at + 0.4], out }))}
        />
      )}
    </g>
  );
}

function WinLine({ game }: { game: Game }): SvgNode | null {
  if (game.outcome.kind !== "win") return null;
  const [first, , last] = game.outcome.line;
  const from = center(first);
  const to = center(last);
  const length = Math.hypot(to.x - from.x, to.y - from.y);
  const reach = 46 / length;
  const dx = (to.x - from.x) * reach;
  const dy = (to.y - from.y) * reach;
  return (
    <path
      d={`M${from.x - dx} ${from.y - dy}L${to.x + dx} ${to.y + dy}`}
      filter="url(#glow)"
      {...stroke(C.win, 7)}
      animation={anim(`win-${game.index}`, drawWindow({
        in: [game.resolveAt, game.resolveAt + 0.45],
        out: [game.clearAt, game.clearAt + 0.35],
      }))}
    />
  );
}

const cursorFrames = (): Frame[] => {
  const look = (move: Move, opacity: number) => ({ ...center(move.cell), opacity, color: TALLY[move.player].color });
  const frames: Frame[] = [];
  for (const game of GAMES) {
    const [first, ...rest] = game.moves;
    if (!first) continue;
    frames.push(frame(game.start, look(first, 0)), frame(game.start + 0.3, look(first, 1)));
    let previous = first;
    for (const move of rest) {
      frames.push(frame(move.at - 0.4, look(previous, 1), EASE.inOut), frame(move.at - 0.1, look(move, 1)));
      previous = move;
    }
    frames.push(frame(previous.at + 0.2, look(previous, 1)), frame(previous.at + 0.5, look(previous, 0)));
  }
  return frames;
};

function Cursor(): SvgNode {
  const half = BOARD.cell / 2 - 12;
  return (
    <g animation={anim("cursor", cursorFrames())}>
      <rect
        x={-half}
        y={-half}
        width={half * 2}
        height={half * 2}
        rx={16}
        fill="currentColor"
        fillOpacity=".07"
        stroke="currentColor"
        strokeOpacity=".55"
        strokeWidth={1.5}
      />
    </g>
  );
}

const shakeFrames = (): Frame[] | undefined => {
  const draws = GAMES.filter((game) => game.outcome.kind === "draw");
  if (draws.length === 0) return undefined;
  return draws.flatMap(({ resolveAt: r }) =>
    [0, -8, 7, -5, 3, 0].map((x, step) => frame(r + 0.1 + step * 0.08, { x })),
  );
};

function Score({ who, x, anchor }: { who: Tally; x: number; anchor: "start" | "middle" | "end" }): SvgNode {
  const { color, label } = TALLY[who];
  const ticks = GAMES.filter((game) => tally(game.outcome) === who).map((game) => game.resolveAt + 0.5);
  const digit = (value: number) => {
    const enter = ticks[value - 1];
    const leave = ticks[value];
    return anim(`score-${who}-${value}`, revealWindow({
      in: enter === undefined ? undefined : [enter, enter + 0.35],
      out: leave === undefined ? undefined : [leave, leave + 0.25],
      from: { opacity: 0, y: 12 },
      to: { opacity: 1, y: 0 },
      exit: { opacity: 0, y: -12 },
    }));
  };
  return (
    <>
      <text x={x} y={56} class="mono" fontSize={11} letterSpacing={3} fill={color} fillOpacity=".7" textAnchor={anchor}>
        {label}
      </text>
      {[0, ...ticks].map((_, value) => (
        <text
          x={x}
          y={92}
          class="mono"
          fontSize={32}
          fontWeight={600}
          fill={color}
          textAnchor={anchor}
          filter="url(#glow)"
          animation={digit(value)}
        >
          {value}
        </text>
      ))}
    </>
  );
}

function Caption({ game }: { game: Game }): SvgNode {
  const { color, caption } = TALLY[tally(game.outcome)];
  return (
    <text
      x={W / 2}
      y={532}
      class="mono"
      fontSize={15}
      letterSpacing={4}
      fill={color}
      textAnchor="middle"
      filter="url(#glow)"
      animation={anim(`caption-${game.index}`, revealWindow({
        in: [game.resolveAt + 0.5, game.resolveAt + 0.85],
        out: [game.clearAt, game.clearAt + 0.3],
        from: { opacity: 0, y: 8 },
        to: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: 0 },
      }))}
    >
      {caption}
    </text>
  );
}

function History(): SvgNode {
  return (
    <>
      {GAMES.map((game) => {
        const cx = W / 2 + (game.index - (GAMES.length - 1) / 2) * 18;
        const at = game.resolveAt + 0.5;
        return (
          <>
            <circle cx={cx} cy={566} r={4} fill="none" stroke={C.faint} />
            <circle
              cx={cx}
              cy={566}
              r={4}
              fill={TALLY[tally(game.outcome)].color}
              animation={anim(`history-${game.index}`, revealWindow({ in: [at, at + 0.3] }))}
            />
          </>
        );
      })}
    </>
  );
}

export function buildNeon(): string {
  const film = new Scene({
    width: W,
    height: H,
    duration: D,
    title: "Neon tic-tac-toe",
    desc: "Three games of tic-tac-toe on a neon board. X wins down the left column, O wins along the bottom row, and the third game is a draw. A scoreboard and a row of dots keep track.",
    css: CSS,
    reducedMotion: { at: GAMES[0]!.resolveAt + 1.2 },
    comment: "Generated by svg-motion. Edit examples/neon/index.tsx instead of this file.",
  });

  const shake = shakeFrames();

  film.defs(<Defs />);
  film.add(
    <g clipPath="url(#card)">
      <rect width={W} height={H} fill="url(#bg)" />
      <rect width={W} height={H} fill="url(#magenta)" />
      <rect width={W} height={H} fill="url(#cyan)" />
      <g animation={anim("film", revealWindow({ in: [0, 0.4], out: [END, END + 0.5] }))}>
        <Score who="x" x={BOARD.x} anchor="start" />
        <Score who="draw" x={W / 2} anchor="middle" />
        <Score who="o" x={W - BOARD.x} anchor="end" />
        <g animation={shake && anim("shake", shake, { timing: EASE.linear })}>
          <Grid />
          <Cursor />
          {GAMES.map((game) => (
            <>
              {game.moves.map((move, order) => <Mark game={game} move={move} order={order} />)}
              <WinLine game={game} />
            </>
          ))}
        </g>
        {GAMES.map((game) => <Caption game={game} />)}
        <History />
      </g>
    </g>,
  );

  return film.render();
}

export default buildNeon;

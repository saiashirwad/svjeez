export type Cell = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export type Player = "x" | "o";

export type Line = readonly [Cell, Cell, Cell];

export type Outcome = { kind: "win"; player: Player; line: Line } | { kind: "draw" };

export type Tally = Player | "draw";

export interface Script {
  first: Player;
  cells: Cell[];
}

export interface Move {
  cell: Cell;
  player: Player;
  at: number;
}

export interface Game {
  index: number;
  start: number;
  moves: Move[];
  outcome: Outcome;
  resolveAt: number;
  clearAt: number;
}

const LINES: Line[] = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

const TIMING = { setup: 0.7, step: 0.62, resolve: 0.55, hold: 2.2, gap: 0.5 } as const;

const other = (player: Player): Player => (player === "x" ? "o" : "x");

export const tally = (outcome: Outcome): Tally =>
  outcome.kind === "win" ? outcome.player : "draw";

const judge = ({ first, cells }: Script): Outcome => {
  const board = new Map<Cell, Player>();
  let player = first;

  for (const [turn, cell] of cells.entries()) {
    if (board.has(cell)) throw new Error(`Cell ${cell} is played twice.`);
    board.set(cell, player);
    const line = LINES.find((candidate) => candidate.every((c) => board.get(c) === player));

    if (line) {
      if (turn !== cells.length - 1)
        throw new Error(`${player} wins on turn ${turn} but the script keeps going.`);

      return { kind: "win", player, line };
    }

    player = other(player);
  }

  if (board.size < 9) throw new Error("The script stops before anyone wins or the board fills.");

  return { kind: "draw" };
};

export const schedule = (scripts: Script[], start: number): { games: Game[]; end: number } => {
  const games: Game[] = [];
  let cursor = start;

  for (const [index, script] of scripts.entries()) {
    const outcome = judge(script);

    const moves = script.cells.map((cell, turn) => ({
      cell,
      player: turn % 2 === 0 ? script.first : other(script.first),
      at: cursor + TIMING.setup + turn * TIMING.step,
    }));

    const resolveAt =
      cursor + TIMING.setup + (script.cells.length - 1) * TIMING.step + TIMING.resolve;

    const clearAt = resolveAt + TIMING.hold;
    games.push({ index, start: cursor, moves, outcome, resolveAt, clearAt });
    cursor = clearAt + TIMING.gap;
  }

  return { games, end: cursor };
};

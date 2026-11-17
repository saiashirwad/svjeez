import type { Ease } from "svjeez";
import type { Timing, Wait } from "./flow.ts";
import type { Snapshot } from "./tree.ts";

/**
 * A state with how the timeline moves into it, or a wait. What `card.run` gives and `<Dom states>` plays.
 */
export type Step = Snapshot | readonly [Snapshot, Timing] | Wait;

interface Move {
  readonly at: number;
  readonly over: number;
  readonly ease?: Ease;
}

const OVER = 0.6;

const isWait = (step: Step): step is Wait => "wait" in step;

export const snapshotOf = (step: Step): Snapshot | undefined =>
  isWait(step) ? undefined : "root" in step ? step : step[0];

export const timeline = (states: Snapshot | readonly Step[]) => {
  const snaps: Snapshot[] = [];
  const moves: Move[] = [];
  let cursor = 0;

  for (const step of "root" in states ? [states] : states) {
    if (isWait(step)) {
      if (snaps.length === 0)
        throw new Error("<Dom> a wait comes before the first state, but nothing is drawn yet.");

      if (!(step.wait >= 0)) throw new Error(`<Dom> needs a wait of 0 or more, got ${step.wait}.`);

      cursor += step.wait;
      continue;
    }

    const state = snapshotOf(step)!;
    const timing = "root" in step ? undefined : step[1];

    if (snaps.length === 0 && timing)
      throw new Error(
        "<Dom> the first state has timing, but nothing moves into it. Put it on the next state.",
      );

    if (snaps.length > 0) {
      const over = timing?.over ?? OVER;

      if (!(over > 0)) throw new Error(`<Dom> needs a positive over, got ${over}.`);

      moves.push({ at: cursor, over, ease: timing?.ease });
      cursor += over;
    }

    snaps.push(state);
  }

  return { snaps, moves, length: cursor };
};

/**
 * When each state is at rest, in seconds: the end of its hold, before the next move starts. The last is held a hair inside the end so a loop hasn't wrapped.
 */
export const steady = (states: Snapshot | readonly Step[]): number[] => {
  const { snaps, moves, length } = timeline(states);

  return snaps.map((_, i) => {
    const arrived = i === 0 ? 0 : moves[i - 1]!.at + moves[i - 1]!.over;
    const leaves = moves[i]?.at ?? length;

    return Math.min(Math.max(arrived, leaves - 0.001), Math.max(length, 1) - 0.001);
  });
};

/**
 * A flow that ends where it began: the steps, then a move back into the first snapshot over `over` seconds (default 0.6), optionally holding `wait` seconds after.
 */
export const loop = (
  steps: readonly Step[],
  timing: Timing & { readonly wait?: number } = {},
): Step[] => {
  const first = steps.map(snapshotOf).find((s) => s !== undefined);

  if (!first) throw new Error("loop() needs a snapshot to return to, but the steps have none.");

  const { wait, ...move } = timing;

  return [...steps, [first, move], ...(wait ? [{ wait }] : [])];
};

/** The picture's size: the largest of the states, so one frame holds them all. */
export const size = (states: Snapshot | readonly Step[]) => {
  const all = timeline(states).snaps;

  return {
    width: Math.max(...all.map((s) => s.width)),
    height: Math.max(...all.map((s) => s.height)),
  };
};

/** Seconds from the first state to the end of the last move or wait, so a scene can pick its duration. */
export const duration = (states: Snapshot | readonly Step[]): number => timeline(states).length;

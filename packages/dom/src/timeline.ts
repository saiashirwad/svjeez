import type { Ease } from "svjeez";
import type { Timing, Wait } from "./flow.ts";
import type { Snapshot } from "./tree.ts";

/**
 * A state, with how the timeline moves into it if not the default, or a wait. What `card.run` gives, and what
 * `<Dom states>` plays.
 */
export type Step = Snapshot | readonly [Snapshot, Timing] | Wait;

/** A move from one state into the next, in seconds on the clock around the `Dom`. */
interface Move {
  readonly at: number;
  readonly over: number;
  readonly ease?: Ease;
}

/** Default length of a move into a snapshot. */
const OVER = 0.6;

const isWait = (step: Step): step is Wait => "wait" in step;

/**
 * Walks a cursor over the steps: the first snapshot holds from 0, each later one moves in from where the cursor is
 * and leaves it at the move's end, and a wait pushes it on.
 */
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

    const [state, timing] = "root" in step ? [step, undefined] : step;

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

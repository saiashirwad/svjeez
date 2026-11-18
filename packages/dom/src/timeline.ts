import type { Timing, Wait } from "./flow.ts";
import type { Snapshot } from "./tree.ts";

export type Step = Snapshot | readonly [Snapshot, Timing] | Wait;

const isWait = (step: Step): step is Wait => "wait" in step;

export const snapshotOf = (step: Step): Snapshot | undefined =>
  isWait(step) ? undefined : "root" in step ? step : step[0];

export const loop = (
  steps: readonly Step[],
  timing: Timing & { readonly wait?: number } = {},
): Step[] => {
  const first = steps.map(snapshotOf).find((s) => s !== undefined);

  if (!first) throw new Error("loop() needs a snapshot to return to, but the steps have none.");

  const { wait, ...move } = timing;

  return [...steps, [first, move], ...(wait ? [{ wait }] : [])];
};

import { valueOf, type TargetValues, type Target } from "./channels";
import { easeAt, splitEase } from "./ease-at";
import { blendStrict } from "./keys";
import { EPSILON, ease, type MotionData, type Seconds, type Step } from "./motion";

const end = (step: Step): Seconds =>
  step.until === undefined ? step.start + step.over : Math.min(step.start + step.over, step.until);

// SAFETY: a and b are TargetValues, so their keys are Target names.
const keysOf = (values: TargetValues): Target[] => Object.keys(values) as Target[];

/** The part of a transition that plays before `until`, from the values the lane holds when it starts. */
const head = (current: TargetValues, step: Step & { readonly until: Seconds }): Step => {
  const progress = (step.until - step.start) / step.over;
  const amount = easeAt(step.ease, progress);
  const [curve] = splitEase(step.ease, progress, "repeat({ until })");

  // SAFETY: the entries are the step's own targets, each paired with a TargetValue from blendStrict, so the result is a TargetValues.
  const values = Object.fromEntries(
    keysOf(step.values).map((target) => [
      target,
      blendStrict(
        target,
        valueOf(current, target)!,
        valueOf(step.values, target),
        amount,
        "repeat({ until })",
      ),
    ]),
  ) as TargetValues;

  return { start: step.start, over: step.until - step.start, ease: curve, values };
};

/**
 * A lane's steps in time order, with the deferred ones written out: a `repeat` pass restarts from the initial values,
 * a transition `repeat({ until })` stops ends where it stops, and `rewind` glides back to the initial values so that
 * it ends at `clockEnd`. A restart that would change nothing is dropped.
 */
export const resolveSteps = (
  initial: TargetValues,
  steps: readonly Step[],
  rewind: MotionData["rewind"],
  clockEnd: Seconds,
  where: string,
): Step[] => {
  const out: Step[] = [];
  let current = initial;

  const apply = (step: Step): void => {
    out.push(step);
    current = { ...current, ...step.values };
  };

  const back = (targets: readonly Target[]): TargetValues =>
    // SAFETY: each entry is a target of the lane with its initial value, so the result is a TargetValues.
    Object.fromEntries(
      targets.flatMap((target) => {
        const home = valueOf(initial, target);

        return home !== undefined && valueOf(current, target) !== home ? [[target, home]] : [];
      }),
    ) as TargetValues;

  for (const step of [...steps].sort((a, b) => a.start - b.start)) {
    if (step.restore) {
      const values = back(step.restore);

      if (keysOf(values).length > 0) apply({ start: step.start, over: 0, ease: ease.hold, values });
    } else if (step.until !== undefined && step.until < step.start + step.over - EPSILON)
      apply(head(current, { ...step, until: step.until }));
    else apply(step);
  }

  if (rewind) {
    const values = back(keysOf(initial));
    const last = Math.max(0, ...out.map(end));
    const start = clockEnd - rewind.over;

    if (keysOf(values).length > 0) {
      if (start < last - EPSILON)
        throw new Error(
          `rewind(${rewind.over}) on ${where} needs the last ${rewind.over}s of its ${clockEnd}s clock, but the motion runs until ${last}s.`,
        );

      apply({ start, over: rewind.over, ease: rewind.ease, values });
    }
  }

  return out;
};

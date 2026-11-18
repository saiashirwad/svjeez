import { SceneError } from "../model/scene-error";
import { EPSILON } from "../model/time";
import { num } from "../model/format";
import { isDerived, restOf } from "./derived";
import { morph } from "./morph";
import type { SceneElement, TextProps } from "./nodes";
import type { Curve } from "./spring";
import { isTrack, passageOf, type Anim } from "./track";

type Reflows = "size" | "width";

interface Step {
  readonly prop: Reflows;
  readonly start: number;
  readonly over: number;
  readonly curve: Curve;
  readonly value: number;
}

const stepsOf = (prop: Reflows, given: Anim<number> | undefined): Step[] => {
  if (given === undefined || !isTrack(given)) {
    if (isDerived(given))
      throw new SceneError(
        `<Text> takes a number or a track for its ${prop}, got one worked out from other tracks with map() or with().`,
        `Give ${prop} a track of its own: the text is laid out again at each value it reaches.`,
      );

    return [];
  }

  const { data } = passageOf(given);

  if (data.period !== undefined || data.rewind || data.repeated)
    throw new SceneError(
      `<Text>'s ${prop} track ${data.period !== undefined ? "loops" : data.rewind ? "rewinds" : "repeats"}, but the text is laid out again at each value it reaches, so its steps must be written out.`,
      "Write each step with to(), or loop the text's scale in a motion layer.",
    );

  return data.steps.map((step) => {
    if (step.over === 0)
      throw new SceneError(
        `<Text>'s ${prop} track cuts with set() at ${num(step.start)}s, but the text is laid out again at each value it reaches, so it moves there with to().`,
        "Give the step a length, or key two <Text>s and swap them.",
      );

    return {
      prop,
      start: step.start,
      over: step.over,
      curve: step.ease,
      value: step.values.value!,
    };
  });
};

/** A <Text> whose size or width moves is a morph between its layouts at each value they reach. */
export const reflowed = (props: TextProps): SceneElement | undefined => {
  const steps = [...stepsOf("size", props.size), ...stepsOf("width", props.width)].sort(
    (a, b) => a.start - b.start || a.over - b.over,
  );

  if (steps.length === 0 && !isTrack(props.size) && !isTrack(props.width)) return undefined;
  const groups: Step[][] = [];

  for (const step of steps) {
    const last = groups.at(-1)?.[0];

    if (
      last &&
      Math.abs(last.start - step.start) < EPSILON &&
      Math.abs(last.over - step.over) < EPSILON
    ) {
      groups.at(-1)!.push(step);
      continue;
    }

    if (last && step.start < last.start + last.over - EPSILON)
      throw new SceneError(
        `<Text>'s ${last.prop} moves from ${num(last.start)}s to ${num(last.start + last.over)}s, and its ${step.prop} from ${num(step.start)}s, before that ends.`,
        "Move size and width over the same span, or one after the other: the text is laid out again at each value they reach.",
      );
    groups.push([step]);
  }

  const [curve] = steps.map((step) => step.curve);

  if (steps.some((step) => step.curve !== curve))
    throw new SceneError(
      "<Text>'s size and width steps use different curves, but the text moves between its layouts on one curve.",
      "Give every step the same curve.",
    );

  const start = { size: restNumber(props.size), width: restNumber(props.width) };
  const states = [start];

  for (const group of groups) {
    const next = { ...states.at(-1)! };

    for (const step of group) next[step.prop] = step.value;
    states.push(next);
  }

  const texts = states.map(({ size, width }): SceneElement => ({
    type: "text",
    props: { ...props, size: size!, ...(width !== undefined && { width }) },
  }));

  if (groups.length === 0) return texts[0];

  return morph.between(
    texts,
    groups.map(([step]) => ({ start: step!.start, over: step!.over })),
    curve === undefined ? {} : { curve },
  );
};

const restNumber = (value: Anim<number> | undefined): number | undefined =>
  value === undefined ? undefined : restOf(value);

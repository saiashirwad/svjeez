import type { Animated, Vec } from "../model/ir";
import { SceneError, located } from "../model/scene-error";
import { isAnchor, type Anchor } from "./refs";
import { blendVec, valueAt } from "../model/sample";
import { outward, type Aim, type Notes } from "./settle";
import { laneOf, mixVec, type Step, type Timing } from "../model/steps";
import type { NodeElement } from "./nodes";
import { goesToAnchor, isTrack, readGoals } from "./track";

const framed = (el: NodeElement): el is NodeElement & { readonly type: "group" } =>
  el.type === "group" && el.props.offset !== undefined;

const isVec = (value: unknown): value is Vec =>
  Array.isArray(value) && value.length === 2 && value.every(Number.isFinite);

/**
 * A node whose at (or a group's offset) is a track with a step that goes to an anchor is placed after
 * layout, when the anchor is known. This registers how, and leaves the node placed at the track's start.
 */
export const withGoals = (
  el: NodeElement,
  key: string,
  timing: Timing,
  notes: Notes,
  parent: string,
): NodeElement => {
  const prop = framed(el) ? "offset" : "at";
  const written = framed(el) ? el.props.offset : el.props.at;

  if (!isTrack(written) || !goesToAnchor(written)) return el;

  const where = `at on ${notes.names.named(key)}`;
  const { data } = readGoals(written, timing, where);
  const initial = data.initial.value;
  const container = notes.nodes.get(parent)?.settle;

  if (container?.kind === "arrange")
    throw new SceneError(
      `${notes.names.named(key)} goes to an anchor, but the ${container.label} it sits in places it.`,
      "Wrap it in a <Group> for the container to place, and move the node inside.",
    );

  if (data.period !== undefined)
    throw new SceneError(
      `${where} loops, and a loop can't go to an anchor, which lands at one moment.`,
      "Go to the anchor in a track that does not loop.",
    );

  if (!isVec(initial))
    throw new SceneError(
      `${where} starts at ${String(initial)}, but a track that goes to an anchor starts at a point.`,
      "Start it with track([x, y]).",
    );
  notes.onAnchor.add(key);

  notes.aims.set(key, (read, self) => {
    try {
      return aimed(read, self);
    } catch (error) {
      throw error instanceof Error ? located(error, notes.names.whereOf(key)) : error;
    }
  });

  const aimed: Aim = (read, self) => {
    const seen = new Map<Anchor, Animated<Vec>>();

    const land = (step: Step<{ readonly value: Vec }>): Step<{ readonly value: Vec }> => {
      const goal = step.values.value;

      if (!isAnchor(goal)) return { ...step, values: goal === undefined ? {} : { value: goal } };

      const t = timing.clock.offset + step.start + step.over;
      const lane = seen.get(goal) ?? read(goal);

      seen.set(goal, lane);
      const [x, y] = valueAt(lane, t, blendVec);
      const node = self();
      const [dx, dy] = outward(node.home, [0, 0], node.origin, node.layers, t);

      return { ...step, values: { value: [x - dx + node.home[0], y - dy + node.home[1]] } };
    };

    return laneOf(
      { ...data, initial: { value: initial }, steps: data.steps.map(land) },
      initial,
      timing,
      mixVec,
      where,
      true,
    );
  };

  // SAFETY: the node keeps the point the track starts at, which is a point of the prop's own type, a Vec.
  return { ...el, props: { ...el.props, [prop]: initial } } as NodeElement;
};

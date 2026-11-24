import { SceneError } from "../model/scene-error";
import type { Animated, Box, TextNode, Vec } from "../model/ir";
import type { Mix } from "../model/steps";
import type { Seconds } from "../model/time";
import { valueAt } from "../model/sample";
import { changesOf, flatten, type Item, type TextContent, type Tick } from "./count";
import { isObject } from "../model/guards";
import { isDerived, type Derived } from "./derived";
import { isTrack, type Track } from "./track";
import { stepped, still } from "./typed";

// SAFETY: isTrack and isDerived only test the value's class, so any object may be handed to them.
const isSwap = (value: Item): value is Track<string> | Derived<string> =>
  isObject(value) && (isTrack(value as Track<string>) || isDerived(value as Derived<string>));

/**
 * A string track read as a label that swaps: a step's value shows from the moment the step ends, so `.set()` swaps at
 * its time and `.to()` swaps when its span is over. Nothing in between: the text is never partway.
 */
export const swapping: Mix<string> = (from, to, amount) => (amount >= 1 ? to : from);

/** The track a <Text> swaps, when that is all it holds. */
export const swapIn = (content: TextContent, where: string): Track<string> | undefined => {
  const items = flatten(content);
  const found = items.filter(isSwap);

  if (found.length === 0) return undefined;

  if (found.length > 1 || items.length > 1)
    throw new SceneError(
      `${where} swaps a string track, and a swapping <Text> holds only that track.`,
      "Give the track its own <Text>, and the other words a <Text> beside it.",
    );

  const [only] = found;

  if (isDerived(only!))
    throw new SceneError(
      `${where} swaps a value derived from a track, and only a string track swaps.`,
      'Make the string track itself: track("CLOSED").set("OPEN", span(2, 0)).',
    );

  // SAFETY: a swap that is not derived is a track, and a track of strings is what a <Text> is given.
  return only as Track<string>;
};

/** Each time a swapping label's text changes over the scene. */
export const swapTicks = (value: Animated<string>, duration: Seconds): Tick[] => {
  const show = (t: Seconds): string =>
    valueAt(value, t, (a, b, amount) => swapping(a, b, amount, ""));

  return changesOf(show, duration, 1 / 1000);
};

/** Distinct non-empty texts the ticks show, in order of first showing. */
export const textsOf = (ticks: readonly Tick[]): string[] => [
  ...new Set(ticks.flatMap((tick) => (tick.text === "" ? [] : [tick.text]))),
];

/** A text node that shows only while the ticks say it does, placed at `at`. */
export const shown = (node: TextNode, text: string, ticks: readonly Tick[], at: Vec): TextNode => {
  const opacity = stepped(
    ticks.map(({ t, text: shownNow }) => ({ t, value: shownNow === text ? 1 : 0 })),
  );

  return {
    ...node,
    at,
    layers: opacity === 1 ? node.layers : [...node.layers, still(opacity)],
  };
};

export const unionOf = (boxes: readonly Box[]): Box => {
  const left = Math.min(...boxes.map((box) => box.x));
  const top = Math.min(...boxes.map((box) => box.y));
  const right = Math.max(...boxes.map((box) => box.x + box.width));
  const bottom = Math.max(...boxes.map((box) => box.y + box.height));

  return { x: left, y: top, width: right - left, height: bottom - top };
};

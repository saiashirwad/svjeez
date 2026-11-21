import { SceneError } from "../model/scene-error";
import type { Font } from "../font/font";
import { valueAt } from "../model/sample";
import { ease, type Seconds } from "../model/time";
import type { Animated, Box, Face, Geometry, Key, Layer, Paint, SceneNode } from "../model/ir";
import type { Mix } from "../model/steps";
import type { Anim } from "./track";
import { changesOf, flatten, isCount, placed, type TextContent, type Tick } from "./count";
import { advancesIn, layoutRuns, setRun } from "./text";

/**
 * How typed() cuts text into what it shows one at a time: the units, in order, which join back into the text.
 * `chars` and `words` are two; any function that keeps that promise is another.
 */
export type Split = (text: string) => readonly string[];

const graphemes = new Intl.Segmenter(undefined, { granularity: "grapheme" });

/** One character at a time: a grapheme, so an emoji with its skin tone or a letter with its accent is one keystroke. */
export const chars: Split = (text) => Array.from(graphemes.segment(text), (part) => part.segment);

/** One word at a time, with the spaces after it. */
export const words: Split = (text) => text.match(/\s+|\S+\s*/g) ?? [];

export interface Caret {
  /** Blink while nothing is typed, as a text field's caret does. Default true. */
  readonly blink?: boolean;
  /** How visible the caret is, on top of its blinking: a track turns it on and off with focus. */
  readonly opacity?: Anim<number>;
}

export interface TypedOptions {
  /** What it types one at a time. Default `chars`. */
  readonly by?: Split;
  /** A caret after the last thing shown. Default false. */
  readonly caret?: boolean | Caret;
}

export interface Typed {
  readonly kind: "typed";
  readonly value: Anim<string>;
  readonly by: Split;
  readonly caret: Caret | undefined;
}

/**
 * Text that is typed out as a string track moves: each `.to(next, span(…))` erases back to what the two strings share,
 * then types the rest, a unit at a time (`by`: `chars`, `words` or a split of your own), the span's curve pacing them.
 * A string track's steps are linear unless given a curve.
 *
 *     const title = track("").to("Save drafts", span(0.2, 1)).to("Save offline", span(2, 0.8));
 *     <Text font={inter} size={14} fill={ink}>{typed(title, { by: words, caret: true })}</Text>
 */
export const typed = (value: Anim<string>, { by = chars, caret }: TypedOptions = {}): Typed => {
  if (!(by instanceof Function))
    throw new SceneError(
      `typed() takes a split for by, as in { by: words }, got ${JSON.stringify(by)}.`,
      "Use chars or words from svjeez, or a function from a string to the units it is typed in.",
    );

  return {
    kind: "typed",
    value,
    by,
    caret: caret === true ? {} : caret === false || caret === undefined ? undefined : caret,
  };
};

export const isTyped = (value: unknown): value is Typed =>
  typeof value === "object" && value !== null && "kind" in value && value.kind === "typed";

/** Where each unit of `text` ends, in UTF-16 code units, after checking the units are the text. */
const endsOf = (text: string, by: Split, where: string): number[] => {
  const units = by(text);

  if (units.join("") !== text || units.some((unit) => unit === ""))
    throw new SceneError(
      `${where} types ${JSON.stringify(text)} by a split that cuts it into ${JSON.stringify(units)}, which isn't the text in pieces.`,
      "A split returns the units of the text in order, none empty, so they join back into it.",
    );
  let end = 0;

  return units.map((unit) => (end += unit.length));
};

/** How much of `a` and `b` is the same, in whole characters, as a length into both. */
const sharedOf = (a: string, b: string): number => {
  const [left, right] = [chars(a), chars(b)];
  let length = 0;

  for (let i = 0; i < left.length && left[i] === right[i]; i++) length += left[i]!.length;

  return length;
};

/**
 * What an edit from `from` to `to` shows after each keystroke: `from` erased a unit at a time back to what the two share,
 * then `to` typed out from there. The last one is `to`.
 */
export const editOf = (from: string, to: string, by: Split, where = "typed()"): string[] => {
  const shared = sharedOf(from, to);

  const erased = endsOf(from, by, where)
    .filter((end) => end > shared && end < from.length)
    .reverse()
    .map((end) => from.slice(0, end));

  const typedOut = endsOf(to, by, where)
    .filter((end) => end > shared)
    .map((end) => to.slice(0, end));

  return [...erased, ...(shared < from.length ? [from.slice(0, shared)] : []), ...typedOut];
};

/** The text partway through an edit, `amount` of its keystrokes in, so a track of strings can be read at any time. */
export const typing = (by: Split): Mix<string> => {
  const edits = new Map<string, string[]>();

  return (from, to, amount, where) => {
    if (from === to || !(amount > 0)) return from;
    const id = `${from}\0${to}`;
    const steps = edits.get(id) ?? editOf(from, to, by, where);

    edits.set(id, steps);
    const done = Math.floor(Math.min(1, amount) * steps.length + 1e-9);

    return done === 0 ? from : steps[done - 1]!;
  };
};

/** The strings a <Text> types: what it holds before its typed() (which is last), and the typed() itself. */
export interface Typing {
  readonly before: string;
  readonly typed: Typed;
}

export const typingIn = (content: TextContent, where: string): Typing | undefined => {
  const items = flatten(content);
  const found = items.filter(isTyped);

  if (found.length === 0) return undefined;

  if (found.length > 1)
    throw new SceneError(
      `${where} holds ${found.length} typed()s, and a <Text> types one string.`,
      "Make one track go through each edit in turn, or give each its own <Text>.",
    );
  const at = items.indexOf(found[0]!);

  if (at !== items.length - 1)
    throw new SceneError(
      `${where} has words after its typed(), which would move as it types.`,
      "Put typed() last, and the words after it in a <Text> of their own.",
    );

  const before = items.slice(0, at);

  if (!before.every((item): item is string => typeof item === "string"))
    throw new SceneError(
      before.some(isCount)
        ? `${where} both counts and types. A <Text> does one or the other.`
        : `${where} types, so it holds strings before its typed() and no <Run>s.`,
      "Style the whole <Text>, or put the styled words in a <Text> beside it.",
    );

  return { before: before.join(""), typed: found[0]! };
};

/** Every change of the typed text over the scene, from the lane its track lowered to. */
export const typedTicks = (
  value: Animated<string>,
  by: Split,
  duration: Seconds,
  where: string,
): Tick[] => {
  const mix = typing(by);

  const show = (t: Seconds): string =>
    valueAt(value, t, (a, b, amount) => mix(a, b, amount, where));

  const ticks = changesOf(show, duration, 1 / 1000);

  for (const { text } of ticks)
    if (/[\r\n]/.test(text))
      throw new SceneError(
        `${where} types ${JSON.stringify(text)}, and typed text is one line.`,
        "Give each line a <Text> of its own.",
      );

  return ticks;
};

export interface TypedLook {
  readonly key: string;
  readonly where: string;
  readonly font: Font;
  readonly face: Face;
  readonly size: number;
  readonly spacing: number;
  readonly fill: (box: Box) => Animated<Paint>;
  /** The caret's own opacity, lowered, when it has one. */
  readonly caret?: Animated<number>;
}

export interface TypedNodes {
  readonly box: Box;
  readonly baseline: number;
  readonly node: SceneNode;
}

/** Half a blink: the caret is on this long, then off this long, while nothing is typed. */
const BLINK = 0.5;

export const still = (opacity: Animated<number>): Layer => ({
  offset: [0, 0],
  rotate: 0,
  scale: [1, 1],
  skew: 0,
  opacity,
});

/** Keys that hold each value from its time until the next, dropping repeats. */
export const stepped = (values: readonly { t: Seconds; value: number }[]): Animated<number> => {
  const keys: Key<number>[] = [];

  for (const { t, value } of values) {
    const last = keys.at(-1);

    if (last?.value === value) continue;
    keys.push(last ? { t, value, ease: ease.hold } : { t, value });
  }

  const [first, second, ...rest] = keys;

  return second ? { kind: "lane", keys: [first!, second, ...rest] } : first!.value;
};

/** A clip that steps to each right edge at its time, held between them. */
const steppedClip = (
  rights: readonly { t: Seconds; right: number }[],
  window: (right: number) => Geometry,
): Animated<Geometry> => {
  const keys: Key<Geometry>[] = [];
  let last: number | undefined;

  for (const { t, right } of rights) {
    if (right === last) continue;
    keys.push(
      last === undefined
        ? { t, value: window(right) }
        : { t, value: window(right), ease: ease.hold },
    );
    last = right;
  }

  const [first, second, ...rest] = keys;

  return second ? { kind: "lane", keys: [first!, second, ...rest] } : first!.value;
};

/** On while typing, and blinking off and on from half a blink after each keystroke until the next. */
const blinking = (ticks: readonly Tick[], duration: Seconds): Animated<number> => {
  const values: { t: Seconds; value: number }[] = [];

  ticks.forEach(({ t }, i) => {
    const until = ticks[i + 1]?.t ?? duration;

    values.push({ t, value: 1 });

    for (let k = 1; t + k * BLINK < until - 1e-6; k++)
      values.push({ t: Math.round((t + k * BLINK) * 1e4) / 1e4, value: k % 2 === 1 ? 0 : 1 });
  });

  return stepped(values);
};

/**
 * The longest texts the ticks show, and which of them each tick shows the start of. A tick keeps the text the one before
 * it showed while it can, else takes the one it is typing toward, so an edit switches texts where the two read the same.
 */
interface Branches {
  /** The longest texts shown, none the start of another. */
  readonly texts: readonly string[];
  /** For each tick, the index of the text it shows the start of. */
  readonly shows: readonly number[];
}

const branchesOf = (ticks: readonly Tick[]): Branches => {
  const all = [...new Set(ticks.map((tick) => tick.text))];

  const texts = all.filter(
    (text) => !all.some((other) => other !== text && other.startsWith(text)),
  );

  const shows: number[] = [];

  ticks.forEach(({ text }, i) => {
    const fits = texts.flatMap((full, b) => (full.startsWith(text) ? [b] : []));
    const last = shows.at(-1);

    if (last !== undefined && fits.includes(last)) {
      shows.push(last);

      return;
    }

    const reached = (b: number): number => {
      const at = ticks.findIndex((tick, j) => j >= i && tick.text === texts[b]);

      return at < 0 ? Infinity : at;
    };

    shows.push(fits.reduce((best, b) => (reached(b) < reached(best) ? b : best)));
  });

  return { texts, shows };
};

/**
 * A typing <Text> as nodes: each longest text it shows is drawn once, whole, and clipped to as much of it as is typed,
 * the clip stepping from keystroke to keystroke. Texts that share a start draw it in the same place, so an edit that
 * erases back to it and types something else switches from one to the other without a glyph moving. A caret, when asked
 * for, steps to the end of the text.
 */
export const typedNodes = (
  look: TypedLook,
  { before, typed: { caret } }: Typing,
  ticks: readonly Tick[],
  duration: Seconds,
): TypedNodes => {
  const { key, where, font, face, size, spacing, fill } = look;
  const piece = (text: string) => ({ text, face: font, style: undefined, spacing });
  const probe = layoutRuns(font, [piece("0")], { size }, where);
  const top = probe.lines[0]!.at[1];
  const height = probe.box.height;

  const widths = new Map<string, number>();

  const width = (text: string): number => {
    const known = widths.get(text);

    if (known !== undefined) return known;
    // Summed, not laid out: a line drops the spaces it ends with, and the next word goes after them.
    const measured = advancesIn(piece(text), size, where).reduce((sum, each) => sum + each, 0);

    widths.set(text, measured);

    return measured;
  };

  const thick = Math.max(1, Math.round(size * 0.08 * 100) / 100);
  const reach = Math.max(width(before), ...ticks.map(({ text }) => width(before + text)));
  const box: Box = { x: 0, y: 0, width: reach + (caret ? thick : 0), height };
  const paint = fill(box);
  const { texts, shows } = branchesOf(ticks);
  // Room above and below the line for glyphs that reach past it. The clip starts at the text's start, so each step is
  // the one rectangle stretched across, which a backend can write as a scale.
  const down = size / 2;

  const window = (right: number): Geometry => ({
    kind: "points",
    points: [
      [0, -down],
      [right, -down],
      [right, height + down],
      [0, height + down],
    ],
    closed: true,
  });

  const words = texts.map((text, b): SceneNode => {
    const run = setRun(piece(before + text), [0, top], size, where);

    const rights = ticks.map(({ t, text: shown }, i) => ({
      t,
      right: shows[i] === b ? Math.round(width(before + shown) * 1000) / 1000 : 0,
    }));

    return {
      kind: "text",
      key: texts.length === 1 ? `${key}/words` : `${key}/words${b + 1}`,
      box,
      at: [0, 0],
      origin: [0, 0],
      layers: [],
      effects: [],
      clip: steppedClip(rights, window),
      size,
      lines: [
        {
          at: [0, top],
          runs: [
            {
              text: run.text,
              at: run.at,
              advances: run.advances,
              ...(spacing && { letterSpacing: spacing }),
              face,
              fill: paint,
              ...(run.outline && { outline: run.outline }),
            },
          ],
        },
      ],
    };
  });

  const cursor: SceneNode[] = caret
    ? [
        {
          kind: "shape",
          key: `${key}/caret`,
          box: { x: 0, y: 0, width: thick, height },
          at: placed(ticks, (text) => [width(before + text), 0]),
          origin: [0, 0],
          layers: [
            ...(caret.blink === false ? [] : [still(blinking(ticks, duration))]),
            ...(look.caret === undefined ? [] : [still(look.caret)]),
          ],
          effects: [],
          geometry: {
            kind: "points",
            points: [
              [0, 0],
              [thick, 0],
              [thick, height],
              [0, height],
            ],
            closed: true,
          },
          fill: paint,
        },
      ]
    : [];

  return {
    box,
    baseline: top,
    node: {
      kind: "group",
      key: `${key}/typed`,
      box,
      at: [0, 0],
      origin: [0, 0],
      layers: [],
      effects: [],
      children: [...words, ...cursor],
    },
  };
};

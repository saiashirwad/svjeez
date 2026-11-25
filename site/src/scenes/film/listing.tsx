import { Code, tsx } from "@svjeez/code";
import {
  Shape,
  Text,
  ease,
  morph,
  rect,
  span,
  track,
  type SceneElement,
  type Span,
  type Vec,
} from "svjeez";
import { Pivot } from "../blip";
import { geistCode } from "./palette";
import { STAGE, mono, spring, theme } from "./kit";

/** The label's row above the code, how far a highlight reaches past the code on each side, and the line height. */
const LABEL = 40;
const BLEED = 10;
const LEADING = 1.5;

/** Geist Mono's advance, as a share of the font size. */
const ADVANCE = 0.6;

/** The room every state of a listing takes at a font size: its label, and its longest and tallest code. */
const panelOf = (states: readonly string[], size: number): Vec => {
  const lines = states.map((source) => source.split("\n"));
  const longest = Math.max(...lines.flat().map((text) => text.length));
  const tallest = Math.max(...lines.map((rows) => rows.length));

  return [longest * size * ADVANCE, LABEL + (tallest - 1) * size * LEADING + size];
};

/** A short name for a line's text: keys only take letters, digits, - and _. */
const hash = (text: string): string =>
  [...text]
    .reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) | 0, 7)
    .toString(36)
    .replace("-", "n");

/** One key per line: its text, and how many times that text came before, so repeated lines stay apart. */
const keysOf = (source: string): string[] => {
  const seen = new Map<string, number>();

  return source.split("\n").map((text) => {
    const n = seen.get(text) ?? 0;

    seen.set(text, n + 1);

    return `line-${hash(text)}-${n}`;
  });
};

/** The first line that differs between two states, which an edit's flash sits on. */
const changed = (before: string, after: string): number => {
  const [a, b] = [before.split("\n"), after.split("\n")];

  return b.findIndex((text, i) => text !== a[i]);
};

export interface ListingProps {
  readonly name: string;
  /** The file at each step: the first is shown from the start. */
  readonly states: readonly string[];
  /** When each later state comes in. */
  readonly steps: readonly Span[];
  /** How many of the steps are edits, made after the listing has stepped aside. */
  readonly edits: number;
  /** The panel while the code is written, then where it steps aside to, and when. */
  /** The font size. The panel is sized to the code, and centered on the stage unless given a place. */
  readonly size: number;
  readonly full?: {
    readonly at?: Vec;
    readonly scale?: number;
    /** A box to fit the listing into, against its left edge and centered top to bottom, in place of at and scale. */
    readonly box?: readonly [number, number, number, number];
  };
  /** The box the listing steps aside into once written, if it does: it scales to fit it, against its left edge. */
  readonly aside?: { readonly box: readonly [number, number, number, number]; readonly when: Span };
  /** A highlight that steps from line to line, a line (counting from 0) at each time: what is running now. */
  readonly trace?: readonly { readonly line: number; readonly at: number }[];
}

export const Listing = ({
  name,
  states,
  steps,
  edits,
  size,
  full = {},
  aside,
  trace = [],
}: ListingProps): SceneElement => {
  const [w, h] = panelOf(states, size);
  const row = size * LEADING;
  const boxed = full.box && Math.min(full.box[2] / w, full.box[3] / h);
  const scale = boxed ?? full.scale ?? 1;

  const at: Vec =
    full.box && boxed !== undefined
      ? [full.box[0], full.box[1] + (full.box[3] - h * boxed) / 2]
      : (full.at ?? [STAGE.x + (STAGE.w - w) / 2, STAGE.y + (STAGE.h - h) / 2]);

  const fit = aside && Math.min(aside.box[2] / w, aside.box[3] / h);

  const tucked: Vec | undefined =
    aside && fit !== undefined
      ? [aside.box[0], aside.box[1] + (aside.box[3] - h * fit) / 2]
      : undefined;

  const moved = aside && tucked ? track<Vec>(at).to(tucked, aside.when, spring) : at;
  const scaled = aside && fit !== undefined ? track(scale).to(fit, aside.when, ease.inOut) : scale;

  const flashes = steps.slice(-edits || steps.length).map((when, i) => {
    const index = steps.length - edits + i;

    return { when, line: changed(states[index]!, states[index + 1]!) };
  });

  /** Where a highlight sits behind a line. */
  const { ascent, descent } = mono.metrics;
  const middle = ((ascent + descent) / 2) * size;
  const behind = (index: number): Vec => [-BLEED, LABEL + index * row + middle - row / 2];
  const bar = rect(w + 2 * BLEED, row, { radius: 6 });

  const code = (source: string): SceneElement => (
    <Code
      lang={tsx}
      font={mono}
      size={size}
      lineHeight={LEADING}
      palette={geistCode}
      keys={keysOf(source)}
      at={[0, LABEL]}
    >
      {source}
    </Code>
  );

  return (
    <Pivot around={[0, 0]} at={[0, 0]} motion={[{ offset: moved }, { scale: scaled }]}>
      <Text
        font={mono}
        size={13}
        letterSpacing={1.2}
        at={[0, 12]}
        anchor="baseline-left"
        fill={theme.faint}
      >
        {name.toUpperCase()}
      </Text>
      {edits > 0 &&
        flashes.map(({ when, line: index }) => (
          <Shape
            geometry={bar}
            at={behind(index)}
            fill={theme.blue}
            opacity={track(0)
              .to(0.14, span(when.start, 0.15))
              .to(0, span(when.start + 1.1, 0.5))}
          />
        ))}
      {trace.length > 0 && (
        <Shape
          geometry={bar}
          at={trace
            .slice(1)
            .reduce(
              (t, { line: index, at: when }) => t.to(behind(index), span(when, 0.25), ease.inOut),
              track<Vec>(behind(trace[0]!.line)),
            )}
          fill={theme.blue}
          opacity={track(0).to(0.14, span(trace[0]!.at, 0.2))}
        />
      )}
      {states.length === 1
        ? code(states[0]!)
        : morph.between(states.map(code), steps, {
            curve: steps.every(({ over }) => over >= spring.settle) ? spring : ease.out,
          })}
    </Pivot>
  );
};

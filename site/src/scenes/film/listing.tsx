import { Code } from "@svjeez/code";
import {
  Shape,
  Text,
  ease,
  line,
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

// Code that writes itself the way a person (or an agent) does: not letter by letter, but a node, a call or an argument
// at a time. Each state is the whole file; lines that stay are keyed by their text, so they slide apart to make room,
// and lines that are new or changed fade in where they land. Then the listing steps aside to make room for what it
// draws, and later states are edits: the changed line flashes as it swaps.

/** The strip on top, the padding on every side of the code, and the line height, as a share of the font size. */
const BAR = 44;
const PAD = 24;
const LEADING = 1.5;

/** Geist Mono's advance, as a share of the font size. */
const ADVANCE = 0.6;

/** The panel that holds every state of a listing at a font size, with the same padding on every side. */
const panelOf = (states: readonly string[], size: number): Vec => {
  const lines = states.map((source) => source.split("\n"));
  const longest = Math.max(...lines.flat().map((text) => text.length));
  const tallest = Math.max(...lines.map((rows) => rows.length));

  return [
    longest * size * ADVANCE + 2 * PAD,
    BAR + 2 * PAD + (tallest - 1) * size * LEADING + size,
  ];
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
  readonly full?: { readonly at?: Vec; readonly scale?: number };
  /** Where the listing steps aside to once written, if it does. */
  readonly aside?: { readonly at: Vec; readonly scale: number; readonly when: Span };
}

export const Listing = ({
  name,
  states,
  steps,
  edits,
  size,
  full = {},
  aside,
}: ListingProps): SceneElement => {
  const [w, h] = panelOf(states, size);
  const bar = BAR;
  const row = size * LEADING;
  const scale = full.scale ?? 1;
  const at = full.at ?? [STAGE.x + (STAGE.w - w) / 2, STAGE.y + (STAGE.h - h) / 2];
  const moved = aside ? track<Vec>(at).to(aside.at, aside.when, spring) : at;
  const scaled = aside ? track(scale).to(aside.scale, aside.when, ease.inOut) : scale;

  const flashes = steps.slice(-edits || steps.length).map((when, i) => {
    const index = steps.length - edits + i;

    return { when, line: changed(states[index]!, states[index + 1]!) };
  });

  return (
    <Pivot around={[0, 0]} at={[0, 0]} motion={[{ offset: moved }, { scale: scaled }]}>
      <Shape
        geometry={rect(w, h, { radius: 12 })}
        fill={theme.surface}
        stroke={{ color: theme.line, width: 1 }}
      />
      <Shape geometry={line([0, bar], [w, bar])} stroke={{ color: theme.line, width: 1 }} />
      <Text font={mono} size={15} at={[22, bar / 2]} anchor="left" fill={theme.muted}>
        {name}
      </Text>
      {edits > 0 &&
        flashes.map(({ when, line: at }) => (
          <Shape
            geometry={rect(w - PAD, row, { radius: 6 })}
            at={[PAD / 2, bar + PAD + at * row - (row - size) / 2]}
            fill={theme.blue}
            opacity={track(0)
              .to(0.14, span(when.start, 0.15))
              .to(0, span(when.start + 1.1, 0.5))}
          />
        ))}
      {morph.between(
        states.map((source) => (
          <Code
            lang="tsx"
            font={mono}
            size={size}
            lineHeight={LEADING}
            palette={geistCode}
            keys={keysOf(source)}
            at={[PAD, bar + PAD]}
          >
            {source}
          </Code>
        )),
        steps,
        { curve: steps.every(({ over }) => over >= spring.settle) ? spring : ease.out },
      )}
    </Pivot>
  );
};

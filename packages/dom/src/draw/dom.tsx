/** @jsxImportSource svjeez */
/** @jsxRuntime automatic */
import {
  ease as eases,
  type Ease,
  type FontValue,
  type Stack,
  type SvgNode,
  type TagChannels,
} from "svjeez";
import { num } from "svjeez/geometry";
import { duration, timeline, type Step } from "../timeline.ts";
import type { Snapshot, TextRun } from "../tree.ts";
import type { PairBy } from "./pairing.ts";
import { painter, type GroupStack, type Parts } from "./painter.tsx";
import { runsByFamily } from "./faces.ts";
import { hold } from "./hold.ts";
import type { Tween } from "./tween.ts";

export interface DomProps {
  /** One snapshot draws statically. Several play in order, each turning into the next, with waits between. */
  readonly states: Snapshot | readonly Step[];
  /** The fonts the page used, so the drawn text matches the layout. */
  readonly fonts?: readonly FontValue[];
  /** The ease of a move whose step has none. Default `ease.inOut`. */
  readonly ease?: Ease;
  /** Motions by part. A function gets each element with that part, in document order. */
  readonly parts?: Parts;
  /** Runs on every text line, as in `(run, i) => enter(...)`. Only on a single snapshot. */
  readonly text?: (run: TextRun, index: number) => Stack<TagChannels<"text">> | undefined;
  /** Overrides how elements pair across states: boxes that get the same string pair, whatever their tag. */
  readonly pair?: PairBy;
  readonly x?: number;
  readonly y?: number;
  readonly animation?: GroupStack;
}

const at = (x: number, y: number) => (x || y ? `translate(${num(x)} ${num(y)})` : undefined);

/**
 * Draws snapshots as svjeez nodes: one `<g>` per element, text in the page's own fonts. With several states, each
 * turns into the next. Paired boxes reshape and recolor, paired text and icons slide (crossfading when they changed),
 * and the rest fade out or in. Time starts at 0 on the clock around it, so a `<Clip at>` places a whole flow.
 *
 * Transition `i` is one two-state drawing, shown from the middle of the gap before it to the middle of the gap after,
 * so only one is up at a time and the cut between two shows the same picture on both sides.
 */
export function Dom({
  states,
  fonts = [],
  ease = eases.inOut,
  parts = {},
  text,
  pair,
  x = 0,
  y = 0,
  animation,
}: DomProps): SvgNode {
  const { snaps, moves } = timeline(states);

  // The runs each family draws, so a given font the page set without ligatures can cut down to its glyphs.
  const drawn = new Map<string, TextRun[]>();

  for (const s of snaps) runsByFamily(s.root, drawn);

  const paint = painter(
    fonts,
    snaps.flatMap((s) => s.fonts ?? []),
    parts,
    pair,
    drawn,
  );

  if (snaps.length === 0) throw new Error("<Dom> needs at least one state.");

  let segments: SvgNode[];

  if (snaps.length === 1) {
    let lines = 0;

    segments = [paint.root(snaps[0]!.root, undefined, text && ((run) => text(run, lines++)))];
  } else {
    if (text) throw new Error("<Dom text> works on a single snapshot, not on states.");

    const tweens: Tween[] = moves.map((m) => ({ at: m.at, over: m.over, ease: m.ease ?? ease }));

    // Where each hand-over happens: halfway between one transition's end and the next one's start.
    const cuts = tweens.slice(1).map((next, i) => (tweens[i]!.at + tweens[i]!.over + next.at) / 2);

    const drawings = tweens.map((tween, i) =>
      paint.root(snaps[i + 1]!.root, { a: snaps[i]!.root, tween }),
    );

    // Transitions `from` through `to` show from the cut before the first to the cut after the last.
    // The same transitions drawn shape by shape, as one drawing each: what holding must not run more animations than.
    const plain = tweens.map((tween, i) =>
      paint.root(snaps[i + 1]!.root, { a: snaps[i]!.root, tween }, undefined, false),
    );

    segments = hold(
      drawings,
      plain,
      (from, to) => {
        const start = from === 0 ? 0 : cuts[from - 1]!;

        if (to === cuts.length) return start === 0 ? undefined : { at: start };

        return { at: start, over: cuts[to]! - start };
      },
      duration(states),
    );
  }

  return (
    <g transform={at(x, y)} animation={animation}>
      {paint.style()}
      {segments}
    </g>
  );
}

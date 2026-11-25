import { ease, morph, span, type Curve, type SceneElement, type Span, type Vec } from "svjeez";
import { expand, type Theme } from "svjeez/tools";
import type { Run, Snapshot } from "../schema.ts";
import type { State } from "../record.ts";
import { element } from "./box.tsx";
import { context, withTheme, type Diagnostic } from "./context.ts";
import { withCursor, type Beat } from "./cursor.tsx";
import { normalize } from "./normalize.ts";
import { pair, type PairBy, type Paired } from "./pair.ts";
import { face } from "./text.tsx";
import { typeInFields, typings, type TextPolicy } from "./typing.ts";
import { animate, watchFor, type Slot } from "./waapi.ts";

const DEFAULT_HOLD = 0.8;

export type { Diagnostic } from "./context.ts";

export type { PairBy } from "./pair.ts";

export {
  fade,
  typeInFields,
  typing,
  type TextChange,
  type TextPolicy,
  type TextTransition,
  type TypingOptions,
} from "./typing.ts";

export interface CompileOptions {
  /** Seconds a move between states takes unless the state says. Default 0.6. */
  readonly over?: number;
  /**
   * Seconds a state rests before the next move unless it says. Default 0.8, or, for one Snapshot with running animations,
   * as long as they need to be seen: the longest one still to run, or a cycle of an endless one.
   */
  readonly hold?: number;
  /** The easing of a move unless the state says: any `Curve` (`ease.out`, `ease.spring()`, ...). Default `ease.inOut`. */
  readonly ease?: Curve;
  /**
   * Names an element so it is the same thing in every state: it keeps its identity and moves, where an unnamed one is matched by place and wording.
   * Return undefined to leave it to `data-key`, the framework identity, `data-part`, `id`, then matching.
   */
  readonly pairBy?: PairBy;
  /**
   * The tokens the page paints with, as `tokens()` makes them, captured in both schemes: each color that a token, a mix of
   * two at a whole percent, or either at an alpha makes in both schemes is drawn with them, so restyling the tokens
   * restyles the scene. Other colors stay as captured.
   */
  readonly theme?: Theme;
  /** How text that changes between states gets there, unless the state says (`Timing.text`). Default `typeInFields`. */
  readonly text?: TextPolicy;
}

export interface Compiled {
  /** The page as core scene elements, with the root's top-left corner at [0, 0]. With several states, the states morphing one into the next. */
  readonly element: SceneElement;
  /** The border box of the root, or the largest of the roots: the scene to draw it in. */
  readonly size: readonly [width: number, height: number];
  /** Seconds the states take: every hold, and every move between them. Use it as the scene's duration. */
  readonly duration: number;
  /** Everything that was approximated or left out. */
  readonly diagnostics: readonly Diagnostic[];
}

/** The paths of the elements that clip. */
const pathsOf = ({ node, children }: Paired, path: string, into: Set<string>): void => {
  if (node.type === "element" && node.clip) into.add(path);

  for (const child of children) pathsOf(child, `${path}/${child.key}`, into);
};

/**
 * Compiles a Snapshot to core scene elements: groups, shapes, text and pictures, nothing a backend has to guess at.
 *
 * Given states (see `record`), the page is shown as the first, moves into the second over `over` seconds, rests for `hold`, and so on.
 * Elements are paired across states (see `pair`), and core's `morph.between()` does the blending: what a pair shares moves,
 * resizes and recolors, text crossfades (or is typed, see `Timing.text`), and what has no pair fades in or out.
 *
 *     const { element, size, duration } = compile(await inlineAssets(await record(page, "#app", run)));
 */
export const compile = (
  input: Snapshot | readonly State[],
  options: CompileOptions = {},
): Compiled => withTheme(options.theme, () => compileStates(input, options));

const compileStates = (
  input: Snapshot | readonly State[],
  {
    over = 0.6,
    hold,
    ease: easing = ease.inOut,
    pairBy,
    text: policy = typeInFields,
  }: CompileOptions,
): Compiled => {
  const states: readonly State[] = "root" in input ? [{ name: "", snapshot: input }] : input;

  if (states.length === 0) throw new Error("compile needs a Snapshot, or at least one state.");

  const snapshots = states.map((state) => state.snapshot);
  const { roots, diagnostics: moves } = pair(snapshots, pairBy);

  const clips = new Set<string>();

  for (const root of roots) pathsOf(root, root.key, clips);

  const single = states.length === 1;

  const resting =
    hold ??
    (single ? Math.max(DEFAULT_HOLD, ...roots.map(({ node }) => watchFor(node))) : DEFAULT_HOLD);

  const ctx = context(
    snapshots.flatMap((snapshot) => snapshot.fonts ?? []),
    single ? new Set() : clips,
  );

  for (const { path, what } of moves) ctx.note(path, what);

  const spans: Span[] = [];
  const curves: Curve[] = [];
  const slots: Slot[] = [];
  const eases: (Curve | undefined)[] = [];
  let duration = 0;

  states.forEach((state, i) => {
    const start = duration;
    const length = i > 0 ? (state.over ?? over) : 0;

    if (i > 0) {
      spans.push(span(duration, length));
      curves.push(state.ease ?? easing);
      duration += length;
    }

    duration += state.hold ?? resting;
    slots.push({ start, over: length, end: duration });
    eases.push(i > 0 ? curves.at(-1) : undefined);
  });

  const measurable = (run: Run) => face(ctx, run.font).measurable;

  for (const [path, typing] of typings(roots, states, spans, policy, measurable))
    ctx.typings.set(path, typing);

  for (const [path, motion] of animate(roots, slots, eases, ctx)) ctx.motions.set(path, motion);

  const trees = roots.map((root) =>
    expand(element(root, [root.node.rect.x, root.node.rect.y], root.key, ctx)),
  );

  const sizes = roots.map(({ node }) => node.rect);

  const page =
    trees.length === 1 ? trees[0]! : morph.between(normalize(trees), spans, { curve: curves });

  const beats = states.map(({ pointer, snapshot: { root } }, i): Beat => {
    const local = ([x, y]: readonly [number, number]): Vec => [x - root.rect.x, y - root.rect.y];
    const { start, over, end } = slots[i]!;
    const before = slots[i - 1];

    return {
      ...(pointer && {
        pointer: {
          at: local(pointer.at),
          down: pointer.down,
          presses: pointer.presses.map(local),
        },
      }),
      start,
      over,
      end,
      rest: before ? before.end - before.start - before.over : 0,
      curve: eases[i],
    };
  });

  return {
    element: expand(withCursor(page, beats)),
    size: [
      Math.max(...sizes.map(({ width }) => width)),
      Math.max(...sizes.map(({ height }) => height)),
    ],
    duration,
    diagnostics: ctx.diagnostics,
  };
};

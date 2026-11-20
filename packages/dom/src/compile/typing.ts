import {
  chars,
  span,
  track,
  typed,
  type Anim,
  type Span,
  type Split,
  type Track,
  type Typed,
} from "svjeez";
import type { ElementNode, Run, TextNode } from "../schema.ts";
import type { State } from "../record.ts";
import { isElement, type Paired } from "./pair.ts";

/** A text that changes from one state to the next, and what the compiler knows of the element it is in. */
export interface TextChange {
  /** The text before the move, empty for a field that showed its placeholder. */
  readonly from: string;
  /** The text after it. */
  readonly to: string;
  /** The state the move goes into. */
  readonly state: string;
  /** The element's tag, as in "input". */
  readonly tag: string;
  /** Its `data-part`, if it has one. */
  readonly part?: string;
  /** It is an `<input>` or a `<textarea>`. */
  readonly field: boolean;
  /** It has focus before or after the move: it is being typed in. */
  readonly focused: boolean;
}

/** How a changed text gets from one state to the next: typed out (see `typing`), or crossfaded (`fade`). */
export type TextTransition =
  | { readonly kind: "typing"; readonly by: Split }
  | { readonly kind: "fade" };

/** Picks the transition for each text that changes in a move. Undefined crossfades it. */
export type TextPolicy = (change: TextChange) => TextTransition | undefined;

export interface TypingOptions {
  /** What is typed one at a time: `chars` (the default), `words`, or a split of your own, as typed() takes. */
  readonly by?: Split;
}

/** Erase back to what the two texts share, then type the rest, over the move. */
export const typing = ({ by = chars }: TypingOptions = {}): TextTransition => ({
  kind: "typing",
  by,
});

/** Crossfade the old text into the new one. */
export const fade: TextTransition = { kind: "fade" };

/** The default policy: what changes in a focused `<input>` or `<textarea>` is typed a character at a time, the rest fades. */
export const typeInFields: TextPolicy = ({ field, focused }) =>
  field && focused ? typing() : fade;

/** A text node that is typed from state to state, rather than crossfaded: the same in every state that draws it. */
export interface Typing {
  /** What it types, on the scene's clock. */
  readonly text: Typed;
  /** The run it takes its font, size and color from. */
  readonly look: Run;
  /** The opacity of its placeholder: gone at the first keystroke, back once the text is erased. */
  readonly hint: Anim<number>;
}

interface Seen {
  readonly node: TextNode;
  readonly element: ElementNode;
}

const FIELDS = new Set(["input", "textarea"]);

/** Every text node of a state, by its path: the element path it is in, then its own key. */
const textsOf = (root: Paired<ElementNode>): Map<string, Seen> => {
  const out = new Map<string, Seen>();

  const visit = ({ node, children }: Paired<ElementNode>, path: string): void => {
    for (const kid of children)
      if (kid.node.type === "text")
        out.set(`${path}/${kid.key}`, { node: kid.node, element: node });
      else if (isElement(kid)) visit(kid, `${path}/${kid.key}`);
  };

  visit(root, root.key);

  return out;
};

/** Whether a node's one run can be typed: plain text drawn once, with nothing that hangs off its glyphs. */
const plain = (node: TextNode): Run | undefined => {
  const [only, ...more] = node.runs;

  return only && more.length === 0 && !only.rtl && !only.shadows && !only.decoration
    ? only
    : undefined;
};

const sameLook = (a: Run, b: Run): boolean =>
  JSON.stringify([a.font, a.color, a.letterSpacing]) ===
  JSON.stringify([b.font, b.color, b.letterSpacing]);

/**
 * The text nodes typed from state to state. A node types when the policy (the state's `text`, else `policy`) says to type
 * a change it shows, and it can: one run of plain text, in one font and color throughout, in a font svjeez can measure.
 * Its placeholder is not part of what it types. It types every change by the split of the first one typed.
 */
export const typings = (
  roots: readonly Paired<ElementNode>[],
  states: readonly State[],
  spans: readonly Span[],
  policy: TextPolicy,
  measurable: (run: Run) => boolean,
): Map<string, Typing> => {
  const out = new Map<string, Typing>();
  const all = roots.map(textsOf);
  const paths = new Set(all.flatMap((texts) => [...texts.keys()]));

  for (const path of paths) {
    const seen = all.map((texts) => texts.get(path));
    const runs = seen.flatMap((one) => (one && !one.node.placeholder ? [plain(one.node)] : []));
    const look = runs[0];

    if (!look || runs.some((run) => !run || !sameLook(run, look)) || !measurable(look)) continue;

    // What each state shows: a placeholder is an empty field, and a state without the node keeps the text around it.
    const shown = seen.map((one) =>
      one ? (one.node.placeholder ? "" : one.node.runs[0]!.text) : undefined,
    );

    const texts = shown.map(
      (one, i) =>
        one ??
        shown.slice(0, i).findLast((each) => each !== undefined) ??
        shown.find((each) => each !== undefined)!,
    );

    const moves = texts.map((to, i): TextTransition | undefined => {
      const from = texts[i - 1];

      if (from === undefined || from === to) return undefined;
      const [before, after] = [seen[i - 1], seen[i]];
      const { tag, part } = (after ?? before)!.element;

      const change: TextChange = {
        from,
        to,
        state: states[i]!.name,
        tag,
        ...(part !== undefined && { part }),
        field: FIELDS.has(tag),
        focused: !!(before?.element.focused || after?.element.focused),
      };

      return (states[i]!.text ?? policy)(change) ?? fade;
    });

    const by = moves.find((move) => move?.kind === "typing");

    if (by?.kind !== "typing") continue;

    let value: Track<string> = track(texts[0]!);
    let hint: Track<number> = track(1);

    moves.forEach((move, i) => {
      if (!move) return;
      const { start, over } = spans[i - 1]!;

      value =
        move.kind === "fade"
          ? value.set(texts[i]!, span(start))
          : value.to(texts[i]!, span(start, over));

      const quick = Math.min(0.1, over);
      const [from, to] = [seen[i - 1]?.node.placeholder, seen[i]?.node.placeholder];

      if (from && !to) hint = hint.to(0, span(start, quick));

      if (!from && to) hint = hint.to(1, span(start + over - quick, quick));
    });

    const focus = seen.map((one) => (one?.element.focused ? 1 : 0));

    const opacity = focus.reduce<Track<number>>(
      (made, on, i) =>
        i > 0 && on !== focus[i - 1] ? made.set(on, span(spans[i - 1]!.start)) : made,
      track(focus[0]!),
    );

    const steady = seen.every((one) => !one || one.element.focused);
    const typedIn = seen.some((one) => one && FIELDS.has(one.element.tag) && one.element.focused);
    const caret = typedIn ? { caret: steady ? {} : { opacity } } : {};

    out.set(path, { text: typed(value, { by: by.by, ...caret }), look, hint });
  }

  return out;
};

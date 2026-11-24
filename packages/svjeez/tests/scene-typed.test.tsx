import { describe, expect, test } from "bun:test";
import {
  Run,
  Text,
  chars,
  ease,
  font,
  scene,
  span,
  track,
  typed,
  words,
  type SceneElement,
  type Split,
} from "svjeez";
import { check, isLane, svg, valueAt, type Model, type TextProps } from "svjeez/tools";
import { editOf, typing } from "../src/author/typed";
import { blendNumber } from "../src/model/sample";
import { mixVec } from "../src/model/steps";
import { fontFixture } from "../../../fixtures/fonts";

const mono = await font.load(fontFixture("JetBrainsMono"));

// JetBrains Mono is 0.6em wide everywhere, so at size 10 every character is 6 across.
const CHAR = 6;

const made = (build: () => SceneElement, duration = 4): Model.Scene =>
  scene({ size: [300, 40], duration, title: "Typed" }, build);

const typedText = (content: TextProps["children"], duration = 4) =>
  made(
    () => (
      <Text key="t" font={mono} size={10} fill="#000000">
        {content}
      </Text>
    ),
    duration,
  );

const groupOf = (model: Model.Scene) => {
  const node = model.root.kind === "group" ? model.root.children[0] : undefined;

  if (node?.kind !== "group" || !node.authored?.count) throw new Error("expected typed text");

  return node;
};

const ticksOf = (model: Model.Scene) => groupOf(model).authored!.count!.ticks;

const textsOf = (model: Model.Scene) => ticksOf(model).map((tick) => tick.text);

const partsOf = (model: Model.Scene) => {
  const [inner] = groupOf(model).children;

  if (inner?.kind !== "group") throw new Error("expected the typed group");
  const words = inner.children.filter((child) => child.kind === "text");
  const caret = inner.children.find((child) => child.kind === "shape");

  return { words, caret };
};

const held = <T,>(a: T): T => a;

/** What the clipped texts draw at `t`: each text up to where its clip ends. */
const drawnAt = (model: Model.Scene, t: number): string =>
  partsOf(model)
    .words.map((node) => {
      const clip = valueAt(node.clip!, t, held);

      if (clip.kind !== "points") throw new Error("expected a clip");
      const right = clip.points[1]![0];
      const [run] = node.lines[0]!.runs;
      let x = run!.at[0];

      return [...run!.text]
        .filter((_, i) => {
          x += run!.advances[i]!;

          return x <= right + 1e-6;
        })
        .join("");
    })
    .join("");

describe("edits", () => {
  test("a char is a grapheme, and a word keeps the spaces after it", () => {
    expect(chars("née 👍🏽!")).toEqual(["n", "é", "e", " ", "👍🏽", "!"]);
    expect(words("  Save drafts  now")).toEqual(["  ", "Save ", "drafts  ", "now"]);
  });

  test("erases back to what the two share, then types the rest", () => {
    expect(editOf("Save drafts", "Save on", chars)).toEqual([
      "Save draft",
      "Save draf",
      "Save dra",
      "Save dr",
      "Save d",
      "Save ",
      "Save o",
      "Save on",
    ]);
    expect(editOf("abc", "", chars)).toEqual(["ab", "a", ""]);
    expect(editOf("", "ab", chars)).toEqual(["a", "ab"]);
  });

  test("by word, a word types whole, and an edit inside a word erases it to the shared part", () => {
    expect(editOf("new", "new iss", words)).toEqual(["new ", "new iss"]);
    expect(editOf("Save drafts", "Save offline", words)).toEqual(["Save ", "Save offline"]);
    expect(editOf("one two", "one twelve", words)).toEqual(["one tw", "one twelve"]);
  });

  test("partway through, it shows as many keystrokes as the amount has passed", () => {
    const mix = typing(chars);

    expect(mix("ab", "ax", 0, "x")).toBe("ab");
    expect(mix("ab", "ax", 0.4, "x")).toBe("ab");
    expect(mix("ab", "ax", 0.5, "x")).toBe("a");
    expect(mix("ab", "ax", 0.99, "x")).toBe("a");
    expect(mix("ab", "ax", 1, "x")).toBe("ax");
    // A spring that overshoots holds the end.
    expect(mix("ab", "ax", 1.2, "x")).toBe("ax");
  });
});

describe("typed()", () => {
  test("types one character at a time, evenly by default, done at the end of its span", () => {
    const model = typedText(typed(track("").to("abcd", span(1, 2))));
    const ticks = ticksOf(model);

    expect(ticks.map((tick) => tick.text)).toEqual(["", "a", "ab", "abc", "abcd"]);
    expect(ticks.map((tick) => tick.t)).toEqual([0, 1.5, 2, 2.5, 3]);
    expect(drawnAt(model, 0.5)).toBe("");
    expect(drawnAt(model, 2.2)).toBe("ab");
    expect(drawnAt(model, 3.5)).toBe("abcd");
  });

  test("backspaces to the shared start, which stays put, then types on", () => {
    const title = track("").to("Save it", span(0, 1)).to("Save on", span(1.5, 1));
    const model = typedText(typed(title));

    expect(textsOf(model)).toEqual([
      "",
      "S",
      "Sa",
      "Sav",
      "Save",
      "Save ",
      "Save i",
      "Save it",
      "Save i",
      "Save ",
      "Save o",
      "Save on",
    ]);
    expect(drawnAt(model, 2.0)).toBe("Save ");
    expect(drawnAt(model, 3)).toBe("Save on");

    // Each longest text is drawn once, and "Save " sits in the same place in both.
    const { words } = partsOf(model);

    expect(words.map((node) => node.lines[0]!.runs[0]!.text)).toEqual(["Save it", "Save on"]);
    expect(words.map((node) => node.lines[0]!.runs[0]!.at[0])).toEqual([0, 0]);
  });

  test("by word, whole words appear", () => {
    const model = typedText(typed(track("").to("one two three", span(0, 1.5)), { by: words }));

    expect(textsOf(model)).toEqual(["", "one ", "one two ", "one two three"]);
    expect(drawnAt(model, 0.6)).toBe("one ");
  });

  test("a split of its own types in its own units", () => {
    // Two characters to a keystroke.
    const pairs: Split = (text) => text.match(/[^]{1,2}/gu) ?? [];
    const model = typedText(typed(track("").to("abcde", span(0, 1.5)), { by: pairs }));

    expect(textsOf(model)).toEqual(["", "ab", "abcd", "abcde"]);
  });

  test("the span's curve paces the keystrokes", () => {
    const even = ticksOf(typedText(typed(track("").to("abcd", span(0, 2)))));
    const slow = ticksOf(typedText(typed(track("").to("abcd", span(0, 2), ease.in))));

    expect(slow[1]!.t).toBeGreaterThan(even[1]!.t);
    expect(slow.at(-1)!.t).toBe(2);
  });

  test("set() swaps the text at once, and a loop types it again", () => {
    expect(textsOf(typedText(typed(track("ab").set("xyz", span(1)))))).toEqual(["ab", "xyz"]);

    const looped = typedText(typed(track("").to("ab", span(0, 0.5)).loop(1)), 3);

    expect(textsOf(looped)).toEqual(["", "a", "ab", "", "a", "ab", "", "a", "ab"]);
  });

  test("words before it stay where they are", () => {
    const model = typedText(["$ ", typed(track("").to("ls", span(0, 1)))]);

    expect(textsOf(model)).toEqual(["$ ", "$ l", "$ ls"]);
    expect(drawnAt(model, 0)).toBe("$ ");
    expect(drawnAt(model, 0.7)).toBe("$ l");
  });

  test("a caret sits after the text, and blinks while nothing is typed", () => {
    const model = typedText(typed(track("").to("abc", span(1, 1.5)), { caret: true }));
    const { caret } = partsOf(model);

    if (caret?.kind !== "shape") throw new Error("expected a caret");
    expect(valueAt(caret.at, 0.5, mixVec)[0]).toBe(0);
    expect(valueAt(caret.at, 3, mixVec)[0]).toBe(3 * CHAR);

    const blink = caret.layers[0]!.opacity;

    expect(isLane(blink)).toBe(true);
    // On while typing, off half a second after the last keystroke, on again half a second later.
    expect(valueAt(blink, 2.2, blendNumber)).toBe(1);
    expect(valueAt(blink, 2.7, blendNumber)).toBe(1);
    expect(valueAt(blink, 3.2, blendNumber)).toBe(0);
    expect(valueAt(blink, 3.7, blendNumber)).toBe(1);

    const steady = typedText(typed(track("").to("abc", span(1, 1.5)), { caret: { blink: false } }));

    expect(partsOf(steady).caret!.layers).toEqual([]);
    expect(partsOf(typedText(typed(track("").to("abc", span(1, 1.5))))).caret).toBeUndefined();
  });

  test("the caret takes an opacity of its own", () => {
    const shown = track(1).set(0, span(2));
    const model = typedText(typed("abc", { caret: { blink: false, opacity: shown } }));
    const { caret } = partsOf(model);

    expect(valueAt(caret!.layers[0]!.opacity, 1, blendNumber)).toBe(1);
    expect(valueAt(caret!.layers[0]!.opacity, 3, blendNumber)).toBe(0);
  });

  test("the box is as wide as the longest text it types", () => {
    const model = typedText(typed(track("").to("abcdef", span(0, 1)).to("ab", span(2, 1))));

    expect(groupOf(model).box.width).toBe(6 * CHAR);
  });

  test("it emits and checks clean", () => {
    const model = typedText(
      typed(track("").to("abc", span(0, 1)).to("", span(3, 0.5)), { caret: true }),
    );

    expect(svg.emit(model)).toContain('calcMode="discrete"');
    expect(check(model).problems.filter((finding) => finding.severity !== "info")).toEqual([]);
  });

  test("what it can't do, it says", () => {
    const t = typed(track("").to("ab", span(0, 1)));

    // SAFETY: a <Run> takes no typed() by its types, but a caller without types can pass one.
    expect(() => typedText(<Run>{t as never}</Run>)).toThrow("typed() goes straight in its <Text>");
    expect(() => typedText([t, t])).toThrow("holds 2 typed()s");
    expect(() => typedText([t, "!"])).toThrow("has words after its typed()");
    expect(() =>
      made(() => (
        <Text font={mono} size={10} fill="#000000" width={100}>
          {t}
        </Text>
      )),
    ).toThrow("typed text is one line, so it takes no width");
    expect(() => typedText(typed(track("").to("a\nb", span(0, 1))))).toThrow(
      "typed text is one line",
    );
    // SAFETY: a caller without types can pass anything.
    expect(() => typed("a", { by: "word" as never })).toThrow("takes a split for by");

    const lossy: Split = (text) => text.split(" ");

    expect(() => typedText(typed(track("").to("a b", span(0, 1)), { by: lossy }))).toThrow(
      "which isn't the text in pieces",
    );
  });
});

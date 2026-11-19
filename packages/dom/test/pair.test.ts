import { describe, expect, test } from "bun:test";
import { pair, type Paired } from "../src/compile/pair.ts";
import type { ElementNode } from "../src/index.ts";
import { box, snapshot, words } from "./fixtures.ts";

const item = (text: string, props: Partial<ElementNode> = {}) =>
  box({ tag: "li", children: [words(text)], ...props });

const list = (...items: ElementNode[]) => snapshot(box({ id: "root", tag: "ul", children: items }));

/** The text of each child of each root, with the key it was given. */
const keys = (...snaps: ReturnType<typeof list>[]) =>
  pair(snaps).roots.map((root) =>
    root.children.map((child) => {
      const [inner] = child.node.type === "element" ? child.node.children : [];
      const run = inner?.type === "text" ? inner.runs[0]!.text : child.key;

      return [run, child.key] as const;
    }),
  );

const find = (tree: Paired, key: string): Paired | undefined =>
  tree.key === key ? tree : tree.children.map((child) => find(child, key)).find(Boolean);

describe("pair", () => {
  test("the roots pair, and an explicit key names a node in every state", () => {
    const a = list(item("x", { key: "one" }), item("y", { key: "two" }));
    const b = list(item("y", { key: "two" }), item("x", { key: "one" }));
    const [one = [], two = []] = keys(a, b);

    expect(one).toEqual([
      ["x", "one"],
      ["y", "two"],
    ]);

    expect(two).toEqual([
      ["y", "two"],
      ["x", "one"],
    ]);

    expect(pair([a, b]).roots.map((root) => root.key)).toEqual(["root", "root"]);
  });

  test("pairBy beats data-key, which beats data-part, which beats id", () => {
    const one = list(
      item("x", { key: "k", part: "p", id: "i" }),
      item("y", { part: "p", id: "i" }),
    );

    const two = list(item("x", { key: "k", part: "p", id: "i" }), item("y", { id: "i" }));

    expect(keys(one, two)[0]!.map(([, key]) => key)).toEqual(["k", "p"]);
    expect(keys(one, two)[1]!.map(([, key]) => key)).toEqual(["k", "i"]);

    const by = pair([one], (node) => (node.key === "k" ? "chosen" : undefined));

    expect(by.roots[0]!.children.map((child) => child.key)).toEqual(["chosen", "p"]);
  });

  test("unkeyed siblings match by tag and wording: an insert and a delete leave the rest paired", () => {
    const before = list(item("apple"), item("banana"), item("cherry"));
    const after = list(item("banana"), item("cherry"), item("date"));
    const [a = [], b = []] = keys(before, after);
    const key = (rows: typeof a, text: string) => rows.find(([t]) => t === text)![1];

    expect(key(b, "banana")).toBe(key(a, "banana"));
    expect(key(b, "cherry")).toBe(key(a, "cherry"));
    expect(new Set([...a, ...b].map(([, k]) => k)).size).toBe(4);
  });

  test("a reorder of unkeyed siblings with their own wording keeps every one's key", () => {
    const [a = [], b = []] = keys(
      list(item("one"), item("two"), item("three")),
      list(item("two"), item("three"), item("one")),
    );

    const key = (rows: typeof a, text: string) => rows.find(([t]) => t === text)![1];

    expect(key(b, "two")).toBe(key(a, "two"));
    expect(key(b, "three")).toBe(key(a, "three"));
    expect(key(b, "one")).toBe(key(a, "one"));
  });

  test("a changed text still pairs with its place, and a different tag does not", () => {
    const [a = [], b = []] = keys(
      snapshot(box({ id: "r", children: [box({ tag: "p", children: [words("empty")] })] })),
      snapshot(
        box({
          id: "r",
          children: [
            box({ tag: "h1", children: [words("typed")] }),
            box({ tag: "p", children: [words("typed")] }),
          ],
        }),
      ),
    );

    expect(b.map(([, key]) => key).includes(a[0]![1])).toBe(true);
    expect(new Set(b.map(([, key]) => key)).size).toBe(2);
  });

  test("a repeated name gets numbered", () => {
    const [rows = []] = keys(list(item("a", { part: "row" }), item("b", { part: "row" })));

    expect(rows.map(([, key]) => key)).toEqual(["row", "row~2"]);
  });
});

describe("a node under different parents", () => {
  const column = (id: string, ...kids: ElementNode[]) =>
    box({ id, rect: { x: id === "a" ? 0 : 200, y: 0, width: 100, height: 300 }, children: kids });

  const card = (y: number) => box({ key: "card", rect: { x: 0, y, width: 80, height: 40 } });

  const board = (...columns: ElementNode[]) =>
    snapshot(
      box({ id: "board", rect: { x: 0, y: 0, width: 400, height: 300 }, children: columns }),
    );

  test("rides at the level of the nearest shared ancestor", () => {
    const { roots, diagnostics } = pair([
      board(column("a", card(10)), column("b")),
      board(column("a"), column("b", card(60))),
    ]);

    expect(diagnostics).toEqual([]);

    for (const root of roots) {
      expect(root.children.map((child) => child.key)).toContain("card");
      expect(
        find(
          root.children.find((child) => child.key === "a")!,
          "card",
        ),
      ).toBeUndefined();
      expect(
        find(
          root.children.find((child) => child.key === "b")!,
          "card",
        ),
      ).toBeUndefined();
    }
  });

  test("stays put when its parent is the same", () => {
    const { roots } = pair([
      board(column("a", card(10)), column("b")),
      board(column("a", card(50)), column("b")),
    ]);

    expect(find(roots[0]!.children[0]!, "card")).toBeDefined();
    expect(find(roots[1]!.children[0]!, "card")).toBeDefined();
  });

  test("is left to exit and enter when a parent in between clips, transforms or fades it", () => {
    for (const trap of [
      { clip: { x: true, y: true } },
      { opacity: 0.5 },
      { transform: { matrix: [1, 0, 0, 1, 0, 0] as const, origin: [0, 0] as const } },
    ]) {
      const { roots, diagnostics } = pair([
        board({ ...column("a", card(10)), ...trap }, column("b")),
        board(column("a"), column("b", card(60))),
      ]);

      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0]!.what).toContain('"card" moves between parents');
      expect(find(roots[0]!.children[0]!, "card")).toBeDefined();
      expect(find(roots[1]!.children[1]!, "card")).toBeDefined();
    }
  });

  test("a pseudo-element that appears in the second state pairs by its part, and the real children stay paired", () => {
    const pseudo = (which: "::before" | "::after") =>
      box({ tag: which, part: which, rect: { x: 0, y: 0, width: 8, height: 8 } });

    const a = list(item("x"), item("y"));
    const b = list(pseudo("::before"), item("x"), item("y"), pseudo("::after"));
    const c = list(pseudo("::after"), item("x"), item("y"));

    const [one = [], two = []] = pair([a, b]).roots.map((root) => root.children.map((k) => k.key));

    expect(one).toEqual(["li[0]", "li[1]"]);
    expect(two).toEqual(["::before", "li[0]", "li[1]", "::after"]);

    // The ::after that moves from last to first of the list still pairs with itself.
    const [, , third = []] = pair([a, b, c]).roots.map((root) => root.children.map((k) => k.key));

    expect(third).toEqual(["::after", "li[0]", "li[1]"]);
  });

  test("a shuffle of distinct cards is matched by wording, whatever the order", () => {
    const one = list(item("apple pie"), item("banana split"), item("cherry tart"));
    const two = list(item("cherry tart"), item("apple pie"), item("banana split"));
    const [before = [], after = []] = keys(one, two);
    const keyOf = (rows: typeof before, text: string) => rows.find(([run]) => run === text)![1];

    for (const text of ["apple pie", "banana split", "cherry tart"])
      expect(keyOf(after, text)).toBe(keyOf(before, text));
  });

  test("duplicate wording is ambiguous: it falls back to order, not a guess", () => {
    const one = list(item("todo"), item("todo"), item("done"));
    const two = list(item("done"), item("todo"), item("todo"));
    const [before = [], after = []] = keys(one, two);

    // "done" is unique, so it moves. The "todo"s could be either: they keep the order-keeping match, never swapped by a guess.
    expect(after[0]![1]).toBe(before[2]![1]);
    expect(after[1]![1]).toBe(before[1]![1]);
    expect(after[2]![1]).not.toBe(before[0]![1]);
  });

  test("an ordinary edit (one out the front, one in the back) is not a move", () => {
    const one = list(item("Count 1"), item("Count 2"), item("Count 3"));
    const two = list(item("Count 2"), item("Count 3"), item("Count 4"));
    const [before = [], after = []] = keys(one, two);

    expect(after[0]![1]).toBe(before[1]![1]);
    expect(after[1]![1]).toBe(before[2]![1]);
    expect(after[2]![1]).not.toBe(before[0]![1]);
  });

  test("a framework identity sits between data-key and data-part, and follows a node across parents", () => {
    const one = list(
      item("x", { identity: "i", part: "p" }),
      item("y", { key: "k", identity: "i" }),
    );

    expect(keys(one, one)[0]!.map(([, key]) => key)).toEqual(["i", "k"]);

    const a = snapshot(
      box({
        id: "root",
        children: [
          box({ key: "left", children: [item("x", { identity: "card" })] }),
          box({ key: "right" }),
        ],
      }),
    );

    const b = snapshot(
      box({
        id: "root",
        children: [
          box({ key: "left" }),
          box({ key: "right", children: [item("x", { identity: "card" })] }),
        ],
      }),
    );

    const [first, second] = pair([a, b]).roots;

    expect(find(first!, "card")).toBeDefined();
    expect(find(second!, "card")).toBeDefined();
  });
});

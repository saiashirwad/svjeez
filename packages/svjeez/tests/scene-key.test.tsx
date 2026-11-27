import { describe, expect, test } from "bun:test";
import { Group, Shape, circle, h, morph, rect, ref, scene, span, type SceneElement } from "svjeez";
import { isLane, valueAt, type Model } from "svjeez/tools";
import { blendNumber, blendVec } from "../src/model/sample";

const made = (build: () => SceneElement): Model.Scene =>
  scene({ size: [100, 40], duration: 1, title: "Keys" }, build);

describe("key", () => {
  const keysOf = (model: Model.Scene) => model.root.children.map((node) => node.key);

  test("takes a number, as React does, and reads it as its text", () => {
    const model = made(() => (
      <Group>
        {[2021, 2022].map((year) => (
          <Shape key={year} geometry={circle(2)} fill="#000000" />
        ))}
        <Shape key={0} geometry={circle(2)} fill="#000000" />
      </Group>
    ));

    expect(keysOf(model)).toEqual(["2021", "2022", "0"]);
  });

  test("a number and the same text are one key", () => {
    expect(() =>
      made(() => (
        <Group>
          <Shape key={1} geometry={circle(2)} fill="#000000" />
          <Shape key="1" geometry={circle(2)} fill="#000000" />
        </Group>
      )),
    ).toThrow('Two nodes are both keyed "1"');
  });

  test("an explicit key never collides with the position of an unkeyed sibling", () => {
    const model = made(() => (
      <Group>
        <Shape geometry={circle(2)} fill="#000000" />
        <Shape geometry={circle(2)} fill="#000000" />
        <Shape key={1} geometry={circle(2)} fill="#000000" />
      </Group>
    ));

    expect(new Set(keysOf(model)).size).toBe(3);
  });

  test("refuses anything else, naming the node", () => {
    const bad = (key: string) =>
      made(() => (
        <Group>
          <Shape key={key} geometry={circle(2)} fill="#000000" />
        </Group>
      ));

    // SAFETY: a loosely typed scene can hand the compiler a key that is neither a string nor a number.
    const wrong = [{}, true, Number.NaN, null] as never[];

    for (const key of wrong) expect(() => bad(key)).toThrow("A key is a string or a number");
  });

  describe("lists", () => {
    const dot = (key: number | string, x = 0) => (
      <Shape key={key} geometry={rect(4, 4)} at={[x, 0]} fill="#000000" />
    );

    const two = (xs: number[], ys: number[], dx = 0) => (
      <Group>
        {xs.map((x) => dot(x, x * 10 + dx))}
        {ys.map((y) => dot(y, y * 10 + 50 + dx))}
      </Group>
    );

    const groupOf = (model: Model.Scene): Model.GroupNode => {
      const [group] = model.root.children;

      if (group?.kind !== "group") throw new Error("expected a group");

      return group;
    };

    test("two lists in one parent can both key from 0", () => {
      const model = made(() => two([0, 1], [0, 1]));

      expect(keysOf(model)).toEqual(["0", "1", "0~1", "1~1"]);
    });

    test("keys stay as written when they don't collide", () => {
      const model = made(() => two([0, 1], [2, 3]));

      expect(keysOf(model)).toEqual(["0", "1", "2", "3"]);
    });

    test("a key repeated inside one list is still an error", () => {
      expect(() => made(() => two([0, 0], [1]))).toThrow('Two nodes are both keyed "0"');
      expect(() => made(() => two([1], [0, 0]))).toThrow('Two nodes are both keyed "0"');
      expect(() => made(() => two([0], [0, 0]))).toThrow('Two nodes are both keyed "0"');
    });

    test("a key repeated between plain siblings, or a plain sibling and a list, is an error", () => {
      expect(() =>
        made(() => (
          <Group>
            {dot(0)}
            {dot(0)}
          </Group>
        )),
      ).toThrow('Two nodes are both keyed "0"');

      expect(() =>
        made(() => (
          <Group>
            {dot(0)}
            {[0].map((k) => dot(k))}
          </Group>
        )),
      ).toThrow('Two nodes are both keyed "0"');
    });

    test("a key unique in its parent is found by part() even in a later list", () => {
      const box = ref();

      const model = made(() => (
        <Group>
          <Group ref={box}>
            {["agent"].map((k) => dot(k, 0))}
            {["lint", "test"].map((k, i) => dot(k, 20 + i * 20))}
          </Group>
          <Shape key="pin" geometry={circle(1)} at={box.part("lint").center} fill="#000000" />
        </Group>
      ));

      expect(keysOf(model)).toEqual(["#0", "pin"]);
      // "lint" covers [20, 0] to [24, 4]; the pin's box starts at its center.
      expect(model.root.children[1]!.at).toEqual([23, 3]);
    });

    test("part() of a key two lists share is ambiguous", () => {
      const box = ref();

      expect(() =>
        made(() => (
          <Group>
            <Group ref={box}>
              {[0, 1].map((k) => dot(k, k * 10))}
              {[0].map((k) => dot(k, 50))}
            </Group>
            <Shape key="pin" geometry={circle(1)} at={box.part("0").center} fill="#000000" />
          </Group>
        )),
      ).toThrow(
        'ref().part("0").center is ambiguous: lists in <Group> each hold a part keyed "0". They are "0", "0~1".',
      );
    });

    test("morph tweens two mapped lists in one parent by their keys", () => {
      const model = made(() => morph(two([0, 1], [0, 1]), two([0, 1], [0, 1], 100), span(0, 1)));
      const group = groupOf(model);

      // One node per key, not an exit and an enter for each: the states matched.
      expect(group.children.map((node) => node.key)).toEqual(["#0/0", "#0/1", "#0/0~1", "#0/1~1"]);

      const ends = group.children.map((node) => {
        if (!isLane(node.at)) throw new Error(`${node.key} doesn't move`);

        return [node.at.keys[0].value[0], node.at.keys.at(-1)!.value[0]];
      });

      expect(ends).toEqual([
        [0, 100],
        [10, 110],
        [50, 150],
        [60, 160],
      ]);
    });

    describe("morph keeps a list's node one node when another list drops its key", () => {
      const xAt = (node: Model.SceneNode, t: number): number =>
        valueAt(node.at, t, blendVec, node.key)[0];

      const opacityAt = (node: Model.SceneNode, t: number): number =>
        valueAt(node.layers[0]?.opacity ?? 1, t, blendNumber, node.key);

      const byKey = (group: Model.GroupNode) =>
        new Map(group.children.map((node) => [node.key, node]));

      test("the second list's 0 tweens from where it was to where it goes", () => {
        // Both lists hold 0 in the first state; only the second does in the last.
        const model = made(() => morph(two([0, 1], [0]), two([1], [0], 100), span(0, 1)));
        const nodes = byKey(groupOf(model));

        expect([...nodes.keys()]).toEqual(["#0/0", "#0/1", "#0/0~1"]);

        const second = nodes.get("#0/0~1")!;
        const kept = nodes.get("#0/1")!;

        expect(xAt(second, 0)).toBe(50);
        expect(xAt(second, 1)).toBe(150);
        // Midway it has moved as far as the first list's 1, which moves by the same 100: one tween, not a swap.
        const moved = xAt(kept, 0.5) - 10;

        expect(moved).toBeGreaterThan(0);
        expect(moved).toBeLessThan(100);
        expect(xAt(second, 0.5)).toBeCloseTo(50 + moved, 6);
        expect(opacityAt(second, 0.5)).toBe(1);
      });

      test("the same holds when the first list gains the key instead", () => {
        const model = made(() => morph(two([1], [0]), two([0, 1], [0], 100), span(0, 1)));
        const nodes = byKey(groupOf(model));

        // The second list wrote 0 first, so it keeps the key; the first list's 0 is told apart.
        expect([...nodes.keys()]).toEqual(["#0/0~0", "#0/1", "#0/0"]);
        const second = nodes.get("#0/0")!;

        expect(xAt(second, 0)).toBe(50);
        expect(xAt(second, 1)).toBe(150);
        expect(opacityAt(second, 0.5)).toBe(1);
        // The first list's 0 is new: it enters, at its own place.
        const first = nodes.get("#0/0~0")!;

        expect(opacityAt(first, 0)).toBe(0);
        expect(opacityAt(first, 1)).toBe(1);
        expect(xAt(first, 1)).toBe(100);
      });

      test("one list keeps its keys as written, even when its place moves", () => {
        const model = made(() =>
          morph(
            <Group>{[0, 1].map((k) => dot(k, k * 10))}</Group>,
            <Group>
              {dot("title", 0)}
              {[0, 1].map((k) => dot(k, k * 10 + 100))}
            </Group>,
            span(0, 1),
          ),
        );

        const nodes = byKey(groupOf(model));

        expect([...nodes.keys()]).toEqual(["#0/title", "#0/0", "#0/1"]);
        expect(xAt(nodes.get("#0/1")!, 0)).toBe(10);
        expect(xAt(nodes.get("#0/1")!, 1)).toBe(110);
        expect(opacityAt(nodes.get("#0/1")!, 0.5)).toBe(1);
      });

      test("the first list's 0, which leaves, still exits", () => {
        const model = made(() => morph(two([0, 1], [0]), two([1], [0], 100), span(0, 1)));
        const first = byKey(groupOf(model)).get("#0/0")!;

        expect(xAt(first, 0)).toBe(0);
        expect(opacityAt(first, 0)).toBe(1);
        expect(opacityAt(first, 1)).toBe(0);
      });
    });

    test("h() keeps keys as JSX does", () => {
      const model = made(() =>
        h(
          Group,
          null,
          [0, 1].map((k) => h(Shape, { key: k, geometry: circle(2), fill: "#000000" })),
          [0, 1].map((k) => h(Shape, { key: k, geometry: circle(2), fill: "#000000" })),
        ),
      );

      expect(keysOf(model)).toEqual(["0", "1", "0~1", "1~1"]);
    });
  });
});

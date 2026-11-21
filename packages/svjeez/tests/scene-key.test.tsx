import { describe, expect, test } from "bun:test";
import { Group, Shape, circle, scene, type SceneElement } from "svjeez";
import type { Model } from "svjeez/tools";

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
});

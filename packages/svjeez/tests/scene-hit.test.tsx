import { describe, expect, test } from "bun:test";
import {
  Group,
  Shape,
  Stack,
  Text,
  font,
  morph,
  rect,
  scene,
  span,
  type SceneElement,
} from "svjeez";
import { svg, type Model } from "svjeez/tools";

const space = font.family(
  await font.load(new URL("./fixtures/SpaceMono-Regular.ttf", import.meta.url)),
  await font.load(new URL("./fixtures/SpaceMono-Bold.ttf", import.meta.url)),
);

const made = (build: () => SceneElement): Model.Scene =>
  scene({ size: [200, 100], duration: 2, title: "Test" }, build);

const emitted = (build: () => SceneElement): string => svg.emit(made(build));

const hits = (out: string): string[] => [...out.matchAll(/data-hit="([^"]*)"/g)].map((m) => m[1]!);

describe("hit", () => {
  test("marks the outermost element of a shape, a group and a text", () => {
    const out = emitted(() => (
      <>
        <Shape key="a" hit="save" geometry={rect(20, 20)} fill="#ff0000" />
        <Group key="g" hit="panel">
          <Shape key="b" geometry={rect(10, 10)} fill="#00ff00" />
          <Shape key="c" geometry={rect(10, 10)} fill="#0000ff" />
        </Group>
        <Text key="t" hit="label" font={space} size={12} fill="#000000">
          Hi
        </Text>
      </>
    ));

    expect(hits(out)).toEqual(["save", "panel", "label"]);
    expect(out).toMatch(/<rect[^>]* data-hit="save"/);
    expect(out).toMatch(/<g[^>]* data-hit="panel"/);
  });

  test("a group with nothing else to say is still there to carry it", () => {
    const out = emitted(() => (
      <Group hit="panel">
        <Shape geometry={rect(10, 10)} fill="#00ff00" />
        <Shape geometry={rect(10, 10)} fill="#0000ff" />
      </Group>
    ));

    expect(out).toMatch(/<g data-hit="panel">/);
  });

  test("a group around one shape keeps both names", () => {
    const out = emitted(() => (
      <Group hit="outer">
        <Shape hit="inner" geometry={rect(10, 10)} fill="#00ff00" />
      </Group>
    ));

    expect(hits(out)).toEqual(["outer", "inner"]);
  });

  test("several nodes may share a name", () => {
    const out = emitted(() => (
      <>
        <Shape hit="card" geometry={rect(10, 10)} fill="#ff0000" />
        <Shape hit="card" geometry={rect(10, 10)} fill="#00ff00" />
      </>
    ));

    expect(hits(out)).toEqual(["card", "card"]);
  });

  test("survives layout and morphs", () => {
    const model = made(() => (
      <>
        <Stack key="row" direction="row" gap={4} hit="row">
          <Shape key="a" hit="a" geometry={rect(20, 20)} fill="#ff0000" />
          <Shape key="b" geometry={rect(20, 20)} fill="#ff0000" />
        </Stack>
        {morph(
          <Shape key="m" hit="m" geometry={rect(10, 10)} fill="#000000" />,
          <Shape key="m" hit="m" geometry={rect(20, 10)} fill="#000000" />,
          span(0, 1),
        )}
      </>
    ));

    const [row, m] = model.root.children;

    expect([row!.hit, m!.hit]).toEqual(["row", "m"]);
    expect(row!.kind === "group" && row!.children.map((child) => child.hit)).toEqual([
      "a",
      undefined,
    ]);
    expect(hits(svg.emit(model))).toEqual(["row", "a", "m"]);
  });

  test("a morph needs the same name in every state", () => {
    expect(() =>
      made(() =>
        morph(
          <Shape key="m" hit="one" geometry={rect(10, 10)} fill="#000000" />,
          <Shape key="m" hit="two" geometry={rect(20, 10)} fill="#000000" />,
          span(0, 1),
        ),
      ),
    ).toThrow("its hit differs between states");
  });

  test("needs a name of letters, digits, - and _ that starts with a letter", () => {
    for (const name of ["", "1st", "a b", 'a"b'])
      expect(() =>
        emitted(() => <Shape key="a" hit={name} geometry={rect(10, 10)} fill="#ff0000" />),
      ).toThrow("a hit name is letters, digits, - and _ that starts with a letter");
  });

  test("without hit the output has no data-hit and is unchanged", () => {
    const plain = emitted(() => (
      <Group>
        <Shape geometry={rect(10, 10)} fill="#00ff00" />
      </Group>
    ));

    expect(plain).not.toContain("data-hit");
    expect(
      emitted(() => (
        <Group>
          <Shape hit="x" geometry={rect(10, 10)} fill="#00ff00" />
        </Group>
      )).replace(' data-hit="x"', ""),
    ).toBe(plain);
  });
});

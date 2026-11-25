import { describe, expect, test } from "bun:test";
import {
  Group,
  Sequence,
  Series,
  Shape,
  circle,
  component,
  context,
  scene,
  span,
  track,
  type Slots,
  type SceneElement,
} from "svjeez";
import { isLane, propsOf, SceneError, type Model } from "svjeez/tools";

const Tone = context("none");

const Probe = ({ n }: { readonly n: number }): SceneElement => (
  <Shape id={`${Tone.read()}${n}`} geometry={circle(2)} fill="#000000" />
);

const idsOf = (node: Model.SceneNode): string[] => [
  ...(node.id === undefined ? [] : [node.id]),
  ...(node.kind === "group"
    ? [...(node.mask ? idsOf(node.mask) : []), ...node.children.flatMap(idsOf)]
    : []),
];

const made = (build: () => SceneElement, duration?: number): Model.Scene =>
  scene({ size: [100, 100], title: "Context", ...(duration && { duration }) }, build);

const beat = (over: number, key: string): SceneElement => (
  <Sequence when={span(0, over)}>
    <Shape key={key} geometry={circle(2)} fill="#000000" opacity={track(0).to(1, span(0, over))} />
  </Sequence>
);

const startOf = (model: Model.Scene, key: string, over: number): number => {
  const find = (node: Model.SceneNode): Model.SceneNode | undefined =>
    node.key.endsWith(key)
      ? node
      : node.kind === "group"
        ? node.children.map(find).find(Boolean)
        : undefined;

  const value = find(model.root)!.layers.at(-1)!.opacity!;

  return isLane(value) ? value.keys.find((key) => key.value === 1)!.t - over : -1;
};

describe("context()", () => {
  test("reads the initial value outside a provider, and the nearest one inside", () => {
    expect(Tone.read()).toBe("none");

    const model = made(
      () => (
        <Group>
          <Probe n={1} />
          <Tone value="outer">
            <Probe n={2} />
            <Tone value="inner">
              <Probe n={3} />
            </Tone>
            <Probe n={4} />
          </Tone>
        </Group>
      ),
      1,
    );

    expect(idsOf(model.root)).toEqual(["none1", "outer2", "inner3", "outer4"]);
    expect(Tone.read()).toBe("none");
  });

  test("reaches a child that is passed through a slot", () => {
    const Frame = component({
      name: "Frame",
      render: ({ children }: Slots) => (
        <Tone value="frame">
          <Group>{children}</Group>
        </Tone>
      ),
    });

    const model = made(
      () => (
        <Tone value="written">
          <Frame>
            <Probe n={5} />
          </Frame>
        </Tone>
      ),
      1,
    );

    expect(idsOf(model.root)).toEqual(["frame5"]);
  });

  test("a function mask expands under the context it was written in", () => {
    const model = made(
      () => (
        <Tone value="masked">
          <Group mask={() => <Probe n={6} />}>
            <Shape geometry={circle(4)} fill="#000000" />
          </Group>
        </Tone>
      ),
      1,
    );

    expect(idsOf(model.root)).toEqual(["masked6"]);
  });
});

describe("<Series>", () => {
  test("starts each child where the one before ends, and nests", () => {
    const model = made(() => (
      <Series>
        {beat(1, "a")}
        <Series>
          {beat(2, "b")}
          {beat(3, "c")}
        </Series>
      </Series>
    ));

    expect(model.duration).toBe(6);
    expect([startOf(model, "a", 1), startOf(model, "b", 2), startOf(model, "c", 3)]).toEqual([
      0, 1, 3,
    ]);
  });

  test("gap puts seconds between children: negative overlaps them, positive leaves a pause", () => {
    const series = (gap: number) =>
      made(() => (
        <Series gap={gap}>
          {beat(2, "a")}
          {beat(3, "b")}
          {beat(1, "c")}
        </Series>
      ));

    const overlapped = series(-0.5);

    expect([
      startOf(overlapped, "a", 2),
      startOf(overlapped, "b", 3),
      startOf(overlapped, "c", 1),
    ]).toEqual([0, 1.5, 4]);
    expect(overlapped.duration).toBe(5);

    const paused = series(1);

    expect([startOf(paused, "a", 2), startOf(paused, "b", 3), startOf(paused, "c", 1)]).toEqual([
      0, 3, 7,
    ]);
    expect(paused.duration).toBe(8);
  });

  test("a gap that starts a child before the series is an error", () => {
    expect(() =>
      made(() => (
        <Series gap={-3}>
          {beat(2, "a")}
          {beat(3, "b")}
        </Series>
      )),
    ).toThrow("<Series> gap={-3} starts its child 2 at -1s, before the series starts.");
  });

  test("a child with no length is an error that says how to give it one", () => {
    expect(() =>
      made(() => (
        <Series>
          <Shape geometry={circle(2)} fill="#000000" />
        </Series>
      )),
    ).toThrow("Wrap it in <Sequence when={span(0, n)}>");
  });
});

describe("scene duration", () => {
  test("is the length of the root when left out, and an error when the root has none", () => {
    expect(made(() => <Group>{beat(2.5, "a")}</Group>).duration).toBe(2.5);

    const error = (() => {
      try {
        made(() => <Shape geometry={circle(2)} fill="#000000" />);
      } catch (thrown) {
        return thrown;
      }
    })();

    expect(error).toBeInstanceOf(SceneError);
  });
});

describe("propsOf()", () => {
  test("reads the props an unbuilt element was written with", () => {
    const Card = ({ size }: { readonly size: number }): SceneElement => (
      <Shape geometry={circle(size)} fill="#000000" />
    );

    const el = <Card size={7} />;

    expect(propsOf(el, Card)).toEqual({ size: 7 });
    expect(propsOf(el, Probe)).toBeUndefined();
  });
});

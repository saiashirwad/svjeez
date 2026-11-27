import { describe, expect, test } from "bun:test";
import {
  Fragment,
  Group,
  Shape,
  Text,
  circle,
  font as fonts,
  h,
  scene,
  type SceneElement,
} from "svjeez";
import { svg, type Model } from "svjeez/tools";
import { fontFixture } from "../../../fixtures/fonts";

const made = (build: () => SceneElement): Model.Scene =>
  scene({ size: [100, 40], duration: 1, title: "h" }, build);

const font = await fonts.load(fontFixture("SpaceMono-Regular"));

describe("h", () => {
  test("builds the same scene as JSX, keys and text children included", () => {
    const withJsx = made(() => (
      <Group>
        <Shape key="a" geometry={circle(2)} fill="#000000" />
        <>
          <Shape key={1} geometry={circle(3)} fill="#ff0000" />
        </>
        <Text font={font} size={10} at={[0, 20]} fill="#000000">
          n = {4}
        </Text>
      </Group>
    ));

    const withH = made(() =>
      h(
        Group,
        null,
        h(Shape, { key: "a", geometry: circle(2), fill: "#000000" }),
        h(Fragment, null, h(Shape, { key: 1, geometry: circle(3), fill: "#ff0000" })),
        h(Text, { font, size: 10, at: [0, 20], fill: "#000000" }, "n = ", 4),
      ),
    );

    expect(svg.emit(withH)).toBe(svg.emit(withJsx));
    expect(withH.root.children.map((node) => node.key)).toEqual(
      withJsx.root.children.map((node) => node.key),
    );
  });

  test("hands a component the same props as JSX", () => {
    const seen: unknown[] = [];

    const Probe = (props: { readonly label: string }): SceneElement => {
      seen.push(props);

      return h(Shape, { geometry: circle(1), fill: "#000000" });
    };

    made(() => (
      <Group>
        <Probe key="p" label="x" />
      </Group>
    ));

    made(() => h(Group, null, h(Probe, { key: "p", label: "x" })));

    expect(seen[1]).toEqual(seen[0]);
  });

  test("an array child is one child, as in JSX", () => {
    const dots = [1, 2].map((r) => h(Shape, { key: r, geometry: circle(r), fill: "#000000" }));

    expect(svg.emit(made(() => h(Group, null, dots)))).toBe(
      svg.emit(made(() => <Group>{dots}</Group>)),
    );
  });

  test("types props and children from the component", () => {
    const check = (): SceneElement[] => [
      // @ts-expect-error: Shape has no `radius` prop
      h(Shape, { geometry: circle(1), radius: 2 }),
      // @ts-expect-error: a Group's children are scene elements, not text
      h(Group, null, "text"),
      // @ts-expect-error: Text needs a font
      h(Text, { size: 10 }, "hi"),
    ];

    expect(check).toBeFunction();
  });

  test("requires what the component requires, as JSX does", () => {
    const Needs = (_props: { readonly label: string }): SceneElement => h(Fragment);
    const Wants = (_props: { readonly children: SceneElement }): SceneElement => h(Fragment);

    const Many = (_props: { readonly children: readonly SceneElement[] }): SceneElement =>
      h(Fragment);

    const Free = (_props: { readonly tint?: string }): SceneElement => h(Fragment);
    const dot = h(Shape, { geometry: circle(1), fill: "#000000" });

    const check = (): SceneElement[] => [
      // @ts-expect-error: Text's props are required
      h(Text),
      // @ts-expect-error: Shape's props cannot be null
      h(Shape, null),
      // @ts-expect-error: label is required
      h(Needs),
      // @ts-expect-error: label is required
      h(Needs, null),
      // @ts-expect-error: a child is required
      h(Wants),
      // @ts-expect-error: a child is required
      h(Wants, null),
      // @ts-expect-error: one child, not two
      h(Wants, null, dot, dot),
      // @ts-expect-error: at least one child
      h(Many, null),
      h(Needs, { label: "x" }),
      h(Wants, null, dot),
      h(Many, null, dot),
      h(Many, null, dot, dot),
      h(Many, null, [dot, dot]),
      h(Free),
      h(Free, null),
      h(Free, { tint: "red" }),
      h(Group),
      h(Group, null, dot, dot),
    ];

    expect(check).toBeFunction();
  });
});

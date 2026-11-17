import { describe, expect, test } from "bun:test";
import { Clip, render, span, type Drawn, type Part } from "svjeez";
import { rect } from "svjeez/geometry";
import { jsx, Fragment } from "svjeez/jsx-runtime";
import { jsxDEV } from "svjeez/jsx-dev-runtime";

const part: Part<"a"> = { id: "a", box: rect(0, 0, 10, 10), span: span(1, 1) };

const drawn: Drawn<Part<"a">> = {
  node: <rect width={10} height={10} />,
  span: part.span,
  bounds: part.box,
  parts: [part],
  part: () => part,
};

const scene = (content: Parameters<typeof render>[1]) =>
  render({ width: 20, height: 20, duration: 2, title: "Drawn" }, content);

describe("a Drawn as a JSX child", () => {
  test("renders as its node, in JSX, in a fragment, in a list and inside a component", () => {
    const expected = scene(<g>{drawn.node}</g>);

    expect(scene(<g>{drawn}</g>)).toBe(expected);
    expect(scene(<g>{[drawn]}</g>)).toBe(expected);
    expect(scene(<g>{<>{drawn}</>}</g>)).toBe(expected);
    expect(scene(<Clip at={0}>{drawn}</Clip>)).toBe(scene(<Clip at={0}>{drawn.node}</Clip>));
  });

  test("renders as its node through jsx() and the development runtime", () => {
    const expected = scene(jsx("g", { children: drawn.node }));

    expect(scene(jsx("g", { children: drawn }))).toBe(expected);
    expect(scene(jsx("g", { children: [jsx(Fragment, { children: drawn })] }))).toBe(expected);
    expect(scene(jsxDEV("g", { children: drawn }))).toBe(expected);
  });

  test("renders as its node when it carries a kind of its own, as a Mermaid diagram does", () => {
    const tagged = { ...drawn, kind: "sequence" as const };

    expect(scene(<g>{tagged}</g>)).toBe(scene(<g>{drawn.node}</g>));
  });

  test("renders as its node when handed straight to render()", () => {
    expect(scene(drawn)).toBe(scene(drawn.node));
  });

  test("still rejects an object that is not a node or a Drawn", () => {
    // @ts-expect-error a bare object is not a child, even with a node in it
    expect(() => scene(<g>{{ node: "text" }}</g>)).toThrow("Unsupported SVG child");
    // @ts-expect-error a node alone does not make a Drawn: it needs span, bounds and parts
    void (<g>{{ node: drawn.node }}</g>);
  });
});

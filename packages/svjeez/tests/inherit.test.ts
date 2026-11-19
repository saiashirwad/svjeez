import { describe, expect, test } from "bun:test";
import { inherit } from "../src/svg/inherit";
import { element, type Element, type SvgNode } from "../src/svg/tree";

type Attrs = Record<string, string>;

const red = { fill: "#FF0000" };
const rect = (attrs: Attrs = {}): Element => element("rect", attrs);
const group = (children: SvgNode[], attrs: Attrs = {}): Element => element("g", attrs, children);

const run = (node: Element, css = ""): Element => {
  const [out] = inherit([node], css, "");

  if (out?.kind !== "element") throw new Error("inherit lost its element");

  return out;
};

const names = (node: Element): (Attrs | undefined)[] =>
  node.children.map((child) => (child.kind === "element" ? attrsOf(child) : undefined));

const attrsOf = (node: Element): Attrs =>
  Object.fromEntries(Object.entries(node.attrs).map(([name, value]) => [name, String(value)]));

describe("inherit", () => {
  test("a value that two children repeat moves to the group", () => {
    const out = run(group([rect(red), rect(red), rect({ fill: "#00FF00" })]));

    expect(out.attrs).toEqual({ fill: "#FF0000" });
    expect(names(out)).toEqual([{}, {}, { fill: "#00FF00" }]);
  });

  test("a value only one child has stays where it is", () => {
    const out = run(group([rect(red), rect({ fill: "#00FF00" })]));

    expect(out.attrs).toEqual({});
    expect(names(out)).toEqual([red, { fill: "#00FF00" }]);
  });

  test("the group's own value is dropped from the children that repeat it", () => {
    const out = run(group([rect(red), rect({ fill: "#00FF00" })], red));

    expect(out.attrs).toEqual(red);
    expect(names(out)).toEqual([{}, { fill: "#00FF00" }]);
  });

  test("a child that sets nothing would inherit it, so the group keeps nothing", () => {
    const out = run(group([rect(red), rect(red), rect()]));

    expect(out.attrs).toEqual({});
    expect(names(out)).toEqual([red, red, {}]);
  });

  test("text, tspan and use without the attribute block it", () => {
    for (const tag of ["text", "tspan", "use"]) {
      const out = run(group([rect(red), rect(red), element(tag)]));

      expect(out.attrs).toEqual({});
    }
  });

  test("an image covers any attribute, a shape only the font ones", () => {
    const image = element("image");

    expect(run(group([rect(red), rect(red), image])).attrs).toEqual(red);
    expect(run(group([rect(red), rect(red), rect()])).attrs).toEqual({});

    const sized = { "font-size": "12" };
    const text = (attrs: Record<string, string>) => element("text", attrs);

    expect(run(group([text(sized), text(sized), rect()])).attrs).toEqual(sized);
  });

  test("a group whose children are all covered covers its parent", () => {
    const inner = group([rect(red), rect({ fill: "#00FF00" })]);
    const out = run(group([rect(red), rect(red), inner]));

    expect(out.attrs).toEqual(red);
  });

  test("a group inside it takes its own repeats first, and the parent then drops the same value", () => {
    const out = run(group([group([rect(red), rect(red)]), group([rect(red), rect(red)])]));

    expect(out.attrs).toEqual(red);
    expect(names(out)).toEqual([{}, {}]);
  });

  test("on a tie the value seen first wins", () => {
    const blue = { fill: "#0000FF" };
    const out = run(group([rect(blue), rect(red), rect(blue), rect(red)]));

    expect(out.attrs).toEqual(blue);
  });

  test("the value repeated most wins", () => {
    const out = run(group([rect({ fill: "#0000FF" }), rect(red), rect(red)]));

    expect(out.attrs).toEqual(red);
  });

  test("a group with an animation on the attribute keeps its children's values", () => {
    const css = "@keyframes k1{0%{fill:#000000}100%{fill:#FFFFFF}}.m1{animation-name:k1}";

    expect(run(group([rect(red), rect(red)], { class: "m1" }), css).attrs).toEqual({ class: "m1" });
    expect(run(group([rect(red), rect(red)], { class: "m1", fill: "#FF0000" }), css).attrs).toEqual(
      {
        class: "m1",
        fill: "#FF0000",
      },
    );

    const moved = "@keyframes k1{0%{translate:0 0}100%{translate:0 4px}}.m1{animation-name:k1}";

    expect(run(group([rect(red), rect(red)], { class: "a m1" }), moved).attrs).toEqual({
      class: "a m1",
      fill: "#FF0000",
    });
  });

  test("a group with a class it cannot read, or a SMIL animation of the attribute, is left alone", () => {
    expect(run(group([rect(red), rect(red)], { class: "mine" })).attrs).toEqual({ class: "mine" });

    const smil = group([rect(red), rect(red), element("animate", { attributeName: "fill" })]);

    expect(run(smil).attrs).toEqual({});
  });
});

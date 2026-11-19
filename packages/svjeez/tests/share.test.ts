import { describe, expect, test } from "bun:test";
import { PER_ELEMENT, WORTH, share } from "../src/svg/share";
import { element, inline, type Element, type SvgNode } from "../src/svg/tree";

const path = (length: number, attrs: Record<string, string> = {}): Element =>
  element("path", { d: `M${"0".repeat(length)}`, ...attrs });

const group = (length: number, children = 3): Element =>
  element(
    "g",
    {},
    Array.from({ length: children }, (_, index) => path(length + index)),
  );

const wrap = (...nodes: SvgNode[]): SvgNode[] => [element("g", {}, nodes)];
const markup = (body: readonly SvgNode[]): string => body.map((node) => inline(node)).join("");

/** What sharing the copies would save, worked out from the markup like share() does. */
const net = (node: Element, count: number): number =>
  count * (inline(node).length - '<use href="#u1"/>'.length) -
  inline(element(node.tag, { id: "u1", ...node.attrs }, node.children)).length;

/** The shortest drawing whose net saving over this many copies is at least the given bytes. */
const shortest = (make: (length: number) => Element, count: number, bytes: number): number => {
  let length = 1;

  while (net(make(length), count) < bytes) length += 1;

  return length;
};

describe("share", () => {
  test("a drawing that appears once is left as it is", () => {
    const body = wrap(group(400));

    expect(share(body, "")).toBe(body);
  });

  test("copies are shared once they save WORTH bytes, and not before", () => {
    const length = shortest((each) => group(each), 3, WORTH);
    const copies = (each: number) => wrap(group(each), group(each), group(each));

    expect(net(group(length), 3)).toBeGreaterThanOrEqual(WORTH);
    expect(net(group(length - 1), 3)).toBeLessThan(WORTH);
    expect(markup(share(copies(length), ""))).toContain("<defs>");
    expect(markup(share(copies(length - 1), ""))).not.toContain("<use");
  });

  test("a single element that would only be copied twice needs PER_ELEMENT for each element it adds", () => {
    const body = (length: number) => wrap(path(length), path(length));
    const enough = shortest((each) => path(each), 2, 2 * PER_ELEMENT);

    expect(net(path(enough - 1), 2)).toBeGreaterThan(WORTH);
    expect(markup(share(body(enough - 1), ""))).not.toContain("<use");
    expect(markup(share(body(enough), ""))).toContain("<use");
  });

  test("three copies of a group come to fewer elements, so WORTH alone is enough", () => {
    const length = shortest((each) => group(each), 3, WORTH);

    expect(net(group(length), 3)).toBeLessThan(2 * PER_ELEMENT);
    expect(markup(share(wrap(group(length), group(length), group(length)), ""))).toContain("<use");
  });

  test("drawings that move are left where they are", () => {
    const moving = (child: SvgNode) =>
      wrap(...[1, 2, 3].map(() => element("g", {}, [path(400), path(401), child])));

    for (const child of [
      element("path", { d: "M0", class: "m1" }),
      element("animate", { attributeName: "d" }),
      element("set", { attributeName: "d" }),
    ])
      expect(markup(share(moving(child), ""))).not.toContain("<use");
  });

  test("a stroked drawing that has a class is not shared", () => {
    const stroked = (): Element => ({
      ...path(3000, { "stroke-width": "2", class: "m1" }),
      drawn: ["d", "stroke-width"],
    });

    expect(markup(share(wrap(stroked(), stroked()), ""))).not.toContain("<use");
  });

  test("nothing inside text, clipPath, mask, pattern or filter is counted", () => {
    for (const tag of ["text", "clipPath", "mask", "pattern", "filter"]) {
      const body = wrap(
        element(tag, { x: "1" }, [group(3000)]),
        element(tag, { x: "2" }, [group(3000)]),
        element(tag, { x: "3" }, [group(3000)]),
      );

      expect(share(body, "")).toBe(body);
    }
  });

  test("a shared drawing that holds another shared drawing links to it from <defs>", () => {
    const inner = group(300);
    const outer = () => element("g", {}, [group(300), path(500)]);
    const out = share(wrap(outer(), outer(), outer(), inner, inner), "");
    const defs = inline(out[0]!);

    expect(defs).toContain("<defs>");
    expect(defs).toMatch(/<g id="u1"><use href="#u2"\/>/);
  });

  test("drawings lead an existing <defs>, or a new <defs> leads the body", () => {
    const copies = [group(300), group(300), group(300)];
    const body = [...wrap(...copies)];
    const without = share(body, "");

    expect(without[0]).toMatchObject({ tag: "defs" });
    expect(without).toHaveLength(2);

    const defs = element("defs", {}, [element("linearGradient", { id: "g" })]);
    const within = share([defs, ...body], "");
    const [head] = within;

    expect(within).toHaveLength(2);
    expect(head).toMatchObject({ tag: "defs" });
    expect(inline(head!)).toMatch(/^<defs>\s*<g id="u1">.*<linearGradient id="g"\/>/s);
  });
});

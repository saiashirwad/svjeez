import { expect, test } from "bun:test";
import { code } from "../src/explain/code";
import { render } from "../src/render";

test("code geometry uses fixed 1-based cells across token boundaries", () => {
  const c = code([[{ content: "ab" }, { content: "cd" }], [{ content: "x cd" }]], { x: 10, y: 20, fontSize: 10, lineHeight: 2, gutter: true, focus: [{ lines: [1, 1], during: { at: 1, over: 2 } }] });
  expect(c.at(1, 1)).toEqual({ x: 28, y: 20 });
  expect(c.find("bc").x).toBe(34);
  expect(c.find("cd", 2).y).toBe(40);
  expect(c.lines(1, 2).pad(2).h).toBe(44);
  expect(() => c.at(3, 1)).toThrow();
  expect(render({ width: 100, height: 100, title: "code", duration: 4 }, c.node)).toContain("xml:space");
});

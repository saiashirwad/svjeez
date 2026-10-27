import { expect, test } from "bun:test";
import { code } from "../src/explain/code";
import { match, morph } from "../src/explain/morph";
import { render } from "../src/render";

test("morph matches ordered occurrences and renders transitions", () => {
  const a = code([[{ content: "a" }, { content: "b" }, { content: "a" }]]);
  const b = code([[{ content: "b" }, { content: "a" }, { content: "a" }]]);
  expect(match(a.tokens, b.tokens)).toEqual([[1, 0], [2, 2]]);
  const m = morph([a, b], { at: [{ at: 0, over: 2 }, { at: 2, over: 2 }], over: 0.5 });
  expect(m.step(1)).toBe(b);
  expect(render({ width: 100, height: 100, title: "morph", duration: 4 }, m.node)).toContain("@keyframes");
});

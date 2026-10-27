import { expect, test } from "bun:test";
import { Camera } from "../src/explain/camera";
import { rect } from "../src/geometry";
import { dataOf } from "../src/motion";

test("camera fits and centers its view in the viewport", () => {
  const node = Camera({ viewport: { w: 800, h: 400 }, stops: [{ at: { at: 0, over: 1 }, view: "all" }, { at: { at: 1, over: 1 }, view: rect(100, 50, 200, 100) }], children: null });
  if (node.kind !== "element") throw new Error("expected element");
  expect(dataOf(node.motions[0]!).steps[0]!.values).toEqual({ x: -400, y: -200, scale: 4 });
});

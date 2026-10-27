import { test, expect } from "bun:test";
import { Arrow, Brace, Callout, Underline } from "../src/explain/annotations";
import { rect } from "../src/geometry";
import { render } from "../src/render";

test("annotations render together", () => {
  const r = rect(20, 20, 30, 20), during = { at: 0, over: 2 };
  const svg = render({ width: 200, height: 100, duration: 3, title: "annotations" }, [Arrow({ from: r.bottom, to: { x: 100, y: 80 }, during }), Brace({ lines: r, during }), Callout({ target: r, during, children: "a useful note" }), Underline({ rect: r, during, style: "squiggle" })]);
  expect(svg).toContain("a useful note");
});

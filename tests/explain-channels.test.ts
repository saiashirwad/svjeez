import { expect, test } from "bun:test";
import { el } from "../src/el";
import { motion } from "../src/motion";
import { render } from "../src/render";
import { rect } from "../src/geometry";
import { Marker } from "../src/explain/marker";

test("geometry channels emit SMIL and marker changes size", () => {
  const svg = render({ width: 100, height: 100, title: "geometry", duration: 4 }, [el.line({ x1: 0, y1: 0, x2: 10, y2: 10, animation: motion().at(1).to({ x1: 5, y1: 4, x2: 20, y2: 30 }, 1) }), Marker({ stops: [{ at: { at: 0, over: 1 }, rect: rect(0, 0, 10, 20) }, { at: { at: 2, over: 1 }, rect: rect(10, 10, 30, 40) }] })]);
  for (const name of ["x1", "y1", "x2", "y2", "width", "height"]) expect(svg).toContain(`attributeName="${name}"`);
});

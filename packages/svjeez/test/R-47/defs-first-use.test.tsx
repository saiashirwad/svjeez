import { describe, expect, test } from "bun:test";
import { def } from "svjeez";
import { defsTree } from "../helpers/compile-fixtures";
import { scene } from "../helpers/compile-scene";

describe("defs", () => {
  test("only referenced defs are emitted, with ids in first-use order", () => {
    const svg = scene(defsTree());
    expect(svg).toContain('<clipPath id="c1">');
    expect(svg).toContain('<linearGradient id="g1" x2="1">');
    expect(svg.match(/<linearGradient/g)).toHaveLength(1);
    expect(svg).toContain('clip-path="url(#c1)"');
    expect(svg.match(/fill="url\(#g1\)"/g)).toHaveLength(2);
  });

  test("filters default to a region covering the canvas", () => {
    const glow = def.filter({}, <feGaussianBlur stdDeviation={2} />);
    expect(scene(<path d="M5 0V10" filter={glow} />)).toContain(
      '<filter id="f1" filterUnits="userSpaceOnUse" x="0" y="0" width="100" height="100">',
    );
  });
});

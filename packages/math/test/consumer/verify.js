import assert from "node:assert/strict";
import { Tex, plane } from "@svjeez/math";
import { Group, Shape, scene } from "svjeez";
import { jsx } from "svjeez/jsx-runtime";
import { svg as backend } from "svjeez/tools";

const graph = plane({ x: [-2, 2], y: [0, 4], size: [200, 100] });

const svg = backend.emit(
  scene({ size: [300, 200], duration: 2, title: "Consumer" }, () =>
    jsx(Group, {
      children: [
        jsx(Tex, {
          size: 32,
          at: [10, 10],
          fill: "#000000",
          draw: 1,
          children: String.raw`\frac{a}{b}+\sqrt{x}`,
        }),
        jsx(Shape, { geometry: graph.plot((x) => x * x), stroke: { color: "#000000" } }),
      ],
    }),
  ),
);

const paths = svg.match(/<path/g)?.length ?? 0;

assert.ok(paths >= 6, `expected glyph paths, got ${paths}`);

assert.doesNotMatch(svg, /<text/);

console.log(`typeset a fraction and a root into ${paths} paths`);

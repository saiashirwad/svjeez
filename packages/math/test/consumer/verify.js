import assert from "node:assert/strict";
import { axes, contours, tex } from "@svjeez/math";
import { render, morph } from "svjeez";

const at = { x: 20, y: 20, fontSize: 40 };
const square = tex(String.raw`(a+b)^2`, at);
const expanded = tex(String.raw`a^2 + \cssId{mid}{2ab} + b^2`, at);

const svg = render({ width: 400, height: 120, duration: 4, title: "Math" }, [
  morph([square, expanded], { at: [1], over: 1 }).node,
]);

assert.match(svg, /^<svg[\s\S]*@keyframes[\s\S]*<path d="M/);

assert.equal(expanded.words[0].text, "a@1");

assert.ok(expanded.get("mid").w > 0);

assert.throws(() => tex(String.raw`\frac{`), /could not parse/);

const graph = axes({ x: [-3, 3], y: [-1, 9], width: 200, height: 100, at: { x: 10, y: 10 } });
const plotted = render({ width: 240, height: 120, duration: 2, title: "Graph" }, [graph.node]);

assert.match(plotted, /^<svg[\s\S]*<line /);

assert.deepEqual(graph.point(-3, 9), { x: 10, y: 10 });

const ring = contours((x, y) => x * x + y * y, {
  levels: [1],
  bounds: { x: 0, y: 0, w: 100, h: 100 },
});

assert.ok(ring.some((level) => level.lines.length > 0));

console.log(`rendered an equation morph into ${(svg.length / 1024).toFixed(1)} KB`);

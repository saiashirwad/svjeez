import assert from "node:assert/strict";
import { chart } from "@svjeez/charts";
import { render } from "svjeez";
import { rect } from "svjeez/geometry";

const c = chart({
  frame: rect(40, 20, 360, 180),
  x: { kind: "band", domain: ["Q1", "Q2", "Q3"] },
  data: [
    ["Q1", 4],
    ["Q3", 9],
  ],
});

const bars = c.bars({ at: 0.5, over: 1 }, { Q1: 4, Q2: 7, Q3: 9 });

const trend = c.line(
  { at: bars.span.end, over: 1 },
  [
    ["Q1", 4],
    ["Q3", 9],
  ],
  { curve: "monotone" },
);

const svg = render({ width: 440, height: 240, duration: 4, title: "Charts" }, [
  c.node,
  bars.node,
  trend.node,
]);

assert.match(svg, /^<svg[\s\S]*@keyframes[\s\S]*<rect/);

assert.match(svg, />Q2<\/text>/);

assert.equal(bars.parts.length, 3);

assert.equal(bars.part("Q2").value, 7);

assert.throws(() => c.bars({ at: 0, over: 1 }, { Q9: 1 }), /not in the x domain/);

console.log(`rendered a chart into ${(svg.length / 1024).toFixed(1)} KB`);

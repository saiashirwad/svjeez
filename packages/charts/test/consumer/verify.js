import assert from "node:assert/strict";
import { chart } from "@svjeez/charts";
import { render } from "svjeez";

const c = chart({
  width: 360,
  height: 180,
  at: { x: 40, y: 20 },
  x: { kind: "band", domain: ["Q1", "Q2", "Q3"] },
  data: [
    ["Q1", 4],
    ["Q3", 9],
  ],
});

const bars = c.bars({ Q1: 4, Q2: 7, Q3: 9 }, { at: 0.5 });

const trend = c.line(
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

assert.equal(bars.bars.length, 3);

assert.throws(() => c.bars({ Q9: 1 }), /not in the x domain/);

console.log(`rendered a chart into ${(svg.length / 1024).toFixed(1)} KB`);

import assert from "node:assert/strict";
import { flowchart, lanes, sequence, stateMachine, tree } from "@svjeez/diagrams";
import { render } from "svjeez";

const chart = flowchart(
  { nodes: { a: "A", b: "B" }, edges: [["a", "b", { label: "go" }]] },
  { play: { at: 0.5 } },
);

const svg = render({ width: 400, height: 300, duration: 4, title: "Diagrams" }, [chart.node]);

assert.match(svg, /^<svg[\s\S]*@keyframes/);

assert.match(svg, />go</);

assert.throws(() => flowchart({ nodes: { a: "A" }, edges: [["a", "c"]] }), /c/);

assert.ok(sequence({ actors: { u: "U", a: "A" }, messages: [["u", "a", "hi"]] }).bounds.w > 0);

assert.ok(stateMachine({ states: { a: "A" }, initial: "a", transitions: [] }).bounds.w > 0);

assert.ok(tree({ nodes: { root: "Root" } }).bounds.w > 0);

assert.ok(
  lanes({ lanes: { a: "A" }, spans: [{ lane: "a", from: 0, to: 1 }] }, { scale: 10 }).bounds.w > 0,
);

console.log(`rendered a flowchart into ${(svg.length / 1024).toFixed(1)} KB`);

import assert from "node:assert/strict";
import { flowchart, lanes, sequence, stateMachine, tree } from "@svjeez/diagrams";
import { Group, font, scene, span } from "svjeez";
import { jsx } from "svjeez/jsx-runtime";
import { SceneError, svg } from "svjeez/tools";

const sans = await font.load(
  new URL("./node_modules/svjeez/skills/svjeez/examples/fonts/Geist-400.ttf", import.meta.url),
);

const o = { font: sans };

const chart = flowchart(
  { nodes: { a: "A", b: "B" }, edges: [["a", "b", "go"]] },
  { ...o, reveal: span(0.5, 0.4) },
);

const out = svg.emit(
  scene({ size: [400, 300], duration: 4, title: "Diagrams" }, () =>
    jsx(Group, { children: chart.node }),
  ),
);

assert.match(out, /^<svg[\s\S]*@keyframes/);
assert.throws(
  () => flowchart({ nodes: { a: "A" }, edges: [["a", "c"]] }, o),
  (error) => error instanceof SceneError && /"c"/.test(error.message),
);
assert.ok(sequence({ actors: { u: "U", a: "A" }, messages: [["u", "a", "hi"]] }, o).size[0] > 0);
assert.ok(stateMachine({ states: { a: "A" }, initial: "a", transitions: [] }, o).size[0] > 0);
assert.ok(tree({ nodes: { root: "Root" } }, o).size[0] > 0);
assert.ok(
  lanes({ lanes: { a: "A" }, spans: [{ lane: "a", at: 0, over: 1 }] }, { ...o, scale: 10 }).size[0] > 0,
);

console.log(`rendered a flowchart into ${(out.length / 1024).toFixed(1)} KB`);

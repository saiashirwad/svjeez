import assert from "node:assert/strict";
import { mermaid, parse } from "@svjeez/mermaid";
import { render } from "svjeez";

const flow = mermaid("flowchart LR\nA([Start]) --> B{OK?}\nB -->|yes| C[Ship]", {
  play: { at: 0.5 },
});

const svg = render({ width: 600, height: 300, duration: 6, title: "Mermaid" }, [flow.node]);

assert.equal(flow.kind, "flowchart");

assert.match(svg, /^<svg[\s\S]*@keyframes/);

assert.match(svg, />Ship</);

assert.equal(mermaid("sequenceDiagram\nA->>B: hi").kind, "sequence");

assert.equal(mermaid("stateDiagram-v2\n[*] --> A\nA --> [*]").kind, "state");

assert.equal(parse("stateDiagram-v2\n[*] --> A").kind, "state");

assert.throws(() => parse("flowchart TD\nA --> B\nclassDef x fill:#f00"), /line 3.*classDef/);

console.log(`rendered a Mermaid flowchart into ${(svg.length / 1024).toFixed(1)} KB`);

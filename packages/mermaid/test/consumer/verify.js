import assert from "node:assert/strict";
import { mermaid } from "@svjeez/mermaid";
import { font, scene } from "svjeez";
import { jsx } from "svjeez/jsx-runtime";
import { Group } from "svjeez";
import { SceneError, svg } from "svjeez/tools";

const sans = await font.load(
  new URL("./node_modules/svjeez/skills/svjeez/examples/fonts/Geist-400.ttf", import.meta.url),
);

const chart = mermaid("flowchart LR\nA([Start]) --> B{OK?}\nB -->|yes| C[Ship]", { font: sans });

assert.equal(chart.kind, "flowchart");

const out = svg.emit(
  scene({ size: [400, 300], duration: 2, title: "Mermaid" }, () =>
    jsx(Group, { children: chart.node }),
  ),
);

assert.match(out, /^<svg/);

assert.equal(mermaid("sequenceDiagram\nA->>B: hi", { font: sans }).kind, "sequence");

assert.equal(mermaid("stateDiagram-v2\n[*] --> A\nA --> [*]", { font: sans }).kind, "state");

assert.throws(
  () => mermaid("flowchart TD\nA --> B\nC@{ shape: bolt }", { font: sans, file: "flow.mmd" }),
  (error) => error instanceof SceneError && /flow\.mmd:3.*bolt/.test(error.message),
);

console.log("drew a Mermaid " + chart.kind);

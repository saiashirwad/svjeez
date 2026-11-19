# @svjeez/diagrams

Flowcharts, sequence diagrams, state machines, trees and swimlanes for svjeez scenes: laid out for you from a plain description, measured with your font, and revealed step by step.

```sh
npm i @svjeez/diagrams@next svjeez@next
```

```tsx
import { flowchart } from "@svjeez/diagrams";
import { Align, scene, span } from "svjeez";
import { sans, theme } from "./style";

const review = flowchart(
  {
    nodes: { open: "Open PR", lint: "Run checks", merge: { label: "Merge", role: "output" } },
    edges: [["open", "lint"], ["lint", "merge", "pass"]],
  },
  { font: sans, reveal: span(0.3, 0.4) },
);

export default scene({ size: [480, 320], duration: 4, title: "Review", theme }, () => (
  <Align>{review.node}</Align>
));
```

Each diagram returns its `node`, its `size`, `part(id)` refs for arrows and `<Align>`, `when(id)` for timing, and routes with `travel(span)` for a token's `at`. `reveal` is a schedule of spans (one span plays the parts in order; a record times the ones it names; a sequence names its rows `message-1`, `note-2`, …). To drive an edge from your own timeline instead, pass `draw: { "pr->lint": progress }`, a track from 0 to 1 per edge id; an edge a `reveal` also draws can't have one. For Mermaid source, use `@svjeez/mermaid`.

[API reference](https://github.com/saiashirwad/svjeez/blob/next/packages/svjeez/skills/svjeez/references/diagrams.md)

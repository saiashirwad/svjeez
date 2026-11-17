# @svjeez/diagrams

Lay out and animate flowcharts, sequence diagrams, state machines, trees and swimlanes from TypeScript.

```sh
npm i -D @svjeez/diagrams svjeez
```

```tsx
import { flowchart } from "@svjeez/diagrams";
import { render } from "svjeez";

const review = flowchart(
  {
    nodes: { open: "Open PR", lint: "Run checks", merge: "Merge" },
    edges: [["open", "lint"], ["lint", "merge", "Pass"]],
  },
  { x: 20, y: 20, play: { at: 0.5, step: 0.6 } },
);

export default () =>
  render(
    { width: review.bounds.w + 40, height: review.bounds.h + 40, duration: 4, title: "Review" },
    review.node,
  );
```

Use `part(id).box` to place an annotation and `part(id).span` to time it. Flowcharts also expose `route(from, to)` for motion along their edges. For Mermaid source, use [@svjeez/mermaid](https://www.npmjs.com/package/@svjeez/mermaid).

<a href="https://github.com/saiashirwad/svjeez/tree/main/examples/flowchart"><img src="https://raw.githubusercontent.com/saiashirwad/svjeez/main/examples/dist/flowchart.svg" width="540" alt="A code review flowchart reveals and a token travels through it." /></a>

[API reference](https://github.com/saiashirwad/svjeez/blob/main/packages/svjeez/skills/svjeez/references/diagrams.md)

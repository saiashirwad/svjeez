# @svjeez/diagrams

Flowcharts, sequence diagrams, state machines, trees, and swimlanes for `svjeez`. Laid out automatically with real font metrics and revealed step by step.

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

- Every diagram returns `node`, `size`, `part(id)` refs (for arrows or `<Align>`), `when(id)` timing handles, and edge routes with `travel(span)`.
- `reveal` accepts either a single `span` (plays parts in order) or a record mapping part IDs to spans.
- Pass `draw: { "open->lint": track }` to drive an edge from your own timeline instead of `reveal`.
- For Mermaid syntax input, use `@svjeez/mermaid`.

[API reference](https://github.com/saiashirwad/svjeez/blob/next/packages/svjeez/skills/svjeez/references/diagrams.md)

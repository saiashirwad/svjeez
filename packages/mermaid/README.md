# @svjeez/mermaid

Turn Mermaid text into an animated svjeez flowchart, sequence diagram or state diagram.

```sh
npm i -D @svjeez/mermaid svjeez
```

```tsx
import { mermaid } from "@svjeez/mermaid";
import { render } from "svjeez";

const chart = mermaid(
  `flowchart LR
    pr([PR opened]) --> lint[Run linters]
    lint --> ok{Clean?}
    ok -->|yes| post([Post review])
    ok -->|no| fix[Draft fixes] --> lint`,
  { x: 40, y: 40, play: { at: 0.4, step: 0.4 } },
);

export default () =>
  render(
    { width: chart.bounds.w + 80, height: chart.bounds.h + 80, duration: 6, title: "Review" },
    chart,
  );
```

`mermaid(text, options)` returns a diagram with `kind`, `doc`, `node`, `span`, `bounds` and named parts. `parseMermaid(text)` returns the parsed document for tools that only need the structure.

The adapter supports a subset of Mermaid. Flowcharts lay out top-to-bottom or left-to-right. Sequence diagrams support participants, messages and single-participant notes. Edge styles and message heads carry through to the SVG. State diagrams include composite states. Syntax outside the supported subset, such as styling directives, activation bars and sequence blocks, throws a line-numbered `MermaidSyntaxError`.

<a href="https://github.com/saiashirwad/svjeez/tree/main/examples/mermaid"><img src="https://raw.githubusercontent.com/saiashirwad/svjeez/main/examples/dist/mermaid.svg" width="540" alt="A Mermaid flowchart animates into place." /></a>

[API reference](https://github.com/saiashirwad/svjeez/blob/main/packages/svjeez/skills/svjeez/references/mermaid.md)

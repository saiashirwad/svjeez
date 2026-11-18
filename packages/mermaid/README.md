# @svjeez/mermaid

Draw Mermaid text as a svjeez diagram: flowcharts, sequence diagrams and state diagrams.

```sh
npm i -D @svjeez/mermaid svjeez
```

```ts
import { mermaid } from "@svjeez/mermaid";

const chart = mermaid(
  `flowchart LR
  pr([PR opened]) --> lint[Run linters]
  lint --> ok{Clean?}
  ok -->|yes| post([Post review])`,
  { font, reveal: span(0.2, 0.3) },
);
```

`mermaid(text, options)` returns the diagram `flowchart()`, `sequence()` or `stateMachine()` from `@svjeez/diagrams` would, with `kind` and the parsed `doc` added. The options are the diagram's own, plus `file` and `line` to say where the text sits in your source, so an error points at the Mermaid line as `file:line`. `parseMermaid(text, { file, line })` returns just the document, as plain data.

The reader supports a subset of Mermaid. Syntax outside it, such as styling directives, activation bars and sequence blocks, throws a `SceneError` that names the line and what to write instead.

[API reference](https://github.com/saiashirwad/svjeez/blob/main/packages/svjeez/skills/svjeez/references/mermaid.md)

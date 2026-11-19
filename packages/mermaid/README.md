# @svjeez/mermaid

Parse Mermaid flowcharts, sequence diagrams, and state diagrams into animated `@svjeez/diagrams` scenes.

```sh
npm i -D @svjeez/mermaid@next svjeez@next
```

```ts
import { mermaid } from "@svjeez/mermaid";
import { span } from "svjeez";

const chart = mermaid(
  `flowchart LR
  pr([PR opened]) --> lint[Run linters]
  lint --> ok{Clean?}
  ok -->|yes| post([Post review])`,
  { font, reveal: span(0.2, 0.3) },
);
```

- `mermaid(text, options)` returns the same diagram object as `flowchart()`, `sequence()`, or `stateMachine()` from `@svjeez/diagrams`, plus `kind` and the parsed `doc`.
- Pass `file` and `line` in `options` so syntax errors point directly to the source line. Use `parseMermaid(text, { file, line })` to get the parsed document without building a diagram.
- Unsupported Mermaid directives (such as styling directives, activation bars, and sequence blocks) throw a `SceneError` naming the line and the supported alternative.

[API reference](https://github.com/saiashirwad/svjeez/blob/next/packages/svjeez/skills/svjeez/references/mermaid.md)

# Mermaid

`@svjeez/mermaid` (`npm i @svjeez/mermaid@next`) reads Mermaid text and draws it with `@svjeez/diagrams`. `mermaid(text, options)` returns the same diagram `flowchart()`, `sequence()` or `stateMachine()` would, so everything in [diagrams.md](diagrams.md) applies to it: `node`, `with`, `size`, `part`, `when`, `route`, `walk`.

```tsx
/** @jsxImportSource svjeez */
import { mermaid } from "@svjeez/mermaid";
import { Align, Group, Shape, scene, span } from "svjeez";
import { sans, theme } from "./style";

const chart = mermaid(
  `flowchart LR
    pr([PR opened]) --> lint[Run linters]
    lint --> ok{Clean?}
    ok -->|yes| post([Post review])
    ok -->|no| lint`,
  { font: sans, textSize: 13, reveal: span(0.3, 0.35) },
);

export default scene({ size: [720, 200], duration: 4, title: "Review", theme, loop: false }, (canvas) => (
  <Group>
    <Shape geometry={canvas.rect} fill={theme.background} />
    <Align>{chart.node}</Align>
  </Group>
));
```

## What it returns

The diagram, plus `kind` (`"flowchart"`, `"sequence"` or `"state"`) and `doc`, the parsed text as plain data. Narrow on `kind` to reach `route()`, `message()` or `walk()`:

```ts
if (chart.kind === "flowchart") chart.route("pr", "post");
```

Parts are named by the Mermaid ids: nodes, subgraphs, and edges as `"from->to"`. `parseMermaid(text)` returns only `doc`.

## Options

The diagram's own (`font` is required, then `textSize`, `weight`, `colors`, `draw`), a `reveal` that is one span, a `direction`,, plus `file` and `line`: where the text sits in your source, so an error points at the Mermaid line as `file:line`. `direction` overrides the text; a flowchart written `BT` or `RL` needs it, since svjeez lays out `TB` and `LR`. A `direction` on a sequence diagram, or a `reveal` on a state diagram, is an error, never ignored.
## What it reads

- `flowchart` or `graph` with a direction. Nodes `A[text]`, `A(text)`, `A([text])`, `A{text}`, `A((text))`, `A[[text]]`, `A[(text)]` draw as the roles `task`, `task`, `input`, `decision`, `output`, `tool` and `store`. Edges `-->`, `---`, `-.->`, `==>` (solid, plain, dotted, thick) with `|text|` or `-- text -->` labels, chains, `A & B --> C`, and `subgraph id [title]` ... `end`.
- `sequenceDiagram` with `participant A`, `actor A`, `participant A as Alice`, messages `A->>B: text` with the arrows `->>` `-->>` `->` `-->` `-x` `--x` `-)` `--)`, and `Note over A: text`. An `actor` draws as `input`, a participant as `task`.
- `stateDiagram` or `stateDiagram-v2` with `[*] --> A`, `A --> [*]`, `A --> B : label`, `state "Long name" as A`, composite `state A {` ... `}` and `direction LR` at the top.
- `%%` comments. Anything else (styling, `click`, activation bars, `loop` and `alt` blocks, `%%{ }%%` directives, choices) throws.

## Errors

Parse errors name the line, as `"<line>": <problem>`, with `file:line` when you pass `file`: no Mermaid text, a first line that names no diagram type (start with `flowchart`, `sequenceDiagram` or `stateDiagram`), a flowchart written in a direction svjeez doesn't lay out (write `TD` or `LR`, or pass `direction`), a `direction` on a sequence diagram, a `reveal` on a state diagram (time the machine with `walk()`).

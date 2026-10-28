# Diagrams from Mermaid text with @svjeez/mermaid

`@svjeez/mermaid` is a separate package: `npm i -D @svjeez/mermaid`. `mermaid()` reads a Mermaid flowchart, sequence diagram or state diagram and calls `flowchart()`, `sequence()` or `stateMachine()` with it, so the result is themed, laid out and animated like any svjeez diagram. It has no dependencies and needs no DOM. Reach for it when the diagram already exists as Mermaid text; to build one from scratch, use the typed functions in [`diagrams.md`](diagrams.md).

```tsx
import { mermaid } from "@svjeez/mermaid";
import { render } from "svjeez";
import { flow } from "svjeez/extras";
import { css, mono, theme } from "./style";

const chart = mermaid(
  `flowchart TD
    push([Push to main]) --> test{Tests pass?}
    test -->|yes| ship[Deploy]
    test -->|no| fix[Draft fixes] --> test`,
  { theme, font: mono, x: 40, y: 40, play: { at: 0.4, step: 0.35 } },
);

if (chart.kind !== "flowchart") throw new Error("expected a flowchart");
const { under, over } = chart.layers;
const trip = flow(chart.route("push", "ship"), { at: 3, speed: 160, style: "trace", arrive: true });

<>
  {under}
  {trip.node}
  {over}
</>;
```

- `mermaid(text, options)` takes svjeez's own options: `theme`, `font`, `fontSize`, `x`, `y`, `anchor`, `class`, `direction` and `play`. Each kind reads the ones it knows. `direction` in the options beats the text.
- It returns the svjeez diagram plus `kind` (`"flowchart"`, `"sequence"` or `"state"`) and `doc`. Narrow on `kind` to get `layers`, `route()` and `edge()` on a flowchart, `message(i)` on a sequence diagram, and `walk()` on a state diagram. Ids are the Mermaid ids, as plain strings, so there is no compile-time check on them.
- `parse(text)` returns the plain model (`FlowchartDoc`, `SequenceDoc` or `StateDoc`) without importing svjeez.

## What it reads

Anything else throws a `MermaidSyntaxError` naming the line number and the line. Comment lines (`%%`), blank lines and a trailing `;` are ignored.

- Flowcharts: `flowchart` or `graph` with `TD`, `TB` or `LR`, node forms `A[ ]` task, `A( )` task, `A([ ])` input, `A{ }` decision, `A(( ))` output, `A[[ ]]` tool and `A[( )]` store, edges `-->` `---` `-.->` `==>` with `|text|` or `-- text -->` labels, chains, `A & B --> C`, and `subgraph id [Title]` ... `end`. Every edge draws as one solid arrow whatever its style. Subgraphs are flat and never empty. `BT` and `RL` throw, because svjeez lays out `TB` and `LR`. Quote a label that holds a bracket: `A["list[0]"]`.
- Sequence diagrams: `participant` and `actor` with `as`, the messages `->>`, `-->>`, `->`, `-->`, `-x`, `--x`, `-)` and `--)`, and `Note over A: text` on one actor. A `--` arrow draws as a dashed reply. `activate`, `+` and `-` marks, `loop`/`alt`/`opt`/`par`, `autonumber` and notes left of, right of or over several actors throw.
- State diagrams: `stateDiagram` or `stateDiagram-v2`, `[*] --> A` (the start, once per scope), `A --> [*]` (marks `A` final), `A --> B : label`, `state "Long name" as A`, composite `state A {` ... `}` and `direction LR` at the top. Choice, fork, join, notes, `--` concurrency and `A : description` throw.
- `classDef`, `class`, `style`, `linkStyle`, `click` and `%%{ }%%` directives throw: svjeez themes and positions the diagram itself.

## Errors

| Error | Fix |
| --- | --- |
| `Mermaid syntax error on line N ("…"): …` | The message after the colon says what is unsupported and what is supported. Edit that line. |
| `parse() got no Mermaid text.` | Start with `flowchart TD`, `sequenceDiagram` or `stateDiagram-v2`. |
| `mermaid() cannot draw direction BT: …` | Write `TD` or `LR`, or pass `{ direction }`. |

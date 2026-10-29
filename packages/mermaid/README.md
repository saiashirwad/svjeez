# @svjeez/mermaid

Mermaid text for [svjeez](https://www.npmjs.com/package/svjeez) scenes. `mermaid()` reads a flowchart, sequence diagram or state diagram and hands it to svjeez's `flowchart()`, `sequence()` or `stateMachine()`, so the diagram comes out themed, laid out and animated like any other svjeez diagram. The parser is a small hand-written one with no dependencies, and it never needs a DOM, so it runs while the scene builds.

<p align="center">
  <a href="https://github.com/saiashirwad/svjeez/tree/main/examples/mermaid"><img src="https://raw.githubusercontent.com/saiashirwad/svjeez/main/examples/dist/mermaid.svg" width="320" alt="A deploy pipeline written as Mermaid text appears node by node as a svjeez flowchart, then a token runs from the push to the live release." /></a>
  <br /><sub>A Mermaid flowchart laid out and played as a svjeez diagram</sub>
</p>

## Install

```sh
npm i -D @svjeez/mermaid svjeez
```

## Use

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
    chart.node,
  );
```

`mermaid(text, options)` returns the svjeez diagram, plus `kind` and the parsed `doc`. Narrow on `kind` to reach what only one diagram has:

```ts
const d = mermaid(text);

if (d.kind === "state") d.walk(["Idle", "Run"], { at: 1 });
if (d.kind === "flowchart") d.route("a", "b");
if (d.kind === "sequence") d.message(0);
```

The options are svjeez's own, passed straight through: `theme`, `font`, `fontSize`, `x`, `y`, `anchor`, `class`, `direction` (flowcharts and state diagrams) and `play` (flowcharts and sequence diagrams). Each kind reads the options it knows. `direction` in the options wins over the one in the text.

`parse(text)` returns the plain model without importing svjeez: a `FlowchartDoc`, `SequenceDoc` or `StateDoc`, told apart by `kind`. Use it to lint or transform Mermaid text, or to build the svjeez spec yourself.

## What it reads

Anything else throws a `MermaidSyntaxError` with the line number, the line and what is supported. A line is never dropped. `%%` comment lines, blank lines and a trailing `;` are ignored, and `<br>` in a label becomes a space.

### Flowcharts

- `flowchart` or `graph`, then `TD`, `TB`, `LR`, `BT` or `RL`. Without a direction it is `TD`. svjeez lays out `TB` and `LR` only, so `mermaid()` throws on `BT` and `RL` unless you pass `direction`.
- Node forms, which pick a svjeez node role:

  | Mermaid | Form | svjeez role |
  | --- | --- | --- |
  | `A[text]` | rectangle | `task` |
  | `A(text)` | rounded | `task` |
  | `A([text])` | stadium | `input` |
  | `A{text}` | diamond | `decision` |
  | `A((text))` | circle | `output` |
  | `A[[text]]` | subroutine | `tool` |
  | `A[(text)]` | cylinder | `store` |

  Quote a label that holds a bracket: `A["list[0]"]`. The table is exported as `FORM_ROLES`.
- Edges `-->`, `---`, `-.->`, `==>`, with labels as `-->|text|` or `-- text -->`. Edge styles are parsed into the model, but svjeez draws every edge as a solid arrow.
- Chains `A --> B --> C` and lists `A & B --> C & D`.
- `subgraph id [Title]`, `subgraph Title` and `end`. A node mentioned inside a subgraph belongs to the first subgraph that mentions it. Subgraphs cannot nest, cannot be empty and cannot be an edge's end.
- Not supported: `classDef`, `class`, `style`, `linkStyle`, `click`, `direction` and `title` lines, `:::` classes, other arrow heads such as `--o`.

### Sequence diagrams

- `participant A`, `actor A` and `participant A as Alice`. A participant first named in a message is declared there. An `actor` draws with the `input` role and a `participant` with `task`.
- Messages `A->>B: text`, with `->>`, `-->>`, `->`, `-->`, `-x`, `--x`, `-)` and `--)`. A `--` arrow draws dashed, like a reply. svjeez draws every head the same, and `A->>A` loops on the right.
- `Note over A: text`, on one actor.
- Not supported, and rejected: `Note left of`, `Note right of`, notes over several actors, `activate`, `deactivate`, the `+` and `-` activation marks, `loop`, `alt`, `opt`, `par` and the other blocks, `autonumber`, `box`, `create`, `destroy`.

### State diagrams

- `stateDiagram` or `stateDiagram-v2`.
- `[*] --> A` is the start, and `A --> [*]` marks `A` final. Every scope needs exactly one start, and the start and end lines take no label.
- `A --> B` and `A --> B : label`.
- `state "Long name" as A`, and composite states `state A {` ... `}` with their own start. Transitions may cross levels.
- `direction LR` or `TB` once, at the top.
- Not supported: `<<choice>>`, `<<fork>>` and `<<join>>`, `note`, concurrency with `--`, `A : description`, `direction` inside a composite.

## The model

`parse()` and `mermaid().doc` give plain data.

- `FlowchartDoc`: `direction`, `nodes` (`id`, `label`, `form`), `edges` (`from`, `to`, `label`, `line`, `arrow`) and `subgraphs` (`id`, `title`, `nodes`).
- `SequenceDoc`: `participants` (`id`, `label`, `role`) and `items`, each a `message` (`from`, `to`, `text`, `line`, `head`) or a `note` (`actor`, `text`).
- `StateDoc`: `initial`, `direction`, `states` (`id`, `label`, `final`, `inner`) and `transitions` (`from`, `to`, `label`).

## Errors

`MermaidSyntaxError` has `line` and `source` beside its message, such as `Mermaid syntax error on line 4 ("classDef red fill:#f00"): classDef is not supported: …`. `mermaid()` also throws for a `BT` or `RL` flowchart. Errors from svjeez itself, such as a `walk()` through a state that does not exist, keep svjeez's message.

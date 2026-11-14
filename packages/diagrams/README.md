# @svjeez/diagrams

Animated diagrams for [svjeez](https://www.npmjs.com/package/svjeez) scenes. `flowchart()`, `sequence()`, `stateMachine()`, `tree()` and `lanes()` take a typed spec, lay it out for you and play it step by step. A misspelled node id is a compile error. The result is plain SVG elements with CSS keyframes, so a diagram is still one file with no JavaScript.

<p align="center">
  <a href="https://github.com/saiashirwad/svjeez/tree/main/examples/flowchart"><img src="https://raw.githubusercontent.com/saiashirwad/svjeez/main/examples/dist/flowchart.svg" width="640" alt="A code-review flowchart appears rank by rank, then a token runs from the opened pull request to the posted review." /></a>
  <br /><sub>A flowchart laid out and played by <code>flowchart()</code></sub>
</p>

## Install

```sh
npm i -D @svjeez/diagrams svjeez
```

## Use

```tsx
import { flowchart } from "@svjeez/diagrams";
import { flow, render } from "svjeez";

const chart = flowchart(
  {
    nodes: { pr: { label: "PR opened", role: "input" }, lint: "Run linters", post: "Post review" },
    edges: [["pr", "lint"], ["lint", "post", { label: "clean" }]],
  },
  { x: 40, y: 40, play: { at: 0.4, step: 0.4 } },
);

const trip = flow(chart.route("pr", "post"), { at: 2, style: "comet" });

export default () =>
  render(
    { width: chart.bounds.w + 80, height: chart.bounds.h + 80, duration: 5, title: "Review" },
    <>{chart.layers.under}{trip.node}{chart.layers.over}</>,
  );
```

Each diagram returns `{ node, get(id), bounds }` plus helpers such as `route()` and `walk()`. Size the canvas from `bounds`.

| Function | Draws |
| --- | --- |
| `flowchart` | Nodes in ranks, grouped nodes, labelled edges that route around nodes |
| `sequence` | Actors, messages, replies and notes |
| `stateMachine` | States, composite states and transitions, with `walk()` through them |
| `tree` | A parent-linked hierarchy |
| `lanes` | Spans, events and links on a real-time axis |

[`references/diagrams.md`](https://github.com/saiashirwad/svjeez/blob/main/packages/svjeez/skills/svjeez/references/diagrams.md) in the svjeez skill covers every option. [`@svjeez/mermaid`](https://www.npmjs.com/package/@svjeez/mermaid) reads Mermaid text into these diagrams.

## Moved from svjeez/extras

These came from `svjeez/extras` and no longer exist there. Import them from `@svjeez/diagrams`: `flowchart`, `sequence`, `lanes`, `tree`, `stateMachine` and their types (`Diagram`, `DiagramOptions`, `NodeRole`, `Flowchart`, `Sequence`, `Lanes`, `Tree`, `StateMachine` and the rest). `flow()` and `travel()` stay in `svjeez`.

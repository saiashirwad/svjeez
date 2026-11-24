# Diagrams

`@svjeez/diagrams` (`npm i @svjeez/diagrams@next`) lays out flowcharts, trees, sequence diagrams, state machines and swimlanes from a plain description, measures every label with your font, and reveals them step by step. It draws with the same nodes a scene does, so a diagram is checked, framed and themed like the rest.

```tsx
/** @jsxImportSource svjeez */
import { flowchart } from "@svjeez/diagrams";
import { Align, Group, Shape, circle, exit, scene, span, track } from "svjeez";
import { sans, theme } from "./style";

const chart = flowchart(
  {
    nodes: {
      pr: { label: "PR opened", role: "input" },
      lint: { label: "Run linters", role: "tool" },
      ok: { label: "Clean?", role: "decision" },
      post: { label: "Post review", role: "output" },
    },
    groups: { agent: { label: "Review agent", nodes: ["lint", "ok"] } },
    edges: [["pr", "lint"], ["lint", "ok"], ["ok", "post", "yes"], ["ok", "lint", "no"]],
  },
  {
    font: sans,
    textSize: 13,
    direction: "LR",
    reveal: span(0.3, 0.35),
    colors: { background: theme.background, text: theme.text, line: theme.muted, accent: theme.blue },
  },
);

const trip = span(2.4, 1.6);

export default scene({ size: [720, 200], duration: 5, title: "Review", theme, loop: false }, (canvas) => (
  <Group>
    <Shape geometry={canvas.rect} fill={theme.background} />
    <Align>
      <Group>
        {chart.node}
        <Shape
          geometry={circle(4)}
          fill={theme.red}
          offset={chart.route("pr", "post").travel(trip)}
          opacity={track(0).to(1, span(trip.start, 0.1)).to(0, span(trip.end - 0.2, 0.2))}
        />
      </Group>
    </Align>
  </Group>
));
```

## The five diagrams

| Call | Description | Returns besides the common fields |
| --- | --- | --- |
| `flowchart({ nodes, edges, groups? }, options)` | nodes by id, edges `[from, to, label?, { line, head }?]`, groups of node ids drawn as a dashed frame | `edge(from, to)`, `route(from, to)`: the shortest path along edges |
| `tree({ nodes }, options)` | each node names its `parent`; exactly one has none | `route(from, to)`: up to the common ancestor and down |
| `sequence({ actors, messages }, options)` | messages `[from, to, label, { reply, head }?]` (a reply is dashed), or `{ note, text }` | `message(i)`: its `span` and its `route` |
| `stateMachine({ states, initial, transitions }, options)` | a state is a label or `{ label, role, final, states, initial }`; `states` nests a composite | `edge(from, to)`, `walk(path, { at, speed })` |
| `lanes({ lanes, spans, events, links }, options)` | bars `{ lane, at, over }`, events `{ lane, at }` and links `{ from, to, at }` in lane seconds; `scale` is pixels per second | `x(t)`: the axis position of lane second `t` |

A node is a label or `{ label, role }`; `role` (`task`, `input`, `output`, `tool`, `decision`, `store`) picks its outline and color. Ids are typed: an edge, a parent, a message or a transition naming a node the spec lacks is a type error.

## Options

- `font` (required) measures and draws every label; `textSize` (default 14) and `weight` for node labels, which the family must have.
- `colors`: `{ background, text, line, accent, muted?, highlight?, roles? }`. Without it the diagram uses a light and dark palette of its own. A role takes `roles[role]`, else `accent`; a node's fill is its color washed over `background`.
- `direction`: `"TB"` (default) or `"LR"` for flowcharts, trees and state machines.
- `reveal`: one span plays every part a beat each, end to end, in layout order: `span(0.3, 0.35)` brings the first in over 0.3 to 0.65, the next over 0.65 to 1. A record `{ lint: span(1, 0.3) }` times the ones it names and leaves the rest there from the start. Edges draw on as their later end enters, labels after them. A sequence takes one span, or a record by row id (`message-1`, `note-2`, counted over messages and notes together). Lanes take a span only: `span(start, over)` fits the timeline into `over`, an open `span(start)` plays at its own rate.
- `draw: { "a->b": track }` drives an edge from your own timeline, 0 to 1 (`message-N` and `link-N` in sequences and lanes). An edge a `reveal` also draws throws.
- An edge head is fixed at the end and shows once the drawn line reaches its base, like an `<Arrow>` head ([refs-arrows.md](refs-arrows.md)); a dashed edge fades its head in with the line.

## What a diagram gives back

- `node`: the drawing, its top-left at `[0, 0]` of its frame. Place it with `<Align>`, a `<Group offset>` or a container, and scale it with the group's `scale`. `size` is `[width, height]`.
- `with(child)`: the drawing with `child` over the edges and under the nodes and labels, for a trace along a route.
- `part(id)`: a ref to a node, a group, an actor, a lane or an edge (`"pr->lint"`), for `<Align to>`, `<Arrow from to>` and anchors. `ref` is the diagram's own ref. Inside a node, `"shape"` and `"label"` are parts too.
- `when(id)`: the span in which that part enters, or `undefined` when it is there from the start; `span` is the whole reveal.
- A `Route`: `points`, `length`, `geometry` (a path along the edges, to stroke and `draw`), `at(fraction)` and `travel(span)`, a track for a token's `at` that runs the route at an even speed.
- A walk lights each state of its path in turn and runs a token between them. `at: span(start, dwell)` lights the first state for `dwell`, and each next one when the token, moving at `speed` pixels per second, reaches it; a list of spans, one per state, says when each lights. Draw it with `machine.with(walk.node)`; `walk.spans[state]` and `walk.span` say when.

## Loops and checks

A diagram that reveals itself enters; a looping scene must take it away again before the loop (`<Align motion={exit(chart.span!.next(0.5, 4))}>`), or set `loop: false`. Everything a diagram draws carries the line of the call that made it, so `check` points there.

## Errors

Each names the diagram call: it needs a `font` to measure labels with; a `reveal` names something that is not one of its nodes; a node sits in two groups; there is no way from one node to another along its edges (`route`, `walk`); a state machine can't draw a transition between a composite and its inner state; a `part(id)` that doesn't exist (edges are `"from->to"`).

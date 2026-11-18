# Diagrams

`@svjeez/diagrams` (`npm i @svjeez/diagrams@next`) lays out flowcharts, trees, sequence diagrams, state machines and swimlanes from a plain description, measures every label with your font, and reveals them step by step. It draws with the same nodes a scene does, so a diagram is checked, framed and themed like the rest.

```tsx
/** @jsxImportSource svjeez */
import { flowchart } from "@svjeez/diagrams";
import { Align, Group, Shape, canvas, circle, scene, span, track } from "svjeez";
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
    size: 13,
    direction: "LR",
    reveal: span(0.3, 0.35),
    colors: { background: theme.background, text: theme.text, line: theme.muted, accent: theme.blue },
  },
);

const trip = span(2.4, 1.6);

export default scene({ size: [720, 200], duration: 5, title: "Review", theme, loop: false }, () => (
  <Group>
    <Shape geometry={canvas.rect} fill={theme.background} />
    <Align>
      <Group>
        {chart.node}
        <Shape
          geometry={circle(4)}
          anchor="center"
          fill={theme.red}
          at={chart.route("pr", "post").travel(trip)}
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
| `sequence({ actors, messages }, options)` | messages `[from, to, label, { reply, head }?]` (a reply is dashed), or `{ note, text }` | `message(i)`: its beat and its route |
| `stateMachine({ states, initial, transitions }, options)` | a state is a label or `{ label, role, final, states, initial }`; `states` nests a composite | `edge(from, to)`, `walk(path, { at, speed })` |
| `lanes({ lanes, spans, events, links }, options)` | bars `{ lane, at, over }`, events `{ lane, at }` and links `{ from, to, at }` in lane seconds; `scale` is pixels per second | `x(t)`: the axis position of lane second `t` |

A node is a label or `{ label, role }`; `role` (`task`, `input`, `output`, `tool`, `decision`, `store`) picks its outline and color. Ids are typed: an edge, a parent, a message or a transition naming a node the spec lacks is a type error.

## Options

- `font` (required) measures and draws every label; `size` (default 14) and `weight` for node labels, which the family must have.
- `colors`: `{ background, text, line, accent, muted?, highlight?, roles? }`. Without it the diagram uses a light and dark palette of its own. Each role takes `roles[role]`, else `accent`; a node's fill is its color washed over `background`. `highlight` marks walks, playheads and link pulses.
- `direction`: `"TB"` (default) or `"LR"` for flowcharts, trees and state machines.
- `reveal`: one span plays every node a beat each, end to end, in layout order: `span(0.3, 0.35)` brings the first in over 0.3 to 0.65, the next over 0.65 to 1. A record `{ lint: span(1, 0.3) }` times the nodes it names and leaves the rest there from the start. Edges draw on as their later end enters, labels after them. A sequence takes one span (a beat per message) or a list of one span per message. Lanes take `span(start)` to play in real time, or `span(start, over)` to fit the whole timeline into `over`.
- `name`: the key of the diagram's ref, by default its kind (`"flowchart"`). Give two diagrams in one scene different names.

## What a diagram gives back

- `node`: the drawing, with its top-left at `[0, 0]` of its frame. Place it with `<Align>`, a `<Group offset>` or a container, and scale it with the group's `scale`.
- `with(child)`: the drawing with `child` over the edges and under the nodes and labels, for a trace along a route.
- `size`: `[width, height]`, to size the canvas or a scale.
- `part(id)`: a ref to a node, a group, an actor, a lane or an edge (`"pr->lint"`), for `<Align to>`, `<Arrow from to>` and timeline verbs. Inside a node, `"shape"` and `"label"` are parts too: `chart.part("lint").part("shape").fill(theme.red, 0.3)`.
- `when(id)`: the span in which that part enters, or `undefined` when it is there from the start; `span` is the whole reveal.
- A route: `points`, `length`, `geometry` (a path along the edges, to stroke and `draw()`), `at(fraction)` and `travel(span)`, a track for a token's `at` that runs the route at an even speed.

A walk lights each state of its path in turn and runs a token between them. `at: span(start, dwell)` lights the first state for `dwell`, and each next one when the token, moving at `speed` pixels per second, reaches it; a list of spans, one per state, lights each when its span says. Draw it with `machine.with(walk.node)` or after `machine.node` in the same frame; `walk.spans[state]` and `walk.span` say when.

## Loops and checks

A diagram that reveals itself enters; a looping scene must take it away again before the loop, as with `<Align motion={exit(chart.span!.next(0.5, 4))}>`, or set `loop: false`. Everything a diagram draws carries the line of the call that made it, so `check` points there.

## Errors

| Message | Fix |
| --- | --- |
| `… needs a font to measure its labels with.` | pass `font` in the options |
| `… edge 1 names "…", which is not one of its nodes.` | name a node the spec has; the hint lists them |
| `… reveal names "…", which is not one of its nodes.` | time only nodes the diagram has |
| `… puts node "…" in two groups, "…" and "…".` | a node sits in one group at most |
| `… has no way from "…" to "…" along its edges.` | route between nodes an edge path joins |
| `walk() has no way from "…" to "…".` | each next state needs a transition from the one before, or is the initial state inside it |
| `stateMachine() can't draw a transition between "…" and "…", because one holds the other.` | draw it from a sibling of the composite or from an inner state |
| `… has no part "…".` | the hint lists the parts; edges are `"from->to"` |

# Diagrams

`flowchart`, `sequence`, `stateMachine`, `tree` and `lanes` take a typed spec, so a misspelled id is a compile error: `Type '"c"' is not assignable to type '"a" | "b"'`. Import them from `svjeez/extras`. Each returns `{ node, get(id), bounds }` plus helpers.

Options common to all: `theme`, `x`, `y`, `anchor` (`"top-left"`, `"center"` or an edge, which part of `bounds` lands on `x, y`), `fontSize`, `font` and `class`. Size the canvas from `bounds`, not a guess. `flowchart`, `tree` and `stateMachine` take `direction: "TB" | "LR"`. A node `role` picks its shape and color: `task`, `input`, `output`, `tool`, `decision`, `store`.

## Timing

| Diagram | How it plays |
| --- | --- |
| `flowchart` | `play: { at, step? }`. Nodes appear rank by rank, each edge draws as its target appears. Default step 0.4 |
| `tree` | `play: { at, step? }`. Breadth first. Default step 0.3 |
| `sequence` | `play: { at, step? }`. One message or note per step, default 0.8 |
| `lanes` | `play: { at }`. Real time: a playhead sweeps, spans grow, events pop |
| `stateMachine` | No `play`. Call `walk(ids, { at })` |

`at` is a `Beats`: a start time, or an array with one time per item, to keep two diagrams in sync. `lanes` takes a plain start time, because its spans already play in real time. Without `play`, everything is there from the start.

## Flowchart

```tsx
import { flow, flowchart } from "svjeez/extras";

const chart = flowchart(
  {
    nodes: { pr: { label: "PR opened", role: "input" }, lint: { label: "Run linters", role: "tool" }, ok: { label: "Clean?", role: "decision" }, post: "Post review" },
    groups: { agent: { label: "Review agent", nodes: ["lint", "ok"] } },
    edges: [["pr", "lint"], ["lint", "ok"], ["ok", "post", { label: "yes" }], ["ok", "lint", { label: "no" }]],
  },
  { play: { at: 0.5 }, direction: "TB" },
);
const trip = flow(chart.route("pr", "post"), { at: 4, style: "trace", arrive: true });
const picture = <>{chart.layers.under}{trip.node}{chart.layers.over}</>; // the flow runs between edges and nodes
```

`edge(from, to)` is the drawn line, `route(from, to)` the shortest path through nodes, both as points. `layers` splits the diagram so a flow runs between edges and nodes.

`flow(points, { at })` runs a token along any path. `style` is `dot`, `comet`, `trace` or `packet` (a labelled chip: pass `label`). `speed` is px per second, or set `over`. `arrive` adds a ripple at the end. It returns `{ node, end }`. `loop` runs a dot, comet or packet again every that many seconds, and `tail` sets how many dots trail a comet. `travel(points, { at, speed, over })` is the bare motion: draw your own token at the origin and give it `animation={travel(...)}`.

## Sequence

```tsx
import { sequence } from "svjeez/extras";

const login = sequence(
  {
    actors: { user: "User", api: "API", db: { label: "Postgres", role: "store" } },
    messages: [["user", "api", "POST /login"], ["api", "db", "select"], ["db", "api", "row", { reply: true }], { note: "api", text: "hash check" }],
  },
  { play: { at: 0.5, step: 0.8 } },
);
const slot = login.message(2); // { span, points }: when it plays and where it runs
```

## State machine

```tsx
import { stateMachine } from "svjeez/extras";

const agent = stateMachine(
  {
    states: { idle: "Idle", working: { label: "Working", states: { plan: "Plan", act: "Act" }, initial: "plan" }, done: { label: "Done", final: true } },
    initial: "idle",
    transitions: [["idle", "working", "task"], ["plan", "act"], ["act", "plan"], ["working", "done", "finish"]],
  },
  { direction: "LR" },
);
const walk = agent.walk(["idle", "working", "plan", "act", "done"], { at: 1, dwell: 0.8 }); // { node, spans, end }
```

`walk` lights each state in turn and runs a token along the transition between them. It throws `walk() has no way from "a" to "b".` when no transition connects two states. `edge(from, to)` gives the drawn line.

## Tree

```tsx
import { tree } from "svjeez/extras";

const team = tree({ nodes: { lead: "Lead", a: { label: "Search", parent: "lead" }, b: { label: "Build", parent: "lead" } } }, { play: { at: 0.5 } });
const hop = team.route("a", "b"); // up through the common ancestor and down
```

Exactly one node has no `parent`.

## Lanes

```tsx
import { lanes } from "svjeez/extras";

const run = lanes(
  {
    lanes: { lead: "Lead", build: { label: "Build", role: "tool" } },
    spans: [{ lane: "lead", from: 0, to: 1, label: "plan" }, { lane: "build", from: 1, to: 4, label: "editing" }],
    events: [{ lane: "build", at: 2, label: "TEST" }],
    links: [{ from: "lead", to: "build", at: 1 }],
  },
  { scale: 80, play: { at: 0 } }, // scale: px per second
);
const x = run.x(2.5); // the x of lane time 2.5
```

Lane time 0 starts at `play.at` on the scene timeline.

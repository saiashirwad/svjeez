# `@svjeez/diagrams`

Auto-laid-out, animated diagrams built from typed data specs (flowcharts, sequence diagrams, state machines, trees, swimlanes, and 18+ additional diagram types).

## Setup

```sh
npm install @svjeez/diagrams @svjeez/fonts svjeez
```

- Every builder requires `{ font }` in options to measure labels at build time.
- Pass `colors` built from your `tokens()` (or omit `colors` to use `defaultColors`, which is already light/dark aware).

## Mental model

- **Builder functions, not JSX components:** Call `const chart = flowchart(spec, options)` at module top level. Layout runs immediately and returns a `Diagram` object: `{ node, with(between), size, ref, part(id), when(id), span }` (plus type-specific helpers like `.route()`, `.edge()`, `.message()`, `.walk()`).
- **Natural top-left sizing:** Diagrams draw at `[0, 0]` to `chart.size` with no background. Size the scene from `chart.size` (`[chart.size[0] + 2 * M, chart.size[1] + 2 * M]`) or center/scale with `<Align>` + `<Group scale={...}>`. Add `<Shape geometry={canvas.rect} fill={theme.background} />` yourself.
- **`reveal` is a per-item beat, not total duration:** `reveal: span(0.2, 0.3)` reveals item `i` at `0.2 + i * 0.3` over `0.3s` (total = `start + n * over`). Passing a record `{ id: span(...) }` reveals only the named ids; unnamed items start visible.
- **Type-specific reveal & travel:**
  - `flowchart`: edges draw automatically when endpoints reveal; use `draw: { "a->b": Anim<number> }` only when those nodes are omitted from `reveal`. `chart.route(from, to)` returns a `Route` with `.geometry` and `.travel(span)` (draw overlays between edges and nodes via `chart.with(<Group>...</Group>)`).
  - `sequence`: `reveal` keys are 1-based across messages and notes together (`"message-1"`, `"note-2"`), while `chart.message(i)` is 0-based and returns `{ span, route }`. `part()`/`when()` address actors only.
  - `stateMachine`: has no `reveal`. Play transitions with `const walk = machine.walk(path, { at: span(...) })` and render `machine.with(walk.node)`.
  - `lanes`: requires `scale` (px/sec); `reveal: span(start, over)` fits the entire timeline into `over`.
- **Roles and ids:** Node ids are TS-checked object keys (non-empty, no `/`). `role: "task" | "input" | "output" | "tool" | "decision" | "store"` picks both outline and color from `colors.roles`; `shape` overrides outline only; `style` overrides paint.

## API map

| Category | Exports |
|---|---|
| Core flow & state | `flowchart`, `sequence`, `stateMachine`, `tree`, `lanes` |
| Data & timelines | `pie`, `radar`, `xyChart` (`xyBar`, `xyLine`), `quadrantChart`, `sankey`, `treemap`, `gantt` (`formatTime`), `journey`, `timeline` |
| Architecture & software | `classDiagram`, `erDiagram`, `requirementDiagram`, `c4`, `blockDiagram`, `architecture`, `kanban`, `mindmap`, `packet`, `gitGraph` |
| Shared | `defaultColors`, `Route` (`points`, `geometry`, `length`, `at(f)`, `travel(span)`) |

## Verified snippet

```tsx
/** @jsxImportSource svjeez */
import { flowchart } from "@svjeez/diagrams";
import { google } from "@svjeez/fonts";
import { Align, Group, Shape, circle, ease, exit, scene, span, tokens, track } from "svjeez";

const mono = await google("JetBrains Mono", { fallback: ["ui-monospace", "monospace"], ligatures: false });
const theme = tokens({
  light: { background: "#FFFFFF", text: "#111111", border: "#6B7280", muted: "#555A66", blue: "#0A6CFF", orange: "#D95D00", magenta: "#C2185B", cyan: "#007A87" },
  dark: { background: "#090A0C", text: "#F5F5F7", border: "#8B949E", muted: "#98A0AD", blue: "#64D2FF", orange: "#FF9F43", magenta: "#FF5CA8", cyan: "#5CE1E6" },
});

const chart = flowchart(
  {
    nodes: {
      pr: { label: "PR opened", role: "input" },
      test: { label: "Test", role: "tool" },
      ok: { label: "OK?", role: "decision" },
      ship: { label: "Ship", role: "output" },
    },
    edges: [
      ["pr", "test"],
      ["test", "ok"],
      ["ok", "ship", "yes"],
      ["ok", "pr", "no", { line: "dotted" }],
    ],
  },
  {
    font: mono,
    textSize: 14,
    direction: "LR",
    reveal: { pr: span(0.2, 0.3), test: span(0.6, 0.3), ok: span(1.0, 0.3), ship: span(1.4, 0.3) },
    colors: {
      background: theme.background, text: theme.text, line: theme.border, muted: theme.muted,
      accent: theme.blue, highlight: theme.orange,
      roles: { tool: theme.magenta, decision: theme.orange, output: theme.cyan },
    },
  },
);

const trip = span(2.0, 1.4);
const route = chart.route("pr", "ship");
const M = 32;

export default scene(
  { size: [chart.size[0] + 2 * M, chart.size[1] + 2 * M], duration: 4.5, title: "Flowchart", desc: "A CI pipeline reveals and a token travels from PR to Ship.", theme, still: 3.4 },
  (canvas) => (
    <Group>
      <Shape geometry={canvas.rect} fill={theme.background} />
      <Align motion={exit(span(3.9, 0.5))}>
        {chart.with(
          <Group>
            <Shape geometry={route.geometry} stroke={{ color: theme.orange, width: 2.5, cap: "round" }} draw={track(0).to(1, trip, ease.linear)} />
            <Shape geometry={circle(5)} fill={theme.orange} offset={route.travel(trip)} opacity={track(0).to(1, span(trip.start, 0.15)).to(0, span(trip.end - 0.2, 0.2))} />
          </Group>,
        )}
      </Align>
    </Group>
  ),
);
```

## Gotchas

- `offset in motion of <Group> "c" runs until Ns, past the Ms scene` → `reveal: span(start, over)` is per item; shorten `over`, use a reveal record, or lengthen `duration`.
- `off-canvas error` on diagram nodes → Size the scene from `chart.size` or wrap in `<Align><Group scale={...}>`.
- `flowchart() draws "a->b" from a draw timeline, but its reveal already draws it` → Either drop `draw["a->b"]` or omit its endpoints from `reveal`.
- `sequence() has no part "message-5"` → Use `chart.message(i).span` (0-based) for row timing; `part()` addresses actors only.
- `pie({ Dogs: 386 })` fails → Pass `{ slices: { Dogs: 386 } }`.
- `lanes() needs a scale above 0` → Pass `scale` (pixels/second) in `lanes` options.
- `static warning` on a diagram → Add `reveal` (or `walk()` for `stateMachine`).

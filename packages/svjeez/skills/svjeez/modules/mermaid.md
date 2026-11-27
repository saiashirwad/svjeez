# `@svjeez/mermaid`

Parse Mermaid text into a themed, animated `@svjeez/diagrams` object in one call.

## Setup

```sh
npm install @svjeez/mermaid @svjeez/fonts svjeez
```

- `@svjeez/diagrams` is installed as a dependency of `@svjeez/mermaid`.
- `font` is required in `mermaid(text, options)` to measure labels.

## Mental model

- **`mermaid(text, options)` = `parseMermaid(text)` + matching `@svjeez/diagrams` builder:** Returns the diagram (`node`, `with`, `size`, `ref`, `part`, `when`, `span`, plus type-specific methods) spread with `kind` and `doc`.
- **Discriminated union on `kind`:** Narrow `if (chart.kind === "sequence")` (or `"state"`, `"flowchart"`, etc.) before accessing `chart.message()`, `chart.walk()`, `chart.route()`, or `chart.doc` fields.
- **22 supported headers:** `flowchart`/`graph`, `sequenceDiagram`, `stateDiagram`/`stateDiagram-v2`, `classDiagram`, `erDiagram`, `gantt`, `journey`, `pie`, `mindmap`, `gitGraph`, `timeline`, `quadrantChart`, `xychart-beta`/`xychart`, `sankey-beta`/`sankey`, `block-beta`/`block`, `architecture-beta`, `requirementDiagram`, `C4*`, `kanban`, `packet-beta`/`packet`, `radar-beta`, `treemap-beta`/`treemap`. (Only `lanes` and `tree` require `@svjeez/diagrams` directly.)
- **Strict dialect:** Unsupported directives (`%%{init}%%`, `title` in flowcharts, nested subgraphs, edges to subgraphs) throw `SceneError` with line numbers. Pass `{ file: "scene.tsx", line: <startLine> }` so errors point to your source file instead of `mermaid:N`.
- **Reveal & direction:** `reveal` takes a single `Span` (one beat per item, same as `@svjeez/diagrams`). `direction` applies only to `flowchart`, `class`, `er`, `requirement`, `c4`, and `state`. `stateDiagram` takes no `reveal`—narrow `kind === "state"` and call `chart.walk(path, { at })`.
- **Use `String.raw` for backslashes:** Plain JS template literals eat `\` in shapes like `A[\text/]`, silently turning them into plain rects.

## API map

| Export | Summary |
|---|---|
| `mermaid(text, options)` | Parses and builds a `MermaidDiagram` union (`{ kind, doc, node, with, size, ref, part, when, span, ... }`). Options: `font` (required), `textSize?`, `weight?`, `colors?`, `draw?`, `direction?`, `reveal?: Span`, `file?`, `line?`. |
| `parseMermaid(text, { file?, line? })` | Parses Mermaid text into a typed `MermaidDoc` without font/layout. |

## Verified snippet

```tsx
/** @jsxImportSource svjeez */
import { google } from "@svjeez/fonts";
import { mermaid } from "@svjeez/mermaid";
import { Align, Group, Shape, exit, scene, span, tokens } from "svjeez";

const mono = await google("JetBrains Mono", { fallback: ["ui-monospace", "monospace"], ligatures: false });
const theme = tokens({
  light: { background: "#FFFFFF", text: "#111111", border: "#6B7280", muted: "#555A66", blue: "#0A6CFF", orange: "#D95D00", magenta: "#C2185B", cyan: "#007A87" },
  dark: { background: "#090A0C", text: "#F5F5F7", border: "#8B949E", muted: "#98A0AD", blue: "#64D2FF", orange: "#FF9F43", magenta: "#FF5CA8", cyan: "#5CE1E6" },
});

const chart = mermaid(
  String.raw`flowchart LR
  A([Start]) --> B{OK?}
  B -->|yes| C[(Cache)]
  B -.->|no| D[Retry]
  D --> B`,
  {
    font: mono,
    textSize: 14,
    reveal: span(0.2, 0.4),
    colors: {
      background: theme.background, text: theme.text, line: theme.border, muted: theme.muted,
      accent: theme.blue, highlight: theme.orange,
      roles: { store: theme.magenta, decision: theme.orange, tool: theme.cyan },
    },
  },
);

const M = 32;

export default scene(
  { size: [chart.size[0] + 2 * M, chart.size[1] + 2 * M], duration: 3.5, title: "Mermaid flow", desc: "A Mermaid flowchart reveals node by node.", theme, still: 2.8 },
  (canvas) => (
    <Group>
      <Shape geometry={canvas.rect} fill={theme.background} />
      <Align motion={exit(span(2.9, 0.5))}>{chart.node}</Align>
    </Group>
  ),
);
```

## Gotchas

- `A state diagram has no reveal` → Drop `reveal` on `stateDiagram` and animate with `chart.walk(path, { at })` after narrowing `chart.kind === "state"`.
- `A pie chart has no direction` → Only pass `direction` for `flowchart`, `class`, `er`, `requirement`, `c4`, or `state`.
- `TS2339: Property 'nodes' does not exist` → Narrow on `chart.kind` before accessing type-specific methods or `chart.doc` fields.
- `cannot read this line` in `classDiagram` / `erDiagram` → Put spaces around relation operators (`A <|-- B`, `CUSTOMER ||--o{ ORDER : places`).
- `title is not supported` / `%%{ }%% directives are not supported` / `subgraph inside subgraph is not supported` → Draw flowchart titles with `<Text>`, configure styling via `colors`/`textSize`, and keep subgraphs flat.
- `A[\text/]` renders as a plain rectangle → Use `` String.raw`...` `` so JS does not interpret `\t`.
- Error message lists fewer than 22 diagram types → The message text is outdated; all 22 headers above are supported.

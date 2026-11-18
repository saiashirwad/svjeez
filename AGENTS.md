# AGENTS.md

svjeez is a TypeScript library that compiles scenes written in TypeScript into one self-contained animated SVG. Motions become CSS keyframes, or SMIL on filter primitives, `d`, `width` and `height`. Nothing runs in the viewer's browser.

To write a scene, read [`packages/svjeez/skills/svjeez/SKILL.md`](packages/svjeez/skills/svjeez/SKILL.md) and the references it points to. It ships in the npm package, and `svjeez skill --install` copies it into a project. This file covers working on the repository.

## Workspace

The repository is a Bun workspace. The root `package.json` is private and lists the workspaces:

- `packages/svjeez/` is the library published to npm as `svjeez`.
- `packages/vite/` is `@svjeez/vite`, the Vite plugin.
- `packages/astro/` is `@svjeez/astro`, the Astro integration, built on `@svjeez/vite`.
- `packages/charts/` is `@svjeez/charts`, which draws animated bar, line and area charts with `d3-scale` and `d3-shape`.
- `packages/code/` is `@svjeez/code`, which highlights source into role-tagged runs for `code()` and `terminal()` through Shiki, and the editor palettes (`tomorrow`, `solarizedDark` and the rest) on `@svjeez/code/palettes`.
- `packages/diagrams/` is `@svjeez/diagrams`, which lays out and animates flowcharts, sequence diagrams, state machines, trees and swimlanes, with the layered, tree, sequence and lanes layout behind them. `@svjeez/mermaid` builds on it.
- `packages/dom/` is `@svjeez/dom`, which snapshots real HTML and CSS (or a React or Svelte component) in headless Chromium into svjeez nodes you can animate.
- `packages/fonts/` is `@svjeez/fonts`, which loads Google Fonts by family name into a `Font`.
- `packages/geo/` is `@svjeez/geo`, which projects GeoJSON and TopoJSON into scenes through `d3-geo`.
- `packages/icons/` is `@svjeez/icons`, the Tabler and Lucide icons as path data for `<Icon>`.
- `packages/math/` is `@svjeez/math`, which typesets TeX into glyph paths through MathJax and draws coordinate planes (axes, plots, moving grids), calculus on them, vector fields and contour lines.
- `packages/mermaid/` is `@svjeez/mermaid`, which reads Mermaid flowcharts, sequence diagrams and state diagrams into svjeez diagrams.
- `packages/video/` is `@svjeez/video`, which encodes a scene as MP4 or WebM through Mediabunny in headless Chromium.
- `examples/` holds the scene-model example scenes and their committed output in `examples/dist/`. `examples/golden/` keeps the SVGs the 0.7 examples built, as references for frame diffs when a feature is ported; nothing builds or tests them. It is private and never published.

Run `bun install` once at the root. From the root, `bun run typecheck` and `bun run test` run every workspace's script, `bun run build:examples` rebuilds `examples/dist/`, and `bun run typecheck` also checks `scripts/` through the root `tsconfig.json`. Every other command runs inside its workspace.

The workspace packages depend on `svjeez` through `workspace:*`. Its exports carry an `@svjeez/source` condition that points at `src/`. The plugins' tests turn that condition on, so they run the library's source and never need `package-dist/`.

Every other package points its exports at TypeScript source in the workspace, because Astro loads a config's integrations without the `@svjeez/source` condition. In each, `bun run build:package` writes `package-dist/` with the package.json that npm publishes, and `bun run test:package` installs the packed tarball into a copy of `test/consumer/` and checks it on plain Node. Both use the scripts in the root `scripts/` folder Packages with a third-party dependency stay out of `svjeez` so the core keeps none.

## Library commands

Run these in `packages/svjeez/`:

```sh
bun run typecheck                 # tsc --noEmit, must stay clean
bun test                          # every test, including frame tests in headless Chromium
bun run test:node                 # renders the skill's examples on the current Node through tsx
bun run test:package              # packs the tarball, lints it, and type-checks and loads it as a consumer
bun run build:package             # the npm build into package-dist/, with the root README and LICENSE beside it
bun run dev <file.tsx>            # svjeez dev: live preview with reload and a scrubber (--port, --params data.json)
bun run render-png <file> --sheet  # svjeez frames: frames/ with sheet.png (--times 0,1,2, --out dir)
bun run svjeez <command> ...      # any CLI command from source: svg, dev, frames, check, video, skill
```

`examples/` has its own `build`, `dev`, `render-png`, `render-video`, `test`, `test:node` and `typecheck`. `bun run build [name ...]` there writes `examples/dist/`, as in `bun run build readme/basic`. Its `tsconfig.json` maps `svjeez` to the library's `src/`, so the examples always run the source.

Frame rendering needs Chromium once per machine: `bunx playwright-core install chromium-headless-shell`.

## Library layout

Paths in this section are relative to `packages/svjeez/`.

- `src/` holds the core: `motion.ts` (timeline), `span.ts` and `clip.ts` (spans, and `<Clip>`, a clock of its own), `recipes.ts`, `channels.ts` (the channel table), `keys.ts` (keyframe math, including cutting and rotating keys), `resolve.ts` (a lane's `.repeat` and `.rewind` steps written out), `css.ts` and `smil.ts` (emit CSS and SMIL), `compile.ts` and `render.ts` (orchestrate them; compile adds a clip's offset to every motion inside it, so the output stays on one clock), `validate.ts`.
- `src/extras/` holds timeline, code, terminal, annotations and themes, all exported from the root `svjeez` entry.
- `src/layout/` holds pure layout math. It imports nothing outside `src/layout`, and a test enforces this. The diagram layouts (layered, route, tree, sequence, lanes) are in `packages/diagrams/src/layout/`.
- `src/cli.ts` is the `svjeez` CLI, and `src/dev.ts` its `dev` server (node:http and fs.watch, no dependencies). `src/frames.ts` and `src/cli.ts` rasterize frames. They and `src/page.ts`, the functions they run inside the page, are the only code that touches a browser.
- `skills/svjeez/` holds the scene-writing skill, its references and its examples, published with the package. `tests/skill.test.ts` renders the examples, checks that every `examples/` and `references/` path the skill mentions exists, and checks that every runtime error in the error table appears in `src/`. Quote an error there with `…` for each value the message fills in. The examples carry their own JSX pragmas so they compile wherever `svjeez skill --install` puts them.

## Packages

Each package's source explains its own internals. These are the rules that aren't visible from one file:

- `@svjeez/vite` and `@svjeez/astro` never import svjeez. Scenes run in a Vite environment of their own that compiles JSX as svjeez. Run `bun run test` in `packages/vite/` to build and serve the React app in `test/app/`, and `bun run dev` there to open it.
- `@svjeez/icons`: `src/tabler.ts` and `src/lucide.ts` are generated by `bun run generate`. Never edit them by hand.
- `@svjeez/code` returns `[role, text]` runs, never hex, so `adaptive()` and `variables()` keep working.
- `@svjeez/charts`, `@svjeez/diagrams`, `@svjeez/math`, and `@svjeez/mermaid` end their relative imports in `.ts` or `.tsx`, whichever the file is, so the packed declarations resolve. They build SVG with JSX; `jsxImportSource` is `svjeez` in their tsconfig.
- `@svjeez/mermaid` never drops a line. Anything it cannot draw throws a `MermaidSyntaxError`. When svjeez gains a feature, move it from the rejected list to the parser and the mapper together, and update the README and `references/mermaid.md`.
- `@svjeez/fonts` is the only package that touches the network. The examples load every font through it, and the library's own tests read the TTFs in `packages/svjeez/tests/fixtures/`.
- A package that scene writers use has an example scene in `examples/` and a reference in `skills/svjeez/references/`.

## Rules

- Import `svjeez`, `svjeez/frames`, `svjeez/page` and `svjeez/params`. Scenes, examples, packages and docs write JSX, or call `jsx` from `svjeez/jsx-runtime`. `restyle` is in `svjeez/page` and `validateSvg` in `svjeez/frames`. In `packages/svjeez/` the tsconfig maps them to `src/`.
- Keep the library dependency-free and runnable on Node 20. Don't use APIs newer than Node 20, such as `Map.groupBy` or `Set.prototype.union`. `bun run test:node` under Node 20 catches these.
- Don't change the behavior of an existing public function without being asked.
- After changing an example or the compiler, rebuild the affected `examples/dist/` files and commit them with the change.
- Keep the library free of Astro. Astro code belongs in `packages/astro/`.
- Example scenes take `theme` and `mono` from `examples/theme.ts`, so they share one palette and one embedded mono font.
- Time is spans on clocks: write `show`, `<Clip>` and `{ at, over }`, never absolute seconds inside a component. `frames`, `restyle` and `seek` take scene seconds, so `render` writes `data-playback-rate` on the root and they read it.
- Check visual changes with `bun run svjeez check <file>`, which reports layout and timing faults as text, then by looking at frames: run `bun run render-png <file> --sheet` and open `sheet.png`. Passing tests don't show timing or layout bugs.
- A package that lays something out returns a `Drawn` (`src/drawn.ts`): `node`, `span`, `bounds`, `parts` and `part(id)`, where each part has a `box` and its own `span`. Don't add another name for the same thing.

## Releasing

`ci.yml` runs on every pull request. It lints, typechecks, runs the tests, fails if `examples/dist/` is stale, and on Node 20 and 22 renders every example and checks the packed packages. `@svjeez/astro` is checked on Node 22 only, because Astro 7 needs it.

`release.yml` runs `scripts/release.ts` on every push to `main` after CI passes. It publishes every package whose version isn't on npm or has no GitHub release yet, and rerunning it skips steps that already happened. A prerelease version such as `0.5.0-beta.0` goes to the `next` dist-tag.

Every package shares one version. To release, bump them together and push. `bun pm version` doesn't commit inside a workspace, so commit yourself:

```sh
for p in svjeez vite astro charts code diagrams dom fonts geo icons math mermaid video; do (cd packages/$p && bun pm version minor --no-git-tag-version); done   # or patch, major, prerelease --preid beta
bun install && bun run build:examples && git add -A examples && git commit -am "v$(node -p 'require("./packages/svjeez/package.json").version')" && git push
```

The version is part of `@svjeez/dom`'s recording hash, so a bump re-records every `snapshots.json`; `build:examples` above commits them, or CI fails on a stale `examples/dist/`.

A new package needs one publish from a maintainer's machine before the workflow can release it. The header of `scripts/release.ts` describes `claim` and `plan`.

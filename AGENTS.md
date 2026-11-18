# AGENTS.md

svjeez is a TypeScript library that compiles scenes written in TypeScript into one self-contained animated SVG. Motions become CSS keyframes, or SMIL on filter primitives, `d`, `width` and `height`. Nothing runs in the viewer's browser.

To write a scene, read [`packages/svjeez/skills/svjeez/SKILL.md`](packages/svjeez/skills/svjeez/SKILL.md) and the references it points to. It ships in the npm package, and `svjeez skill --install` copies it into a project. This file covers working on the repository.

NOTE: very SPARSE comments only, just the MOST ESSENTIAL ONES. if you encounter comments, proactively delete them if they're not ABSOLUTELY ESSENTIAL

## Workspace

`next` is the scene-model rewrite. `main` stays on 0.7.x and keeps everything `next` deleted: the site, the live editor (`@svjeez/live`, `@svjeez/react`, `@svjeez/svelte`), and the diagrams and mermaid packages. Each comes back by porting it from `main` (`git show main:<path>`) onto the scene model, never by restoring it as it was.

The repository is a Bun workspace. The root `package.json` is private and lists the workspaces:

- `packages/svjeez/` is the library published to npm as `svjeez`.
- `packages/vite/` is `@svjeez/vite`, the Vite plugin.
- `packages/astro/` is `@svjeez/astro`, the Astro integration, built on `@svjeez/vite`.
- `packages/fonts/` is `@svjeez/fonts`, which loads Google Fonts by family name into a `Font`.
- `packages/icons/` is `@svjeez/icons`, the Tabler and Lucide path data and the `<Icon>` that draws it.
- `packages/charts/` is `@svjeez/charts`, which draws bars, lines and areas on shared axes, with `d3-scale` and `d3-shape`.
- `packages/dom/` is `@svjeez/dom`, which records HTML, React or Svelte states in headless Chromium as snapshot data. It reads and records only; drawing a snapshot as a scene is not ported yet.
- `packages/code/` is `@svjeez/code`, which highlights source with Shiki into a `<Code>` node that types itself and morphs by line.
- `packages/geo/` is `@svjeez/geo`, which projects GeoJSON and TopoJSON into maps and turning globes.
- `packages/math/` is `@svjeez/math`, which typesets TeX into glyph shapes through MathJax and draws plots, constructions and plane transformations as geometry.
- `packages/video/` is `@svjeez/video`, which encodes a scene as MP4 or WebM through Mediabunny in headless Chromium.
- `examples/` holds the scene-model example scenes and their committed output in `examples/dist/`. `examples/golden/` keeps the SVGs the 0.7 examples built, as references for frame diffs when a feature is ported; nothing builds or tests them. It is private and never published.

Run `bun install` once at the root. From the root, `bun run typecheck` and `bun run test` run every workspace's script, `bun run build:examples` rebuilds `examples/dist/`, and `bun run typecheck` also checks `scripts/` through the root `tsconfig.json`. Every other command runs inside its workspace.

The workspace packages depend on `svjeez` through `workspace:*` in development and `workspace:^` as a peer, which the published manifest turns into `^` of the current version, so a prerelease such as `0.8.0-next.0` satisfies it. Its exports carry an `@svjeez/source` condition that points at `src/`. The plugins' tests turn that condition on, so they run the library's source and never need `package-dist/`.

Every other package points its exports at TypeScript source in the workspace, because Astro loads a config's integrations without the `@svjeez/source` condition. In each, `bun run build:package` writes `package-dist/` with the package.json that npm publishes, and `bun run test:package` installs the packed tarball into a copy of `test/consumer/` and checks it on plain Node. Both use the scripts in the root `scripts/` folder. Packages with a third-party dependency stay out of `svjeez` so the core keeps none.

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

`examples/` has its own `build`, `dev`, `render-png`, `render-video`, `test`, `test:node` and `typecheck`. `bun run build [name ...]` there writes `examples/dist/`, as in `bun run build readme/basic`. Its `tsconfig.json` maps `svjeez` to the library's `src/`, so the examples always run the source. `bun run test:browsers` there plays and seeks every SVG in `dist/` in Chromium, Firefox and WebKit and compares each engine to Chromium; locally it skips an engine that isn't installed, and in CI it fails. Install them inside `packages/svjeez/` with `bun run playwright-core install --with-deps chromium-headless-shell firefox webkit`.

Frame rendering needs Chromium once per machine: `bunx playwright-core install chromium-headless-shell`.

## Library layout

Paths in this section are relative to `packages/svjeez/`.

- The entries: `src/index.ts` is `svjeez`, what a scene imports. `src/tools.ts` is `svjeez/tools`, what tools need and authors don't: the SVG backend (`svg.emit`), `inspect`, `describe`, `boxesOf`, `hitTest`, `placements`, `valueAt` and every type. `src/jsx-runtime.ts` and `src/jsx-dev-runtime.ts` build scene nodes; there are no lowercase tags. `frames.ts`, `page.ts` and `params.ts` are `svjeez/frames`, `svjeez/page` and `svjeez/params`.
- `src/model/` is the scene model and its math, with nothing of any one target in it. `ir.ts` is the model: plain data that survives JSON, where every node keeps its key, its source and its measured box, and every backend reads only it. `lane.ts`, `curve.ts`, `steps.ts`, `sample.ts` and `fold.ts` are values over time, `geometry.ts`, `painted.ts` and `reach.ts` outlines and boxes, and `time.ts` has `Seconds` and `ease`.
- `src/author/` is what scene authors call and its lowering. `nodes.ts` has the components, `values.ts`, `paint.ts`, `effects.ts` and `holes.ts` the geometry and paint values, `track.ts`, `recipes.ts`, `timeline.ts`, `span.ts`, `spring.ts`, `morph.ts` and `derived.ts` time, `layout.ts`, `arrow.ts`, `refs.ts`, `pin.ts` and `settle.ts` placement, and `text.ts`, `runs.ts` and `picture.ts` text and images. `lower.ts` turns `scene(options, build)` into the model.
- `src/svg/` is the SVG backend and the emitter it writes through. `svg.ts`, `svg-geometry.ts` and `svg-paint.ts` turn the model into elements with lanes, and `backend.ts` says what a backend can draw. `compile.ts` turns each element's lanes into CSS classes and keyframes (`css.ts`) or SMIL (`smil.ts`), resolves fonts and writes the reduced-motion still; `keys.ts` is keyframe math, `channels.ts` the values a lane carries, `tree.ts` the element tree and its serializer, and `render.ts` the root, validation (`validate.ts`) and the trace the CLI reads (`traced.ts`). `render()` is internal: authors call `svg.emit`.
- `src/check/` reads a built scene: `inspect.ts`, `describe.ts`, `boxes.ts` (`boxesOf`, `hitTest`, `placements`, `valueAt`) and `survey.ts`, and `check.ts` and `check-page.ts`, which are `svjeez check`.
- `src/font/` parses, measures, shapes and subsets fonts.
- `src/cli.ts` is the `svjeez` CLI, and `src/dev.ts` its `dev` server (node:http and fs.watch, no dependencies). `src/restyle.ts` is `restyle` in `svjeez/page`. `src/frames.ts` and `src/cli.ts` rasterize frames. They, `src/check/check-page.ts` and `src/page.ts`, the functions they run inside the page, are the only code that touches a browser.
- Nothing under `src/` is unreachable from the entries. When a feature goes, its emitter path goes with it.
- `skills/svjeez/` holds the scene-writing skill, its references and its examples, published with the package. `tests/skill.test.ts` renders the examples, checks that every `examples/` and `references/` path the skill mentions exists, and checks that every runtime error in the error table appears in `src/`. Quote an error there with `…` for each value the message fills in. The examples carry their own JSX pragmas so they compile wherever `svjeez skill --install` puts them.

## Packages

These are the rules that aren't visible from one file:

- `@svjeez/vite` and `@svjeez/astro` never import svjeez. Scenes run in a Vite environment of their own that compiles JSX as svjeez. Run `bun run test` in `packages/vite/` to build and serve the React app in `test/app/`, and `bun run dev` there to open it.
- `@svjeez/fonts` is the only package that touches the network. The examples load every font through it, and the library's own tests read the TTFs in `packages/svjeez/tests/fixtures/`.
- A package that scene writers use has an example scene in `examples/` and a reference in `skills/svjeez/references/`.

## Rules

- Import `svjeez`, `svjeez/tools`, `svjeez/frames`, `svjeez/page` and `svjeez/params`. Scenes, examples, packages and docs write JSX with `"jsxImportSource": "svjeez"`, or call `jsx` from `svjeez/jsx-runtime`. `restyle` is in `svjeez/page` and `validateSvg` in `svjeez/frames`. In `packages/svjeez/` the tsconfig maps them to `src/`.
- Keep the library dependency-free and runnable on Node 20. Don't use APIs newer than Node 20, such as `Map.groupBy` or `Set.prototype.union`. `bun run test:node` under Node 20 catches these.
- Don't change the behavior of an existing public function without being asked.
- After changing an example or the compiler, rebuild the affected `examples/dist/` files and commit them with the change.
- Keep the library free of Astro. Astro code belongs in `packages/astro/`.
- Example scenes take `theme` and `mono` from `examples/theme.ts`, so they share one palette and one embedded mono font.
- Time is spans on clocks: write `span(start, over)`, tracks, timelines and `<Sequence>`, never absolute seconds worked out inside a component. `frames`, `restyle` and `seek` take scene seconds, so the backend writes `data-playback-rate` on the root and they read it.
- Check visual changes with `bun run svjeez check <file>`, which reports layout and timing faults as text, then by looking at frames: run `bun run render-png <file> --sheet` and open `sheet.png`. Passing tests don't show timing or layout bugs.
- Keep what an editor needs: every node's key, source and measured box, `boxesOf`, `hitTest`, `placements`, `valueAt`, `inspect` and `describe` with their tests, and the backend's `sources` option (`data-key` and `data-source`). The live editor will be rebuilt on them.
- Every target means the same thing: a scene draws the same picture through CSS, SMIL and the reduced-motion still, and a backend that can't draw something says so, never silently differs. Don't raise the budgets in `examples/tests/scene-size.test.ts`; prove visual changes with frames.
- No message an author sees names SVG or CSS internals: say what to change in the scene, in its own words.
- Write no comments in code. Keep only what a tool requires (`// SAFETY:` lines, `@ts-expect-error` and similar directives, licence headers, JSX pragmas in copied examples). Author knowledge lives in the skill, repo rules here.

## Releasing

`ci.yml` runs on every pull request. It lints, typechecks, runs the tests, fails if `examples/dist/` is stale, and on Node 20 and 22 renders every example and checks the packed packages. `@svjeez/astro` is checked on Node 22 only, because Astro 7 needs it.

`release.yml` runs CI and `scripts/release.ts plan` on every push to `main` or `next`, but publishes only when someone runs it by hand (`gh workflow run release --ref next`), and only after CI passes. A run publishes every package whose version isn't on npm or has no GitHub release yet, and rerunning it skips steps that already happened. A prerelease version such as `0.8.0-next.0` goes to the `next` dist-tag. On any branch but `main` it skips stable versions, so every version on `next` keeps its `-next.N` suffix.

Every package shares one version. To release, bump them together and push. `bun pm version` doesn't commit inside a workspace, so commit yourself:

```sh
for p in svjeez vite astro fonts icons charts dom code geo math video; do (cd packages/$p && bun pm version prerelease --preid next --no-git-tag-version); done   # on next; main uses minor, patch or major
bun install && bun run build:examples && git add -A examples && git commit -am "v$(node -p 'require("./packages/svjeez/package.json").version')" && git push
```

A new package needs one publish from a maintainer's machine before the workflow can release it. The header of `scripts/release.ts` describes `claim` and `plan`.

# AGENTS.md

svjeez is a TypeScript library that compiles TSX scenes into one self-contained animated SVG. Motions become CSS keyframes, or SMIL on filter primitives. Nothing runs in the viewer's browser.

To write a scene, read [`skills/svjeez/SKILL.md`](skills/svjeez/SKILL.md). It ships in the npm package, and `svjeez skill` prints it or `svjeez skill --install` copies it into a project. It covers the `motion()` timeline, channels, easing, recipes, `sampled()`, the diagram and explainer APIs, compile errors and their fixes, and three worked examples. This file covers working on the library itself.

## Commands

```sh
bun install
bun run typecheck                 # tsc --noEmit, must stay clean
bun test                          # every test, including frame tests in headless Chromium
bun run test:node                 # renders every example on the current Node through tsx
bun run test:package              # packs the tarball, lints it, and type-checks and loads it as a consumer
bun run build [name ...]          # examples into dist/, e.g. bun run build readme/hero
bun run build:package             # the npm build into package-dist/
bun run dev <file.tsx>            # live preview with reload and a scrubber
bun run render-png <file> --times 0,1,2 --sheet --out frames/
```

Frame rendering needs Chromium once per machine: `bunx playwright-core install chromium-headless-shell`.

## Layout

- `src/` holds the core: `motion.ts` (timeline), `recipes.ts`, `channels.ts` (the channel table), `keys.ts` (keyframe math), `css.ts` and `smil.ts` (emit CSS and SMIL), `compile.ts` and `render.ts` (orchestrate them), `validate.ts`.
- `src/extras/` holds code, terminal, annotations, themes, and the diagrams in `extras/diagrams/`.
- `src/layout/` holds pure layout math. It imports nothing outside `src/layout`, and a test enforces this.
- `src/frames.ts` and `src/cli.ts` rasterize frames. They are the only code that touches a browser.
- `examples/` holds scenes. `dist/` is their committed output, which the README links to.
- `skills/svjeez/` holds the scene-writing skill and its examples, published with the package. `tests/skill.test.ts` renders the examples. They carry their own JSX pragmas so they compile wherever `svjeez skill --install` puts them.

## Rules

- Import `svjeez`, `svjeez/extras`, `svjeez/voxel` and `svjeez/frames`. The tsconfig maps them to `src/`.
- Keep the library dependency-free and runnable on Node 20. Don't use APIs newer than Node 20, such as `Map.groupBy` or `Set.prototype.union`. `bun run test:node` under Node 20 catches these.
- Don't change the behavior of an existing public function without being asked.
- After changing an example or the compiler, rebuild the affected `dist/` files and commit them with the change.
- Check visual changes by looking at frames: run `bun run render-png <file> --sheet`, then open `sheet.png`. Passing tests don't show timing or layout bugs.

## Releasing

CI (`.github/workflows/ci.yml`) runs on every push to `main` and every pull request. It typechecks, runs the tests, fails if `dist/` is stale, and on Node 20 and 22 renders every example and checks the packed package.

To release, bump the version and push the tag:

```sh
npm version minor -m "svjeez %s"   # or patch, major, prerelease --preid beta
git push --follow-tags
```

The `v*` tag starts `.github/workflows/release.yml`. It reruns CI, checks the tag against `package.json`, publishes to npm with provenance through trusted publishing, and creates a GitHub release with the tarball and generated notes. A version with a prerelease suffix such as `0.5.0-beta.0` goes to the `next` dist-tag. Rerunning the workflow skips steps that already happened.

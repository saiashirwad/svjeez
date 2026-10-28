# AGENTS.md

svjeez is a TypeScript library that compiles TSX scenes into one self-contained animated SVG. Motions become CSS keyframes, or SMIL on filter primitives. Nothing runs in the viewer's browser.

To write a scene, read [`packages/svjeez/skills/svjeez/SKILL.md`](packages/svjeez/skills/svjeez/SKILL.md). It ships in the npm package, and `svjeez skill` prints it or `svjeez skill --install` copies it into a project. `SKILL.md` covers the `motion()` timeline, channels, easing, recipes, `sampled()`, and the compile and runtime errors with their fixes. `skills/svjeez/references/` covers defs and CSS properties, images and fonts, ink, explainers, diagrams, voxels and non-JSX use. Five worked examples sit in `skills/svjeez/examples/`. `svjeez skill` prints `SKILL.md` alone; `--install` also copies the references and examples. This file covers working on the repository.

## Workspace

The repository is a Bun workspace. The root `package.json` is private and lists the workspaces:

- `packages/svjeez/` is the library published to npm as `svjeez`.
- `packages/vite/` is `@svjeez/vite`, the Vite plugin.
- `packages/astro/` is `@svjeez/astro`, the Astro integration, built on `@svjeez/vite`.
- `site/` is the Astro site at svjeez.texoport.in.

Run `bun install` once at the root. From the root, `bun run typecheck` and `bun run test` run every workspace's script, and `bun run typecheck` also checks `scripts/` through the root `tsconfig.json`. Every other command runs inside its workspace.

The workspace packages depend on `svjeez` through `workspace:*`. Its exports carry an `@svjeez/source` condition that points at `src/`. The site and the plugins' tests turn that condition on, so they run the library's source and never need `package-dist/`.

## Library commands

Run these in `packages/svjeez/`:

```sh
bun run typecheck                 # tsc --noEmit, must stay clean
bun test                          # every test, including frame tests in headless Chromium
bun run test:node                 # renders every example on the current Node through tsx
bun run test:package              # packs the tarball, lints it, and type-checks and loads it as a consumer
bun run build [name ...]          # examples into dist/, e.g. bun run build readme/hero
bun run build:package             # the npm build into package-dist/, with the root README and LICENSE beside it
bun run dev <file.tsx>            # live preview with reload and a scrubber
bun run render-png <file> --times 0,1,2 --sheet --out frames/
```

Frame rendering needs Chromium once per machine: `bunx playwright-core install chromium-headless-shell`.

## Library layout

Paths in this section are relative to `packages/svjeez/`.

- `src/` holds the core: `motion.ts` (timeline), `recipes.ts`, `channels.ts` (the channel table), `keys.ts` (keyframe math), `css.ts` and `smil.ts` (emit CSS and SMIL), `compile.ts` and `render.ts` (orchestrate them), `validate.ts`.
- `src/extras/` holds code, terminal, annotations, themes, and the diagrams in `extras/diagrams/`.
- `src/layout/` holds pure layout math. It imports nothing outside `src/layout`, and a test enforces this.
- `src/frames.ts` and `src/cli.ts` rasterize frames. They are the only code that touches a browser.
- `examples/` holds scenes. `dist/` is their committed output, which the README links to.
- `skills/svjeez/` holds the scene-writing skill, its references and its examples, published with the package. `tests/skill.test.ts` renders the examples, checks that every `examples/` and `references/` path the skill mentions exists, and checks that every runtime error in the error table appears in `src/`. Quote an error there with `…` for each value the message fills in. They carry their own JSX pragmas so they compile wherever `svjeez skill --install` puts them.

## Vite plugin

`@svjeez/vite` compiles scenes while an app builds. An import such as `./hero.tsx?svjeez` gives `{ src, width, height, title, desc }`, and `?svjeez&posters` adds a still per color scheme. The dev server serves the files under `/_svjeez/`, and the build emits them as assets. Scenes run in a Vite environment of their own that compiles JSX as svjeez, so a React app's JSX settings never reach them. `getScene()` and the poster renderer run in that environment too, so the plugin itself never imports svjeez. Posters render in headless Chromium and are cached in Vite's cache directory.

Run `bun run test` in `packages/vite/` to build and serve the React app in `test/app/`. Run `bun run dev` there to open it.

Both plugin packages point their exports at TypeScript source in the workspace, because Astro loads a config's integrations without the `@svjeez/source` condition. `bun run build:package` in either package writes `package-dist/`, with compiled JavaScript, declarations, and the package.json that npm publishes. `bun run test:package` builds it, lints it, installs the packed tarballs into a copy of `test/consumer/`, and builds that project. Both commands use the scripts in the root `scripts/` folder.

## Astro integration

`@svjeez/astro` adds `@svjeez/vite` to Astro and provides the `svjeez:astro` module. `<Scene scene={build} />` and `getScene(build, { posters })` compile a scene and give it a URL under `/_svjeez/`. Pages call `getScene()` while they render, after Vite has bundled, so the integration writes those files in `astro:build:done`. Posters are cached in Astro's cache directory.

## Site

`site/` imports scenes straight from `packages/svjeez/examples/` through the `@examples/*` path. Run `bun run dev`, `bun run build`, `bun run typecheck` and `bun run test` inside `site/`. `bun run deploy` builds and deploys through Alchemy's `Cloudflare.Website.Astro` (`site/alchemy.run.ts`). The site pins TypeScript 6, because `astro check` does not support TypeScript 7.

## Rules

- Import `svjeez`, `svjeez/extras`, `svjeez/voxel` and `svjeez/frames`. In `packages/svjeez/` the tsconfig maps them to `src/`.
- Keep the library dependency-free and runnable on Node 20. Don't use APIs newer than Node 20, such as `Map.groupBy` or `Set.prototype.union`. `bun run test:node` under Node 20 catches these.
- Don't change the behavior of an existing public function without being asked.
- After changing an example or the compiler, rebuild the affected `dist/` files and commit them with the change.
- Keep the library free of Astro. Astro code belongs in `packages/astro/`.
- Scenes that show code, an explainer or a terminal take `theme`, `css` and `mono` from `packages/svjeez/examples/style.ts`, and the site's code blocks and playground read the same palette through `site/src/styles/code.ts`. `tests/style.test.ts` fails on a scene that brings its own code palette or mono font.
- Check visual changes by looking at frames: run `bun run render-png <file> --sheet`, then open `sheet.png`. Passing tests don't show timing or layout bugs.

## Releasing

`.github/workflows/release.yml` runs on every push to `main`, and `ci.yml` runs on every pull request. CI typechecks, runs the tests, fails if `dist/` is stale, and on Node 20 and 22 renders every example and checks the packed packages. `@svjeez/astro` is checked on Node 22 only, because Astro 7 needs it.

After CI passes, `release.yml` runs `scripts/release.ts`. It releases every package under `packages/` whose version isn't on npm or has no GitHub release yet. It publishes to npm with provenance through trusted publishing, and it creates a GitHub release with the tarball and notes listing the commits that touched the package since its previous release. A package with a private workspace manifest publishes the `package-dist/` that its `build:package` writes. svjeez's tags stay `v1.2.3`, and the other packages tag `@svjeez/vite@1.2.3`. A version with a prerelease suffix such as `0.5.0-beta.0` goes to the `next` dist-tag. Rerunning the workflow skips steps that already happened.

To release, bump a package's version and push. `bun pm version` doesn't commit inside a workspace, so commit yourself:

```sh
(cd packages/vite && bun pm version minor --no-git-tag-version)   # or patch, major, prerelease --preid beta
git commit -am "@svjeez/vite $(node -p 'require("./packages/vite/package.json").version')" && git push
```

Bump `@svjeez/vite` and `@svjeez/astro` together and the workflow publishes vite first. A new `@svjeez/vite` version reaches `@svjeez/astro` users through its `^` range, so it needs no Astro release.

npm trusts a workflow one package at a time, and only for a package that it already has. A new package therefore needs one publish from a maintainer's machine. Run `npm login`, then `bun scripts/release.ts claim packages/<name>` from the root. It publishes the package's current version and trusts `release.yml` and the `npm` environment for every later version. npm stages that first version, so approve it under Staged Packages on npmjs.com. Until then, the workflow skips the package with a warning. `bun scripts/release.ts plan` lists what the next push would release.

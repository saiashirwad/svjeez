This is a fresh new library without any users, we're good to make breaking changes - in fact, when changes make for a more coherent, simpler, cleaner library that agents can use more effectively, I actively encourage making those changes.

The agent skill that ships with svjeez lives in `packages/svjeez/skills/svjeez` (SKILL.md, references/, examples/). It is documentation for users of the library; work in this repo from the code. When you change the API, the CLI or a check code, update the skill too: `packages/svjeez/tests/skill.test.ts` fails when a check code or CLI command is missing from it, and its examples must pass `check` with no warnings.

## API design: open for authors, closed for renderers

When an author chooses a behavior (an easing curve, a layer entrance, how text splits), take a value or function instead of a string mode or tagged union. Built-ins are just ready-made values of that same type, so users can pass their own without changing the library.

```ts
// Avoid: closed mode strings
typed(title, { by: "word" });
track("").to("Save drafts", span(0, 1), "out");

// Prefer: values and functions users can extend or replace
typed(title, { by: words });
typed(title, { by: (s) => s.split("/") });
track("").to("Save drafts", span(0, 1), ease.out);
```

Save closed unions for the rendering layer below (e.g. IR curves lowered to `cubic-bezier` or `steps`), where every backend must handle every case. String unions are still fine for genuinely fixed facts, like `scheme: "light" | "dark"`.

## Fonts

Font files live only in `fixtures/fonts/`, and only tests load them, through `fontFixture("JetBrainsMono")` from `fixtures/fonts.ts`, so tests stay offline. Scenes, examples, templates, site scenes and the skill load fonts by name with `google()` from `@svjeez/fonts`. Code that runs in a browser, where `google()` can't cache to disk, loads a pinned TTF URL instead, such as `https://cdn.jsdelivr.net/fontsource/fonts/geist@5.3.0/latin-400-normal.ttf`. `scripts/fonts.test.ts` fails on a font file anywhere else or a local `font.load` or CSS `url()` in scene code.

## Checking a scene

Run these from the root (or from `examples/` or `site/`). `<scene>` is an example name (`pendulum`, `readme/hero`), `site:<name>` for `site/src/scenes`, or a path.

```sh
bun run scene check <scene>    # problems with file:line and a fix; exits 1 on errors
bun run scene frames <scene>   # PNG frames to look at (add -- --sheet --times 0,1.5)
bun run scene dev <scene>      # live preview with a scrubber
bun run scene svg <scene> -- --out x.svg
bun run example <name...>      # build examples into examples/dist/
bun run typecheck              # whole-repo tsc
```

After writing or changing a scene, run `bun run scene check` (it also reports TypeScript errors in the scene and the local files it imports, as `type-error`, using the nearest tsconfig.json), then look at frames. A ✓ from the build only means it compiled. The root `bun run check` is lint, format and tsc, not `svjeez check`.

## Before you commit

`bun run check` (oxlint, oxfmt, tsc) and `bun run test` must pass; `bun run format` fixes formatting. `hk.pkl` runs the same checks before every push once hk is set up (`mise use -g hk`, then `hk install`); `hk fix` runs the fixers. CI on a pull request that touches only `AGENTS.md`, `UPGRADING.md`, `.vscode/` or `site/` runs just `check`. The lint config carries strict house rules, so write to them from the start:

- a blank line before any statement that spans several lines, and before a `return` after other statements;
- a `// SAFETY:` comment on the line before every type assertion; prefer a typed parse or a type guard to an assertion;
- `typeof` checks only inside type guard functions (`(x: T): x is string => typeof x === "string"`);
- no `unknown` in return types or open `Record<string, unknown>` dictionaries; name the type.

## Scripts are Effect programs

Every script (build, release, check, codegen, one-off tasks) is an Effect program. `scripts/scene.ts` is the model to copy.

- Define commands with `Command`, `Argument` and `Flag` from `effect/cli` and run them with `Command.run`, which reads arguments from `Stdio`. Don't read `process.argv`.
- When Effect has a module for something, use it instead of `node:*` or `Bun.*`. That means `FileSystem` and `Path` for files, `ChildProcess` and `ChildProcessSpawner` from `effect/process` for subprocesses, `Console` for output and `Config` for environment variables. Parse JSON with `Schema`, compare versions with `SemVer`, and loop with `Effect.forEach` with an explicit `concurrency`.
- Every script ends with `.pipe(Effect.provide(Services.layer), BunRuntime.runMain)`, where `Services` is `scripts/services.ts`. Its one layer provides the Bun platform services (FileSystem, Path, ChildProcessSpawner, Stdio, Terminal), `Digest` and an `HttpClient`, and works under Bun, Node and `tsx` alike. Add `Effect.scoped` before it when the script acquires scoped resources. Reach for `Bun.*` (such as `Bun.build`) only where Effect has no module for the job, and wrap it in `Effect.tryPromise`.
- Fail with the two errors in `scripts/errors.ts`; don't define error classes per script. `ScriptError({ message, cause })` is every failure: the message is one sentence in a single template string with names quoted inline, such as `` `No scene called "${name}".` ``, and `cause` carries the underlying error for the runtime to print. `Exited({ code })` is for a child process that already printed its own failure; it exits with that code and prints nothing more. Never call `process.exit`.
- Don't define a constant, helper or type that is used once. Inline it where it's used. Name something only when two places share it.
- Write shared effects with `Effect.fn("name")` and inline ones with `Effect.gen`. A function that can fail returns an `Effect` or a `Result` instead of throwing.
- Prefer Effect combinators to hand-rolled branching, for example `Effect.findFirst(...).pipe(Effect.flatMap(Effect.fromOption(() => new NotFound(...))))`. Use template commands like ``ChildProcess.make(options)`bun ${file} ${flags}` ``, where an array interpolates as one argument per item. Don't rewrite argv to work around a parser; when a command passes flags through to another tool, they go after `--`.
- Don't write comments in scripts. The code should read without them.

## The single-file binary

`packages/bin` compiles the CLI and every add-on package into one executable (`bun run build:bin` writes `packages/bin/dist/svjeez`), for scenes with no `package.json` or `node_modules` beside them. Its `check` also reports TypeScript errors as `type-error`. When a package gains or loses an export, update `packages/bin/src/modules.ts`; its test fails until you do. If a package starts reading a file beside its code, make sure the build's embed plugin handles it (`packages/bin/scripts/binary.ts`).

On npm, `@svjeez/bin` is a small launcher (`src/svjeez.ts`, bundled by `scripts/package.ts`) that downloads the release's executable for the machine on first run, so `npx @svjeez/bin` needs no build. It fetches `v<version>`, whose executables the release workflow attaches a few minutes after `publish`.

## Site

`site/` is the Astro site at svjeez.texoport.in. Its own scenes and films live in `site/src/scenes/`; it also shows scenes from `examples/` through the `@examples/*` path. Its scripts run Astro under Bun with the `@svjeez/source` condition. Run `bun run dev` at the root, or `bun run build` and `bun run typecheck` inside `site/`. `bun run deploy` builds and deploys through Alchemy's `Cloudflare.Website.Astro` (`site/alchemy.run.ts`). The site pins TypeScript 6, because `astro check` does not support TypeScript 7.

## Design

UI and data (pages, panels, code blocks, app mock-ups, charts, maps) should look like Vercel's designers made them: Geist and Geist Mono, black and white with a gray scale, 1px hairlines instead of filled cards, tight negative letter-spacing on headings, small uppercase mono labels, and color used sparingly. Maps and charts must look slick and clean, never jagged. Around that, keep the landing page's whimsy: Blip the mascot hopping and reacting, handwritten notes in the marker font, squiggles. Films and heroes get both.

The launch film lives in `site/src/scenes/film/`; `bun run scene dev site:film` previews it and `bun run scene check site:film` checks it.

## Releasing

Every package shares one version. `bun scripts/release.ts version next` bumps them all and `bun.lock` (`minor` and `major` start a new `-next.0` line, `stable` drops the suffix, or pass an exact version). Push to main, then run `gh workflow run release.yml --ref main`: prereleases go to npm's `next` tag, stable versions to `latest`.

- Every package releases. An add-on's own `package.json` exports `src/`, so the workspace and `bun link` read source; its `build:package` writes the published package to `package-dist/`, which `publishConfig.directory` names and the release packs. Its `prepublishOnly` fails on purpose, so `npm publish` in the package folder can't ship `src/`.
- A new package needs `build:package` and `test:package` scripts, `publishConfig.directory`, the `prepublishOnly` guard, a README and a `test/consumer` check (copy `packages/og`), and must be in the `packages` matrix in `.github/workflows/ci.yml`.
- Every push also publishes every package to pkg.pr.new (`.github/workflows/preview.yml`, which runs `bun scripts/release.ts preview`): `bun add https://pkg.pr.new/svjeez@<sha>` or `@main` installs it with no npm release. Each folder in `templates/` becomes a StackBlitz project on that preview, named after its `package.json` name, with its svjeez dependencies pointed at the commit; keep `templates/starter` working when the API changes.
- A package's first publish needs a person logged in to npm: `bun scripts/release.ts claim packages/<name>`, then approve the staged version on npmjs.com. An agent can't do that step.
- A new version can take a few minutes to appear in `npm view`; a 404 right after the workflow passes isn't a failure. The workflow log's `Released` lines are the record.

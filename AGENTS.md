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

## Checking a scene

Run these from the root (or from `examples/` or `site/`). `<scene>` is an example name (`pendulum`, `readme/hero`), `site:<name>` for `site/src/scenes`, or a path.

```sh
bun run scene check <scene>    # problems with file:line and a fix; exits 1 on errors
bun run scene frames <scene>   # PNG frames to look at (add --sheet, --times 0,1.5)
bun run scene dev <scene>      # live preview with a scrubber
bun run scene svg <scene> --out x.svg
bun run example <name...>      # build examples into examples/dist/
bun run typecheck              # whole-repo tsc
```

After writing or changing a scene, run `bun run scene check` (it also reports TypeScript errors in the scene and the local files it imports, as `type-error`, using the nearest tsconfig.json), then look at frames. A ✓ from the build only means it compiled. The root `bun run check` is lint, format and tsc, not `svjeez check`.

## Before you commit

`bun run check` (oxlint, oxfmt, tsc) and `bun run test` must pass; `bun run format` fixes formatting. The lint config carries strict house rules, so write to them from the start:

- a blank line before any statement that spans several lines, and before a `return` after other statements;
- a `// SAFETY:` comment on the line before every type assertion; prefer a typed parse or a type guard to an assertion;
- `typeof` checks only inside type guard functions (`(x: T): x is string => typeof x === "string"`);
- no `unknown` in return types or open `Record<string, unknown>` dictionaries; name the type.

## The single-file binary

`packages/bin` compiles the CLI and every add-on package into one executable (`bun run build:bin` writes `packages/bin/dist/svjeez`), for scenes with no `package.json` or `node_modules` beside them. Its `check` also reports TypeScript errors as `type-error`. When a package gains or loses an export, update `packages/bin/src/modules.ts`; its test fails until you do. If a package starts reading a file beside its code, make sure the build's embed plugin handles it (`packages/bin/scripts/build.ts`).

## Site

`site/` is the Astro site at svjeez.texoport.in. Its own scenes and films live in `site/src/scenes/`; it also shows scenes from `examples/` through the `@examples/*` path. Its scripts run Astro under Bun with the `@svjeez/source` condition. Run `bun run dev` at the root, or `bun run build` and `bun run typecheck` inside `site/`. `bun run deploy` builds and deploys through Alchemy's `Cloudflare.Website.Astro` (`site/alchemy.run.ts`). The site pins TypeScript 6, because `astro check` does not support TypeScript 7.

This is a fresh new library without any users, we're good to make breaking changes - in fact, when changes make for a more coherent, simpler, cleaner library that agents can use more effectively, I actively encourage making those changes.

we have temporarily deleted the svjeez skill so don't bother looking for it - just do everything based on code

## Site

`site/` is the Astro site at svjeez.texoport.in. Its own scenes and films live in `site/src/scenes/`; it also shows scenes from `examples/` through the `@examples/*` path. Its scripts run Astro under Bun with the `@svjeez/source` condition. Run `bun run dev` at the root, or `bun run build` and `bun run typecheck` inside `site/`. `bun run deploy` builds and deploys through Alchemy's `Cloudflare.Website.Astro` (`site/alchemy.run.ts`). The site pins TypeScript 6, because `astro check` does not support TypeScript 7.

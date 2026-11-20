This is a fresh new library without any users, we're good to make breaking changes - in fact, when changes make for a more coherent, simpler, cleaner library that agents can use more effectively, I actively encourage making those changes.

we have temporarily deleted the svjeez skill so don't bother looking for it - just do everything based on code

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

## Site

`site/` is the Astro site at svjeez.texoport.in. Its own scenes and films live in `site/src/scenes/`; it also shows scenes from `examples/` through the `@examples/*` path. Its scripts run Astro under Bun with the `@svjeez/source` condition. Run `bun run dev` at the root, or `bun run build` and `bun run typecheck` inside `site/`. `bun run deploy` builds and deploys through Alchemy's `Cloudflare.Website.Astro` (`site/alchemy.run.ts`). The site pins TypeScript 6, because `astro check` does not support TypeScript 7.

## Design

UI and data (pages, panels, code blocks, app mock-ups, charts, maps) should look like Vercel's designers made them: Geist and Geist Mono, black and white with a gray scale, 1px hairlines instead of filled cards, tight negative letter-spacing on headings, small uppercase mono labels, and color used sparingly. Maps and charts must look slick and clean, never jagged. Around that, keep the landing page's whimsy: Blip the mascot hopping and reacting, handwritten notes in the marker font, squiggles. Films and heroes get both.

The launch film lives in `site/src/scenes/film/`. `bun run film` in `site/` previews it with a scrubber and live reload; `bun run film:svg` writes `site/film.svg`.

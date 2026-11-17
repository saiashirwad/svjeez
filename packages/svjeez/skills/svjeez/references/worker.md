# Rendering a scene in a Worker

A scene is a function that returns a string, so a Cloudflare Worker can render it on request: no file system, no browser, and no `nodejs_compat`. The core, `@svjeez/charts`, `@svjeez/diagrams`, `@svjeez/mermaid`, `@svjeez/code`, `@svjeez/math`, `@svjeez/icons` and `@svjeez/geo` all run in workerd, and the SVG is the same bytes `svjeez svg` writes.

Bundle the Worker into one ES module and upload that:

```sh
bun build src/index.ts --target=browser --format=esm --minify --outdir dist
```

## Fonts

A Worker may not fetch outside a request, so a font comes one of two ways:

- **Bytes in the bundle.** Ship the file as a module (Wrangler's `rules` with `type: "Data"` import it as an `ArrayBuffer`) and pass it to `font(bytes)`, which is sync.
- **`@svjeez/fonts` inside the request.** `google()` fetches the face from Google Fonts the first time an isolate asks for it and keeps it in memory after that. There is no disk cache.

A scene module that awaits `google()` at its top level fetches while it loads. Import it inside the handler, never at the top of the Worker, so that fetch happens during a request. The bundler keeps it in the same file and runs the module's top level on the first import:

```ts
const scenes = { card: () => import("./card.tsx") };

export default {
  async fetch(request: Request) {
    const { default: build } = await scenes.card();

    return new Response(build(), { headers: { "content-type": "image/svg+xml; charset=utf-8" } });
  },
};
```

## Params from the request

A query carries every value as text. `fromEntries` reads it the way `--param` does, and `parse` checks the result; its error names the path of the bad value, which makes a good 400:

```ts
import { fromEntries, parse } from "svjeez/params";

const { params, default: build } = await import("./card.tsx");
const query = new URL(request.url).searchParams;

try {
  return svg(build(parse(params, fromEntries(params, query))));
} catch (error) {
  return new Response(error instanceof Error ? error.message : String(error), { status: 400 });
}
```

`jsonSchema(params)` describes what `parse` accepts, for a form or for a model asked to fill the values. The model only writes JSON; `parse` checks it, and nothing it writes runs.

## Caching

The same URL always draws the same SVG, so cache by URL: answer with `cache-control: public, max-age=3600` and put the response in `caches.default` with `ctx.waitUntil`. Leave errors uncached.

## What does not work

- `svjeez check`, `frames` and `video`, and `@svjeez/dom`: they drive headless Chromium.
- Compiling scene source at request time. Workers forbid `eval` and `new Function`, so bundle every scene before you deploy.
- Reading files. `createRequire(import.meta.url)("world-atlas/countries-50m.json")` and `node:fs` have nothing to read in a Worker. Import the data instead: `import world from "world-atlas/countries-50m.json"`.

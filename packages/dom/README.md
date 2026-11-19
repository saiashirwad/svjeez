# @svjeez/dom

Turn a web app, or one component, into an animated SVG. Write your app and an interaction script; `film` does the rest.

`film(target, script, options)` takes a **target**: an app served at a URL with a root selector, or one component mounted alone.

```tsx
import { film } from "@svjeez/dom";
import { serve } from "@svjeez/dom/bun";
import index from "./index.html";

export default await film(
  serve(index, { selector: "#app" }),
  async ({ page, snap }) => {
    await snap("start");
    await page.locator("button").first().click();
    await snap("moved", { over: 0.7 });
  },
  { scheme: "both", title: "Sprint board", cache: "states.json" },
);
```

It serves the app, opens it in Chromium, fails if the page throws or logs a console error, waits for fonts and a stable layout before each `snap`, records, inlines fonts and images while the server is still up, compiles, and closes everything. You get a core `Scene`: `svg.emit(scene)`, or default-export it from an examples-style `index.tsx`.

With Vite (`vite` is an optional peer dependency), `serve` starts a dev server on a free port:

```ts
import { serve } from "@svjeez/dom/vite";

film(serve({ root: import.meta.dir, selector: "#app" }), run, options);
```

The Vite adapter serves a `<link>`/`<script>` in `index.html` that points outside the root (`href="../shared/theme.css"`) through `/@fs/` and extends `server.fs.allow` to it. Any stylesheet, script, font or image that the server answers with `text/html` fails `film`, naming the URL.

A target is `{ url, selector, sources(), close() }`. `sources()` returns a hash of the app's source, which keys the cache. The Bun adapter hashes the bundled page and its assets; the Vite adapter hashes the entry HTML and every project module it imports.

Options: `scheme` (`"light" | "dark" | "both"`), `title` (default: the component's name, else the page `<title>` with Vite, else the film file's name), `viewport` (default 1280x720), `cache` (a JSON file; reused while the source and options are unchanged, `SVJEEZ_DOM_REFRESH=1` records again. `true` is `<film file>.states.json`; a relative path is relative to the film file, not the cwd; an absolute path is kept. The film file is found through `runFilm`'s bridge or, under Bun, the caller's stack frame (one helper, `callerFile`)), `settle` (see below), `onDiagnostics` (default: one `console.warn` listing what is not faithful), `executablePath`.

## One component

Pass the component itself, with typed props. No string paths:

```tsx
import Card from "./Card.tsx"; // or ./Card.svelte
import theme from "./theme.css?url"; // Bun: import theme from "./theme.css" with { type: "file" }
import { film } from "@svjeez/dom";
import { component } from "@svjeez/dom/vite"; // or @svjeez/dom/bun

export default await film(component(Card, { task }, { css: [theme] }), async ({ snap, update }) => {
  await snap("todo");
  await update({ task: { ...task, done: true } }); // typed against Card's props
  await snap("done", { over: 0.6 });
});
```

The component is mounted alone in `#svjeez-root` (the capture selector, unless `selector` is given). `update(props)` merges new props, re-renders and waits for the page to settle.

**Props** are typed from the component (React `(props) => node`, Svelte `Component<Props>`) and cross to the browser as JSON. Data props are required and must be JSON-serializable (a `Date`, `Map` or class instance is a type error, and a runtime error naming the prop). Function props are optional: any function you pass is replaced by a no-op in the browser, and so is every callback you leave out, by naming convention: a prop called `on` + a capital (`onDone`, `onSelect`) reads as a no-op when missing (React and Svelte 5). Other function props you omit are `undefined`, so pass those as `() => {}`. Plain `tsc` sees `.svelte` imports as untyped (`Component<any>`), so check Svelte projects with `svelte-check` (see `examples/dom-svelte/card.check.ts`).

**Finding the module.** The browser has to load the same component, so `component` finds the module whose export `=== Card`:

- **Vite:** run the film file through Vite's SSR loader with `runFilm("./card.film.tsx")` (returns the `Scene`). Vite loads `.svelte` and `.tsx` itself, so the module graph holds every export; the page is a virtual module served by the same dev server (your plugins, CSS modules and `<style>` blocks included). Without `runFilm`, `component` throws and says so. `runFilm` marks `svjeez` and `@svjeez/dom` as `ssr.external` (merged with your own), so the film file shares the host's copies. Film files can run in parallel: each `runFilm` has its own server and dependency cache.
- **Bun:** add `preload = ["@svjeez/dom/bun/preload"]` to `bunfig.toml`. The preload records each source module's live exports as it loads, and `component` bundles the page with Bun's HTML bundler. Svelte works too with `bun-plugin-svelte` installed (`bun add -D bun-plugin-svelte`): the preload then also lets the film file import `.svelte`, and `component` bundles the page with the plugin. See `examples/dom-svelte/card.bun.tsx`.

A component defined in the film file itself, or one nothing exports, throws an error that says which.

## Adding a framework

A framework is a `Framework` (node side) and a `BrowserAdapter` (browser side). React and Svelte are the built-in ones (`src/frameworks/`); film's core does not know about either.

```ts
interface Framework {
  name: string;
  /** Is `component`, exported from `file`, one of yours? Tried in order. */
  detect(file: string, component: Prop): boolean;
  /** Absolute path of a browser module whose default export is a BrowserAdapter. Bundled into the page. */
  client: string;
}

interface BrowserAdapter<Component> {
  mount(component: Component, props: Bag, el: HTMLElement): void | Promise<void>;
  update(props: Bag): void | Promise<void>; // the full, merged props
  unmount(): void;
  /** Optional idle signal: resolves when the framework has nothing pending. */
  settled?(): Promise<void>;
}
```

Pass it as `component(C, props, { framework })`. To type its props, add a branch to `PropsOf` in `src/props.ts`.

Settling prefers the adapter's `settled()` (a framework that knows its pending commands or effects are done can say so), then waits for fonts, transitions and a stable layout. Replace the whole strategy with the `settle: (page, selector) => Promise<void>` option. `film` and its script surface (`page`, `snap`, `update`) are plain Promise-based, so an Effect wrapper can wrap them one for one.

## Snapshots

Capture a live DOM subtree as a plain, versioned JSON `Snapshot`: resolved layout, computed style, text runs with per-character advances, inline SVG, and Web Animations.

```
capture (in the browser) -> Snapshot -> [Snapshot -> Snapshot passes] -> compile -> scene -> backend
```

A Snapshot makes no scene decisions, so it can be stored, diffed and transformed before anything compiles it.

## capture

`capture(root)` is one self-contained function with no dependencies, so any driver can run it in the page. `captureScript` is its source:

```ts
import { captureScript, checkVersion, type Snapshot } from "@svjeez/dom";

await page.goto("https://example.com");
const snapshot = checkVersion(
  await page.evaluate(`(${captureScript})(document.querySelector("#hero"))`),
) as Snapshot;
```

It works with Playwright, Puppeteer or raw CDP `Runtime.evaluate`. Do not pass `capture` itself through `page.evaluate(capture, ...)` from a bundled build: the bundler may add helpers around it. The `captureScript` string is built from the function's own source, so it needs nothing else.

Capture reads the page as it renders now. Running animations and transitions are captured mid-flight: the layout shows that moment, and `animations` carries the keyframes and `currentTime`.

## Snapshot

`{ version: 1, viewport, root }`. Every node is an element (`rect`, `radii`, `transform`, `opacity`, `clip`, `background`, `backgrounds`, `border`, `outline`, `shadows`, `image`, `svg`, `animations`, `children`) or a text node of `runs`. Rects are the border box in page px before the element's own transform; each ancestor's transform composes on top. See `src/schema.ts`.

`checkVersion` throws on a Snapshot from another version. Snapshots are not migrated: capture again.

## compile

`compile(snapshot)` turns a Snapshot into core scene elements: groups, shapes, text and pictures, with nothing a backend has to guess at.

```ts
import { scene } from "svjeez";
import { svg } from "svjeez/tools";
import { compile } from "@svjeez/dom";

const { element, size, duration, diagnostics } = compile(snapshot);
const out = svg.emit(scene({ size, duration, title: "Hero" }, () => element));
```

Each element is a group framed at its transform origin (or its top-left corner), so children are measured from their parent. The root's top-left corner is `[0, 0]`, and `size` is its border box.

Drawn with core primitives: rounded boxes (per-corner radii), background colors and linear/radial gradients, opacity, blend, 2D transforms, overflow clips, `<img>` data URLs as pictures, inline svg paths and basic shapes, text runs at their captured baselines and advances. Built from plain geometry: borders and outlines (a stroke pulled inside the box, or wedges cut to a ring when sides differ), outer shadows (core `shadow()` on a shape cut away under the box), spread and inset shadows (blurred shapes), and text decorations (thin rects).

`diagnostics` lists what is not faithful, as `{ path, what }`: an elliptical radial gradient, `groove`/`ridge`/`inset`/`outset` borders, background images, `<img>` sources that are not `data:` URLs, svg text, paint servers and other elements, animated properties other than `transform`, `opacity` and `background-color`, and a keyed element that moves between parents it cannot ride across.

## Animating between states

`compile(states, options?)` takes the `State[]` that `record` returns. The first state shows, moves into the second over `over` seconds, rests for `hold`, and so on. Defaults: `over` 0.6, `hold` 0.8, `ease` `"inOut"`; set them in the options, or per state (`over` and `ease` are for the move into that state, `hold` for resting in it). `duration` is the total: use it as the scene's duration.

The blending is core's `morph.between()`. What a pair of elements shares moves, resizes and recolors; text that changes crossfades; an element with no pair in the next state fades out, and one with no pair in the previous fades in.

Elements are paired across states by `pair`, in this order: `pairBy(node)` (an option), `data-key`, `data-part`, `id`. Siblings with none of those are matched by tag and wording, keeping their order (a longest common subsequence); whatever stays unmatched enters or exits. Put `data-key` on anything that should keep its identity through reorders, inserts and removals.

A `data-key` (or `id`, or `pairBy` name) that sits under different parents in different states, like a card moving between columns, is lifted to the level of the nearest parent the states share and glides across in page coordinates. That works when nothing between it and that parent clips, transforms or fades; otherwise a diagnostic says so and it leaves in one place and enters in the other.

Every element also has an inner `@track` group that its Web Animations drive, so they never collide with the lanes a morph drives.

With one Snapshot, running animations and transitions play on from the captured moment (scene time 0): each continues from its `currentTime` through its delay, iterations and direction at its `playbackRate`, as `track()`s on `transform` (with `translate`, `rotate`, `scale`; the matrix becomes offset, rotate, scale and skew), `opacity` and `background-color`. An infinite animation is one cycle started at its phase and looped; a finite one is unrolled. Without `hold`, the scene rests until the longest running animation ends (one cycle for an endless one). Easings are cubic-bezier and steps (`linear()` is drawn linear). `fill` decides what shows before and after; when an animation lets go of a value, `transform` and `opacity` return to none and 1 and a color keeps its last keyframe, since a mid-flight capture cannot see the style underneath. Paused and finished animations stay as captured. With several states, animations are not compiled (each state shows its captured moment).

## record, cache, assets, schemes

Write normal Playwright against your own dev server; `record` only takes the snapshots. `snap(name, { over, hold, ease })` returns a `State` (`{ name, snapshot, over?, hold?, ease? }`): states play in order, `over` is the seconds spent moving into it from the previous one, `hold` the seconds it rests.

```ts
import { scene } from "svjeez";
import { svg } from "svjeez/tools";
import { cached, compile, inlineAssets, openPage, record } from "@svjeez/dom";

const url = "http://localhost:5173";

const states = await cached("hero.states.json", { url }, async () => {
  const { page, close } = await openPage({ url, viewport: { width: 640, height: 400 } });

  const recorded = await record(
    page,
    "#app",
    async (snap) => {
      await snap("empty");
      await page.fill("input", "Ada");
      await snap("typed", { over: 0.8 });
    },
    { scheme: "both" },
  );

  await close();

  return recorded;
});

// Download images and the web fonts the text uses; the scene then needs no network.
const { element, size, duration } = compile(await inlineAssets(states));
const out = svg.emit(scene({ size, duration, title: "Hero" }, () => element));
```

- `cached(file, inputs, fn)` keeps `fn`'s JSON result in `file` while `inputs` and the Snapshot version are unchanged. `SVJEEZ_DOM_REFRESH=1` records again.
- `scheme: "both"` captures each state under light and dark `prefers-color-scheme` and merges them with `mergeSchemes(light, dark)`: a color that differs becomes `{ light, dark }`, and `compile` draws it as a theme token, so the SVG follows the viewer's scheme. The two trees must match node for node.
- `inlineAssets` takes Snapshots or States (and returns the same kind), and embeds `<img>` and background images as `data:` URLs and the page's `@font-face` files for the families its text uses; `compile` then draws text with the embedded font instead of `font.system`. A URL that fails to download throws. Background images are embedded but still not drawn.
- `openPage({ url, viewport?, executablePath?, onError? })` launches headless Chromium; `onError` hears page exceptions and console errors from before the page loads.
- `playwright-core` is an optional peer dependency.

## Not captured

`::before` / `::after`, text-shadow, filters and backdrop-filter, masks and clip-path, 3D transforms (only the 2D part is kept), `<canvas>` and `<video>` contents, form control values, shadow DOM, repeating and conic gradients, background-size/position/repeat, scroll offsets inside scrolled containers, right-to-left and vertical text, and a root that sits inside a transformed ancestor.

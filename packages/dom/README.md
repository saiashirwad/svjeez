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

With Vite (`vite` is an optional peer dependency), `serve` starts a dev server on a free port, rooted at the film file's folder unless you pass `root`:

```ts
import { serve } from "@svjeez/dom/vite";

film(serve({ selector: "#app" }), run, options);
```

To use a film in a Vite app or an Astro site, import the film file with `?svjeez` through [`@svjeez/vite`](../vite/README.md#films) (or `@svjeez/astro`): you get the SVG's URL, filmed in dev and in the build. From a script, `runFilm(file)` from `@svjeez/dom/vite` does the same and returns `{ scene, svg, files }`.

The Vite adapter serves a `<link>`/`<script>` in `index.html` that points outside the root (`href="../shared/theme.css"`) through `/@fs/` and extends `server.fs.allow` to it. Any stylesheet, script, font or image that the server answers with `text/html` fails `film`, naming the URL.

A target is `{ url, selector, sources(), close() }`. `sources()` returns a hash of the app's source, which keys the cache. The Bun adapter hashes the bundled page and its assets; the Vite adapter hashes the entry HTML and every project module it imports.

Options: `scheme` (`"light" | "dark" | "both"`), `theme` (see below), `cursor` (see below), `title` (default: the component's name, else the page `<title>` with Vite, else the film file's name), `viewport` (default 1280x720), `cache` (a JSON file; reused while the source and options are unchanged, `SVJEEZ_DOM_REFRESH=1` records again. `true` is `<film file>.states.json`; a relative path is relative to the film file, not the cwd; an absolute path is kept. The film file is known when Vite loads it (`?svjeez` or `runFilm`), or under Bun from the caller's stack frame (one helper, `callerFile`)), `settle` (see below), `onDiagnostics` (default: one `console.warn` listing what is not faithful), `executablePath`.

## A theme

`theme` films an app that paints with your scene tokens, so its scene recolors with them. Give it the `tokens()` your other scenes use; the app's CSS paints with the same names as CSS variables.

```tsx
import { theme } from "./colors.ts"; // tokens({ light: { background, text, blue, … }, dark: { … } })

export default await film(serve({ selector: "#root" }), script, { theme });
```

```css
.card { background: var(--background); border: 1px solid var(--raised); color: var(--text); }
.chip { background: color-mix(in srgb, var(--blue) 14%, transparent); }
```

The page gets the theme's values in each scheme (`themeCss(theme)`, as an adopted stylesheet, so nothing is added to the DOM) and is filmed in both. Each color is read back from its light and dark values: one token's is `var(--token)`, a `color-mix()` of two tokens at a whole percent is their `mix()`, and either at an alpha is a `mix()` with transparent. The SVG declares the tokens, so `restyle(svg, { theme })` recolors it like any scene, mixes included. A color nothing in the theme makes (a black shadow) stays as captured. The theme keys the cache. `scheme` may be left out or `"both"`.

## The mouse

`cursor: true` draws the mouse over the page. Drive it with plain Playwright (`locator.click()`, `hover()`, `dragTo()`, `page.mouse`): `record` follows the page's own pointer events (an init script and a binding, so it survives `page.reload()`; nothing is added to the app's DOM) and keeps each snap's position, whether a button is held, and where buttons went down since the previous snap, as the state's `pointer`. The compile draws an arrow on its own layer above the page: it moves with each snap's move on the morph's easing, reaches a press just before the page reacts, dips while a button is held and leaves a ring where it pressed. It is dark with a light edge, so it reads in either scheme. Until the mouse first moves it is hidden; move it to a resting point before the first snap (and again before the last, for a seamless loop).

```tsx
export default await film(serve({ selector: "#root" }), async ({ page, snap }) => {
  await page.mouse.move(680, 410);
  await snap("idle");
  await page.getByRole("button", { name: "New issue" }).click();
  await snap("dialog", { over: 0.4 });
}, { cursor: true });
```

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

- **Vite:** the film file has to be loaded through Vite: import it with `?svjeez` ([`@svjeez/vite`](../vite/README.md#films)), or call `runFilm("./card.film.tsx")` from a script. It loads the film file with the nearest `vite.config.*` above it (up to its package; `root` and `config` options override), so Vite loads `.svelte` and `.tsx` itself and the module graph holds every export; the page is a virtual module served by the same dev server (your plugins, CSS modules and `<style>` blocks included). Loaded any other way, `component` throws and says so. `svjeez` and `@svjeez/dom` stay `ssr.external` (merged with your own), so the film file shares the host's copies. Films can run in parallel: each has its own server and dependency cache. A Bun-style `import.meta.dir` in the film file works too.
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
  /** Optional: a stable identity for an element (React's `key`), or undefined. Becomes the node's `identity`. */
  identify?(el: Element): string | undefined;
}
```

Pass it as `component(C, props, { framework })`. To type its props, add a branch to `PropsOf` in `src/props.ts`.

`identify` lets film hand the framework's own keys to `pair`: before each capture it stamps `data-svjeez-id` on every element from `identify`, and capture stores it as `identity`. React reads the `key` from the fiber on the DOM node, scoped by the list it is in (React keys are per list, so `key=1` in two lists is two elements), and `film` does so on app targets too (it finds React's fibers on any page; a page without React gets none). A keyed item that moves to another list is a new element: put `data-key` on it to follow it. Svelte keeps no keys in the DOM, so it has no `identify`: put `data-key` on a Svelte list's items to have a reorder slide.

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

`::before` and `::after` become synthetic element nodes (tag `::before`/`::after`, `part` of the same name so they pair across states) before and after the real children, with their `content` text, `attr()`, `url()` and quotes resolved. An empty, absolutely positioned one in a host that is its containing block is read from the host's padding box. Any other is measured through a temporary `<span>` (or `<img>`) wearing its computed style, inserted after the real children are captured, while the pseudo-element is switched off by an adopted stylesheet; everything is removed afterwards. While it is there the host has one extra child, so `:first-child`, `:last-child` or `:empty` rules on real children may restyle them and nudge the pseudo-element. `counter()` content draws nothing, and replaced elements, `display: none` and `content: none` have no pseudo-element. Animations on a pseudo-element ride on its node.

Capture reads the page as it renders now. Running animations and transitions are captured mid-flight: the layout shows that moment, and `animations` carries the keyframes and `currentTime`. Each element with animations also gets `base`: what its animated properties compute to without them, which is what they return to when an animation ends or has not started. Capture reads it synchronously: each effect is pushed past its start with `fill: none`, the style is read, and the effect's timing is put back, so no frame renders and the animations keep their time, state and rate.

Each background layer carries its own `place`: `background-size`, `-position`, `-repeat`, `-origin` and `-clip`, with shorter lists repeated to the number of layers, boxes and gradient sizes resolved to px, and gradients resolved against their tile. An image layer keeps `auto`, `cover` and `contain` for `compile`, which can read the image's size.

Capture never drops CSS silently. Anything it cannot represent is a short phrase in the element's `notes` (`conic-gradient() is not drawn`, `a 3D transform is flattened to 2D`, `filter: sepia() is not drawn`, `<canvas> is not drawn`, `::before counter() content is not drawn`, ...), and `compile` forwards each as a diagnostic. Open shadow roots are captured as the browser composes them: a host shows its shadow tree, and a `<slot>` shows its assigned nodes (or its fallback content). Closed shadow roots cannot be seen from the page, so their hosts capture as empty.

Bidirectional text is cut per line into pieces that each read one way, in visual order. A right-to-left piece (Hebrew, Arabic, ...) has `rtl: true` and its `text` in logical order, so the SVG text shapes joined scripts itself; `compile` wraps it in an isolate (U+2067 ... U+2069, zero advance) so it renders the same under any base direction. Spaces at the ends of a piece are dropped, so an underline or line-through has gaps where a line changes direction.

## Snapshot

`{ version: 1, viewport, root }`. Every node is an element (`rect`, `radii`, `transform`, `opacity`, `clip`, `background`, `backgrounds`, `border`, `outline`, `shadows`, `filter`, `clipPath`, `masks`, `image`, `svg`, `animations`, `base`, `notes`, `children`) or a text node of `runs`. Rects are the border box in page px before the element's own transform; each ancestor's transform composes on top. See `src/schema.ts`.

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

Drawn with core primitives: `filter` (`blur()` as core `blur`, `drop-shadow()` as `shadow`, `brightness()`, `contrast()`, `saturate()`, `grayscale()`, `hue-rotate()` as `adjust`, `opacity()` as opacity), `text-shadow` (core `shadow` on the text; several are blurred copies below it), `clip-path` (`inset()`, `circle()`, `ellipse()`, `polygon()`, `path()`, against its reference box) as a group clip, `mask-image` (gradients and images, placed like backgrounds) as an alpha mask, rounded boxes (per-corner radii), background colors, `url()` images and linear/radial gradients (repeating ones too, elliptical ones as a scaled circle) placed by `background-size`, `-position`, `-repeat`, `-origin` and `-clip`, opacity, blend, 2D transforms, overflow clips, `<img>` data URLs as pictures, inline svg paths and basic shapes, text runs at their captured baselines and advances. Built from plain geometry: borders and outlines (a stroke pulled inside the box, or wedges cut to a ring when sides differ), outer shadows (core `shadow()` on a shape cut away under the box), spread and inset shadows (blurred shapes), and text decorations (thin rects).

`diagnostics` lists what is not faithful, as `{ path, what }`: everything the Snapshot's `notes` say, `groove`/`ridge`/`inset`/`outset` borders, background images that were not inlined or cannot be read, a repeating gradient with no period, `<img>` sources that are not `data:` URLs, svg text, paint servers and other elements, animated properties other than `transform`, `opacity` and `background-color`, and a keyed element that moves between parents it cannot ride across.

## Animating between states

`compile(states, options?)` takes the `State[]` that `record` returns. The first state shows, moves into the second over `over` seconds, rests for `hold`, and so on. Defaults: `over` 0.6, `hold` 0.8, `ease` `ease.inOut`; set them in the options, or per state (`over` and `ease` are for the move into that state, `hold` for resting in it). `ease` is any curve from `svjeez` (`ease.out`, `ease.spring()`); a cached film (`film`'s `cache`) can't keep a per-snap one, so it takes `film`'s `ease` option instead. `duration` is the total: use it as the scene's duration.

The blending is core's `morph.between()`. What a pair of elements shares moves, resizes and recolors; text that changes crossfades, or is typed (see below); an element with no pair in the next state fades out, and one with no pair in the previous fades in.

Text that changes in a focused `<input>` or `<textarea>` is typed: erased back to what the old and new values share, then typed out over the move, a character at a time with a caret, while its placeholder goes at the first keystroke. A text policy decides this for every text that changes: `film(target, script, { text })`, `compile(states, { text })` or one `snap(name, { text })` takes `(change) => typing({ by: words }) | fade | undefined`, where `change` has `from`, `to`, `state`, `tag`, `part`, `field` and `focused`. The default is `typeInFields`. Typing needs one line of plain text in a font svjeez can measure; anything else fades.

Elements are paired across states by `pair`, in this order: `pairBy(node)` (an option), `data-key`, the framework's `identity` (React's `key`, see [Adding a framework](#adding-a-framework)), `data-part`, `id`. Siblings with none of those are matched by tag and wording: first, in any order, the ones that are strongly alike (same tag and subtree shape, same words or 90% of their letter pairs) and each other's only best candidate, so a reordered list slides; then the rest keeping their order (a longest common subsequence). Duplicates and near-ties are not guessed at: they fall to the ordered match. Whatever stays unmatched enters or exits. Put `data-key` on anything that should keep its identity through reorders, inserts and removals. A React `key` is the bare key, not scoped to its list, so give lists distinct keys if their items should not pair across lists.

A `data-key` (or `id`, or `pairBy` name) that sits under different parents in different states, like a card moving between columns, is lifted to the level of the nearest parent the states share and glides across in page coordinates. That works when nothing between it and that parent clips, transforms or fades; otherwise a diagnostic says so and it leaves in one place and enters in the other.

Every element also has an inner `@track` group that its Web Animations drive, so they never collide with the lanes a morph drives.

With one Snapshot, running animations and transitions play on from the captured moment (scene time 0): each continues from its `currentTime` through its delay, iterations and direction at its `playbackRate`, as `track()`s on `transform` (with `translate`, `rotate`, `scale`; the matrix becomes offset, rotate, scale and skew), `opacity` and `background-color`. An infinite animation is one cycle started at its phase and looped; a finite one is unrolled. Without `hold`, the scene rests until the longest running animation ends (one cycle for an endless one). Easings are cubic-bezier and steps (`linear()` is drawn linear). `fill` decides what shows before and after; when an animation lets go of a value, `transform` and `opacity` return to none and 1 and a color keeps its last keyframe, since a mid-flight capture cannot see the style underneath. Paused and finished animations stay as captured. With several states, animations are tracks over the whole film, the same on every state's copy of an element, so the morph has nothing to blend. An animation that is the same (name and keyframes) in consecutive states is one run, continuous through the moves between them, with the phase of the first of those states' capture (a spinner keeps spinning through the move). A run starts when its first state starts to appear: at 0 for the first state, at the start of the move in for an element that enters, and at the end of the move in (where that state's capture shows) for one already there. It ends with its last state, or after the move out for an element that leaves, which keeps animating while it fades. Outside a run the property holds the state's static value, and moves between those with the state's ease. An endless animation is unrolled over a run that does not span the whole film, so a long film makes a long track.

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
- `inlineAssets` takes Snapshots or States (and returns the same kind), and embeds `<img>` and background images as `data:` URLs and the page's `@font-face` files for the families its text uses; `compile` then draws text with the embedded font instead of `font.system`. A URL that fails to download throws.
- `compile(states, { theme })` draws a merged pair that the theme makes with its tokens (see [A theme](#a-theme)).
- `openPage({ url, viewport?, executablePath?, onError?, css? })` launches headless Chromium; `onError` hears page exceptions and console errors from before the page loads, and `css` is added to every document as an adopted stylesheet.
- `playwright-core` is an optional peer dependency.

## Not captured

`backdrop-filter`, `filter: invert()`, `sepia()` and `url()`, `clip-path: url()`, luminance masks (`mask-mode: luminance`) and `mask-image: url(#...)`, 3D transforms (only the 2D part is kept), `<canvas>` and `<video>` contents, form control carets and native chrome beyond checkbox, radio and select state, shadow DOM, conic gradients, `background-attachment: fixed` (drawn as scroll), scroll offsets inside scrolled containers, right-to-left and vertical text, and a root that sits inside a transformed ancestor.

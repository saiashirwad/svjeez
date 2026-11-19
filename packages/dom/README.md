# @svjeez/dom

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

`diagnostics` lists what is not faithful, as `{ path, what }`: a skew, an elliptical radial gradient, `groove`/`ridge`/`inset`/`outset` borders, background images, `<img>` sources that are not `data:` URLs, svg text, paint servers and other elements, animations, and a keyed element that moves between parents it cannot ride across.

## Animating between states

`compile(states, options?)` takes the `State[]` that `record` returns. The first state shows, moves into the second over `over` seconds, rests for `hold`, and so on. Defaults: `over` 0.6, `hold` 0.8, `ease` `"inOut"`; set them in the options, or per state (`over` and `ease` are for the move into that state, `hold` for resting in it). `duration` is the total: use it as the scene's duration.

The blending is core's `morph.between()`. What a pair of elements shares moves, resizes and recolors; text that changes crossfades; an element with no pair in the next state fades out, and one with no pair in the previous fades in.

Elements are paired across states by `pair`, in this order: `pairBy(node)` (an option), `data-key`, `data-part`, `id`. Siblings with none of those are matched by tag and wording, keeping their order (a longest common subsequence); whatever stays unmatched enters or exits. Put `data-key` on anything that should keep its identity through reorders, inserts and removals.

A `data-key` (or `id`, or `pairBy` name) that sits under different parents in different states, like a card moving between columns, is lifted to the level of the nearest parent the states share and glides across in page coordinates. That works when nothing between it and that parent clips, transforms or fades; otherwise a diagnostic says so and it leaves in one place and enters in the other.

Every element also has an inner `@track` group, reserved for its CSS animations to hang `track()`s on without colliding with the lanes a morph drives.

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
- `playwright-core` is an optional peer dependency.

## Not captured

`::before` / `::after`, text-shadow, filters and backdrop-filter, masks and clip-path, 3D transforms (only the 2D part is kept), `<canvas>` and `<video>` contents, form control values, shadow DOM, repeating and conic gradients, background-size/position/repeat, scroll offsets inside scrolled containers, right-to-left and vertical text, and a root that sits inside a transformed ancestor.

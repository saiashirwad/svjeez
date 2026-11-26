# `@svjeez/dom`

Film an existing web UI (plain HTML, React, or Svelte 5) in headless Chromium, snapshot its DOM at named moments, and compile the states into one zero-JS, light/dark-aware animated svjeez SVG.

## Setup

```sh
npm install @svjeez/dom svjeez
npm install -D playwright-core
npx playwright-core install chromium-headless-shell
```

Install framework peers as needed:
- **React:** `react`, `react-dom` (`>=18`), plus `@vitejs/plugin-react` for Vite.
- **Svelte 5:** `svelte` (`>=5`), plus `bun-plugin-svelte` for Bun or `@sveltejs/vite-plugin-svelte` for Vite.
- **Vite:** `vite` (`>=6`).

### Wiring: Bun vs Vite

A film file default-exports `await film(target, script, options)` (returns a normal `Scene`).

| Target | Import | How to run | Setup required |
|---|---|---|---|
| HTML/app (Bun) | `serve(indexHtml, { selector })` from `@svjeez/dom/bun` | `svjeez check\|frames\|svg\|video film.tsx` | Import `index.html` (`import index from "./index.html"`). |
| Component (Bun) | `component(Comp, props, { css?, framework?, selector? })` from `@svjeez/dom/bun` | `svjeez check\|frames\|svg\|video film.tsx` | Add `preload = ["@svjeez/dom/bun/preload"]` to `bunfig.toml` in the working dir. Component must live in its own module. |
| App (Vite) | `serve({ selector, root?, config?, entry? })` from `@svjeez/dom/vite` | `svjeez check\|frames\|svg\|video film.tsx` | Reads the nearest `vite.config.*`. |
| Component (Vite) | `component(Comp, props, { css?, framework?, selector? })` from `@svjeez/dom/vite` | `import x from "./film.tsx?svjeez"` via `@svjeez/vite`, or `runFilm(file)` from `@svjeez/dom/vite` | Plain `svjeez` CLI cannot load Vite `component()` films directly. |

- **React JSX pragma:** When `svjeez check` type-checks a film that imports React `.tsx` components under a `jsxImportSource: "svjeez"` tsconfig, put `/** @jsxImportSource react */` on line 1 of each React component file (or give the React folder its own `tsconfig.json` excluded from the parent).
- **CSS for `component()`:** Pass `css: [styles]` using `import styles from "./a.css" with { type: "file" }` (Bun) or `import styles from "./a.css?url"` (Vite).

## Mental model

1. **Pipeline:** `capture(el)` (in-page) → `Snapshot` JSON → `record(page, selector, run)` collects `State[]` on each `snap(name, timing)` → `inlineAssets(states)` embeds `@font-face` and images as data URLs → `compile(states)` pairs elements and emits a `morph.between` scene tree. `film()` wraps all of this plus `openPage` and `scene()`.
2. **Script & settling:** The script receives `{ page, snap, update }` (standard Playwright `page`). Before every `snap()` and after every `update(partialProps)`, `film()` automatically settles (framework tick, `document.fonts.ready`, CSS transitions, and 3 stable layout frames). Any uncaught page exception or `console.error` fails the film.
3. **Timing & loops:** `snap(name, { over?, hold?, ease?, text? })`: `over` (default `0.6s`, ignored on the first snap) is the transition into this state; `hold` (default `0.8s`) is the rest before the next move. `film()` always produces a **looping** scene (`loop: false` is not an option on `film`), so end your script on a snap matching the first state (with a short `hold: 0.01`) to avoid `loop-seam` warnings.
4. **What becomes scene nodes (and how elements pair):**
   - Each captured DOM node becomes positioned shapes, gradients/backgrounds, borders, shadows, clip-paths, masks, inline SVG subtrees, form controls, and per-line text runs with per-codepoint glyph advances.
   - `compile()` pairs nodes across states in precedence order: `pairBy(node)` → `data-key` → framework identity (React `key`) → `data-part` → `id` → unkeyed sibling order + tag/text similarity. Paired nodes slide, resize, and recolor; unpaired nodes fade in/out. Add `data-key="..."` (or stable React keys) to items that move across lists/columns (avoid clipping/transforming ancestors between old and new parents).
   - **Unsupported / approximated:** `<canvas>`, `<video>`, `mask-image: url(#...)`, `counter()` pseudo-content, vertical `writing-mode`, and rAF-driven JS loops are not captured/replayed; CSS animations/transitions are captured as keyframes; `mix-blend-mode` and non-solid/dashed/dotted borders are approximated and reported via `onDiagnostics`.
5. **Typing in inputs:** Default policy (`typeInFields`) types text changes inside a focused `<input>`/`<textarea>` with a caret and crossfades everything else. Give the input a `placeholder` (so a text node exists in the prior state) and drive it via Playwright `fill()`/`pressSequentially()`.
6. **Dark/light schemes and theme tokens:**
   - `scheme: "both"` captures light and dark `prefers-color-scheme` and merges them into CSS variable tokens.
   - `theme` (a `tokens()` object) injects `--<token>` CSS vars into the page, films both schemes, and binds matching computed colors back to your theme tokens (your CSS must reference `var(--surface)`, etc.). Omit `scheme` when passing `theme`.
7. **Caching (`cache: true | "states.json"`):** Saves recorded states next to the film file and skips Chromium while page sources, selector, scheme, theme, viewport, cursor, and script text are unchanged. Set `SVJEEZ_DOM_REFRESH=1` to force re-recording. Cached films cannot use per-snap `ease` or `text` functions—pass those in `film()` options instead.
8. **Cursor (`cursor: true`):** Renders a pointer following Playwright mouse actions (`click`, `hover`, `mouse.move`, `dragTo`). Move the mouse to its start position before the first snap and back before the last snap to avoid `loop-seam` on the cursor arrow.
9. **Component props are JSON:** Data props must serialize as plain JSON (ISO strings for Dates); callback props (`on*`) become optional no-ops.

## API map

| Entry | Exports |
|---|---|
| `@svjeez/dom` | `film(target, run, opts)`, `openPage(opts)`, `record(page, selector, run, opts?)`, `compile(states, opts?)`, `inlineAssets(states, opts?)`, `cached`, `mergeSchemes`, `themeCss`, `capture`, `captureScript`, `settleScript`, `typing`, `fade`, `typeInFields`, `react`, `svelte`, `serializeProps`, `SNAPSHOT_VERSION`, `checkVersion` |
| `@svjeez/dom/bun` | `serve(htmlImport, { selector, port? })`, `component(Comp, props, { css?, framework?, selector? })` |
| `@svjeez/dom/bun/preload` | Bun preload plugin (register in `bunfig.toml` for Bun `component()`) |
| `@svjeez/dom/vite` | `serve({ selector, root?, config?, entry? })`, `component(Comp, props, opts?)`, `runFilm(file, { root?, config? })` |
| `@svjeez/dom/react`, `@svjeez/dom/svelte` | Browser-side framework mount adapters |

## Verified snippet

Plain HTML + Bun `serve` (`counter.film.tsx`, paired with `./html/index.html` containing `#app`, `#n`, `#inc`):

```tsx
import { film } from "@svjeez/dom";
import { serve } from "@svjeez/dom/bun";
import index from "./html/index.html";

export default await film(
  serve(index, { selector: "#app" }),
  async ({ page, snap }) => {
    await page.mouse.move(300, 150);
    await snap("zero");
    await page.click("#inc");
    await snap("one", { over: 0.4 });
    await page.click("#inc");
    await snap("two", { over: 0.4 });
    await page.evaluate(() => { document.getElementById("n")!.textContent = "0"; });
    await page.mouse.move(300, 150);
    await snap("zero-again", { over: 0.4, hold: 0.01 });
  },
  { scheme: "both", title: "Counter", cursor: true, viewport: { width: 400, height: 300 } },
);
```

Single React or Svelte component (Bun `component()`, with `preload = ["@svjeez/dom/bun/preload"]` in `bunfig.toml`):

```tsx
import { film } from "@svjeez/dom";
import { component } from "@svjeez/dom/bun";
import Badge from "./Badge.tsx"; // starts with /** @jsxImportSource react */

export default await film(
  component(Badge, { label: "Inbox", count: 1 }),
  async ({ snap, update }) => {
    await snap("one");
    await update({ count: 5 });
    await snap("five", { over: 0.5 });
    await update({ count: 1 });
    await snap("back", { over: 0.5, hold: 0.01 });
  },
  { title: "Badge", viewport: { width: 240, height: 80 } },
);
```

## Gotchas

- `component() from @svjeez/dom/bun needs the preload` → Add `preload = ["@svjeez/dom/bun/preload"]` to `bunfig.toml` and run from that directory.
- `component() from @svjeez/dom/vite needs the film file to be loaded through Vite` → Import with `?svjeez` via `@svjeez/vite` or run via `runFilm(file)` instead of `svjeez check`.
- `component: could not find the module that exports X` → Export the component from its own module (not inline in the film file).
- `TS2339: Property 'div' does not exist on type 'JSX.IntrinsicElements'` → Add `/** @jsxImportSource react */` to line 1 of every React file.
- `waitForSelector: Timeout 30000ms exceeded` → Fix `selector` to match a visible element on the page.
- `record: there is already a state named "…"` → Give every `snap()` call a unique name.
- `film: a theme is filmed in both schemes … not "light"` → Omit `scheme` (or set `"both"`) when passing `theme`.
- `component: props.when is a Date, which is not JSON` → Pass JSON-serializable props (e.g. ISO date strings).
- `loop-seam` warnings on states or `cursor: true` arrow → End on a snap matching the first state (and move the mouse back to its initial position).
- Input text fades instead of typing → Add a `placeholder` on the input and use Playwright `fill()`/`pressSequentially()` so the field is focused.
- `film: snap("x") has its own ease, which a cached film can't keep` → Move `ease` / `text` options from `snap()` to `film()` options when `cache` is enabled.

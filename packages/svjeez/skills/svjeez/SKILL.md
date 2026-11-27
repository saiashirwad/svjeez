---
name: svjeez
description: Author, check, and render svjeez animated SVG scenes in TypeScript/JSX (one self-contained SVG with zero runtime JS). Use when creating or editing svjeez scenes, debugging timing or `svjeez check` diagnostics, rendering frame sheets or MP4/WebM video, filming a live React/Svelte/HTML UI with `@svjeez/dom`, drawing charts, diagrams, Mermaid, math, code, maps, or icons, or wiring Vite, Astro, OG cards, live-editor sessions, or the single-file CLI binary.
---

# svjeez

Compiles a TypeScript/JSX scene into one self-contained animated SVG (CSS keyframes + SMIL where geometry/filters animate, zero runtime JS), plus PNG frame sheets and MP4/WebM video.

## Authoring loop

Follow these steps in order. A scene is **done** only when `svjeez check` reports **0 errors and 0 warnings** and you have **visually inspected `sheet.png`** and confirmed the layout, legibility, and motion match the intent.

1. **Write the scene.** Start `.tsx` files with `/** @jsxImportSource svjeez */` (unless `tsconfig.json` sets `"jsxImportSource": "svjeez"`). Default-export `scene(options, (canvas) => tree)` with a full-canvas background `<Shape geometry={canvas.rect} fill={theme.background} />`, a `tokens({ light, dark })` theme, and `loop: false` for one-shot animations. See [examples/basic.tsx](examples/basic.tsx).
2. **Check the model.** Run `svjeez check <file>` (fast, no browser). Use `--at 0,1.5,3` to inspect boxes, opacity, fills, and active lanes at specific times. Fix every error and warning (`--fail-on warning` enforces zero warnings).
3. **Check rendered pixels.** Run `svjeez check <file> --browser` to measure rendered text bounds, overlap, and contrast in headless Chromium.
4. **Inspect frames.** Run `svjeez frames <file> --sheet --out <dir>` and view `<dir>/sheet.png`. Passing `check` verifies constraints, not composition or visual timing.
5. **Emit the output.** Run `svjeez svg <file> --out scene.svg` (or `svjeez video <file> --out scene.mp4`).
6. **Measure playback (optional, for long or heavy scenes).** Run `svjeez perf <file>` to play the scene in headless Chromium across its whole duration and report fps, p95 frame time, dropped frames, and the slowest stretch. `check` cannot see dropped frames; add `--fail-under 50` to gate on fps.

## Mental model

- **Scene contract:** `scene({ size: [w, h], title, desc?, duration?, theme?, loop?, still?, markers? }, (canvas) => tree)`. `size` (inline tuple `[w, h]` or `as [number, number]`) and `title` are required. `duration` must be `> 0` (or omitted when the root is a `<Sequence when={span(0, n)}>`). `canvas` is a `Bounds` (`x, y, width, height, size, center, rect`).
- **Nodes only:** Every element is a svjeez component (`Shape`, `Text`, `Run`, `Group`, `Picture`, `Arrow`, `Slot`, `Shader`, `Stack`, `Grid`, `Center`, `Align`, `Sequence`, `Series`). Text lives inside `<Text font size fill>`; inline styled spans use `<Run>` inside `<Text>`. Every `<Shape>` needs `fill` or `stroke`.
- **Fonts are explicit:** There is no default or inherited font. Pass a `Font` or `FontFamily` (from `font()` or `@svjeez/fonts`) to every `<Text>`. Load every weight/italic you use; missing glyphs are a build error.
- **Colors are hex or tokens:** Pass `#rgb`, `#rrggbb`, `#rrggbbaa`, or `tokens({ light, dark })` values (passed as `scene({ theme })` so light/dark CSS variables emit). Derive shades with `mix(a, b, share)` and `alpha(c, 0..1)`. Use `scheme="light" | "dark"` to show a node in one scheme only.
- **Textures, layers, `none`, relief:** `noise({ frequency, seed, ramp, octaves?, type?, stitch?, rotate? })` is a fill (on `<Shape>` and `<Text>`) or `<Shape>` stroke that maps noise through a color ramp (tokens work; animate `frequency` with a track). A `<Shape>` `fill` or stroke `color` also takes layers painted bottom to top: `fill={[gradient, { paint: noise(…), blend: "multiply", opacity: 0.4 }]}`; a layer's `effects` (e.g. `[emboss()]`) light that layer alone. `rotate` (degrees, about the box center) turns stretched grain like `frequency: [0.09, 0.7]` along a limb without turning the shape. A node painted `none` (fill and stroke) is left out of the scene; a `none` stroke drops just the stroke. `effects={[emboss({ light: { azimuth, elevation }, depth })]}` lights the node's own shape so it reads as raised.
- **Gradients:** `linear({ from, to, stops })`, `radial({ center, radius, stops })`, and the box-relative `linear.across` / `radial.across`. `radius` may be `[rx, ry]` for an ellipse, and `radial.across({ shape: "ellipse" })` stretches to the node's box (vignettes), with `fit` read per axis. An ellipse's radius ratio and vertical center can't animate.
- **Coordinates:** Top-left origin `[0, 0]`, y down. `offset` moves the node's own `[0, 0]` (for `circle(r)`, that is its center); `at` + `anchor` pins a point of its bounding box (`top-left`, `top`, `top-right`, `left`, `center`, `right`, `bottom-left`, `bottom`, `bottom-right`; `<Text>` also accepts `baseline-*`). Use `at` or `offset`, never both. `at` places the box, so a `<Code>` whose split drops its first column, or a group holding a caret at x=-6, shifts; use `offset` there.
- **Layout containers:** `Stack` (`direction`, `gap`, `align`, `justify`, `padding`, `width`, `height`), `Grid` (`columns`, `gap`), `Center`, and `Align` (`to`, `place`, `inset`) place their children. Omit `at`/`offset` on children of a layout container; nudge a child with `motion={{ offset }}`. `Stack`, `Grid`, `Center`, and `Slot` accept backdrop props (`fill`, `stroke`, `radius`, `padding`); `<Group>` does not. `Fragment` flattens its children into the parent layout.
- **Transforms, clips, and refs:** `rotate`, `scale`, `skew` pivot around `origin` (default `"center"` of the node's box; also a place name, `[x, y]` from box top-left (so content bleeding past the frame moves it; pivot on a fixed point with `{ own: [x, y] }`), `"at"`, `"own"` for the node's own `[0, 0]` where its `offset` puts it, `{ own: [x, y] }` in the node's own coordinates, or `{ frame: [x, y] }` in the PARENT's coordinates, so `frame: [0, 0]` is the parent's corner, not the node's). `rect(w, h)` is top-left anchored (covers `[0, 0]` to `[w, h]`) unless `anchor: "center"`; `circle`/`ellipse` are always centered. `clip` and `mask` live in the node's own frame: center a circular clip with `moved(circle(r), own.center)`. `ref()` names a node so `Arrow` or `Align` can read settled anchors (`.center`, `.left`, `.right`, `.top`, `.bottom`, `.topLeft`, `.side(edge, t)`, `.part(key)`).
- **Components and context:** Use plain functions `(props) => SceneElement` for typed props and pass `ref`/`motion` explicitly. Use `component({ name, props?, render })` when you need a minify-stable name or Standard Schema validation (without `props`, its JSX accepts only `children` and `id`). Share implicit values with `context(defaultValue)` (`<Ctx value={v}>` and `Ctx.read()`). Use `h(Component, props, ...children)` in plain `.ts` files without JSX.
- **Geometry and determinism:** Geometry builders take plain numbers; animate geometry with `track(geomA).to(geomB, span)`. Use `random(seed)` (integer or string seed) for repeatable randomness.

## Timing

Timing is where most scene errors occur. Every span and track obeys strict clock rules. See [examples/timing.tsx](examples/timing.tsx) and [examples/morph.tsx](examples/morph.tsx).

### Clocks, `Sequence`, and `Series`

- Every `span` is in seconds on the clock of its nearest enclosing `<Sequence>` (root clock = scene). Nested `<Sequence>` offsets add: `span(0.5, 1)` inside `<Sequence when={span(2, 6)}>` inside `<Sequence when={span(1, 3)}>` runs at `3.5s..4.5s`.
- Nothing may run past its clock's end, and one `Track` instance cannot be read on two different clocks (build a track per clock with a helper function).
- `<Sequence when={span(s, o)}>` shifts its children by `s` with length `o`; `<Sequence when={span(s)}>` (open span) runs to scene end. `<Sequence clock={clock("name", span(s, o))}>` plays on a page-driven clock (`svjeez/page`).
- `<Series gap={g}>` plays children sequentially, starting each `g` seconds after the previous ends (negative `g` overlaps). Every direct child of `<Series>` must have a `<Sequence when={span(0, length)}>` at its root—always start at local `0`, since `<Series>` adds the offset. `durationOf(element)` gives the length of an element such as a series, as in `<Sequence when={span(0, durationOf(series))}>` for a footer across it, or `still: durationOf(series) - 0.5`.

### `span` arithmetic

Verified numbers for `span(start, over)`:

| Expression | Result `[start, over]` | End | Notes |
|---|---|---|---|
| `span(1, 2)` | `[1, 2]` | `3` | Interval; `span(2)` is open (`end = Infinity`) |
| `span(1, 2).shift(0.5)` | `[1.5, 2]` | `3.5` | Shift start by `dt` |
| `span(1, 2).next(1)` | `[3, 1]` | `4` | Starts where this span ends |
| `span(1, 2).next(1, 0.5)` | `[3.5, 1]` | `4.5` | Gap `0.5s` (`-0.5` overlaps to `[2.5, 1]`) |
| `span(1, 2).chain(0.5, 1)` | `[1, 2]`, `[3, 0.5]`, `[3.5, 1]` | `4.5` | This span plus back-to-back lengths |
| `span(1, 2).cascade(3, 0.2)` | `[1, 2]`, `[1.2, 2]`, `[1.4, 2]` | `3.4` | Same length, staggered by `step` |
| `span(1, 2).distribute(3, 0.5)` | `[1, 0.5]`, `[1.75, 0.5]`, `[2.5, 0.5]` | `3` | First starts at `start`, last ends at `end` |
| `span(0, 4).pace([1, 2, 1])` | `[0, 1]`, `[1, 2]`, `[3, 1]` | `4` | Proportional lengths; `{ gap: 0.5 }` gives `0.75, 1.5, 0.75` |

Read the span of a track's last step with `t.span`. Find when a track reaches a value with `timeAt(t, value)` (returns seconds or `undefined`).

### Tracks, `keyframes`, and derived values

- `track(initial)` is immutable; `.to(value, span, curve?)` and `.set(value, span)` return new tracks. Steps cannot overlap—chain with `.next()`. Default curve is `ease.out` (string tracks default to `ease.linear`).
- `keyframes([[t0, v0], [t1, v1, curve?], ...])` takes strictly increasing absolute times; `curve` shapes the leg arriving at that frame and returns a normal `Track`.
- `.repeat(n)` plays `n` total runs back-to-back (snapping back to start each run). `.rewind(over, curve?)` winds back to the initial value over the **last `over` seconds of the scene** (not right after the last step). `.loop(period, { phase? })` repeats the first `period` seconds counted from `0s`—make `period >= motion end` and a divisor of `duration`.
- Derived values: `t.map(fn, { tolerance? })`, `t1.with(t2).map((a, b) => ...)`, `through(val, fn)` (maps plain values or tracks), and `within(t, low, high)` (0..1 progress between two values—exact and cheaper than `.map`). Move points as one track: `track([0, 0]).to([0, -55], s)`.
- `ease` presets: `linear`, `in`, `out`, `inOut`, `pop`, `hold`, `steps(n)`, `bezier(x1, y1, x2, y2)`, `spring({ stiffness?, damping?, mass? })`, `at(curve, progress)`. `ease.pop` overshoots—use it for scale/offset, and `ease.out`/`ease.inOut` for opacity.

### Visibility, `enter` / `exit`, and `loop` / `still`

- Bare nodes are visible from `0s`. `enter(span, { from?, curve? })` merges over `{ opacity: 0 }` so the node starts hidden and enters over `span`. `exit(span, { to?, curve? })` hides it before the end.
- Compose motion layers with `motion={[layerA, cond && layerB]}` (falsy entries are skipped). Other layers: `ride(geometry, progressTrack, { turn? })`, `wiggle(amp, { seed, rate?, period?, curve? })`, and `sampled(fn, span, { tolerance })`; `sampled.all(fn, span, opts)` takes a record-returning fn, calls it once per time and returns a track per key (use it when limbs share one solve).
- `loop` defaults to `true`. Any node whose end state differs from `0s` warns `loop-seam`. For one-shot animations, set `loop: false`; for looping scenes, return every animated property to its `0s` state with `exit()` or `.rewind()`.
- `still` sets the `prefers-reduced-motion: reduce` frame (defaults to 85% of `duration`, or `false` to disable). Pick a moment when the scene is readable and settled.
- A `<Group>` with moving content that holds at opacity 0 (a film's shot before its `enter()` and after its `exit()`) costs nothing while hidden, filters included, unless the `still` frame shows it; so fade finished shots out rather than covering them.
- `markers: { handoff: 4.5 }` names moments (seconds, from 0 to `duration`). `frames --times` and `check --at/--times` take the names mixed with numbers, as in `--times handoff,10.5`; an unknown name lists the known ones.

### `morph` and `morph.between`

- `morph(before, after, when, opts?)` and `morph.between(states, spans, opts?)` (`states.length - 1` sequential spans) blend between scene trees.
- Give every node that arrives, leaves, or changes a stable `key`. Unkeyed sibling mismatches are a compile error. Keys are unique per parent, but two `.map()` lists in one parent may reuse a key (both `key={i}`), as in React; `ref().part(key)` finds a key as written, and throws when two lists share it. Options: `curve`, `enter`, `exit`, `stagger`, `each`. `stagger` delays each changing part; `each` sets how long each part moves (with no `stagger`, the starts spread so the last part ends with the span).

## Core API surface (`svjeez`)

Hover types for full option objects. Every value export of `svjeez`:

| Group | Exports |
|---|---|
| Scene & nodes | `scene`, `Group`, `Shape`, `Text`, `Run`, `Picture`, `picture`, `Arrow`, `Slot`, `Shader`, `Fragment`, `h` |
| Layout & refs | `Stack`, `Grid`, `Center`, `Align`, `spread`, `ref` |
| Components & state | `component`, `context`, `param`, `defaults`, `parse`, `random` |
| Geometry builders | `rect`, `circle`, `ellipse`, `arc`, `line`, `polygon`, `path`, `spline` |
| Geometry ops & measure | `moved`, `rotated`, `scaled`, `mirrored`, `merge`, `around`, `reversed`, `subtract`, `bounds`, `length`, `pointAt`, `along` |
| Color, paint & effects | `tokens`, `mix`, `alpha`, `linear`, `radial`, `pattern`, `noise`, `none`, `blur`, `shadow`, `adjust`, `displace`, `emboss` |
| Time & motion | `span`, `clock`, `track`, `keyframes`, `ease`, `enter`, `exit`, `ride`, `sampled`, `wiggle`, `through`, `within`, `timeAt`, `Sequence`, `Series`, `morph` |
| Text & fonts | `font`, `count`, `numeral`, `typed`, `chars`, `words` |

Subpaths: `svjeez/tools` (`svg.emit`, `check`, `describe`, `RULES`, `SceneError`, `expand`, `propsOf`, `isScene`, `valueAt`, `boxesOf`), `svjeez/frames` (`renderFrames`, `openScene`, `checkPixels`, `costOf`, `validateSvg`), `svjeez/page` (`mount`, `player`, `scrolled`, `pointer`, `hovered`, `seen`, `restyle`, `seek`, `loopLength`), `svjeez/jsx-runtime`, `svjeez/typecheck`.

Notes on specialized core features:
- **`count` / `typed`:** Put `${count(track, { format: numeral({ decimals: 2 }) })}` and `{typed(stringTrack, { by: chars | words, caret })}` inside `<Text>`. When `caret: true` starts before the first keystroke, set `caret: { opacity: track(0).set(1, span(firstKeystroke)) }` to avoid `visible-at-zero`.
- **`param`:** `export const params = { gap: param.number(40, { min: 10, max: 80 }) }` and default-export `(values) => scene(...)` (or read `defaults(params)`). Pass `--param key=value` or `--params file.json` on the CLI.
- **`<Shader>`:** Needs `typegpu` + `unplugin-typegpu` and a page runner (`svjeez/page` `mount`); `svg`/`frames` render its fallback children.

## CLI

Run `svjeez --help` for all flags. Every scene command accepts `[params]` (`--params data.json`, `--param key=value`).

| Command | Use |
|---|---|
| `svjeez check <file>` | Static model + TS check (`--browser`, `--at 0,1.5`, `--times`, `--fail-on warning`, `--json`, `--color-scheme`) |
| `svjeez frames <file>` | Render PNG frames (`--sheet`, `--count 6`, `--times 0,1`, `--scale 2`, `--out dir`, `--color-scheme`, `--background`) |
| `svjeez perf <file>` | Playback smoothness in headless Chromium: fps, p95 frame ms, dropped %, main-thread ms/s, slowest window (`--ms 3000`, `--windows 4`, `--fail-under <fps>`, `--json`, `--color-scheme`) |
| `svjeez svg <file>` | Emit self-contained SVG (`--out file.svg`, `--json`) |
| `svjeez video <file>` | Encode MP4/WebM via `@svjeez/video` (`--out`, `--format`, `--fps`, `--loops`, `--quality`, `--workers`, `--scale`, `--background`; `--preview` for a fast fps 12, scale 1, low-quality render) |
| `svjeez dev <file>` | Live-reloading preview server with scrubber (`--port 5173`, `--out`) |
| `svjeez skill` | Print `SKILL.md` (`--install [--dir .claude/skills]`) |
| `svjeez version` | Print installed version |

## Check rule codes

`svjeez check` prints each problem with a `fix:` line. All 21 codes from `RULES`:

| Code | Fix |
|---|---|
| `type-error` | Fix the TypeScript prop/value type (check `jsxImportSource` and inline `size: [w, h]` tuples). |
| `compile-error` | Follow the `SceneError` message (bad span/clock, unkeyed morph, missing font/glyph, layout child with `offset`/`at`). |
| `compile-warning` | Fix the warning reported on an input `.svg` file/string. |
| `never-visible` | Raise `opacity`/scale above `0` at some time, uncover the node, enlarge its clip, or remove it. |
| `zero-size` | Give the geometry, text, or image a positive width and height, or remove it. |
| `off-canvas` | Move the node inside the canvas bounds (or grow `size`), or remove it. |
| `text-overflow` | Move text inside the canvas, shorten it, add `width` to wrap, or reduce `size`. |
| `overlap` | Separate overlapping `<Text>` nodes (or opaque shapes covering text), or hide one while the other shows. |
| `missing-glyph` | Switch to a font that contains the characters, or remove unsupported glyphs (no fallback font fills in). |
| `whole-font` | Info only: the font embeds whole (size and reason in the message). Load a TTF with TrueType outlines, or pass `subset: false` to accept it. |
| `low-contrast` | Pick theme tokens with sufficient contrast against the flat background in **both** light and dark schemes, or enlarge text. |
| `loop-seam` | Set `loop: false` for one-shots, or return entering/moving nodes to their `0s` state with `exit()` / `.rewind()`. |
| `visible-at-zero` | Start opacity/scale tracks hidden (use `enter()`), animate `fillOpacity` after `draw`, or gate `typed` caret opacity. |
| `nothing-enters` | Info only: add `enter()` if the scene is meant to build up; ignore for pure-motion loops. |
| `wasted-motion` | Start the track at its value when the node first becomes visible (or stop animating after it leaves). |
| `static` | Animate at least one property within `duration` (`duration: 0` is rejected). |
| `moving-filter` | Keep `effects` parameters static and animate the node's transform/opacity instead. |
| `moving-box` | Place the `<Group>` with `offset` instead of `at`/`anchor`, or keep moving children in an inner `<Group>`. |
| `layout-overlap` | Increase `Stack`/`Grid` `gap` or reduce the child's `motion` offset/scale/rotation. |
| `word-cut` | Widen `<Text width>` or reduce `size` so long words fit on one line. |
| `unsupported` | Replace the feature with one supported by the target backend. |
| `approximate` | Avoid `blur` below `1.5` units (WebKit softens it) or accept the noted approximation. |

## Companion modules

Load the matching reference file only when your task hits its branch:

| Package | Reach for it when… | Reference |
|---|---|---|
| `@svjeez/fonts` | Loading Google Fonts (`google`, `google.family`), caching fonts offline, or drawing stroke handwriting (`casual`, `Lettering`, `handwrite`). | [modules/fonts.md](modules/fonts.md) |
| `@svjeez/charts` | Plotting numeric data on x/y axes: grouped `bars`, `line`, `area` with auto-fitted scales and plot annotations. | [modules/charts.md](modules/charts.md) |
| `@svjeez/code` | Rendering syntax-highlighted `<Code>` listings, typing code in, morphing diffs (`tokens.across`), or aligning highlights (`codeLayout`). | [modules/code.md](modules/code.md) |
| `@svjeez/diagrams` | Building auto-laid-out `flowchart`, `sequence`, `stateMachine`, `tree`, `lanes`, `pie`, `gantt`, `erDiagram`, `classDiagram`, and 15+ other diagram specs. | [modules/diagrams.md](modules/diagrams.md) |
| `@svjeez/mermaid` | Turning existing Mermaid text (`flowchart`, `sequenceDiagram`, `stateDiagram-v2`, `pie`, etc.) into a themed, animated svjeez diagram. | [modules/mermaid.md](modules/mermaid.md) |
| `@svjeez/icons` | Placing, stroking, drawing, or recoloring Tabler (`@svjeez/icons/tabler`) or Lucide (`@svjeez/icons/lucide`) vector icons. | [modules/icons.md](modules/icons.md) |
| `@svjeez/math` | Typesetting `<Tex>` formulas (with `\textcolor`/`\cssId` morphs), plotting functions on `plane()`/`<Axes>`, linear transforms, or compass constructions. | [modules/math.md](modules/math.md) |
| `@svjeez/geo` | Projecting GeoJSON/TopoJSON flat maps (`project`), dot maps, routes, or rotating Earth globes (`globe`, `<GlobeShape>`, `sun`/`night`). | [modules/geo.md](modules/geo.md) |
| `@svjeez/dom` | Filming an existing HTML, React, or Svelte app/component in headless Chromium into a zero-JS animated SVG (`film`, `serve`, `component`). | [modules/dom.md](modules/dom.md) |
| `@svjeez/video` | Encoding a finished scene/SVG to MP4 or WebM video via headless Chromium WebCodecs (`svjeez video` or `video()`). | [modules/video.md](modules/video.md) |
| `@svjeez/vite` | Importing `.tsx?svjeez` (with `&posters` or `&inline`) in a Vite app so scenes ship as static SVG assets. | [modules/vite.md](modules/vite.md) |
| `@svjeez/astro` | Embedding `<Scene>` in Astro pages and generating per-route `og:image` cards via `_<page>.og.tsx` / `<Og>`. | [modules/astro.md](modules/astro.md) |
| `@svjeez/og` | Authoring 1200×630 `ogScene` link-preview cards and rasterizing scenes to JPEG/PNG/WebP (`renderOg`, `ogResponse`, `renderStill`). | [modules/og.md](modules/og.md) |
| `@svjeez/live` | Building an editor, MCP server, or CLI that parses TSX scenes by `id`, applies minimal-diff literal edits, and compiles in a runner (`Effect`). | [modules/live.md](modules/live.md) |
| `@svjeez/bin` | Running standalone `svjeez` single-file binary with no `package.json`, `svjeez init`, or `svjeez browser install`. | [modules/bin.md](modules/bin.md) |

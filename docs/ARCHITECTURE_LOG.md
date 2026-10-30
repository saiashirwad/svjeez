# Architecture log

Dated design changes, newest first. This is the only doc that records what something used to be.

### 2026-10-30 — The ontology doc set becomes the design reference

`docs/ONTOLOGY.md`, `docs/CRITERIA.md`, `docs/RATIONALE.md` and this log now describe svjeez. Before them the design lived in the shipped skill (`packages/svjeez/skills/svjeez/`), the package READMEs, `AGENTS.md` and code comments, and those stay as user documentation. The docs were mapped from the code, and where the code and the older documents disagreed the docs describe the code. These are the places they disagreed. Each one is open until the designer rules on it, and the related Q-items are in RATIONALE.md.

#### Timeline and motion

- `skills/svjeez/SKILL.md` says "Across layers `x`, `y` and `rotate` add and `opacity` and `scale` multiply" vs `sample.ts` `STACKED` also stacks `blur` with `Math.hypot`.
- `skills/svjeez/SKILL.md` and `references/params.md` say "a `#rrggbb` hex" vs `params.ts` `color()` accepts any string at runtime (the `Hex` type is compile-time only).
- `references/params.md` says a number kind "throws when ... the value is out of range" vs `check` passes `NaN` because `NaN < min` and `NaN > max` are false.
- `keys.ts` `valueAt` doc says "what the keys draw at `t`, as the browser plays them" vs the same function holds colours while CSS interpolates them (the comment itself says "Colors hold").

#### Compile and output

- SKILL.md error table lists `Node cannot load …. Install tsx`; that error is thrown by `src/cli.ts` (Frames, CLI, plugins and release), not compile code.
- SKILL.md "Runtime errors" table omits errors this area throws (see Q-12); the table is not exhaustive and `tests/skill.test.ts` only checks table-to-source, not source-to-table.
- SKILL.md `render` paragraph does not mention that `reducedMotion.at` is clamped to `[0, duration]`, or the 85% default; `RenderOptions` JSDoc states the default only.
- without-jsx.md says the default prefix is none and "the output is unchanged"; code agrees. It says classes and ids written by the author are not renamed; code agrees. But `render({ comment })` and authored `css` are also emitted verbatim (not documented).
- images-fonts.md "validateSvg warns past 256 KB" — code measures characters of the data URI (`uri.length > 262144`), which is the encoded size, not the source file size; a 190 KB PNG (base64 ≈ 253 KB) does not warn, while the doc's "Keep each image under 100 KB" refers to the file. Consistent but the unit differs between sentences.
- defs-css.md says "`render` emits a def only when something uses it, with a generated id"; code also emits a `{id}s` twin for animated filters under reduced motion. Not mentioned.
- icons.md says "`strokeWidth` ... scales with `size`, so a 48px icon strokes at 4px"; code agrees. icons.md does not say fill icons ignore `stroke` and `strokeWidth` (code does: the `fill` branch writes only `fill`).
- `Once` docs in SKILL.md describe `restyle(svg, { at, onceAt: 0 })`; `restyle.ts` finds once SMIL by `data-once`, which compile writes as an undocumented attribute (`ONCE_ATTR`).
- AGENTS.md says `src/layout/` imports nothing outside itself; `space.ts` imports a type from `./layout/box` (fine) but is not in `layout`. No conflict; noted because `texture.ts` also imports `./layout/box` types.

#### Geometry, fonts, ink and voxels

- `references/ink.md` says "`d` is any SVG path data, arcs included" vs `ink/path.ts` (`tokens`, `flatten`): arcs written with compact flags (`a5 5 0 1010 0`) throw `Path command a needs 7 numbers.` Verified by running `flatten`.
- `SKILL.md` and the `Spline.path` JSDoc say path data "from `from` to `to`" vs `spline.ts` (`path`): the bounds are put in order, so `path(2, 0)` equals `path(0, 2)`. Verified.
- `SKILL.md` line on `matchPaths` says "any outlines" vs `paths.ts` (`parse`): same compact-flag limit as above.
- `references/images-fonts.md` says "Two files sharing a family, weight and style throw `Two different fonts claim …`" vs `font/font.ts`: the error is thrown in `compile.ts`, not by `font()` or `font.family()`; two such files only throw once they are both used in one render.
- `references/images-fonts.md`: "`validateSvg` warns past 256 KB" vs `validate.ts` (`EMBED_WARN_BYTES = 256 * 1024`) measures the length of the data URI, not the font file. The two agree only to within the 33 percent base64 cost.
- `AGENTS.md`: "`src/layout/` ... imports nothing outside `src/layout`" vs `geometry.ts` and `spline.ts` import `Point` from `layout/box` (the allowed direction); no mismatch, noted so nobody moves `Point`.
- `FontOptions.subset` JSDoc says "Applies to TrueType outlines (most .ttf files)" vs `font.ts` (`embed`): the test is the presence of a `glyf` table, not the file extension or format tag.

#### Layout and diagrams

- `skills/svjeez/SKILL.md` runtime-error table lists no diagram error (`No path from …`, `No edge from …`, `tree() needs exactly one root, got …`, `… needs N times, got M.`); only `walk() has no way from …` appears, and only in `references/diagrams.md`. The code throws all of them.
- `references/diagrams.md` says "Each returns `{ node, get(id), bounds }` plus helpers". `get(id)` on a `sequence` returns actor heads only, on `flowchart` returns nodes and groups, on `lanes` returns whole row boxes (label column included); the doc says only "a node's box" in the `Diagram` JSDoc.
- `references/diagrams.md` documents `flowchart` `play` as "Nodes appear rank by rank"; the code shows rank-0 nodes from the start and sorts later ones by rank, then cross-axis position (same visible result, but the first rank never animates).
- `layered.ts` and the AGENTS.md "Library layout" say `src/layout/` holds "pure layout math"; `field.ts` and `contour.ts` are plotting numerics for `extras/field.ts` rather than layout of boxes (see Q-28).
- `skills/svjeez/references/diagrams.md` sequence section does not mention `{ note }` rows placing at an actor or that `message(i)` indexes both messages and notes (the code does).

#### Extras

- `references/explainers.md` (Terminals) and `terminal.ts` doc comment "each prompt appears, its command types" vs `terminal.ts`: the prompt is part of the typed line, so `❯ ` types character by character at `cps`.
- `references/explainers.md` (Annotations): "Each takes `during: Span` and aims at a `Rect` with `target`" vs `marker.ts`: `Marker` takes `stops`, uses only `during.at` of stops after the first, and has no fade or exit.
- `references/explainers.md` (Moving code): "A start time like `at` in `play` or `reveal` is a `Beats`" vs this area: `play` belongs to the diagrams (“Layout and diagrams”); within extras only `reveal` takes `Beats`. `morph` takes `readonly Seconds[]` per transition and `typewriter`/`terminal` a single number.
- `references/explainers.md` (Calculus): `readout` "samples `text(t)` every `step` and shows each distinct string while it holds" vs `calculus.ts`: the first string is also shown before `at`, and the last holds after `at + over`.
- `references/fields.md` and `field.ts` `slopeSolution(f, axes, { x, y })` — consistent, but `start` is typed `Point` while meaning graph units; scene-px points would silently be wrong.
- `extras.ts` vs public signatures: `MorphResult`, `TypewriterResult`, `RevealResult`, `TerminalResult`, `AppWindowResult`, `FlowResult`, `AdaptiveResult`, `VariablesResult` are returned by exported functions but not exported.
- `AGENTS.md` lists `src/extras/` as "code, terminal, annotations, themes, and the diagrams"; the directory also holds axes, calculus, field, flow, camera, focus, marker, reveal, morph, timeline and typewriter.

#### Frames, CLI, plugins and release

- `AGENTS.md` "`@svjeez/vite` and `@svjeez/astro` never import svjeez" vs `packages/vite/src/posters.ts` imports `renderFrames` from `svjeez/frames` (svjeez is a peer dependency of `@svjeez/vite`); the scene environment imports svjeez at runtime.
- `AGENTS.md` "Releasing: ci.yml … checks the packed packages" and "In each [package], … `test:package`" vs `ci.yml`, which has no `test:package` step for `packages/icons` (it has the script and a `test/consumer/`).
- `packages/vite/README.md` "posters.quality … Default 0.8" vs `encode.ts` default parameter 0.82 (never reached through `posters.ts`).
- `AGENTS.md` "`bun test` — every test, including frame tests in headless Chromium" vs `tests/frames.test.tsx`, which skips every browser test with a console warning when Chromium is missing, unless `CI` is set.

#### Live editor

- `packages/live/src/fixes.ts` header says the fixes come from the "Errors and fixes" table of the skill; `errorTable` finds the section by the text `Runtime errors.`.
- `packages/svelte/README.md` tells a custom-control author to send `set` with `continues: true` after the first step; `packages/react/README.md` points to the gestures (`scrubbing`) that do this. Both are valid; the Svelte README does not mention the gestures.
- `packages/live/README.md` message table lists six message kinds and says "`update(state, msg)` is the same logic as a pure function"; the code also has runtime-only messages `compiled`, `shown`, `probed` that appear in `Msg` and `update` but not the README.
- `packages/live/README.md` says `{ type: "seek", at }` "moves the picture's clock"; the code does not clamp `at`.
- `AGENTS.md` lists `@svjeez/live`, `@svjeez/svelte`, `@svjeez/react` as published packages; their workspace `package.json` files set `"private": true` and the published manifest comes from `build:package`.
- `packages/live/src/editor.css` header says `select.sj-choice`'s `data-selected` and `data-sj-key` exist on every control; true for number, color, ease, choice, and the grip; the ease popover handles (`circle.sj-handle`) carry neither.
- `packages/live/README.md` says no framework is in the package; `packages/live/package.json` lists `playwright-core` and several `@svjeez/*` packages as devDependencies for tests only, and `sucrase` plus three `@lezer/*` as dependencies. (Consistent with G-6 only for `svjeez` itself.)

#### Charts, code, fonts, icons and Mermaid

- `packages/charts/README.md` lists the accent order as "blue, orange, green, magenta, cyan, yellow, red"; code uses the theme slot `number` (resolved by the theme, orange only in `defaultDark`).
- `packages/icons/package.json` has `"private": true`; `icons/README.md` and AGENTS.md describe it as an installable published package. (See Q-55.)
- `references/mermaid.md` says flowcharts take `TD`, `TB` or `LR`; `parse()` also accepts `BT` and `RL` and only `mermaid()` rejects them (README states this correctly; the reference omits that `parse` accepts them).
- `references/mermaid.md` and `README.md` say classDef/style/etc. throw; the code throws for line-leading words in `UNSUPPORTED` (`classDef class style linkStyle click direction accTitle accDescr title` followed by whitespace) and `:::` fails only as a generic "expected an edge" error, not as a named unsupported feature.
- `references/charts.md` Errors table gives `bars() needs a positive over, got …`; the same text also applies to `line()`/`area()` (it is generic "… needs a positive over") — table understates scope.
- `references/icons.md` says "about 8,000" icons; code has 6257 + 2193 = 8450.
- `references/code.md` states "Runs carry no ids" and recommends mapping pieces by hand; no code in this area adds ids (consistent), but `Highlighted` type allows `CodeRun` of any shape from `svjeez/extras`.

#### Maps and math

- `packages/svjeez/skills/svjeez/references/geo.md` and `packages/geo/README.md` list errors for `choropleth`, `cartogram`, `toBars`, `traffic`, `arc`, `sequential` only; code also throws `diverging()` domain, `choropleth() needs times that rise ...`, `traffic() needs a span ...`, `... at least one route`, weights, `line() needs at least two places.`, `bounds() needs at least one region or place.`, `globe()` positive duration and `globe() found no lines or rings to draw.` (geo.md lists the globe, reproject and trueSize errors; the README does not). The README error table is a subset of the reference.
- `references/geo.md` ("Errors") says `cartogram() takes one number per region`; code emits `toBars() takes one number per region` for toBars (same helper), and `cartogram() found no region to draw` is documented but `toBars() found no region to draw` is not.
- `references/math.md` "Constructions" says every element takes `at`, `over`, `color` and `aid`; `perpendicularBisector`/`angleBisector` (via `finishing(o)`) force `aid: false` on the resulting line, so `aid` is silently ignored there.
- `packages/geo/package.json` and `packages/math/package.json` have `"private": true` and `exports` pointing at source; AGENTS.md says these publish to npm. The published manifest is generated by `scripts/package-plugin.ts` (not checked here).
- README (geo) says `globe` "land(), borders(), graticule(step) and path(geojson) come back in pieces 30 degrees of longitude wide": `graticule()` returns one path per line (`list.map((arc) => arcs(() => arc))`), not band pieces.

Entries before this one are reconstructed from `git log`. The history before 075302f, which made the repository a Bun workspace, was squashed, so older changes are dated by the commits that survive.

### 2026-10-30 — `keysOf`/`valueAt` and `easeAt` become the single shared evaluator used by labs and the editor; morph blending moves to `paths.ts` (91fed19)

### 2026-10-30 — Plugin and Svelte package builds share `package-manifest.ts` for the published manifest, README and LICENSE (456d160)

### 2026-10-30 — `@svjeez/live` takes `svjeez` as a peer, scene packages as optional peers (13a49d8)

### 2026-10-30 — compile.ts loads world-atlas maps without an import attribute so they work on Node 20 before 20.10 and in Vite's dev server (c9f3a6d)

### 2026-10-30 — a drag whose first move changes nothing still starts its own undo step; exponent numbers set without new decimals (c3d2590)

### 2026-10-30 — `createEditor` takes a `?svjeez` first picture with optional duration, pauses when its last listener leaves, and owns the gestures (scrub, follow, bend, arrows, selection); react reads state through `useEditorState` (49e5221)

### 2026-10-30 — a number keeps its decimals through arrow steps; a measured grip is dropped when anything but its own value changed (213f96a)

### 2026-10-30 — no two literals share a key: paths start at top-level consts, clashes get ordinals, unnamed statements are keyed by place (f69cf33)

### 2026-10-30 — a compile timeout fails only the stuck worker's jobs, no worker starts after stop, `latestWins` survives a thrown job, play/pause/seek show the newest compile (d5b12ec)

### 2026-10-30 — `@svjeez/live` becomes the framework-free Elm-style core; `@svjeez/svelte` and `@svjeez/react` render it with one shared stylesheet (76605c3)

### 2026-10-29 — Still frames ease between keys: `valueAt` blends numbers and morph paths toward the next key, and `sample()` shares it (74d2d7b)

### 2026-10-29 — `handles()` and `follow()` added to `svjeez/params` so a drag on the picture edits a value (3e95557)

### 2026-10-29 — Labs' needs moved into the library: `easeAt`, `sample`, `random`, `Pivot`, `Once`, `sampled` precision, `restyle` paused and `onceAt` (ec59149)

### 2026-10-29 — `sampled()` cuts at a jump instead of tweening across it; a cut at the end of the timeline lands on 100% (999a27d)

### 2026-10-29 — Shape morphs: a `d` channel on `<path>` through SMIL (fd541f8)

### 2026-10-29 — `restyle({ still })` pauses every animation including a scene's own CSS (2bbbc20); `restyle()` introduced with `--t0` offsets (4b5c346)

### 2026-10-29 — `<Icon>` draws path data one `<path>` per piece (757361a)

### 2026-10-29 — Every CSS animation offsets by `--t0` so `restyle()` can start or hold a rendered SVG (4b5c346)

### 2026-10-29 — `slack` added to `sampledPath` for the hidden side of turning globes (a20af25)

### 2026-10-29 — Fields and level sets add `layout/field.ts` (Jobard-Lefer streamlines, Douglas-Peucker `simplify`) and `layout/contour.ts` (marching squares) beside the box layouts (b0b9a65)

### 2026-10-29 — style: anti-slop lint findings fixed across font, extras, layout, site, scripts (5233578)

### 2026-10-29 — repository formatted with oxfmt (d3c69e1)

### 2026-10-29 — `shot()` moves a shot in and out inside its span (46941b9)

### 2026-10-29 — heading for `travel()` and `Steady` for `Camera` (47dc159)

### 2026-10-29 — Calculus on axes: dot, tangent, secant, area, riemann, curve morph, parametric, polar, readout (7caddde)

### 2026-10-29 — `axes()` added to `svjeez/extras` (9f8719a); Brace gains `above`/`below` (14674a4)

### 2026-10-29 — `morph()` animates any `Morphable`, so equations morph like code (2d2408e)

### 2026-10-29 — `variables()` added; `adaptive()` builds on it (3489df5)

### 2026-10-29 — `svjeez video` command; the CLI loads `@svjeez/video` only when asked (a503941)

### 2026-10-29 — `openScene()` opens an SVG in a secure page; `renderFrames()` shares its setup (2b88542)

### 2026-10-29 — `@svjeez/video`: MP4/WebM through Mediabunny in headless Chromium (b5b546d); CI checks its package (fd3cd17, 6e01d04)

### 2026-10-29 — Release any package whose version isn't out yet, on every push to main; `claim` for the first version (a51d142, dbfe679)

### 2026-10-29 — Per-package release notes from `git log`; npm 11 on Node 20 for plugin consumers (81ecc35, 69a3d06)

### 2026-10-29 — `@svjeez/vite` and `@svjeez/astro` publishable on their own tags (2bf73fa, a6373f2, 3338698)

### 2026-10-29 — `@svjeez/live` gains `open()` documents, a Svelte `live()` with Picture and Source, and the one compile worker (1e36022)

### 2026-10-29 — labs get Svelte 5 islands, typed scenes with build-time first pictures, and `@svjeez/live` for parsing, editing and compiling scene source (8f3673a)

### 2026-10-29 — Charts README/skills reference gallery: every package README shows an animated scene (0bb2806)

### 2026-10-29 — `@svjeez/mermaid` added: hand-written parser for flowchart, sequence and state diagrams drawn through svjeez diagram functions (e8a87e4)

### 2026-10-29 — `@svjeez/code` highlighting stops using Shiki's per-line time limit so output does not depend on machine speed (d7defb6)

### 2026-10-29 — Example scene, skill reference, AGENTS section and CI step for `@svjeez/code` (3e16e79)

### 2026-10-29 — `@svjeez/code` added: Shiki to role-tagged runs for `code()` and `terminal()` (6124688)

### 2026-10-29 — `@svjeez/charts` added: animated bar, line and area charts (72ba974)

### 2026-10-29 — `@svjeez/icons` README stops claiming icons import one by one (a60a666)

### 2026-10-29 — `@svjeez/icons` added: Tabler and Lucide path data plus the generator (df8d757)

### 2026-10-29 — `@svjeez/fonts` added: Google Fonts by family name, cached on disk; example TTFs deleted (689da09)

### 2026-10-29 — epicycles: each circle spins by its frequency minus its parent's, so the pen rides the trace (b50da5e)

### 2026-10-29 — `readout()` renamed `counter()` so the core `readout()` keeps its name (997220d)

### 2026-10-29 — `plane()`: matrix steps through one CSS transform, functions through `d` (bd23bed)

### 2026-10-29 — `construct()`: compass-and-straightedge geometry that draws itself in order (4102c4a)

### 2026-10-29 — `line()` and `distance()` for cables; `dots()`, `sun()`, `night()` for the earth example (f9e7b85, e956c38)

### 2026-10-29 — `epicycles()`, `derive()`, `readout()` added to `@svjeez/math` (ad7a047); `anchor` and `write()` (989bfba)

### 2026-10-29 — `@svjeez/math` created: TeX as morphable glyph paths (2fcc8fa)

### 2026-10-29 — `@svjeez/geo` created; examples moved into their own workspace (ea14d3e)

### 2026-10-28 — Repository becomes a Bun workspace, `svjeez` in `packages/svjeez` (075302f)

### 2026-10-28 — `RenderOptions.prefix` scopes every generated id, class, keyframe, property and font family (34b136e)

### 2026-10-28 — `speed` renamed `playbackRate`, `Picture` interface renamed `PictureData`, `svjeez render` renamed `svjeez frames` (53d023e)

### 2026-10-28 — `loop: false` plays once and holds the last frame (8a9e0c5)

### 2026-10-28 — `compile.ts` split into keys, css and smil; special cases moved into the channel table (fc373ce)

### 2026-10-28 — Voxels move to `svjeez/voxel`, types prefixed `Voxel…`, block `until` renamed `to` (577f701)

### 2026-10-28 — `Stroke` becomes `Ink`, `ink()` becomes `inkPath()`, tools gathered under `tool` (1fd3df9)

### 2026-10-28 — Fonts embed cut down to used glyphs; whole font embeds when layout lookups could apply; format 12 cmap beyond the BMP (9b6ad05, 82c634f)

### 2026-10-28 — Ink strokes with pen, brush, nib and pencil, revealed through a mask that hands over to a plain copy (e93a91f)

### 2026-10-28 — annotations take `during`/`target`, `columns`, `variant`; spans and `end` from timed builders (1b622e1); accents from `base09` (e246e79)

### 2026-10-27 — Images embed as data URIs with `picture()`, `<Picture>`, image fx and href validation (d3d4ee6)

### 2026-10-27 — Hard cuts inside a hidden parent fall back to opacity (80f3663)

### 2026-10-27 — `speed` option divides every emitted duration (2415d3e)

### 2026-10-27 — Review fixes: CSS-escape family names, composite fan-out budget, off-curve-only contours, dedupe fonts by bytes (aa40409)

### 2026-10-27 — Custom fonts: `font()`, `font.family`, `fontFamily={font}`, `measure()`, `path()` and `<Glyphs>` (b374689)

### 2026-10-27 — `explain` renamed `svjeez/extras`; base16 themes, adaptive light/dark, window and terminal (24fa4e7)

### 2026-10-27 — role-tagged runs with ids; `get()` and id-first morph pairing (f751f63)

### 2026-10-27 — typewriter reveals code a character at a time (0382234); one `Code` type with word layout and content-matched morph (cbe1175)

### 2026-10-27 — Automated release pipeline; packed-package check in CI; CI renders every example on Node 20 and 22 (1ab645b, 3390c08, a341e9b)

### 2026-10-27 — `renderFrames`, the `svjeez` CLI (`svg`, `render`) and `bun run dev` preview (1a65ee8, 34e03e7, e5f4c3b)

### 2026-10-23 — `Scene`/`anim` replaced by `render`, motions, recipes and typed defs (d9e7f7e); one value formatter shared (5d3eace)

### 2026-10-23 — Typed `calc` builder that checks units (f7255e4); six significant digits kept in calc literals (d6e5da1)

### 2026-10-23 — Registered custom properties with `def.property` and `css` (e9acaa0)

### 2026-10-23 — Voxel scenes draw blocks back to front as instanced symbols with lifetimes and buried culling (fad7c02)

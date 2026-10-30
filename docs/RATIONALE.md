# Rationale

Why each current choice in [ONTOLOGY.md](ONTOLOGY.md) was made, what else was considered, and the evidence. A decision marked *Proposed* is an inference from the code that the designer has not confirmed. Open questions are at the end.

## Timeline and motion

### D-1 A motion is an immutable cursor-driven chain — *Decided*
- **Alternatives:** a declarative keyframe list per element; mutable timeline objects; start/end time pairs.
- **Why:** `at`, `to`, `set`, `wait` read like a script and make the timing arithmetic of a scene visible in source. `over` is a duration, so changing one line does not change the later ones' lengths. Immutability lets a base motion be reused and extended safely (G-3, G-4).
- **Evidence:** `Source: motion.ts doc comment "Time is a cursor: at moves it, to and set start at it and advance it"`; `Source: d9e7f7e "Replace Scene and anim with render, motions, recipes and typed defs"`.

### D-2 One lane, one transition at a time — *Decided*
- **Alternatives:** last-writer-wins on overlap; silently merge overlapping channels; allow overlap and sum.
- **Why:** two overlapping transitions on the same lane have no defined result in CSS keyframes. Throwing with a message that names the fix (move them in one `.to()` or stack two motions) removes a class of broken SVGs (G-4, G-9).
- **Evidence:** `Source: motion.ts Track.push error text`.

### D-3 Only some channels stack — *Decided*
- **Alternatives:** stack every channel as a wrapper; allow one motion only.
- **Why:** `opacity x y scale rotate blur` compose by nesting wrapper groups and have defined combination rules. Fills, paths and filter attributes cannot be layered in CSS, so each takes one motion per element (G-2, G-4).
- **Evidence:** `Source: channels.ts composition: "nest" | "replace"; skills/svjeez/SKILL.md "Only opacity x y scale rotate blur stack"`.

### D-4 Seeded randomness is part of the library (`random`, `wiggle`) — *Decided*
- **Alternatives:** `Math.random()` (non-deterministic); require the user to bring a PRNG; a hash of the seed into one number per call.
- **Why:** Determinism (G-7) needs a stream fixed by the seed on every runtime. FNV-1a hashes a string seed, mulberry32 is a tiny PRNG with no dependencies (G-6). A whole-number seed is not hashed so the known stream is checkable; `wiggle` takes `random(String(seed))` so number and string seeds meet.
- **Evidence:** `Measured by: the R-17 tests → random(1)() === 0.6270739405881613`; `Source: ec59149 "what the labs needed, in the library: ... random ..."`.

### D-5 `sampled` bakes a function and simplifies per lane, cutting at jumps — *Decided*
- **Alternatives:** keep all samples; fixed keyframe count; one global tolerance; tween across a jump.
- **Why:** a dense sample bloats the file (G-1); a per-lane tolerance in the lane's units (px for translate) makes the error bound meaningful and checkable (G-3). A function that resets (360 to 0) must not spin back, so a change that survives repeated halving becomes a cut.
- **Evidence:** `Source: 999a27d "sampled() cuts at a jump instead of tweening across it, and a cut at the end of the timeline lands on 100% (#21)"`; `Measured by: the R-21 tests → replay within 1px, far fewer keys`.

### D-6 `sample()` shares `keysOf`/`valueAt` with compile — *Decided*
- **Alternatives:** a separate evaluator; reading computed styles in a browser.
- **Why:** a readout or companion element placed beside a moving part must agree with what plays. Reusing the same key builder as emission keeps them in lockstep, and the Chromium test compares to the drawn box (G-3). `valueAt` blends toward the next key with the transition's ease so still frames agree with playback.
- **Evidence:** `Source: 74d2d7b "Still frames ease between keys: valueAt blends numbers and morph paths toward the next key, sample() shares it"`; `Measured by: the R-12 and R-24 tests → positions within 0.5px`.

### D-7 `restyle` re-times a rendered SVG through CSS variables and SMIL begin — *Decided*
- **Alternatives:** re-render the scene; rewrite keyframes with a delay; a script in the file.
- **Why:** a page can recolor, start in, or pause an `<img>` without recompiling or running script (G-1, G-2, G-5). CSS animations offset by `--t0`; SMIL cannot be paused from markup, so an `<animate>` is made to end just after the copy starts and freeze (`HOLD`, one millisecond, because Chromium shows the base value for an animation that ends at 0).
- **Evidence:** `Source: restyle.ts HOLD comment; commits 4b5c346, 2bbbc20`; `Measured by: the R-34 tests → begin="-2.999s" end="0.001s" fill="freeze"`.

### D-8 Times are compared with an absolute epsilon and keys one relative nudge apart — *Proposed*
- **Alternatives:** exact comparisons; per-scene tolerances.
- **Why:** floats from `start + over` need slack (`EPSILON = 1e-9` s); two keys meant to be one instant apart are placed `NUDGE` (1e-5 of the period) apart so CSS can express a cut as two keyframes. Values are code constants with no stated rationale, so the choice is inferred.
- **Evidence:** `Source: motion.ts doc comments on EPSILON and NUDGE`.

### D-9 Eases are structured data, not strings — *Decided*
- **Alternatives:** CSS timing-function strings; function-valued eases.
- **Why:** the same ease must compile to CSS `cubic-bezier`/`steps` and to SMIL `keySplines`, and be evaluated by `easeAt` for `sample`/`sampled`/UI; strings would have to be parsed back (G-2, G-3). Presets are fixed beziers so a scene renders identically everywhere (G-7).
- **Evidence:** `Source: motion.ts Ease doc comment "Structured, so CSS and SMIL each compile it"`; `Source: ec59149 (easeAt)`.

### D-10 Recipes bake time-varying values at call time — *Decided*
- **Alternatives:** compute in the viewer; emit a CSS random.
- **Why:** nothing runs in the viewer (G-2) and the same source gives the same bytes (G-7). `wiggle`/`shake` produce ordinary `to()` steps from fixed-rate samples.
- **Evidence:** `Source: recipes.ts wiggle doc comment "Values are baked at call time, so output is reproducible."`.

### D-11 Registered custom properties are typed keys, and `calc` checks units in types — *Decided*
- **Alternatives:** string-keyed `--x` variables; untyped `calc()` strings.
- **Why:** a property whose name and syntax live in the literal type lets each value be checked against its syntax; a mistake (length times length, cos of a number) fails to compile instead of producing invalid CSS (G-4). Properties are animated as lanes without a script (G-2). One motion on a parent can drive many children with different phases through `calc`, `cos` and `sin`.
- **Evidence:** `Source: e9acaa0 "Add registered custom properties with def.property and css"; f7255e4 "Add a typed calc builder that checks units"; d6e5da1 "Keep six significant digits in calc literals"`.

### D-12 Scene parameters are plain data with a pure `fit` — *Decided*
- **Alternatives:** a reactive framework store; arbitrary-closure schemas; zod-style schemas.
- **Why:** the schema must cross `postMessage` to a worker and be read by any framework's controls (G-10); scenes stay pure functions of values (G-7). `fit` clamps and steps without float dust so a raw slider or drag reading is always writable. `follow` derives drag direction numerically from the handle's own position function so the scene never states which way a handle moves.
- **Evidence:** `Source: params.ts header comment; 3e95557 "handles() and follow() in svjeez/params placing each handle and turning a drag into a value"`; `Measured by: the R-38 tests → arc handle follows 30 to 60`.

### D-13 `Pivot` and `Once` are groups, not new channels or attributes — *Decided*
- **Alternatives:** a `pivot` prop on every element; a `once` flag on `motion()`.
- **Why:** a turn about a chosen point must apply through every layer of a stack, which a wrapper group with `transform-origin` in the view box does (G-3). `Once` scopes a clock to a subtree and works for nested elements and SMIL together; a per-motion flag could not cover all motions in a part.
- **Evidence:** `Source: pivot.ts and once.ts doc comments; ec59149`.

#### Deliberately left out
- Easing by name strings (`"ease-in-out"`) — structured eases only (D-9).
- Colour interpolation inside `sample()` and `sampled()` — numeric channels and properties only (`sample.ts` doc comment; `skills/svjeez/SKILL.md`).
- Composing rotated/scaled layers as a matrix inside `sample()` — "read those layers one at a time" (`sample.ts` doc comment).
- Wall-clock or `Math.random` anywhere in this area — determinism (G-7).
- Runtime tag-vs-channel check inside `motion()` — types plus the validation in Compile and output own it (`motion.ts` has none).

#### How it's used / how it's abused
Authors chain `motion()` calls, use recipes, optionally `sampled()` for functions of time, and export a `params` schema so an editor can show controls. Inputs are source code, so abuse is mostly accidental.
| Abuse | Prevention | Criteria |
|---|---|---|
| NaN or infinite time/value silently emitting invalid CSS | `time()`, `checkValues`, `num()`/`significant()` throw | R-1, R-3, R-30 |
| Overlapping transitions on one lane | `Track.push` throws with the fix | R-5 |
| Non-determinism via `Math.random` in a scene | `random` and seeded `wiggle` provided; same bytes for same source | R-16, R-17 |
| Two properties/ids clashing between scenes on one page | per-file `--pN` names assigned by render | R-29 |
| Schema value out of range from a slider or drag | `fit`/`fitValues` clamp and step | R-37 |
| A sample function that returns different keys or NaN | `sampled` frame-shape check | R-19 |
| Untrusted text in `label` | `label` accepts only CSS identifiers | R-7 |

## Compile and output

### D-14 Motions compile to CSS keyframes, with SMIL only for filter primitives and `d` — *Decided*
- **Alternatives:** SMIL for everything; a script that drives the Web Animations API; JS-free but inline `style` transitions.
- **Why:** CSS keyframes run in `<img>` with no script (G-1, G-2). CSS cannot animate a filter primitive's attributes or path data in Safari, so those use SMIL.
- **Evidence:** `Source: packages/svjeez/src/channels.ts (backend comment: "d through SMIL, which Safari animates and CSS d does not")`; `Source: fd541f8`; `Source: SKILL.md "compiles them to CSS keyframes (SMIL for filter primitives)"`.

### D-15 Defs are refs resolved at render time, with ids by first use — *Decided*
- **Alternatives:** author-chosen ids; content-hash ids; always emitting every def made.
- **Why:** Hand-written ids collide when scenes inline on one page and when scenes compose (G-7). A ref gives type safety (a gradient is not a clip path, G-4) and lets the compiler drop unused defs (G-1).
- **Evidence:** `Source: d9e7f7e "typed defs"`; `Source: defs.ts doc comment`; `Source: SKILL.md "Never write a string or url(#id)"`.

### D-16 Reduced motion freezes the CSS animation at a still frame, 85% through by default — *Decided*
- **Alternatives:** remove animations (shows the first frame, usually empty); `animation: none` (same); pause at 0.
- **Why:** The last meaningful frame is the one worth showing a viewer who asked for no motion (G-5). Pausing with a negative `animation-delay` works for CSS; SMIL needs a still twin because CSS cannot pause it.
- **Evidence:** `Source: render.ts RenderOptions comment "Freeze frame for prefers-reduced-motion. Default: 85% through."`; `Source: css.ts freezeRule`.

### D-17 A `prefix` option scopes every generated name — *Decided*
- **Alternatives:** random per-render suffixes (breaks G-7); a hash of the content; forcing `<img>` embedding only.
- **Why:** Inlined scenes share one document, and every scene numbers its names from 1, so two scenes overwrite each other's animations. A caller-chosen prefix keeps output deterministic and readable (G-7, G-1).
- **Evidence:** `Source: 34b136e "Add RenderOptions.prefix for every generated name"`; `Source: without-jsx.md "Embedding in a framework"`.

### D-18 A hard 0/1 opacity cut compiles to `visibility`, falling back to `opacity` inside a hidden parent — *Decided*
- **Alternatives:** always opacity; `display`.
- **Why:** `visibility` lets the browser skip painting hidden parts. A descendant's `visibility:visible` overrides a hidden ancestor, so cuts inside a toggled element would show through, hence the fallback.
- **Evidence:** `Source: 80f3663 "hard cuts inside a hidden parent fall back to opacity"`; `Source: compile.ts veil comment`; `Measured by: the R-63 tests → pass`.

### D-19 Composition uses shells: stacking channels nest on `<g>` wrappers, others replace — *Decided*
- **Alternatives:** one `transform` string per element (loses independent timing); rely on SMIL `additive`.
- **Why:** CSS individual transform properties and `opacity` compose by nesting; `fill`, `stroke`, `d` and similar cannot, so a second motion on them is an error rather than a silent overwrite (G-3, G-4).
- **Evidence:** `Source: fc373ce "move special cases into the channel table"`; `Source: SKILL.md "Only opacity x y scale rotate blur stack"`; `Source: compile.ts placeLanes`.

### D-20 Images are inlined as data URIs, sniffed from bytes, drawn through one `<symbol>` per picture — *Decided*
- **Alternatives:** external hrefs (blocked in `<img>`); trust the file extension; copy bytes per use.
- **Why:** One file that plays everywhere (G-1). Bytes tell the truth about format and size. A symbol embeds repeats once. `EMBED_WARN_BYTES` flags files too big to download before the first frame.
- **Evidence:** `Source: d3d4ee6 "Embed images as data URIs: picture(), <Picture>, image fx, href validation"`; `Source: picture.tsx symbols comment`; `Source: images-fonts.md`.

### D-21 Output is bounded: key cap, percent precision, timing selection — *Decided*
- **Alternatives:** unlimited keys; always 4 decimals; per-key timing in every block.
- **Why:** `MAX_KEYS` stops a runaway `sampled()` before it bloats the file (G-1). Percentages shrink the file (G-1, G-7). Choosing the most common ease as the lane timing avoids repeating it.
- **Evidence:** `Source: compile.ts`, `css.ts`; `Source: SKILL.md error table`.

### D-22 Validation warns instead of failing on performance and portability hazards — *Decided*
- **Alternatives:** fail on external hrefs; ignore filter cost.
- **Why:** An external image works on a web page and fails through `<img>`; the author may know. A filter over 40+ animated elements re-renders per frame and can drop Safari far below 60 fps. Errors are for output the browser would reject or misread (G-4, G-9).
- **Evidence:** `Source: e194ddb "Warn when a filter sits over 40 or more animated elements"`; `Source: the R-84 tests "without failing the render"`.

### D-23 `playbackRate` divides emitted durations and leaves the timeline in scene seconds — *Decided*
- **Alternatives:** rescale the timeline; add an `animation-play-rate`-style CSS (none exists).
- **Why:** Authors keep one set of seconds; frames, `reducedMotion.at` and `duration` stay exact (G-3).
- **Evidence:** `Source: 2415d3e "speed option divides every emitted duration"`; `Source: 53d023e rename to playbackRate`; `Source: RenderOptions comment`.

### D-24 Effects are small filters built from `def.filter` JSX — *Decided*
- **Alternatives:** CSS `filter()` functions (not animatable the same way and not portable to `<img>` in all engines); raster effects.
- **Why:** Plain SVG filter primitives play anywhere (G-1) and compose with SMIL for animated effects like `boil`.
- **Evidence:** `Source: fx.tsx`; `Source: d9e7f7e`; `Source: defs-css.md filter table`.

### D-25 Floats print through `num` at three decimals — *Proposed*
- **Alternatives:** full precision; per-use precision.
- **Why:** Stable float printing keeps bytes small and deterministic (G-7). The three-decimal choice is the code's default; the user has not stated it as a design decision.
- **Evidence:** `Source: format.ts, 5d3eace "Share one value formatter"`. Icon transforms bypass it (see Known bugs in CRITERIA.md).

### D-26 `Icon` and `Glyphs` draw one `<path>` per piece — *Decided*
- **Alternatives:** one path per icon; `<text>` for glyphs.
- **Why:** Per-piece paths let `draw` stroke pieces in order and let animation vary by index (G-8). `Glyphs` embeds no font (G-1).
- **Evidence:** `Source: 757361a "Add <Icon>, which draws path data from @svjeez/icons one path per piece"`; `Source: b374689`; `Source: icons.md`.

### D-27 `<Once>` keeps its own animation clock — *Decided*
- **Alternatives:** a separate timeline per group; JS replay.
- **Why:** An intro or a part swapped in at runtime plays once and holds while the rest loops; `restyle` can start it independently with `--t1` (G-10, G-2).
- **Evidence:** `Source: ec59149`; `Source: once.ts doc comment`; `Source: css.ts onceRule comment`.

### D-28 Source locations come from a separate dev JSX runtime — *Decided*
- **Alternatives:** always write `data-source`; a babel plugin.
- **Why:** The editor links a picture to its code (G-10); production output stays unchanged (G-7).
- **Evidence:** `Source: ec59149 "render sources"`; `Source: RenderOptions.sources comment`; `Measured by: the R-79 tests → "changes nothing else, and nothing by default"`.

#### Deliberately left out
- Runtime scripting or the Web Animations API in the output — G-2 forbids code in the viewer (AGENTS.md "Nothing runs in the viewer's browser").
- External `href` for images — blocked through `<img>`; `validateSvg` warns instead of supporting it (D-22, images-fonts.md).
- Letting the compiler sanitize author-written CSS or ids — authors own their `css` and ids; only generated names are managed (without-jsx.md).
- Hash-based or random ids — G-7 requires stable bytes.
- Styling of embedded SVG images — "An embedded SVG is sealed" (images-fonts.md).

#### How it's used / how it's abused
`render()` is called at build time by a script, a CLI, Vite or Astro; the string is written to disk or inlined into HTML. Authors supply geometry, text, colours and CSS; every identifier that the compiler adds is its own.

| Abuse | Prevention | Criteria |
|---|---|---|
| Untrusted title, desc, text or attribute values reaching the file | `escapeText` and `escapeAttr` on all text and attribute values; `<style>` body in CDATA with `]]>` split | R-74 |
| Untrusted `comment` ending the XML comment (`-->`) and injecting markup | None. `comment` is written verbatim. see Known bugs in CRITERIA.md and Q-9 | not yet covered |
| Untrusted `css` option closing the style element | CDATA splitting of `]]>` | R-74 |
| Two inlined scenes overwriting each other's ids and animations | `prefix` | R-46 |
| Hand-written duplicate ids breaking `url(#…)` | `validateSvg` error, `render` throws | R-45, R-82 |
| Non-determinism (clock, random) | No clocks; `wiggle` and `random` seeded (“Timeline and motion”); per-render counters | R-39 |
| A huge embedded image or font bloating the file | `EMBED_WARN_BYTES` warnings | R-85, R-86 |
| A filter over many animated nodes | `FILTERED_ANIMATION_LIMIT` warning | R-83 |
| Reading an arbitrary path or URL from `picture.load` | None; the caller picks the source (build time) | not yet covered |
| An author `pathLength` contradicting `draw` | `pin` throws | R-62 |
| Reduced-motion viewers seeing a blank frame | `stillAt` default 85%; SMIL still twins | R-65, R-68 |

## Geometry, fonts, ink and voxels

### D-29 Voxels paint by depth sort with instanced symbols, and buried blocks are dropped — *Decided*
- **Alternatives:** Per-block paths; a z-buffer (not available in SVG); keeping every block and letting overdraw hide the buried ones.
- **Why:** Back to front is exact for unit cubes under an orthographic camera. One symbol per visible-face texture tuple keeps a large world small (G-1), and dropping buried blocks drops elements the viewer's browser would otherwise paint (G-2).
- **Evidence:** `Source: fad7c02 "Draw blocks back to front as instanced symbols with lifetimes and buried culling"`; `Measured by: the R-128 tests → "a solid 3x3x3 cube keeps only the blocks on its three nearer faces" (19 of 27)`.

### D-30 Path morphs go through cubic Béziers with equal command text — *Decided*
- **Alternatives:** Interpolate in the original command language; flatten every path to a polyline.
- **Why:** SMIL `d` interpolation needs identical commands (G-2). Cubic is closed over every SVG segment type and over splitting, so corners survive and arcs stay round; the compiler rejects unequal commands with a message naming `matchPaths()` (G-4).
- **Evidence:** `Source: fd541f8 "Shape morphs: a d channel on <path> through SMIL, matchPaths() and sampledPath()"`.

### D-31 `sampledPath` samples densely and keeps only keys that stay within a px tolerance — *Decided*
- **Alternatives:** Emit every sample; fit curves; a fixed key count.
- **Why:** Shape animations from physics or projections have thousands of points per frame. Recursive worst-point splitting bounds the error in px (G-3) and the file size (G-1). `slack` lets points nobody sees stray further, which the turning globes use for the side folded out past the clip.
- **Evidence:** `Source: fd541f8, a20af25 "Turning globes, projection morphs..."`; `Measured by: the R-109 tests → steady motion keeps 2 values; slack case keeps 2 values, no slack more than 5`.

### D-32 A subset embed happens only when no layout lookup can differ; otherwise the whole font embeds — *Decided*
- **Alternatives:** Always subset and let ligatures break; subset and keep GSUB/GPOS (subsetting those tables is large work and brings a dependency); never subset.
- **Why:** The browser, not svjeez, shapes `<text>`. A subset without GSUB/GPOS would no longer apply ligatures or contextual alternates (G-5 text must look right), so the cut is skipped whenever `liga`, `clig`, `rlig` fires or `typesetter.beyond` finds any other default-on lookup that could act. Pair kerning is preserved by rebuilding it as a legacy `kern` table. Output is often a tenth of the file (G-1).
- **Evidence:** `Source: 9b6ad05 "Embed fonts cut down to the glyphs a scene uses", 82c634f "embed whole when layout lookups could apply, format 12 cmap beyond the BMP"`; code comments in `subset.ts` and `FontOptions.subset`; `Measured by: the R-117 tests → cut is under a quarter of the file; measure of the cut equals the whole font`.

### D-33 Fonts are parsed in house, and only TTF and OTF can be measured or drawn — *Decided*
- **Alternatives:** A runtime dependency (opentype.js, fontkit); decompress WOFF2 (needs Brotli); read via the browser.
- **Why:** The core has no dependencies (G-6) and measurements must be exact at compile time (G-2, G-3). WOFF and WOFF2 are accepted for embedding only and throw a message naming the fix. Weight is bounded to CSS's 1..1000. Without a font, extras estimate text at 0.6 em per character (`textWidth`).
- **Evidence:** `Source: b374689 "Custom fonts: font(), font.family, fontFamily={font} embedding, measure(), path() and <Glyphs>"`; `FontOptions` comments; `references/images-fonts.md`.

### D-34 Font parsing is bounded against hostile files — *Decided*
- **Alternatives:** Trust the file; a wall-clock timeout.
- **Why:** Fonts come from URLs and disks. Table bounds are checked at parse, composite glyph nesting is capped at `MAX_COMPOSITE_DEPTH`, and total components at `MAX_COMPONENTS`, because nesting can fan out exponentially. Family names are CSS-escaped so a name cannot close the string and start a rule (G-1 safe single file).
- **Evidence:** `Source: aa40409 "Fix review findings: CSS-escape family names, off-curve-only contours, composite fan-out budget, CSS weight matching, dedupe fonts by bytes"`; `Measured by: the R-114 and R-116 tests → "composites that fan out exponentially throw instead of hanging", "a family name cannot break out of the CSS string"`.

### D-35 Hand-drawn strokes are filled outlines, revealed through a mask that is replaced by a plain copy — *Decided*
- **Alternatives:** Real `stroke` with `stroke-width` (no variable width); animate `stroke-dashoffset` on the filled outline (shows the outline, not the centerline); keep the mask forever.
- **Why:** Variable width needs a filled shape. A mask whose centerline draws on reveals the ink in order. Masks repaint every frame, so once the reveal ends the plain copy takes over and the masked one hides (G-2, G-8). Output is relative moves in tenths of px so it is short and never drifts (G-1, G-7).
- **Evidence:** `Source: e93a91f "Ink: Stroke with pen, brush, nib and pencil tools, drawn on through a mask that hands over to a plain copy"`; code comment on `Ink`.

### D-36 Splines are uniform Catmull-Rom written as cubics, with positions 0..legs — *Decided*
- **Alternatives:** Centripetal Catmull-Rom; B-splines (do not pass through points); arc-length parametrisation.
- **Why:** The route must pass through the author's points (G-4). Uniform Catmull-Rom with duplicated ends needs no extra parameters, gives an exact path (`d`) and exact sub-paths. Position `i + u` keeps `point`, `tangent`, `angle` closed-form so they feed `sampled()` without any search; arc-length is deliberately not offered. [P] Coordinates print with 2 decimals, `polylinePath` with 1.
- **Evidence:** `Source: ec59149 "svjeez: what the labs needed, in the library: ... spline, polylinePath and resample"`; doc comment on `Spline`.

### D-37 Stroke fonts are read from SVG font markup and smoothed with sharp corners preserved — *Decided*
- **Alternatives:** Hershey JHF files; bake the smoothing into the tool; smooth every vertex.
- **Why:** Hershey and EMS fonts ship as SVG fonts. Their strokes are short polylines that a wide nib would show as facets, so they are turned into Catmull-Rom cubics, except at corners sharper than a right angle (G-8).
- **Evidence:** `Source: code comments in font/stroke.ts; the R-120 tests "keeps a corner sharper than a right angle as a corner, and smooths gentle turns"`.

### D-38 Tool widths are closed-form functions of position and direction with seeded noise — *Decided*
- **Alternatives:** Pressure samples recorded from a tablet; random per-render noise.
- **Why:** Tools are `{ width(t, s, angle), drift?, size }`, so authors can write their own, and noise is a hashed value-noise of a seed so the same seed draws the same line (G-7). The constants (defaults per tool, `INK_SPACING`) are looks, tuned by eye; a Tool's `size` sizes the reveal mask.
- **Evidence:** `Source: e93a91f`, `1fd3df9 "Rename Stroke to Ink and ink() to inkPath(), collect the pen, brush, nib and pencil under tool"`; `references/ink.md`. The numbers themselves are [P] until someone tunes them against frames.

### D-39 Voxel faces bleed by `BLEED` px and shade by fixed multipliers — *Decided*
- **Alternatives:** Exact edges (antialiased seams show); a stroke around each face.
- **Why:** Abutting faces antialias against the background and leave hairline seams. Growing each face 0.4 screen px hides them with no extra elements (G-1). Shades 1, 0.8, 0.6 give a fixed light from above and the viewer's left.
- **Evidence:** `Source: code comment on BLEED in voxel.ts; fad7c02`.

### D-40 `ligatures: false` is the author's way to keep a coding font cut down — *Decided*
- **Alternatives:** Always detect ligature forming sequences and embed whole; strip ligature lookups silently.
- **Why:** JetBrains Mono turns `=>` into a ligature, which forces a whole-font embed. With the option off, `measure`, `path` and the embedded cut agree on one glyph per character (G-3).
- **Evidence:** `Source: JSDoc on FontOptions.ligatures; Measured by: the R-113 and R-118 tests → "with ligatures off, text draws one glyph per character and the font still cuts down"`.

### D-41 The same font bytes embed once, even when loaded twice — *Decided*
- **Alternatives:** Dedupe by family name; embed per use.
- **Why:** One file, small (G-1). The identity is the bytes (the `href`), so two loads of one file merge and two different files claiming one family/weight/style slot throw. A whole embed wins over a cut one of the same bytes (the compiler's job; this area supplies `Font.embed` and `href`).
- **Evidence:** `Source: aa40409 "dedupe fonts by bytes", 82c634f "full embedding wins on duplicate bytes"`; tests "the same file loaded twice embeds once", "a later copy of the same file with subset: false still embeds it whole".

#### Deliberately left out
- Reading CFF outlines in `path()`, so an OTF with CFF throws — the error says "does not read yet" (`font.ts`).
- Bidi, contextual alternates and mark positioning in the typesetter; such text embeds the whole font and the browser shapes it (`shape.ts` comment, `images-fonts.md`).
- Decompressing WOFF/WOFF2 — would need Brotli, against G-6 (`font.ts` error text).
- `.ttc` collections — the error asks the author to extract one face (`font.ts`).
- Arc-length parametrisation of splines — positions are per-leg parameters (`Spline` doc).
- Named colors in textures — a type error and a runtime check (c92c69e "Type duotone and voxel palettes as Hex so a named color is a compile error again").

#### How it's used / how it's abused
Authors load fonts and images from disk or URLs at compile time, and pass strings (family names, path data, text, SVG font markup) into a document that is published as one SVG. Nothing here runs in the viewer, so the threats are hostile inputs at compile time and bytes that change between runs.

| Abuse | Prevention | Criteria |
|---|---|---|
| A family name that closes the CSS string and injects rules | `cssString` escapes quotes, backslashes and control characters | R-116 |
| A font whose composites nest or fan out to hang the compiler | `MAX_COMPOSITE_DEPTH`, `MAX_COMPONENTS` | R-114 |
| A font whose table directory points past the file | Bounds checks in `sfnt()` | R-111 |
| A subset that silently loses ligatures or contextual forms | Whole-font fallback; `beyond` errs toward yes | R-118 |
| Non-determinism from noise in ink | Seeded hash noise, no `Math.random` | R-122, R-130 |
| Stringified font in an attribute (`fontFamily={`${font}`}`) | `toString` throws with the fix | R-116 |
| Minified path data with compact arc flags (`a5 5 0 1010 0`) | Not prevented: errors with a count message (see Known bugs in CRITERIA.md) | none |
| Huge or hostile stroke-font entities (`&#x110000;`) | Not prevented: raw `RangeError` (see Known bugs in CRITERIA.md) | none |

## Layout and diagrams

### D-42 Layout math lives in `src/layout`, pure, with no imports outside the folder — *Decided*
- **Alternatives:** layout code next to the drawing code in `extras/diagrams`; a third-party graph layout library.
- **Why:** keeps geometry testable without SVG or fonts and lets `extras/field` and `voxel` reuse it (G-6, G-2).
- **Evidence:** `Source: AGENTS.md "src/layout/ ... imports nothing outside src/layout, and a test enforces this"; packages/svjeez/test/R-132/layout-imports-stay-inside.test.ts`.

### D-43 Layered layout is hand-written "Sugiyama-lite" — *Decided*
- **Alternatives:** dagre / elkjs as a dependency; a simple rank-grid.
- **Why:** the core has no runtime dependencies and runs on Node 20 (G-6); output must be identical across runs (G-7); edges, groups and labels need control that a generic library does not give.
- **Evidence:** `Source: layered.ts doc comment "Sugiyama-lite in TB space"; AGENTS.md "Keep the library dependency-free"`.

### D-44 One layout function per diagram shape, each taking only sizes — *Decided*
- **Alternatives:** one general graph layout for all five diagrams.
- **Why:** sequence rows, lanes time axes and tidy trees have different geometry from rank layering. Layouts take `Size`s and return `Box`/`Point`s, so measuring text (fonts) stays in the diagram layer (G-2, G-8).
- **Evidence:** `Source: layout/{tree,sequence,lanes}.ts signatures; extras/diagrams/* measure with textWidth then call layout`.

### D-45 Every edge gets its own port and track; edges into one node merge just above it — *Decided*
- **Alternatives:** shared ports for fans; routing by A*.
- **Why:** distinct tracks keep lines readable and countable; the merge keeps arrowheads on one point (G-8). Fixed track and port spacing makes the result deterministic (G-7).
- **Evidence:** `Source: layered.ts doc comment "Every edge gets its own ports and its own horizontal track in each gap"; route.ts tracks doc; tests "no two edges share a stretch of line, except a final approach into one port"`.

### D-46 Backward edges go round the outside in their own channel — *Decided*
- **Alternatives:** draw them over the forward flow; reverse the layout direction for them.
- **Why:** state machines and review loops are full of cycles (idle -> run -> idle); drawing the return on the outer side keeps the main flow straight (G-8).
- **Evidence:** `Source: layered.ts doc comment "a backward edge leaves and enters its nodes on the right and climbs in its own channel"; test "a chain with backward edges round both sides stays straight"`.

### D-47 A group keeps one column through every rank it spans — *Decided*
- **Alternatives:** compound-graph layout with free-form group boxes; fusing groups after layout.
- **Why:** guarantees no foreign node can sit inside a group's box (R-136) at the price of wider layouts (G-8).
- **Evidence:** `Source: layered.ts place doc comment "A group keeps one column through every rank it spans, so no other vertex can sit inside its box"`.

### D-48 Nodes pop in by rising a few pixels, not by scaling — *Decided*
- **Alternatives:** scale 0.8 -> 1.
- **Why:** a layer that once animated `scale` can stay rasterized at the smaller size in browsers, leaving blurry labels (G-5, quality *plays anywhere*).
- **Evidence:** `Source: kit.ts popIn doc comment`.

### D-49 Diagram specs are typed by their ids (`const` generics, `NoInfer`) — *Decided*
- **Alternatives:** string ids checked at runtime only.
- **Why:** a misspelled node id is a compile error `Type '"c"' is not assignable to type '"a" | "b"'`, never a broken SVG (G-4, G-9, quality *typed authoring*). Runtime errors remain for untyped callers.
- **Evidence:** `Source: skills/svjeez/SKILL.md error table row; flowchart.ts/state.ts/tree.ts signatures; packages/svjeez/test/unit/diagram-types.check.tsx`.

### D-50 Layout stays in TB space; diagrams attach edges to shape outlines afterward — *Decided*
- **Alternatives:** make the layout shape-aware.
- **Why:** layout sees rectangles only (simple, testable); `onOutline` moves each end along the last segment to the diamond/parallelogram/stadium/cylinder outline in the diagram layer. LR is the same layout transposed (G-8).
- **Evidence:** `Source: layered.ts doc comment "LR is the same layout transposed"; flowchart.ts lay(); kit.ts onOutline; test "a decision's edges end on the diamond"`.

### D-51 Orthogonal routes are smoothed in the drawing layer, and layout reserves `BEND` at run ends — *Decided*
- **Alternatives:** draw sharp orthogonal polylines; route curves in layout.
- **Why:** a jog becomes one S-curve and corners are rounded, so labels must not sit on the part a renderer will bend. `BEND` is exported from layered and imported by `curve.ts` so both agree (G-8).
- **Evidence:** `Source: route.ts placeLabels doc comment "the middle of a jog, which a renderer turns into one S-curve"; layered.ts "Room a renderer may round off at each end of a straight run"`.

### D-52 Diagram play timing: first rank/root visible, the rest follow with a step or a list — *Decided*
- **Alternatives:** everything starts hidden; absolute times only.
- **Why:** no frame is ever empty; a start plus step is easy, a `Beats` list keeps two diagrams in sync; step defaults differ per diagram (flowchart 0.4, tree 0.3, sequence 0.8) because a sequence message carries more to read (G-3).
- **Evidence:** `Source: flowchart.ts and tree.ts comments "The first rank/root is there from the start, so no frame is empty"; references/diagrams.md Timing table`.

### D-53 Streamlines use Jobard and Lefer seeding with RK4; level lines use marching squares — *Decided*
- **Alternatives:** grid-seeded streamlines; sampling contours through an SVG filter.
- **Why:** even spacing without clumps; marching squares gives closed or open polylines that morph per level at compile time (G-2, G-8).
- **Evidence:** `Source: field.ts and contour.ts doc comments; commit b0b9a65 "Fields and level sets: streamlines, vector and slope fields, contours with a sweep"`.

### D-54 Fixed sweep counts and constant weights in the layered heuristics — *Proposed*
- **Alternatives:** iterate until convergence; tuned per graph size.
- **Why:** keeps output deterministic and time bounded (G-7); the values 8, 60, 8/4/1 are inferred from the code, not measured.
- **Evidence:** `Source: layered.ts order() and place() loops`; no measurement exists. `Measured by: not yet run`.

### D-55 Label placement is best-effort, never an error — *Proposed*
- **Alternatives:** throw when no clear spot exists; grow the gap until one does.
- **Why:** a crowded diagram should still render (G-4 says mistakes surface as errors, but a crowded layout is not a mistake). Cost: a label may overlap something with no signal.
- **Evidence:** `Source: route.ts placeLabels doc comment "With no clear spot, the spot with the fewest collisions wins"`.

### D-56 Edge cases of "composite" transitions: ends attach to the nearest ancestors that share a scope — *Decided*
- **Alternatives:** draw every transition at the root scope with long lines through containers.
- **Why:** a composite is laid out as one node first, so inner flow stays inside it and transitions cross its border (G-8).
- **Evidence:** `Source: state.ts doc comment "A composite is laid out inside first, then sized to fit and laid out with its siblings as one node; transitions attach to the nearest ancestors that share a scope"; tests under describe("composite")`.

### D-57 `groupBy` is local, not `Map.groupBy` — *Decided*
- **Alternatives:** use `Map.groupBy`.
- **Why:** Node 20 lacks it, and the core runs on Node 20 (G-6).
- **Evidence:** `Source: layout/group.ts comment; AGENTS.md Rules "Don't use APIs newer than Node 20, such as Map.groupBy"`.

#### Deliberately left out
- Edge routing around nodes with arbitrary angles (all edges orthogonal) — layout is rank-based and routes are smoothed later (D-51).
- Automatic text wrapping in node labels — nodes size to the label's measured width (kit.ts sizeOf).
- A `play` option on `stateMachine` — states are lit by `walk()` instead (references/diagrams.md Timing table).
- Crossing minimization beyond 8 barycenter sweeps — see D-54.
- Cross-group edge routing that avoids group borders — only node and label clearance are tested.

#### How it's used / how it's abused
A scene author passes labelled specs (or `@svjeez/mermaid` builds them) and gets a `Diagram` with a `node` and `get(id)` boxes. Text in labels goes through `el.text` (escaped by the renderer, another area). Abuse here is mostly large or malformed input.
| Abuse | Prevention | Criteria |
|---|---|---|
| Misspelled ids in a spec | `const` generics reject them at compile time; runtime lookups throw named errors | R-157, R-161 |
| Duplicate or unknown ids from untyped input | layout functions validate uniqueness and membership | R-133, R-143, R-146, R-148 |
| Cyclic or multi-root tree | tree() throws before laying out | R-143 |
| Huge graphs | none (relaxation is O(sweeps * items * neighbours), group pulls rescan all vertices); no cap | Q-26 |
| Non-deterministic output | no randomness anywhere in layout | R-168 |

## Extras

### D-58 Annotations take `during: Span` and a `Rect` target, with `color` defaulting to the theme's `base09` — *Decided*
- **Alternatives:** per-component start/duration props; fixed yellow; separate `at`/`over`.
- **Why:** one prop shape across components; the accent follows the theme so `adaptive()` recolors everything (G-5, G-4).
- **Evidence:** `Source: 1b622e1 (during/target/columns/variant naming), e246e79 (colors from base09), 03979b5 (span tests)`

### D-59 `Code` lays out one `<text>` per word on a fixed column grid, monospace only — *Decided*
- **Alternatives:** one `<text>` per line; `tspan`s; measure each glyph.
- **Why:** morph, typewriter, reveal and the queries all need word positions; a shared `advance` makes layout exact and deterministic (G-2, G-7).
- **Evidence:** `Source: cbe1175 (one Code type, word layout), code.ts comment "Columns, typewriter and morph all step by one advance"`

### D-60 morph pairs by id, then LCS on text, then nearest equal text — *Decided*
- **Alternatives:** pure LCS; diff by line; match by token index.
- **Why:** ids let a renamed run move instead of fade; LCS keeps order; nearest-pairing makes swaps cross rather than cancel.
- **Evidence:** `Source: f751f63, 13fedfb (id cross-fades), tests "swapped words both move", "a line inserted above repeated words"`

### D-61 morph draws through the `Morphable` interface so formulas morph like code — *Decided*
- **Alternatives:** math package forks its own morph.
- **Why:** one choreography for code and TeX (G-8) with no core dependency on math (G-6).
- **Evidence:** `Source: 2d2408e (morph() animates any Morphable)`

### D-62 A name given to a timeline scene must not be a field or method of the timeline — *Decided*
- **Alternatives:** nest scenes under `.scenes`; throw on use rather than creation.
- **Why:** scenes read as `tl.intro`; reserved names `duration end show enter` keep the surface flat.
- **Evidence:** `Source: timeline.ts throw, test "timeline({ enter: 1 })"`

### D-63 Plots and fields print coordinates rounded to 0.1 px and tick labels through `toPrecision(12)` — *Proposed*
- **Alternatives:** full float printing; 0.01 px.
- **Why:** byte-stable output (G-7) and small files (G-1); 0.1 px is below visible error.
- **Evidence:** `Source: tests "plot() rounds coordinates to 0.1px", "tick labels have no float noise"`. Not measured against file size.

### D-64 `plot()` and `trace()` break the line at gaps, far-out samples and big jumps — *Decided*
- **Alternatives:** draw every finite point; detect asymptotes analytically.
- **Why:** `1 / x` and `tan` must not draw vertical spikes; one rule covers all functions.
- **Evidence:** `Source: tests "plot() breaks at a discontinuity…", "…where tan() jumps…"; commit 9f8719a`

### D-65 Calculus values that move are baked into keyframes at compile time (`sampled`, `sampledPath`) — *Decided*
- **Alternatives:** JS animation; SMIL `animateMotion`.
- **Why:** nothing runs in the viewer (G-2); `d` morphing through SMIL works in Safari.
- **Evidence:** `Source: 7caddde, explainers.md "so they morph in Safari too"`

### D-66 A `Riemann` path draws the largest stage's rectangle count in every stage — *Decided*
- **Alternatives:** one path per stage cross-faded; matchPaths per stage.
- **Why:** identical commands let `d` interpolate with no matching step (G-3).
- **Evidence:** `Source: calculus.ts comment "most rectangles per stage…"; test "every stage is one path with the same commands"`

### D-67 `fieldFlow` starts each particle at a golden-ratio fraction of its own line — *Decided*
- **Alternatives:** random phase; all together.
- **Why:** lines of different length never pulse in unison, and the phase is deterministic (G-7).
- **Evidence:** `Source: field.ts comment on GOLDEN; b0b9a65`

### D-68 `Camera` is a plain group with a transform track and no clipping, and heavy scenes swap copies — *Decided*
- **Alternatives:** clip inside; one SVG per zoom.
- **Why:** Chromium keeps each animated element on its own raster, which flashes blank under a scaling parent; the skill documents the swap pattern.
- **Evidence:** `Source: explainers.md "Do not zoom a camera over hundreds of animated elements", 846ff99 ("no flashing mid-zoom")`

### D-69 `shot()` keeps both moves inside its span and uses no blur — *Decided*
- **Alternatives:** overlap shots and cross-dissolve; blur transitions.
- **Why:** shots hand over through the background; a filter over many animated elements repaints each frame.
- **Evidence:** `Source: timeline.ts comments, 46941b9`

### D-70 `adaptive()` is `variables()` over the 16 slots, so colors are CSS variables — *Decided*
- **Alternatives:** two generated SVGs; inline `light-dark()`.
- **Why:** the viewer's `prefers-color-scheme` decides (G-5) and a page can restyle through `restyle()`.
- **Evidence:** `Source: 3489df5 ("variables(): … adaptive() builds on it")`

### D-71 Typewriter and terminal use `steps(n)` clip reveals and a looped blink — *Proposed*
- **Alternatives:** per-character opacity; SMIL `set`.
- **Why:** one animated element per line instead of per character (small file, G-1).
- **Evidence:** `Modeled by: reading typewriter.ts (clip rect with ease.steps(chars)); not measured against a per-character version`

#### Deliberately left out
- Blur or filter transitions in `shot()` — repaint cost over many animated elements (timeline.ts comment).
- Proportional fonts in `code()` — columns, typewriter and morph step by one advance (code.ts error text).
- Shiki tokens with fixed hex colors in `code()` — they bypass the theme; `@svjeez/code` returns roles (references/code.md).
- Clipping inside `Camera` — authors clip themselves (camera.ts comment).
- Network or runtime evaluation of functions in plots — everything is sampled while compiling (G-2).

#### How it's used / how it's abused
Authors call these from scene source and put the returned nodes in the tree. The main exposure is text and numbers reaching the SVG: code text, callout text, readout text, plot labels, `variables()` names and values.

| Abuse | Prevention | Criteria |
|---|---|---|
| A `variables()` name or value that injects CSS | names must match an identifier regex; values are not validated | R-173 (names only); see Q-33 |
| Untrusted code or label text containing `<`, `&` | text goes through `el.text` children, which escape; this area does no escaping of its own | not yet covered (owned by the element layer) |
| A huge `slopeField` step count or `streamlines` grid that hangs compile | `axes` caps ticks at MAX_TICKS; `slopeField` has no cap; `streamlines` is bounded by `maxLength` | R-192; see Known bugs in CRITERIA.md found (slopeField) |
| Non-finite function values reaching path data | plots drop them; `dot`/`tangent`/`area`/`morph` throw naming the call | R-193, R-195 |
| Two scenes on one page using the same ids | clip paths and masks come from `def`, which owns stable ids (area outside E) | not yet covered |

## Frames, CLI, plugins and release

### D-72 Frames come from headless Chromium via Playwright, as an optional peer — *Decided*
- **Alternatives:** resvg or another native rasterizer; bundling Chromium; a bundled `playwright` dependency.
- **Why:** CSS keyframes and SMIL on filter primitives only mean something in a real browser engine, so frames are the proof of timing (G-3). `playwright-core` stays out of `dependencies` so the core stays dependency-free (G-6): the build marks it external and the peer is optional.
- **Evidence:** `Source: 1a65ee8 "Add renderFrames: rasterize an SVG … in headless Chromium"; 9df8839 "Require playwright-core 1.49+ (chromium-headless-shell)"; packages/svjeez/scripts/package.ts external: ["playwright-core"]`

### D-73 Scenes are shown on an intercepted HTTPS origin, not about:blank — *Decided*
- **Alternatives:** `setContent` on about:blank; a local HTTP server.
- **Why:** WebCodecs exists only in a secure context, and video needs it; the same page serves frames so both paths capture the same pixels (G-3).
- **Evidence:** `Source: code comment above ORIGIN in src/frames.ts; 2b88542 "openScene() opens an SVG paused in a secure page … and renderFrames() shares its setup"`

### D-74 Capture is time-seeking with pause, one scale knob, and a size cap — *Decided*
- **Alternatives:** record in real time; run a virtual clock; screenshot at fractional device scales only.
- **Why:** Seeking `Animation.currentTime` and SMIL `setCurrentTime` gives exact times (honest timing, G-3) and is deterministic (G-7). The sheet is scaled down to stay under Chromium's 16384 px capture limit rather than cropping.
- **Evidence:** `Source: comment "Chromium cannot capture past 16384 device pixels on a side" in src/frames.ts; test "a sheet too big for one capture comes back whole, at a lower scale"`

### D-75 `seek` and `loopLength` live in `svjeez/page` so the preview, frames and labs share them — *Decided*
- **Alternatives:** keep them private in `frames.ts`; reimplement in the preview.
- **Why:** They are serialized into any page (preview, editor, tests) so one definition of "scrub to t" and "one loop" serves G-3 and G-10.
- **Evidence:** `Source: ec59149 "… svjeez/page with seek and loopLength …"; scripts/preview.ts imports them`

### D-76 `svjeez frames` and `svjeez video` replaced `render`; the CLI is a small `Map` of commands — *Decided*
- **Alternatives:** keep `render` as an alias.
- **Why:** One verb per output; the removed name must still print usage so agents are pointed at `frames`.
- **Evidence:** `Source: test "svjeez render is no longer a command"; 34e03e7 (initial svg and render commands); a503941 (video command)`

### D-77 Loop length is a common period within a rounding budget — *Decided*
- **Alternatives:** the longest animation only; exact LCM of rounded durations.
- **Why:** Emitted durations are rounded to a millisecond, so exact LCM would explode (12/7 s is 1714 ms); the budget lets a scene whose parts are rounded fractions of its duration still loop in that duration (G-3).
- **Evidence:** `Source: comment in src/page.ts loopLength; tests "a scene made only of loops …", "periods that are rounded fractions …"`

### D-78 Video is a separate package encoding in Chromium with Mediabunny — *Decided*
- **Alternatives:** ffmpeg; a Node encoder; adding video to `svjeez`.
- **Why:** Node has no video encoder; the headless Chromium that already renders frames can encode with WebCodecs, so no extra binary is needed, and the core stays dependency-free (G-6). Even sides are forced because 4:2:0 cannot encode odd sizes. The CLI loads the package lazily from the project first, then its own location.
- **Evidence:** `Source: b5b546d "renderVideo() encodes … with Mediabunny in headless Chromium"; a503941 "which the CLI loads only when asked"; packages/video/README.md "How it works"`

### D-79 Plugin assets are content-hashed and served from a global registry — *Decided*
- **Alternatives:** write scene files at transform time; one registry per module graph.
- **Why:** The scene compiles in a separate Vite environment, so the plugin and the pages that call `getScene()` load `assets.ts` through different graphs; `globalThis[Symbol.for(...)]` shares one map. Content hashing gives cacheable immutable URLs (G-7).
- **Evidence:** `Source: comment at the top of packages/vite/src/assets.ts; 2bf73fa "import a scene with ?svjeez in any Vite app; @svjeez/astro builds on it"`

### D-80 Posters are a build-time still per color scheme, cached on disk — *Decided*
- **Alternatives:** no posters; render client-side; render at fixed 0 s.
- **Why:** A still lets `<picture>` serve reduced-motion and non-SVG fallback (G-5). The frame is the scene's own reduced-motion frame when it declares one, else most of the way through, so the poster looks finished. Renders launch Chromium, so they are limited to `LANES` and cached by name.
- **Evidence:** `Source: comments in packages/vite/src/posters.ts; test "a build emits the scene and its posters"`

### D-81 One lockstep version, each package tagged and released on its own — *Decided*
- **Alternatives:** changesets; manual publish; one GitHub release for all.
- **Why:** A package is out when npm has it and GitHub has its release, so a failed run is finished by rerunning (idempotent). `svjeez` keeps `v1.2.3` tags; others use `name@version`. Release notes use `git log` limited to the package folder because generated notes would list unrelated pull requests. `-` in a version goes to `next`.
- **Evidence:** `Source: header of scripts/release.ts; a51d142 "Release any package whose version isn't out yet, on every push to main"; 81ecc35 "per-package release notes"`

### D-82 CI proves the packed tarball on Node 20 and 22 across four module resolutions — *Decided*
- **Alternatives:** test only the workspace source.
- **Why:** The source condition hides packaging bugs; users install tarballs (G-4, G-6). Node 20 is the floor (G-6); TypeScript 5.4 is the oldest supported and the newest with `node10`. Examples' `dist/` is rebuilt on macOS because Linux libm changes some printed floats (G-7).
- **Evidence:** `Source: comments in ci.yml and package-check.ts; 3390c08 "Check the packed package in CI"; 69a3d06 "Plugin package checks install with npm 11"`

### D-83 The shipped skill is tested like code — *Decided*
- **Alternatives:** unchecked prose.
- **Why:** Agents write scenes from the skill and its error table (G-9); a doc path that does not exist, a reference nobody routes to, or an error message that no longer exists silently misleads them.
- **Evidence:** `Source: the R-225 tests; AGENTS.md "Library layout"`

### D-84 Plugin and component packages export TypeScript source in the workspace and build `package-dist/` for npm — *Decided*
- **Alternatives:** compile in place; the `@svjeez/source` condition.
- **Why:** Astro loads integrations without custom export conditions, so the workspace manifest must point at source; the published manifest points at JavaScript.
- **Evidence:** `Source: header of scripts/package-plugin.ts; AGENTS.md "Workspace"; 456d160 (shared package-manifest.ts)`

### D-85 `getScene` reads size from `viewBox` and alt text from `<title>`/`<desc>` — *Proposed*
- **Alternatives:** read `width`/`height` attributes (as `renderFrames` does); require `render()`'s output.
- **Why:** `render()` always emits a viewBox, so the regex works for compiled scenes; the inconsistency with frames (width/height) is unexamined.
- **Evidence:** `Source: packages/vite/src/scene.ts vs src/frames.ts size()`

#### Deliberately left out
- A bundled Chromium or any dependency in `svjeez` — the core stays dependency-free (G-6; AGENTS.md "Rules").
- ffmpeg — Mediabunny in Chromium instead (D-78).
- Real-time recording — seeking is exact (D-74).
- Reduced-motion rendering in frames — frames use `no-preference`; the reduced-motion still is read from the SVG by posters (D-80).
- `svjeez render` — removed; prints usage (D-76).
- Releasing a never-published package from CI — the first version needs `claim` from a maintainer because npm trusts a workflow only for a package it already has (header of `scripts/release.ts`).
- Transparent MP4 — MP4 cannot carry alpha here; throws (video README).

#### How it's used / how it's abused
Frames and video are run by a scene author or an agent after writing a scene; the plugins run in a build; release runs on push to main. The SVG text goes straight into an HTML template in the stage page, so a hostile SVG is script-capable in headless Chromium on the author's machine.

| Abuse | Prevention | Criteria |
|---|---|---|
| A malicious `.svg` passed to `frames`/`video` runs script in Chromium | None; the stage page is a throwaway origin with no cookies, but the browser is not sandboxed from the network | Q-36 |
| `getScene` serving a file by traversal (`/_svjeez/../x`) | The middleware looks the decoded path up in `assets.files` (a Map), never the file system | R-233 |
| A release rerun double-publishes | `npm` flag from the registry, `github` flag from the release list; each step skipped when done | R-240 |
| Leaking `workspace:*` to npm | `writeManifest` rewrites ranges in `dependencies` only; peer ranges are literal | R-238 |
| A doc that points an agent to a deleted error or file | the R-225 tests | R-225 |
| A dev server serving a stale scene | Module graph and evaluated-module invalidation, importers transitively | R-233 |

## Live editor

### D-86 The editor is an Elm-style store: pure `update`, runtime performs commands — *Decided*
- **Alternatives:** Per-framework stores with logic copied (what the adapters had); imperative class with methods.
- **Why:** Every framework binds one store and an agent drives it with the same messages a drag sends (G-10, G-9). `update` is testable without a browser.
- **Evidence:** `Source: editor.ts header comment; commit 76605c3 "an Elm-style store over the scene source"; commit 49e5221 "owns what the adapters copied"`.

### D-87 The file text is the only state; every edit rewrites one literal's byte range — *Decided*
- **Alternatives:** Parse to AST and print; keep a model and regenerate code.
- **Why:** The file stays the one its author or an AI wrote; diffs are minimal; undo is snapshot of text (G-10, G-4).
- **Evidence:** `Source: live README ("each change rewrites only that literal"); source.ts apply/set`.

### D-88 Keys name a literal by param, path, or scope plus ordinal — *Decided*
- **Alternatives:** Offsets (shift on every edit); node ids (not stable across parses).
- **Why:** Selection, grips and custom controls must survive edits of other values (G-10).
- **Evidence:** `Source: commit f69cf33 "no two literals share a key: a path starts only at a top-level const, a file that names one thing twice gets ordinals, and an unnamed statement is keyed by its place among statements, not its offset"`.

### D-89 Compile in a worker, with a timeout that kills only the stuck worker — *Decided*
- **Alternatives:** Compile on the main thread (a scene that never returns hangs the page).
- **Why:** A scene is arbitrary user code; an endless loop must cost the worker, not the page (G-4, G-6 keeps svjeez light via lazy package loading).
- **Evidence:** `Source: compile.ts header "a scene that never returns costs the worker, not the page"; commit d5b12ec "a compile timeout fails only the stuck worker's jobs and no worker starts after stop"; Measured by: the R-274 tests`.

### D-90 Only the newest job runs next (`latestWins`) — *Decided*
- **Alternatives:** Debounce by time; queue everything.
- **Why:** A drag emits many sets; a backlog would lag the picture (G-10).
- **Evidence:** `Source: client.ts comment "so a drag never builds a backlog"; the R-264 tests "while a compile runs, only the newest edit waits"`.

### D-91 Handles for any number come from compiling the file twice and comparing shapes — *Decided*
- **Alternatives:** Require authors to annotate every number; static analysis of the JSX.
- **Why:** Any scene gets a handle on whatever its numbers place or size, without annotation (G-10, G-9).
- **Evidence:** `Source: probe.ts header "found by drawing the file twice … It needs no annotation"`. The nudge size (a two-hundredth of the range, at least one step) is commented in `probeOf`.

### D-92 Number ranges are read from the name or call a literal sits in — *Decided* (constants Proposed)
- **Alternatives:** Always a fixed span around the value; require `params`.
- **Why:** A scene nobody annotated still gets sensible controls; svjeez's API names carry units (G-10, G-9).
- **Evidence:** `Source: controls.ts header and MEANINGS comment "at, over and .to(…, over) are seconds, opacity runs 0 to 1"`. Specific ranges and the 300 px scrub width are not documented elsewhere: Proposed.

### D-93 Scenes may declare handles; the compiler samples them — *Decided*
- **Alternatives:** Probe only.
- **Why:** An author who knows where the handle sits says so exactly; declared grips are never probed (G-10).
- **Evidence:** `Source: live README "Handles"; editor.ts declaredGrips; commit 8f3673a`.

### D-94 The editor pauses when its last listener leaves — *Decided*
- **Alternatives:** Keep running until destroy; destroy on last unsubscribe.
- **Why:** A hidden component (React `<Activity>`) must stop the worker yet resume cheaply, and a server render must start none (G-6, G-10).
- **Evidence:** `Source: commit 49e5221 "the editor pauses when its last listener leaves and resumes on the next subscribe"; Effects.compile comment; react test "an editor hidden by <Activity> and shown again still edits"`.

### D-95 Gestures live in the core; adapters only read DOM events — *Decided*
- **Alternatives:** Each adapter implements drag math.
- **Why:** One drag is one undo step in every framework; one place to test (G-10).
- **Evidence:** `Source: gestures.ts header; commit 49e5221 "the gestures (scrubbing, following, bending, arrow keys, selection) make each drag one undo step"; commit c3d2590`.

### D-96 One stylesheet, adapters bring none — *Decided*
- **Alternatives:** Styles per framework; CSS-in-JS.
- **Why:** React and Svelte render identical pictures; theming through `--sj-*` (G-10).
- **Evidence:** `Source: editor.css header "An adapter renders this markup and brings no CSS of its own"; svelte/react READMEs`.

### D-97 A number keeps the decimals it was written with; a set number is as precise as its step or text — *Decided*
- **Alternatives:** Always print shortest float; fixed two decimals.
- **Why:** `0.9` up to `1.0` keeps tenths so the next step is read from them; the file looks hand-edited (G-7 for stable output of the same edit).
- **Evidence:** `Source: editor.ts comment in "set"; commit 213f96a; the R-255 tests "arrow keys keep a number's decimals"`.

### D-98 The fix for a runtime error is copied from the skill's table, never invented — *Decided*
- **Alternatives:** Hand-written fixes in the editor.
- **Why:** An editor only suggests a fix the skill itself gives (G-9).
- **Evidence:** `Source: fixes.ts header; a test fails when the skill and the generated copy differ`.

### D-99 Scene packages are optional peers, loaded when a scene imports them — *Decided*
- **Alternatives:** Hard dependencies.
- **Why:** `npm i @svjeez/react` installs neither charts nor math; the worker starts small (G-6).
- **Evidence:** `Source: commit 13a49d8; compile.ts comment "The @svjeez packages and the map data load only when a scene imports them"`.

### D-100 New pictures are decoded before the swap — *Decided*
- **Alternatives:** Swap on URL creation.
- **Why:** The new picture never shows a blank frame (G-10).
- **Evidence:** `Source: editor.ts showInBrowser comment`.

### D-101 The picture is shown from where the clock was, via `restyle` — *Proposed* (mechanism); *Decided* (behavior)
- **Alternatives:** Re-mount the img and restart.
- **Why:** The new picture appears at the moment the old one had reached (G-10, G-3).
- **Evidence:** `Source: live README "swaps in the new picture at the moment the old one had reached"`; mechanism `restyle(svg, {at, paused})` is in `showInBrowser`.

#### Deliberately left out
- Editing strings other than declared choices, or multi-line literals, template literals and identifiers — only literal tokens are controls (`literalsOf` skips newline text; `valuesOf` filters strings).
- Server-side compiling in the editor — the editor compiles in the viewer's page only; the scene package compiles ahead of time (G-2 concerns the output SVG, not the editor).
- Edit conflict resolution for concurrent writers — one writer: the store.
- Per-framework styling — D-96.
- Typing into the code panel as free text — `replace` exists for it, but the components render a read-only `<pre>`; there is no text-input editor in these packages.

#### How it's used / how it's abused
The editor runs the user's own scene source in a worker in their own browser. A page shipping the editor lets whoever types or pastes source run JavaScript in a worker (`new Function`). The worker has no DOM, a 10 s kill timer, and an allow-list `require`, but it can still `fetch` and use workers' APIs.

| Abuse | Prevention | Criteria |
|---|---|---|
| Scene never returns | Worker terminated at `timeout`; fresh worker next job | R-274 |
| Scene imports an unlisted module | `requireModule` throws the allow-list message | R-271 |
| Scene runs network/exfiltration code in the worker | none beyond browser worker sandbox; not a goal of the library | Q-50 |
| Stale compile overwrites newer edit | Results are matched to the text they came from; schema adopted only for the current text; probed grips checked by `measures` | R-260, R-262 |
| A string value with quote or newline corrupts the source | none (see Known bugs in CRITERIA.md) | not yet covered |
| Picture URL leak | `made` set, release on replace/destroy | R-265 |

## Charts, code, fonts, icons and Mermaid

### D-102 Scales and layout are computed by d3 on the build machine, and only numbers and path strings reach the scene — *Decided*
- **Alternatives:** Hand-written scale and curve math in the core; emitting d3 objects; a runtime chart library.
- **Why:** G-2 and G-6: nothing runs in the viewer and the core keeps no dependency; a separate package may take `d3-scale`/`d3-shape`.
- **Evidence:** `Source: packages/charts/README.md ("d3-scale and d3-shape run once, on the build machine"); AGENTS.md ("Packages with a third-party dependency stay out of svjeez")`.

### D-103 Series throw when data falls outside the fitted domain instead of clipping — *Decided*
- **Alternatives:** Clip silently; auto-widen the domain; draw outside the plot.
- **Why:** G-4: a mistake surfaces as a compile-time error naming the fix ("Pass the data to chart({ data }) or widen the domain"), not a truncated chart.
- **Evidence:** `Source: charts/README.md ("so the chart never clips a value"); charts/src/series.ts place().`

### D-104 Axes share strokes, tick length and label offsets with `axes()` in svjeez/extras — *Decided*
- **Alternatives:** Chart-specific axis style.
- **Why:** G-8: a chart and an `axes()` sit in one scene without a visual seam.
- **Evidence:** `Source: code comment in charts/src/chart.ts above TICK ("Same strokes, label slot, tick length and label offsets as axes()").`

### D-105 Series colors are the theme's accents in a fixed order, not a palette of the package's own — *Proposed*
- **Alternatives:** Categorical palette inside the package; random hue steps.
- **Why:** G-5 and G-7: follows light/dark themes and stays deterministic. Whether the order (blue, number, green, magenta, cyan, yellow, red) is a design choice or just the first seven slots is not stated.
- **Evidence:** `Source: charts/src/types.ts doc "series take the accents in order"; the R-296 tests.`

### D-106 `within()` tolerates a relative 1e-9 slack — *Proposed*
- **Alternatives:** Exact comparison; fixed absolute tolerance.
- **Why:** G-4: d3 `nice()` and float rounding can leave a value that should be on the edge a hair outside; exact compare would throw for correct data.
- **Evidence:** `Modeled by: reading series.ts (EPSILON * span); no test targets it.`

### D-107 Scene coordinates round to 0.1 px and tick labels to 12 significant digits — *Proposed*
- **Alternatives:** Full float precision; 2 decimals.
- **Why:** G-7 and G-1: stable bytes and smaller SVG.
- **Evidence:** `Source: charts/src/series.ts round(); chart.ts compact() doc comment.`

### D-108 `highlight()` disables Shiki's per-line tokenize time limit — *Decided*
- **Alternatives:** Keep the 500 ms default; raise it.
- **Why:** G-7: with a limit, a slow first call (regex compile) returns the rest of a line as one token, so the same source highlights differently by machine speed.
- **Evidence:** `Source: commit d7defb6 "no per-line tokenize time limit, so a slow first call can't merge the rest of a line into one color".`

### D-109 Highlighting emits roles through a sentinel-color theme and Google fonts arrive through a user-agent trick and a shared on-disk cache — *Decided*
- **Alternatives:** Emit Shiki's fixed hex colors (breaks `adaptive()`/`variables()`); WASM Oniguruma engine; bundle font files in the repo; fetch fonts each build.
- **Why:** G-5 (theme-following code), G-6 (JS regex engine: no WASM, Node 20), G-1/G-2 (fonts embedded at compile time, one network hit per machine).
- **Evidence:** `Source: code/README.md ("Shiki's own tokens carry fixed hex colors"; "JavaScript regex engine, so there is no WebAssembly"); fonts/README.md Cache section; commit 689da09 ("Delete the eight example TTFs").`

### D-110 Icons are plain `const` objects, converted to path data by a generator that fails on anything unknown — *Decided*
- **Alternatives:** Ship SVG strings; parse SVG at compile time in svjeez; import upstream packages at runtime of the scene.
- **Why:** G-6 (no dependency, `icons` does not import svjeez), G-8 (one path per piece so each can animate), G-7 (upstream drift cannot slip through).
- **Evidence:** `Source: icons/README.md Conversion section ("The generator stops on an element or attribute it does not know"); commit a60a666 (dropped the claim that icons import one by one).`

### D-111 Mixed outline icons stay `stroke`, and the grid, stroke width and upstream versions are pinned — *Decided*
- **Alternatives:** Split mixed icons into stroke and fill layers; drop them.
- **Why:** G-8: one `kind` per icon keeps `<Icon>` simple; the cost (a solid piece draws as an outline, brand-parsinta loses half opacity) is documented.
- **Evidence:** `Source: icons/README.md ("They stay stroke icons"); package.json pins.`

### D-112 Mermaid is a small hand-written, dependency-free parser that maps onto svjeez diagram functions — *Decided*
- **Alternatives:** Use the `mermaid` package (needs a DOM); render with Mermaid's own layout.
- **Why:** G-6, G-2: no DOM, no dependency, themed and animated by svjeez like any diagram.
- **Evidence:** `Source: mermaid/README.md intro ("small hand-written one with no dependencies, and it never needs a DOM"); commit e8a87e4.`

### D-113 The Mermaid parser never drops a line; anything it cannot draw throws with a line number — *Decided*
- **Alternatives:** Ignore unknown lines; best-effort rendering.
- **Why:** G-4 and G-9: a silent drop yields a wrong diagram that looks right.
- **Evidence:** `Source: AGENTS.md ("@svjeez/mermaid never drops a line"); mermaid/README.md.`

### D-114 Mermaid flowchart styles and sequence heads are parsed into the doc but not drawn — *Proposed*
- **Alternatives:** Reject them; map to svjeez edge styles when they exist.
- **Why:** G-8: keeps `parse()` a faithful model while svjeez draws one solid arrow; AGENTS.md says move features from the rejected list when svjeez gains them.
- **Evidence:** `Source: mermaid/README.md ("Edge styles are parsed into the model, but svjeez draws every edge as a solid arrow"); index.ts passes only label and reply.`

#### Deliberately left out
- Time scale in charts — pass dates as numbers and give x a `format` (charts/README.md).
- Shiki's own colors — would break themes (code/README.md).
- WebAssembly regex engine — JS engine chosen (code/README.md).
- Subgraph nesting, edges to subgraphs, BT/RL, classDef/style, activations, blocks, choice/fork/join — svjeez cannot draw them (mermaid/README.md).
- Variable-font axes — Google serves static TTF at the exact weight (fonts/README.md).
- Per-icon imports claim — dropped from the README (commit a60a666).

#### How it's used / how it's abused
Scene authors call these packages at module scope of a scene file; everything resolves before `render()`. Untrusted input would be Mermaid text, source code to highlight, family names, and chart labels.

| Abuse | Prevention | Criteria |
|---|---|---|
| Untrusted Mermaid text reaches the SVG | Labels pass through svjeez elements (escaping owned by core); unknown syntax throws | R-325, R-327 |
| Fetching arbitrary URLs through a family name | Family goes through `encodeURIComponent` into a fixed Google URL; font file URL is parsed from Google's reply | R-312 |
| Two builds corrupt the font cache | Temp file + atomic rename | R-312 |
| Offline build silently uses a wrong font | Cold-cache failure names family and cache path | R-312 |
| Out-of-range data silently clipped | Throw instead | R-297 |
| Different machines highlight differently | No tokenize time limit | R-309 |
| Upstream icon change alters geometry unnoticed | Strict generator + committed output + regen test | R-315, R-317 |

## Maps and math

### D-115 All geo and math work happens while the scene compiles — *Decided*
- **Alternatives:** Ship d3-geo or MathJax to the viewer; pre-render offline.
- **Why:** G-2 and G-1: the SVG must be one file with no script. The packages return path data, points and `Motion`s only.
- **Evidence:** `Source: packages/geo/README.md ("The SVG it ends up in is still one file with no JavaScript"), packages/math/README.md ("MathJax runs once per formula on the build machine")`.

### D-116 Heavy dependencies live in separate packages — *Decided*
- **Alternatives:** Put maps and TeX in `svjeez`.
- **Why:** G-6: the core stays dependency-free.
- **Evidence:** `Source: AGENTS.md ("Packages with a third-party dependency stay out of svjeez so the core keeps none"), ea14d3e, 2fcc8fa`.

### D-117 Paths are rounded to 0.1 px, thinned at `tolerance` and again at half of it — *Decided*
- **Alternatives:** Keep source precision; thin by a fixed ratio.
- **Why:** G-1 file size. 10m countries drop from 2.5 MB to about 150 KB.
- **Evidence:** `Source: packages/geo/README.md "Size"; Measured by: README claim (not re-measured this pass)`.

### D-118 Region centroid and bounds come from the largest piece — *Decided*
- **Alternatives:** Whole-feature centroid (France lands at sea toward French Guiana).
- **Why:** Labels and zooms must land on the mainland (G-8).
- **Evidence:** `Source: packages/geo/src/index.ts comment on Region.centroid; test "centers a region on its largest piece"`.

### D-119 The globe folds the hidden side past the rim instead of clipping — *Decided*
- **Alternatives:** Clip rings at the horizon (changes point counts, cannot morph); redraw per frame (not allowed).
- **Why:** `sampledPath` needs the same commands at every key (G-2, G-3). Folding keeps every ring's points as it crosses the horizon; the fold pivots around the hidden pole or a clear parallel so no ring wraps the wrong way.
- **Evidence:** `Source: packages/geo/README.md "Turning globes", globe.ts comments, a20af25`.

### D-120 Globe layers are split into 30-degree longitude pieces — *Decided*
- **Alternatives:** One path per layer.
- **Why:** A piece behind the globe holds still and costs no keys (G-1).
- **Evidence:** `Source: README "pieces 30 degrees of longitude wide so a piece behind the globe holds still", globe.ts BAND`.

### D-121 Choropleth shares a path among regions with the same color course — *Decided*
- **Alternatives:** One animated path per region.
- **Why:** G-1 size, and Chromium flashes tiles with hundreds of animated elements.
- **Evidence:** `Source: README "so a map of 180 countries with 9 classes stays small"; choropleth.ts docs`.

### D-122 Morph outlines are thinned (`detail` 2.5 px, relative 1.2%) and small pieces are left behind — *Decided*
- **Alternatives:** Morph full outlines (a world cartogram is large because every point is stored several times).
- **Why:** G-1. The map stays under the shapes until `at`, so dropped detail is not missed.
- **Evidence:** `Source: morph.ts comments; README "A world cartogram is about 600 KB"; 47dc159`.

### D-123 Traffic is seeded and jittered inside slots — *Decided*
- **Alternatives:** Math.random; uniform grid.
- **Why:** G-7 same bytes every build; slot jitter spreads particles without lining up.
- **Evidence:** `Source: traffic.ts doc; test "sends rate times the span of particles and is deterministic by seed"`.

### D-124 Each glyph is one path keyed by character and size — *Decided*
- **Alternatives:** One path per formula; text with embedded fonts.
- **Why:** G-8 and G-1: `morph()` can only translate, so equal chars at equal sizes pair and the rest fade; no font to load.
- **Evidence:** `Source: README "How glyphs pair"; index.ts comment "A bar's size is in its key, because morph only translates and cannot stretch one"`.

### D-125 Plane matrix steps use one CSS transform; function steps sample into `d` — *Decided*
- **Alternatives:** Always sample; always CSS (cannot express nonlinear maps).
- **Why:** G-1 small files, G-2 compile-time.
- **Evidence:** `Source: README "Planes and transformations" ("the file stays small"), plane.ts docstring, bd23bed`.

### D-126 MathJax runs without `noundefined` and `noerrors` — *Decided*
- **Alternatives:** Default MathJax red-text errors.
- **Why:** G-4: a typo must fail the build, not draw red text.
- **Evidence:** `Source: mathjax.ts comment; README "Errors"; test "a TeX error throws with MathJax's message"`.

### D-127 Each epicycle rotates by its frequency minus its parent's — *Decided*
- **Alternatives:** Rotate every circle by its own frequency (the nested transform doubled the turn).
- **Why:** G-3: the pen must ride the drawn trace.
- **Evidence:** `Source: b50da5e; test "the pen rides the trace it draws" (Chromium frames)`.

### D-128 Color scales take hex only and blend in OKLab — *Decided*
- **Alternatives:** Named colors or CSS variables (cannot be blended at compile time).
- **Why:** G-2, G-7: classes are fixed hex values at build.
- **Evidence:** `Source: scale.ts error text, palettes docs`.

### D-129 Night side of a flat map is one fixed-shape path of columns — *Decided*
- **Alternatives:** Re-clip the terminator circle each frame (point count changes at equinox).
- **Why:** G-2 sampling needs stable commands.
- **Evidence:** `Source: nightfall.ts docstring; test "keeps one shape through an equinox"`.

### D-130 `route()` throws across the map edge; `line()` cuts — *Decided*
- **Alternatives:** Silently cut (breaks `travel()`/`flow()` which need one list).
- **Why:** G-4: error names the fix (rotate projection or use `line()`).
- **Evidence:** `Source: index.ts error text; geo.test "cuts where it crosses the edge of the map, where route() throws"`.

### D-131 Compass constructions draw the real compass arcs as aids — *Proposed*
- **Alternatives:** Draw only the result (`compass: false` exists).
- **Why:** G-8 explainers show the construction. Inferred from option shape and README.
- **Evidence:** `Source: README Constructions; 4102c4a`.

#### Deliberately left out
- SVG arc commands in epicycle outlines: `contours()` throws on `A` (README "Arcs are not read").
- Relative path commands in MathJax output and `<text>` fallbacks: refused with errors (mathjax.ts).
- `\overbrace`, `\underbrace`, `\tag`: refused; use `Brace` (math.md).
- Fonts or script in the output (G-1, G-2).
- `fillOpacity` as an animatable channel (geo.md note).
- Clipped globe layers (D-119).

#### How it's used / how it's abused
Authors call these at module scope of a scene; the output is static markup plus Motions. Inputs are the scene author's TeX, GeoJSON and numbers, normally trusted, but a build pipeline may feed external data.

| Abuse | Prevention | Criteria |
|---|---|---|
| TeX `\color{...}` or `\cssId` carrying quotes reaches an attribute | The core escapes attribute values (probe: `red" onload="x` renders as `red&quot; onload=&quot;x`); the value is not validated as a CSS color | not yet covered |
| Huge or hostile TeX/GeoJSON stalls the build | None; MathJax and d3 run synchronously | Q-65 |
| Non-hex scale colors | Hex check throws | R-340 |
| Mismatched keys between data and map | `choropleth.unmatched`, cartogram/toBars throw when nothing matches | R-342, R-343 |
| Non-determinism between builds | Seeded generator, no clocks or Math.random | R-346, R-371 |
| Two scenes on one page colliding ids | Plane registers `--plane-*` properties globally by name; not scoped per scene | Q-66 |

# Open questions

## Purpose

### Q-1 Are the goal order, the conflict priorities and the non-goals in the ONTOLOGY purpose section right?
Options: confirm them; reorder the goals; add or drop non-goals. Recommendation: confirm. The order puts the output contract (G-1, G-2) and the dependency-free core (G-6) first because AGENTS.md treats them as hard rules, and live editing (G-10) last because it is the newest and sits in its own packages.

## Timeline and motion

### Q-2 Should `motion(initial)` validate its initial values like `to()` does?
Options: (a) leave as is; (b) run `checkValues` on non-empty `initial`; (c) a lighter check only for finite numbers. Recommendation: (b), with empty `{}` allowed, since `motion({ x: NaN })` currently stores NaN and fails later in `num()` with no hint about the cause.

### Q-3 Should `ease.bezier` validate its arguments?
Options: (a) leave to the browser (CSS drops an invalid `cubic-bezier` declaration, so the animation loses its ease); (b) throw unless all four are finite and `x1`,`x2` are in [0,1]. Recommendation: (b), keeping `y` values free so `pop` overshoot works.

### Q-4 Do colours blend in `valueAt` (still frames) or hold?
`valueAt` holds the earlier colour while CSS interpolates colours, so a still frame mid-transition can show a different colour than playback. Options: (a) accept and document; (b) interpolate in sRGB (or the same space as CSS); (c) remove colours from still-frame logic. Recommendation: (b) once the colour space is chosen to match the browser.

### Q-5 Is `blur` stacking by `hypot` a decided design?
`sample` combines two blur layers as `hypot(a,b)` (Gaussian variances add) but the skill says only `x y rotate` add and `opacity scale` multiply. Options: document it in SKILL.md and `sample` doc comment; or stop stacking blur. Recommendation: document it.

### Q-6 Should `number()` reject non-finite values and `color()` check its hex?
Today `number(NaN, ...)` passes (comparisons with NaN are false) and `color("red")` is accepted at runtime. Options: validate both in the constructors; leave to types. Recommendation: validate (`Number.isFinite(value)`, `/^#[0-9a-f]{6}$/i`) since the schema is a worker boundary and the docs say "a `#rrggbb` hex".

### Q-7 Which named constants should be exported from the recipes?
The recipe defaults (shake rate 12, wiggle rate 8, period 2, sampled step 0.05, jump halvings 20) are inline literals. Options: keep inline with doc comments; extract named constants. Recommendation: extract the ones the docs state, so the Numbers table can be generated.

### Q-8 Does `wiggle` document that `rate` and `period` interact with the scene duration?
`period` is snapped to divide the scene at render time but `count` is computed before snapping, so the realized rate differs slightly. Options: document; or snap in `wiggle`. Recommendation: document; the snap lives in B.

## Compile and output

### Q-9 Should `render({ comment })` reject or escape `--` and `-->`?
Options: (a) throw when the comment contains `--`; (b) replace `--` with `- -`; (c) leave it, document that comment is trusted. Recommendation: (a). A comment containing `-->` currently ends the comment and writes the rest as live markup (confirmed: output `<!-- x --> <script>alert(1)</script> <!-- -->`). A thrown error names the fix and fits G-4.

### Q-10 Should `validateSvg` read ids only from real `id` attributes?
Options: (a) keep `\bid="` (matches `data-id="…"`, so two elements with the same `data-id` fail the render); (b) use `(?<![-\w:])id="`. Recommendation: (b) and add a test. This is a bug fix.

### Q-11 Should non-finite or infinite inputs get named errors?
`reducedMotion: { at: NaN }` fails with `Expected a finite number, received NaN` from `num`, which does not name the option. `duration: Infinity` and `width: Infinity` pass the guards. Options: (a) guard in `render()` with `Number.isFinite`; (b) leave. Recommendation: (a), naming `reducedMotion.at`, `duration`, `width`, `height`.

### Q-12 Which runtime errors belong in SKILL.md's error table?
Compile-time errors the code throws but the table omits: `<…> cannot animate ….`, `… needs …="…"; this <…> sets …`, `Two different fonts claim …` (only mentioned in images-fonts.md), `Two keys are too close to tell apart …`, `render() needs a positive …`, `render() needs a prefix …`, `Unsupported SVG child`, `Unsupported value for …`, `Unresolved ref in …`. The R-225 tests check that table rows exist in `src/`, not the reverse. Options: add rows; keep the table to common mistakes. Recommendation: add `cannot animate`, `needs … sets`, render guards and `Unsupported …`; G-9 says a coding agent should find the fix from the message.

### Q-13 Should `picture()` dedupe by content or by object?
`symbols` is a `WeakMap` keyed by `PictureData` identity, so two `picture()` calls on the same bytes embed twice. Options: key by `href`; keep identity and document. Recommendation: key by `href` in a per-render map (the symbol def is already per-ref per render). Cheap and removes a surprise.

### Q-14 Should `Icon` format its transform through `num`?
see Known bugs in CRITERIA.md. Options: `num(x)`, `num(y)`, `num(scale, 6)` as `Picture` does; leave. Recommendation: use `num`. G-7 names "stable float printing".

### Q-15 Should an empty `title` be an error?
`title: ""` renders `<title id="t"></title>`. G-5 says text stays accessible. Options: throw; warn in `validateSvg`; allow. Recommendation: warn in `validateSvg` so tools that generate scenes see it without breaking decorative uses.

## Geometry, fonts, ink and voxels

### Q-16 Should path parsing accept compact arc flags and share one parser?
`paths.ts` (`parse`) and `ink/path.ts` (`flatten`) each tokenise path data and each implement arcs; neither reads flags written without separators (`a5 5 0 1010 0`), which svgo emits. Options: (a) keep two parsers and document the limit; (b) one shared tokenizer that reads arc flags as single `0`/`1` digits and one arc routine feeding both; (c) fix both in place. Recommendation: (b), since `matchPaths`, `Ink`, `strokeFont` and `@svjeez/geo` all take outside path data, and the duplication is the cause of the drift risk.

### Q-17 Should `Font.path()` read CFF outlines?
Options: add a CFF charstring reader (Type 2, subroutines, hundreds of lines); keep throwing. Recommendation: keep throwing until a scene needs an OTF; Google Fonts delivers TTF.

### Q-18 Should non-finite positions in `spline` throw a named error?
`point(NaN)` throws `TypeError` from an undefined cubic. Options: throw `spline().point() needs a finite position, got NaN.`; treat NaN as 0. Recommendation: throw a named error, matching every other argument check (G-4).

### Q-19 Should `Spline.path(from, to)` with `from > to` reverse the path?
It currently orders the bounds, so a reversed range draws forward. Options: keep (document it); reverse the output. Recommendation: keep and document, since reversed path data is easy to get with the points reversed.

### Q-20 Should the kerning pair cap be silent?
`kernTable` keeps the first 10000 sorted pairs and drops the rest without a warning, so a very large text set could measure differently in the browser. Options: embed whole above the cap; keep. Recommendation: embed whole above the cap (G-3).

### Q-21 Are the ink and voxel tuning constants [D] or [P]?
The tool defaults, `BLEED` and shades look tuned by eye. Recommendation: the owner confirms them as [T] in the next pass; no measurement exists.

## Layout and diagrams

### Q-22 Should a flowchart/layered layout with zero nodes have defined bounds?
Options: (a) leave NaN/Infinity bounds as today; (b) return `{x:0,y:0,w:0,h:0}`; (c) throw "needs at least one node". Recommendation: (b). `flowchart({nodes: {}, edges: []})` typechecks and currently returns NaN-width bounds that poison `anchor` placement.

### Q-23 What should a transition from a composite to one of its own inner states draw?
Options: (a) today's self-loop on the composite; (b) a line into the container's inner state; (c) a type or runtime error. Recommendation: (b) or (c). `home("w","p")` resolves both ends to `w`.

### Q-24 Should `stateMachine()` reject a composite whose inner state reuses the composite's own id?
Options: check ids before recursing; or keep first-wins. Recommendation: reject (see Known bugs in CRITERIA.md).

### Q-25 Should the diagram runtime errors be in SKILL.md's runtime error table?
Options: add the five most common (`No path`, `No edge`, `walk() has no way`, `tree() needs exactly one root`, `… needs N times`); keep them in references/diagrams.md only. Recommendation: add; G-9 says the skill covers error messages, and the R-225 tests would then check they exist in `src/`.

### Q-26 Should `layered`/`place` cap or document its cost on large graphs?
Options: a warning in the reference; an iteration budget scaled by size. Recommendation: measure on a 200-node graph first; no number exists today.

### Q-27 Two exports named `simplify` (layout/box.ts and layout/field.ts) do different jobs; rename one?
Options: rename field's to `douglasPeucker`; keep. Recommendation: rename (the call sites in extras/field.ts import only the field one).

### Q-28 Should `field.ts` and `contour.ts` stay under `layout/`?
Options: move to `src/extras/field/` or a `geometry/` folder; keep. They are numeric routines for plots, not box layout. Recommendation: keep unless layout's "no imports outside" rule starts to bind.

## Extras

### Q-29 Should `Marker` honour the stop's `during.over` and hide outside its stops?
Today it shows from t=0 at the first stop's size regardless of the first stop's `at`, glides to later stops at their `at`, and never leaves. Options: (a) keep and document; (b) fade in at the first `during.at` and out at the last stop's end. Recommendation: (b), as every other annotation honours its span.

### Q-30 Should `readout` show nothing before `at` and after `at + over`?
Today the first string shows from t=0 and the last string holds forever. Options: keep and document; hide outside the span. Recommendation: hide outside, with a `hold` option for the final value.

### Q-31 Should `terminal` type the prompt, or print it and type only the command?
Code types the whole `❯ cmd` line character by character; the doc says "each prompt appears, its command types". Options: print the prompt instantly; keep and fix the doc. Recommendation: print instantly (matches a real shell).

### Q-32 Should the default `reveal` drop trailing blank lines instead of making a block of blanks?
Options: skip blank-only blocks; keep. Recommendation: skip, since the block costs a beat and draws nothing.

### Q-33 Should `variables()` validate values?
Names are checked; a value containing `}` or `;` reaches the stylesheet. Options: validate, reject, or document that values are trusted scene source. Recommendation: document (scene source is trusted).

### Q-34 Should annotations validate their `Span` (`over > 0`, `at >= 0`)?
`Arrow`, `Callout`, `Brace`, `Underline`, `Focus` and `Marker` stops accept any span; `shot`, `timeline`, `readout` check. Recommendation: one shared span check with a named message.

### Q-35 Should result types be exported from `svjeez/extras`?
See R-206. Recommendation: export them.

## Frames, CLI, plugins and release

### Q-36 Should the stage page restrict network access for untrusted SVGs?
Options: leave as is (author's machine, author's scene); route-block all requests except the stage origin and `data:`; add a flag. Recommendation: block non-`data:`/non-origin requests by default (G-1 says the SVG makes no external fetches, so the render should prove it), with an opt-out.

### Q-37 `loopLength` returns the longest period when no common period is found within 1000 multiples. Is that intended?
Options: keep; throw; return the multiple closest to fitting and warn. Recommendation: keep, but document it in `svjeez/page` and the skill, and add a test for incommensurate periods (it affects `count` frame spacing and video length).

### Q-38 Should `getScene` read `width`/`height` like `renderFrames` and accept scenes without a `viewBox`?
Options: keep viewBox only and throw a named error; fall back to width/height. Recommendation: fall back, then throw "getScene() needs a viewBox or numeric width and height" (see Known bugs in CRITERIA.md).

### Q-39 Should the empty-`times` case (`times: []`) be rejected?
Options: reject with the count message style; return no frames. Recommendation: reject, as `count: 0` is rejected (with `sheet` it divides by zero; see Known bugs in CRITERIA.md).

### Q-40 Should `test:package` run for `@svjeez/icons` in CI?
Options: add the step; remove the script. Recommendation: add the step; AGENTS.md says every package runs it (see Discrepancies).

### Q-41 Should the packed `svjeez` CLI be run in `test:package`?
`SKILL` resolves `../skills/svjeez` relative to `package-dist/cli.js`; only the video consumer runs the packed CLI, and it never runs `skill`. Options: add `svjeez skill` and `svjeez skill --install` to `package-check.ts`. Recommendation: add them.

### Q-42 Poster still selection parses `animation-delay:-Ns!important` out of the SVG text. Should the compiler expose the still time instead?
Options: keep the regex; export it from `render()` as metadata. Recommendation: keep until a second consumer appears; the coupling to `css.ts` is real but small.

### Q-43 Is the stage-page SVG HTML-injected on purpose?
`stage` interpolates the SVG into `<div id="stage">…</div>` of an HTML page (inline SVG, not `<img>`). That differs from how viewers show it (`<img>`), so a scene that behaves differently inline than as an image would be misjudged. Options: capture through `<img src=data:…>`; keep inline (allows `getAnimations()`). Recommendation: keep inline because seeking needs the DOM; add a manual check that the `<img>` rendering matches for the example set.

### Q-44 Is `scheme.ts` in the core's public surface?
`systemColorScheme` is imported by `frames.ts` only and not exported from `index.ts`; it imports `node:child_process`. Options: keep it internal; move it to `frames.ts`'s folder. Recommendation: keep internal, and add a unit test (currently only `packages/svjeez/test/R-212/color-scheme-and-embeds.test.tsx` touches it, with a stub of the host).

## Live editor

### Q-45 Should `seek` clamp `at` to the scene duration, and to 0?
Options: clamp in `update` when a `compiled` file or `first.duration` is known; leave to components. Recommendation: clamp in `update` at 0 (no negative time), and leave the upper bound to the loop.

### Q-46 Should `select` validate that the key names a value?
Options: validate in `update`; accept and let `read` drop it later. Recommendation: validate, so `selected` never names a missing value.

### Q-47 Should a stale compile's error be attributed to the current text?
`compiled` failure sets `error` even when `msg.text !== state.text`. Options: ignore errors for stale text; keep. Recommendation: ignore stale errors, since the newer text will compile and set its own.

### Q-48 Escape quotes and newlines when writing a string/choice value?
Options: escape in `write`; reject values containing the quote or newline. Recommendation: reject (return no-op) and keep choice options plain.

### Q-49 What should `set` do with an ease that is neither named nor bezier (e.g. a spring)?
Options: throw (now); refuse with no-op; write a named alternative. Recommendation: no-op with the state's `error` unchanged, never throw from `send`.

### Q-50 Is running arbitrary source in the page's worker part of the threat model?
Options: document as out of scope; add a CSP/sandbox note. Recommendation: document as a non-goal: the editor is a tool for the author's own scenes.

### Q-51 Should Svelte get the tests React has (server render, control override, popover dismissal, hide/show)?
Options: port; accept gaps. Recommendation: port; they assert rules R-278, R-280, R-281.

### Q-52 Should a single-text-input editing path (typing in the panel) exist in the components?
`replace` is documented for typing, but neither adapter renders an input. Options: ship a text editing mode; keep read-only panel with `replace` for hosts. Recommendation: keep as is and say so in the READMEs.

### Q-53 Should `useEditor` destroy the editor on unmount?
It only pauses (documented); a never-destroyed editor holds its last picture URL. Options: destroy on unmount of the owner; keep. Recommendation: keep, since React strict-mode remounts and `<Activity>` need resume; document `destroy()`.

### Q-54 Name the inline constants (see Numbers) so tests and docs refer to names?
Recommendation: yes, export `SCRUB_PIXELS`, `FINE_SCALE`, `PROBE_NUDGE_DIVISOR`, `COMPILE_TIMEOUT_MS`.

## Charts, code, fonts, icons and Mermaid

### Q-55 Should `@svjeez/icons` be `private: true` while AGENTS.md lists it as a released package?
Options: (a) leave private and have the packaging script publish a different manifest; (b) remove `private`. Recommendation: confirm (a) is how `package-plugin.ts` works and note it in the docs; `icons/package.json` is private but README says `npm i -D @svjeez/icons`.

### Q-56 Should chart tunables (padding, durations, radius, tick counts) become named constants?
Options: keep inline defaults documented in `types.ts`; extract to one `defaults.ts`. Recommendation: extract, so Numbers can be regenerated and tests refer to names.

### Q-57 Should `chart()` validate that band data keys are in `x.domain`?
Today a data row `["Q9", 5]` fits the y scale but is rejected only when a series draws it. Options: reject in `chart()`, or leave. Recommendation: reject early (G-4).

### Q-58 Should Mermaid drawing honor edge style/arrow and sequence head?
The doc keeps `line`, `arrow`, `head`; svjeez draws solid arrows. Options: map when svjeez supports it; keep ignoring. Recommendation: keep ignoring until core supports, then move from "parsed" to "drawn" (AGENTS.md rule).

### Q-59 Is the accent order a decision or an accident?
Options: document as decided; allow `series colors` per chart. Recommendation: mark decided and add a test for wrap-around after 7 (R-296 wrap not asserted).

### Q-60 Should `fonts` validate cache contents?
A corrupt or truncated cached TTF fails inside `font()` with no hint to delete the cache file. Options: catch and refetch; name the cache file in the error. Recommendation: name the file.

## Maps and math

### Q-61 Should `intersect()` check segment bounds only for the crossing kept by `pick`?
Options: (a) keep, every crossing must lie on every segment; (b) check only the kept crossing. Recommendation: (b). Verified by running: segment (0,0)-(10,0) with a circle about (9,0) radius 3 crosses at (6,0) and (12,0); `pick: 0` keeps (6,0) yet throws about (12,0).

### Q-62 `toBars` and `cartogram` options with `top: 0` or an empty `biggest`?
Options: validate `top >= 1`; leave. Recommendation: validate, with an error naming `top`. Today `top: 0` makes `biggest[0]!` undefined and throws a raw TypeError.

### Q-63 `trueSize` `ease` takes `(u) => number` while other geo options take `Ease`
Options: accept `Ease`; keep. Recommendation: accept `Ease` for consistency with `choropleth`, `cartogram` and `plane`.

### Q-64 Three copies of the TopoJSON object lookup
`index.ts` (`features`, `topologyObject`), `globe.ts` (`features`) and `reproject.ts` (inline) each read a topology and word the missing-object error differently. Options: one shared helper taking the caller name; leave. Recommendation: share.

### Q-65 Should build time be bounded for huge inputs?
Options: document only; add limits. Recommendation: document only (author-trusted input).

### Q-66 Are `--plane-*` registered properties safe for two planes on one page?
Planes register the same names with the same definitions, so two inline SVGs may share them. Behavior with different matrices per plane is inherited per element, so likely fine, but not tested. Recommendation: add a criterion test.

### Q-67 Name the magic numbers
List in Numbers marked [P] (`EARTH_RADIUS_KM`, `SUN_J2000_DAYS`, relax passes, legend label width, derive note width). Recommendation: promote to named constants.

### Q-68 `route()` error wording for a route clipped entirely
`cut.length !== 1` also covers 0 pieces (both ends off a globe), where the message says "crosses the edge". Recommendation: separate message naming the far side.

# Ontology

This is the implementation reference for svjeez: what exists, what each thing carries, the rules
it follows and the interface it offers. It covers every package in `packages/`. The reasons for
each choice are in [RATIONALE.md](RATIONALE.md), the tests that prove each rule are in
[CRITERIA.md](CRITERIA.md), and how the design changed is in
[ARCHITECTURE_LOG.md](ARCHITECTURE_LOG.md). This document describes the current state only.

Tags:

- **[D]** decided by the designer. Shipped behavior the designer built is [D].
- **[P]** proposed, pending the designer's review. A [P] is never a rule until the designer
  promotes it.
- **[T]** a tunable number. Its value lives in the Numbers table and in the code constant of the
  same name.
- **[D, unbuilt]** decided but not in the code yet. Its criterion is `not yet covered`.
- **Serves:** the goal (`G-n`) or quality the item exists for.

Code, tests and commits cite stable IDs (`G-n`, `D-n`, `Q-n`, `R-n`, `U-n`, `X-n`), never
section numbers. IDs are never reused.

## §0 Purpose — [D]

svjeez turns a scene written in TypeScript into one animated SVG file. The file plays anywhere an
image does, and nothing runs in the viewer.

**Qualities** the scene writer and the viewer should feel:

- *plays anywhere*: the SVG works in an `<img>`, a README, a slide or an email, with no script.
- *honest timing*: what the scene declares on its timeline is what plays, to the frame.
- *typed authoring*: mistakes are type errors or compile errors that name the fix.
- *zero runtime*: every computation, from physics to TeX, happens while the scene compiles.

**Goals**, in priority order (the ordering is [P], see Q-1):

- **G-1 One self-contained file.** The output is one SVG with no script and no external fetches.
  Fonts are subset and embedded, and images are inlined.
- **G-2 Nothing runs in the viewer.** Every motion compiles ahead of time to CSS keyframes, or to
  SMIL on filter primitives. Physics, layout, highlighting, map projection and TeX run at compile
  time.
- **G-6 Small, dependency-free core.** `svjeez` has no runtime dependencies and runs on Node 20+
  and Bun. Third-party code lives in separate `@svjeez/*` packages that run at compile time.
- **G-7 Deterministic.** The same scene source gives the same bytes: randomness is seeded, ids
  are stable and floats print the same way on every run.
- **G-3 Timing is exact and checkable.** What the scene declares (`at`, `over`, `ease`) is what
  plays, and frames, contact sheets and video can prove it.
- **G-4 Scenes are typed TypeScript.** Scenes are TSX or plain function calls. Mistakes surface
  as type errors or compile-time errors whose message names the fix, never as a broken SVG.
- **G-5 Respects the viewer.** The SVG follows `prefers-color-scheme` and
  `prefers-reduced-motion`, and carries a title and descriptions.
- **G-9 Agents can write scenes.** The shipped skill and the error messages are complete enough
  for a coding agent to write a correct scene unaided.
- **G-8 Explainers are first-class.** Code walkthroughs, terminals, diagrams, ink, charts, maps,
  math and voxels are built in or one package away.
- **G-10 Live editing.** In the editor every literal in the source has a control, a drag on the
  picture edits the source, and the picture shows the frame at the current clock.

**Priorities when goals conflict** — [P]: the output contract (G-1, G-2) beats everything. A
feature that needs viewer-side script or a runtime dependency in the core does not ship in
`svjeez`. Determinism (G-7) beats convenience. A clear compile error (G-4) beats a guess that
renders something.

**Non-goals for now** — [P]:

- Script or interaction in the output. Pointer, scroll and click behavior need JavaScript, which
  G-1 rules out.
- Rendering in the viewer's browser. svjeez is a compiler, not a runtime.
- Raster output as the main product. Frames, contact sheets and video exist to check timing and
  to export, and the SVG stays the artifact.
- Reading or editing existing SVG files.

## §1 Entities

### Timeline and motion

#### Span — [D]
*Serves:* G-3, G-4
| Field | Type | Notes |
|---|---|---|
| at | Seconds | Start on the scene timeline, finite and >= 0 |
| over | Seconds | A duration, never an end time; finite and > 0 for recipes |

#### Ease — [D]
*Serves:* G-2, G-3, G-4
Branded, structured value (not a string) so CSS and SMIL each compile it. Plain data, survives `structuredClone`.
| Field | Type | Notes |
|---|---|---|
| kind | "linear" \| "bezier" \| "steps" | Discriminant |
| points | [x1, y1, x2, y2] | bezier only |
| count | number | steps only; positive integer |

Presets on `ease`: `linear`, `in`, `out`, `inOut`, `pop` (overshoots), `hold` (= `steps(1)`), plus the factories `steps(n)` and `bezier(...)`.

#### Step — [D]
*Serves:* G-3
One transition (or cut, `over: 0`) of a motion.
| Field | Type | Notes |
|---|---|---|
| start | Seconds | The cursor when `to`/`set` was called |
| over | Seconds | 0 for `set` (with `ease.hold`) |
| ease | Ease | Shapes this transition only |
| values | TargetValues | The channels and properties it moves, validated |

#### MotionData — [D]
*Serves:* G-3, G-4, G-7
The state of one immutable motion layer; `Motion` is its public face (`at`, `wait`, `to`, `set`, `loop`, `label`), and every method returns a new motion.
| Field | Type | Notes |
|---|---|---|
| initial | TargetValues | Value of each channel before its first transition; not validated at runtime (see Known bugs in CRITERIA.md) |
| steps | Step[] | In call order, not time order; B sorts by `start` |
| cursor | Seconds | Where the next `to`/`set` starts; `at` sets it, `wait` adds, `to` advances it to the step end |
| period | Seconds? | Set by `loop`; absent means the layer spans the scene |
| label | string? | CSS identifier used for readable keyframe and class names; not unique |

#### Stack — [D]
*Serves:* G-3, G-4
`Motion | (Motion | false | null | undefined)[]`. Index 0 is outermost; falsy entries are dropped. B turns each layer into a nested wrapper.

#### Channel (table row, `Spec`) — [D]
*Serves:* G-2, G-4
One row of `CHANNELS`, the single source of what can be animated.
| Field | Type | Notes |
|---|---|---|
| value | number \| Color \| PathData | Placeholder fixing the value type; the type of values for the channel |
| tags | Tag[] | Elements that may carry it; drives `TagChannels<T>` and the JSX `animation` prop type |
| lane | string | Channels in one lane cannot move at the same time in one motion (`x`,`y` share `translate`) |
| composition | "nest" \| "replace" | `nest`: layers of a stack nest as wrapper groups; `replace`: one motion per element |
| identity | number \| Color \| PathData? | Rest value; only the "rest channels" (`opacity x y scale rotate blur`) have a numeric identity |
| range | [min, max]? | Clamp used by `clamp()` (wiggle) |
| attr | string? | SMIL/attribute name when the lane is not CSS |
| pins | Record? | Attributes B must set when the lane is present (`draw`: `pathLength`, `stroke-dasharray`) |
| pivot | true? | Lane turns about a point (`scale`, `rotate`) so `Pivot` applies |
| collidesWith | string[]? | Style/attribute names that an element-set value would override (`opacity`, `transform`, `filter`) |
| wrapsOn | Tag[]? | Tags where the lane always lands on a wrapper (`text` for `scale`/`rotate`) |
| backend | "blur" \| "smil"? | Non-CSS compile route (`blur` through a filter, `d` through SMIL) |
| toggles | string[]? | Attributes whose presence makes a 0/1 cut compile to `visibility` (`opacity`) |

Channels: `width height opacity x y scale rotate blur draw d fill stroke color stopColor stopOpacity floodColor floodOpacity stdDeviation baseFrequency seed displace dx dy`.

#### Property (registered custom property) — [D]
*Serves:* G-2, G-4
A `Property` is a string key `--name:syntax`. Name and syntax live in the literal type so values are checked by syntax.
| Field | Type | Notes |
|---|---|---|
| key | `--${name}:${Syntax}` | Also the animation key: `{ [yaw]: 90 }` |
| syntax | "number" \| "length" \| "angle" \| "color" | Maps to CSS `<number>`, `<length>` (px), `<angle>` (deg), `<color>` |
| inherits | boolean | Written into `@property` |
| initial | per syntax | Also the property's identity value |

Declarations live in a module-level `Map` (`declared`), keyed by property key; see rule on registration. `Css` is the unrendered CSS text that carries `{ property }` parts so render can give each property a per-file short name (`--p1`, ...).

#### Calc — [D]
*Serves:* G-4, G-2
A typed expression node tree (`literal | var | op | call`) measuring a dimension `D` (`number | length | angle`). It extends `Css`, so it drops into a `css` hole. Lowered to CSS text with `calc(` only around a top-level operator expression.

#### SampleOptions / SampledOptions — [D]
*Serves:* G-3, G-7
| Field | Type | Notes |
|---|---|---|
| duration | Seconds | `sample`: the scene's `duration`; `sampled`: length to bake; > 0 |
| loop | boolean? | `sample` only; default true; false holds the last frame past `duration` |
| step | Seconds? | `sampled` only; sampling interval before simplification; default `0.05` |
| tolerance | { [lane]: number } | `sampled` only; per-lane max stray, in the lane's units (px distance for `translate`) |
| precision | integer? | `sampled` only; decimals each sample is rounded to; default none |

#### WiggleOptions — [D]
*Serves:* G-7
| Field | Type | Notes |
|---|---|---|
| seed | string \| number | Required; stream is `random(String(seed))` |
| rate | number? | Samples per second; default 8 |
| ease | Ease? | Default `ease.inOut` |
| period | Seconds? | Loop length; default 2 |

#### Key — [D]
*Serves:* G-3
Internal keyframe from `keysOf`: `{ t, values, ease }`. `ease` shapes the span from this key to the next. B consumes keys to emit; `valueAt` and `sample` read them.

#### Param, Schema — [D]
*Serves:* G-10, G-4
Plain-data description of a scene's editable values (`svjeez/params`). Variants:
| Kind | Fields | Notes |
|---|---|---|
| number (`number`/`count`/`seconds`) | value, min, max, step, unit?, scale? ("linear"\|"log"), label? | `count`: integer, step 1, min default 0. `seconds`: min 0, step 0.01, unit `s` |
| color | value (Hex), label? | |
| easing | value (Ease), label? | |
| choice | value, options, label? | value must be in options |

`Schema` = record of Param; `Values<S>` = each key's value type; `Handles<S>` = function from all values to a `Point` for each number param it covers.

#### RestyleOptions — [D]
*Serves:* G-5, G-10
| Field | Type | Notes |
|---|---|---|
| css | string? | Appended after the scene's CSS so it wins |
| at | Seconds? | Start the copy this many seconds in (CSS `--t0`, SMIL negative `begin`) |
| onceAt | Seconds? | Clock for `<Once>` parts (`--t1`, `data-once` SMIL); defaults to `at` |
| paused | boolean? | Hold the frame at `at` (default 0) whatever the reduced-motion setting |
| still | boolean? | Hold the reduced-motion still frame; ignores `at` and `paused` |

#### OnceProps, PivotProps — [D]
*Serves:* G-3
`Once`: element props of `g` plus children; emits a `<g>` flagged `once: true`. `Pivot`: `at?: Point` (default 0,0), `animation?: Stack<TagChannels<"g">>`, `children`; emits a `<g>` with `transform-box:view-box;transform-origin:<x>px <y>px`.

### Compile and output

#### Canvas — [D]
*Serves:* G-2, G-3, G-5, G-7
The render-wide constants the compiler reads. Built by `render()` from `RenderOptions`.
| Field | Type | Notes |
|---|---|---|
| width, height | number | Positive. Written as `viewBox` and `width`/`height` on the root. |
| duration | Seconds | One loop of the scene timeline. |
| playbackRate | number | Positive and finite. Every emitted duration is divided by it. The timeline stays in scene seconds. |
| prefix | string | Empty, or `[A-Za-z][\w-]*`. In front of every generated id, class, keyframe name, custom property and font family. |
| stillAt | Seconds or undefined | Freeze frame for `prefers-reduced-motion`. `undefined` when `reducedMotion: false`. |
| loop | boolean | `false` plays once and holds the last frame. |

#### RenderOptions — [D]
*Serves:* G-1, G-4, G-5, G-9
| Field | Type | Notes |
|---|---|---|
| width, height, title, duration | number, string, Seconds | Required. |
| desc | string? | Adds `<desc id="{prefix}d">` and a second `aria-labelledby` id. |
| css | string or Css? | Authored CSS, written before generated rules. A `Css` resolves property holes to render names. |
| playbackRate, prefix, loop | see Canvas | Defaults 1, none, true. |
| reducedMotion | `{ at }` or false? | Default `at = duration * 0.85`, clamped to `[0, duration]`. |
| comment | string? | Written as an XML comment above the root. |
| sources | boolean? | Writes `data-source` from the development JSX runtime. Default false, and bytes are unchanged. |

#### SvgNode — [D]
*Serves:* G-4, G-7
The compiler's tree. A union of four kinds.
| Field | Type | Notes |
|---|---|---|
| kind | "element" or "text" or "raw" or "fragment" | |
| element.tag | string | |
| element.attrs | Record<string, AttrValue> | `AttrValue` is string, a def `Ref`, `Css` or `FontValue`. Refs, Css and fonts resolve to strings during compile. |
| element.children | SvgNode[] | |
| element.motions | Motion[] | The `animation` stack, outermost first. Never serialized. |
| element.once | boolean? | Set by `<Once>`. Never serialized. |
| text.value | string | Escaped on output. |
| raw.value | string | Written as is. Internal use (the `<style>` body). |

#### Ref (def reference) — [D]
*Serves:* G-4, G-7
| Field | Type | Notes |
|---|---|---|
| tag | DefTag | linearGradient, radialGradient, pattern, clipPath, mask, filter, marker, symbol. Phantom-typed, so `clipPath={gradient}` is a type error. |
| node | Element | The def's element, without an id. |
`toString()` throws. Identity is the key: one ref is one id per render.

#### Lane — [D]
*Serves:* G-2, G-3
One CSS property or SMIL attribute that a motion drives on one element. Internal to `compile.ts`.
| Field | Type | Notes |
|---|---|---|
| key | string | The lane name from the channel table (`translate`, `opacity`, `d`, a custom property key). |
| backend | "css" or "smil" or "blur" | `fe*` tags are always `smil`; `blur` and `d` come from the channel row. |
| channels | Target[] | Channels sharing the lane (`x` and `y` share `translate`). |
| keys | Key[] | From “Timeline and motion”'s `keysOf`. |
| period, snapped | Seconds | Loop length and the length that divides the scene. |
| nest | boolean | True for css/blur lanes whose channel composes by wrapping. |
| emit | "value" or "visibility" or "dash" | How keys become declarations. |
| label | string? | Prefix for the generated keyframe and class names. |

#### State (per-render compiler state) — [D]
*Serves:* G-7
| Field | Type | Notes |
|---|---|---|
| ids | Map<AnyRef, string> | A ref's id, assigned at first use. |
| counters | Map<string, number> | One counter per name base, so ids number from 1 in first-use order. |
| keyframes, classes | Map<body, name> | Identical bodies share one name. |
| blurs | Map<signature, id> | Generated blur filters, shared by identical lanes. |
| properties, registrations | Map<Property, name>, string[] | `--p1`, `--p2` ... in first-use order, and their `@property` rules. |
| fonts, faces, texts | Map, array, string[] | Embedded faces by slot, and every text run so fonts can be subset. |
| defs, rules, stills | SvgNode[], string[], string[] | Output buckets. `stills` are the reduced-motion swaps. |
| pivot, once | boolean | Whether to emit the `fb` and `o` rules. |

#### Compiled — [D]
*Serves:* G-1
| Field | Type | Notes |
|---|---|---|
| body | SvgNode[] | The walked tree. |
| defs | SvgNode[] | Emitted into one `<defs>`. |
| css | string | Authored CSS, a blank line, then generated rules joined by newlines. |

#### Declaration (custom property) — [D]
*Serves:* G-4
| Field | Type | Notes |
|---|---|---|
| syntax | "number" or "length" or "angle" or "color" | Units: none, px, deg, none. |
| inherits | boolean | |
| initial | number or Color | Typed by the syntax. |
Key format `--name:syntax`. A module-level registry, `declared`, holds them.

#### PictureData — [D]
*Serves:* G-1
| Field | Type | Notes |
|---|---|---|
| href | `data:${string}` | Base64 for raster. Percent-encoded text for SVG. |
| width, height | number | Intrinsic px. After EXIF rotation for JPEG. For SVG, root width/height, else from the viewBox. |
| format | "svg" or "png" or "jpeg" or "gif" or "webp" | Sniffed from bytes, never the extension. |
| bytes | number | `href.length`, which is what the output pays. |

#### IconData — [D]
*Serves:* G-8
| Field | Type | Notes |
|---|---|---|
| grid | number | Side of the square viewBox. |
| kind | "stroke" or "fill" | |
| paths | string[] | One path per drawn piece. |

#### ValidationResult — [D]
*Serves:* G-4, G-9
| Field | Type | Notes |
|---|---|---|
| errors | string[] | Structural defects. `render()` throws on any. |
| warnings | string[] | Performance and portability hazards. Never throw. |

#### JsxSource — [D]
*Serves:* G-10
| Field | Type | Notes |
|---|---|---|
| fileName | string? | |
| lineNumber | number | |
| columnNumber | number? | Absent under Sucrase. |
Held in a module-level `WeakMap<SvgNode, JsxSource>`. Written as `file:line:column`, skipping absent or empty parts.

### Geometry, fonts, ink and voxels

#### PathData — [D]
*Serves:* G-4, G-7
| Field | Type | Notes |
|---|---|---|
| (type) | `` `M${string}` \| `m${string}` `` | SVG path data. Every function in this area that returns path data starts it with `M`, so the brand is true by construction. |

#### Point / Rect / Edge — [D]
*Serves:* G-4
| Field | Type | Notes |
|---|---|---|
| Point.x, Point.y | number | Defined in `layout/box`, re-exported from `geometry.ts`. |
| Rect.x, y, w, h | number | Top-left corner and size. |
| Rect.top, right, bottom, left, center | Point | Midpoints of the edges and of the box, computed once at construction. |
| Rect.pad(n) | (number) => Rect | Grows every side by `n` (negative shrinks). |
| Rect.union(other) | (Rect) => Rect | Smallest rect holding both. |
| Rect.side(edge, t) | (Edge, number) => Point | The point `t` of the way along an edge, left to right or top to bottom. `t` is not clamped. |
| Edge | `"top" \| "right" \| "bottom" \| "left"` | |

#### PolylinePathOptions — [D]
*Serves:* G-4, G-7
| Field | Type | Notes |
|---|---|---|
| closed | boolean | Default false. Appends `Z`. |
| precision | number | Decimal places, default `POLYLINE_PRECISION`. |

#### Spline — [D]
*Serves:* G-2, G-4
| Field | Type | Notes |
|---|---|---|
| d | string | Path data for the whole curve, one cubic Bézier per leg. |
| legs | number | Points minus one. A position runs 0 to `legs`; `i + u` is `u` along leg `i`. |
| point(at) | Point | Position clamped to `[0, legs]`. |
| tangent(at) | Point | Derivative per unit of position: direction is travel, length is speed. |
| angle(at) | number | Degrees as `rotate` takes them: 0 along +x, 90 along +y. |
| path(from?, to?) | string | Path data cut exactly from the legs crossed; bounds are clamped and put in order. |
| nearest(p, from?, to?) | number | Position in range closest to `p`. |

#### Ring (internal, paths.ts) — [P]
*Serves:* G-2
| Field | Type | Notes |
|---|---|---|
| start | Vec | First point of the subpath. |
| curves | Cubic[] | Absolute cubics `[c1, c2, end]` from the previous end. Every segment kind is converted to cubic. |
| closed | boolean | True if the subpath ended in `Z`. |

#### MatchOptions / SampledPathOptions — [D]
*Serves:* G-2, G-3
| Field | Type | Notes |
|---|---|---|
| MatchOptions.precision | number | Default `MATCH_PRECISION`. |
| SampledPathOptions.duration | Seconds | Required, finite, positive. |
| .step | Seconds | Sample spacing before simplifying. Default `SAMPLE_STEP`. |
| .tolerance | number | px, required, `>= 0`. Max distance a point of the replay may stray from its sample. |
| .precision | number | Output decimals, default `SAMPLED_PRECISION`. |
| .slack | (x, y) => number | Extra px a point may stray, by where it sits in a sample. Default none. |

#### FontOptions / Font — [D]
*Serves:* G-1, G-2, G-6
| Field | Type | Notes |
|---|---|---|
| FontOptions.family | string | Default: name id 16 then 1 (Windows English, then any Windows, then Mac Roman) for TTF/OTF; `font-<fnv1a base36>` for WOFF/WOFF2. |
| .weight | number | Default OS/2 `usWeightClass`, else 400; must be 1..1000. |
| .style | `"normal"\|"italic"` | Default from OS/2 fsSelection bits 0 or 9, else head macStyle bit 1. |
| .fallback | string[] | Default `["monospace"]` if post `isFixedPitch`, else `["sans-serif"]`. |
| .subset | boolean | Default true. Cut embed to used glyphs. Applies to TrueType (glyf) outlines only. |
| .ligatures | boolean | Default true. False: one glyph per character, kerning only, and a subset carries no layout lookups. |
| Font.format | `"ttf"\|"otf"\|"woff"\|"woff2"` | Sniffed from the first four bytes. |
| Font.href | `` `data:${string}` `` | Whole file as a base64 data URI with the format's MIME type. |
| Font.bytes | number | `href.length`, what each embed costs. |
| Font.metrics | FontMetrics | `unitsPerEm`, `ascent`, `descent` (positive), `lineGap`, optional `capHeight`/`xHeight` (OS/2 version 2 or later). Ascent, descent and line gap are in em. |
| (private) #sfnt, #bytes, #typesetter, #embeds | | Parsed tables (TTF/OTF only), lazy shaper, cache of cut data URIs by text key. |

#### FontFamily — [D]
*Serves:* G-2
| Field | Type | Notes |
|---|---|---|
| name | string | The first face's family. |
| faces | Font[] | One per (weight, style) slot. |
| fallback | string[] | The first face's fallback. |
| face(weight=400, style="normal") | Font | The face the browser would pick (CSS font matching). |

#### TextPath / GlyphPath / PathOptions — [D]
*Serves:* G-2, G-8
| Field | Type | Notes |
|---|---|---|
| PathOptions.size | number | px, required, positive. |
| .x, .y | number | Left end of the baseline. Default 0, 0. Must be finite. |
| GlyphPath.char | string | One character, or several for a ligature. |
| .d | string | Path data in scene coordinates, y down. Empty for a space. |
| .x, .advance | number | Left edge and width of the glyph's advance box. |
| TextPath.d | string | All glyphs joined. |
| .width | number | Sum of advances. |
| .glyphs | GlyphPath[] | |

#### Sfnt / Typesetter (internal) — [P]
*Serves:* G-2, G-1
| Field | Type | Notes |
|---|---|---|
| Sfnt.view | DataView | Over the file bytes. |
| Sfnt.tables, lengths | Map<tag, number> | Table offset and length. Bounds-checked at parse. |
| Typesetter.layoutGlyphs(text) | Placed[] | `{glyph, chars, advance}` in font units, ligatures (GSUB type 4 from `liga`/`clig`/`rlig`) and pair kerning included. |
| .glyph(char) | number | cmap lookup (format 12 before format 4); 0 if absent. |
| .kern(l, r) | number | GPOS type 2 (`kern`) sum, else legacy `kern` table format 0. |
| .beyond(runs) | boolean | True if a default-on lookup the typesetter does not apply could act on the runs. Errs toward yes. |

#### StrokeFont — [D]
*Serves:* G-8, G-2
| Field | Type | Notes |
|---|---|---|
| family | string | `font-family`, else `<font id>`, else `"stroke font"`. |
| unitsPerEm | number | Default 1000. |
| has(char) | boolean | Glyph present with a one-character `unicode`. |
| measure(text, size) | number | Sum of advances; unknown characters take the font's default advance. |
| path(text, PathOptions) | TextPath | Centerlines, smoothed, y down. |

#### Tool — [D]
*Serves:* G-8
| Field | Type | Notes |
|---|---|---|
| width(t, s, angle) | number | Mark width in px at fraction `t` of a stroke, `s` px along it, travelling at `angle` radians. |
| drift?(s) | number | Sideways wander in px. |
| size | number | Widest the tool draws; sizes the reveal mask. |

#### InkProps — [D]
*Serves:* G-8, G-2
| Field | Type | Notes |
|---|---|---|
| d | string | Centerline path data. |
| tool | Tool | |
| fill, opacity, class | | Passed to the `<use>` (still) or `<g>` (drawing). |
| draw | Span | Ink in along the path over `{at, over}`. |
| ease | Ease | Default `ease.inOut`. |
| animation | Stack<"x"\|"y"\|"scale"\|"rotate"\|"opacity"> | Moves the whole mark. |

#### VoxelBlock / VoxelScene / VoxelCamera / VoxelSkin / VoxelTexture — [D]
*Serves:* G-8, G-2, G-7
| Field | Type | Notes |
|---|---|---|
| VoxelBlock.at | Vec3 | Whole cell, y up; the cube spans `at` to `at + 1`. |
| .skin | VoxelSkin | One texture, or `{side, top?, north?, south?, east?, west?}`; missing faces fall back to `side`. |
| .from, .to | Seconds | Visible from `from` (default 0) until `to` (default never). Own the block's opacity. |
| .animation | Stack<TagChannels<"use"> minus opacity> | Moves the block's `<use>`. |
| VoxelScene.camera, .blocks | | Blocks sharing a cell draw in given order. |
| VoxelCamera.yaw, pitch, unit | degrees, degrees, px | Yaw about y (45 looks from +x +z); pitch in (0, 90); unit px per block edge. |
| VoxelCamera.project(p) | Vec3 => Point | Linear orthographic projection. |
| VoxelTexture | | Pixel-art grid parsed from rows of palette keys; `null` palette entries are transparent. |

### Layout and diagrams

#### Box, Point, Size, Direction — [D]
*Serves:* G-2, G-7
| Field | Type | Notes |
|---|---|---|
| Point.x, Point.y | number | layout units are px of the scene |
| Size.w, Size.h | number | |
| Box | Point & Size | top-left origin |
| Direction | `"TB" \| "LR"` | rank axis down the page or across it |
Helpers in `layout/box.ts`: `flip` (swap x/y, w/h), `union`, `around`, `simplify` (drops repeated points and the middle of three collinear axis-aligned points), `indexing` (id → index, `unique` flag, throwing lookup). `layout/group.ts` holds `groupBy`, a Node 20-safe stand-in for `Map.groupBy`.

#### LayeredInput — [D]
*Serves:* G-2, G-4, G-8
| Field | Type | Notes |
|---|---|---|
| nodes | `({id} & Size)[]` | input order seeds left-to-right order inside a rank |
| edges | `{from, to, label?: Size}[]` | parallel and opposite edges allowed; `from === to` is a self loop |
| groups? | `{id, members: string[], label: Size}[]` | a node is in at most one group; label sits inside the box, top-left |
| direction? | Direction | default `"TB"` |
| rankGap? | number | default 48 |
| nodeGap? | number | default 36 |
| groupPad? | number | default 12 |

#### LayeredLayout — [D]
*Serves:* G-2, G-8
| Field | Type | Notes |
|---|---|---|
| nodes | `Map<id, Box>` | |
| rank | `Map<id, number>` | 0-based; backward edges do not change it |
| edges | `{from, to, points: Point[], label?: Box}[]` | same order as input edges; `points` orthogonal, from `from`'s border to `to`'s border |
| groups | `Map<id, Box>` | |
| bounds | Box | union of nodes, groups, edge points, labels |

#### Vertex (internal to layered) — [D]
*Serves:* G-2
| Field | Type | Notes |
|---|---|---|
| node? | number | input node index; absent for a dummy |
| rank, w, h, group | number | dummies have w = h = 0 and inherit a group only when both ends share it |
| up, down, ins, outs | number[] | neighbours and segment ids between ranks |
| anchor? | number | a backward edge's dummy beside its end node, in that node's rank |
| back? | number | the reversed edge a dummy belongs to |
| outer? | `"left" \| "right"` | channel side once a backward edge is routed round the outside |
| loop | number | room on the right for a self loop and its label |

#### Crossing (layout/route.ts) — [D]
*Serves:* G-2
| Field | Type | Notes |
|---|---|---|
| id | number | segment id |
| xa, xb | number | x where it leaves the upper rank and enters the lower one |

#### TreeInput / TreeLayout — [D]
*Serves:* G-2, G-8
| Field | Type | Notes |
|---|---|---|
| nodes | `({id, parent?} & Size)[]` | exactly one node has no parent; sibling order = input order |
| direction?, levelGap?, siblingGap? | Direction, number, number | defaults TB, 40, 24 |
| TreeLayout.nodes | `Map<id, Box>` | |
| TreeLayout.parent | `Map<id, id>` | |
| TreeLayout.order | `id[]` | breadth-first, siblings in input order |
| TreeLayout.edges | `{from, to, points}[]` | one per child, in breadth-first order of the child |
| TreeLayout.bounds | Box | |

#### SequenceInput / SequenceLayout — [D]
*Serves:* G-2, G-8
| Field | Type | Notes |
|---|---|---|
| actors | `({id} & Size)[]` | unique ids, at least one |
| rows | message `{kind:"message", from, to, label: Size}` or note `{kind:"note", actor, size: Size}` | one layout row each, top to bottom |
| actorGap?, rowGap? | number | defaults 32, 14 |
| SequenceLayout.heads | `Map<id, Box>` | |
| SequenceLayout.lifelines | `Map<id, [Point, Point]>` | head bottom to the bottom of the last row |
| SequenceLayout.rows | `{points, box}[]` | message: arrow points + label box; self message loops right (4 points); note: one center point + box |
| SequenceLayout.bounds | Box | |

#### LanesInput / LanesLayout — [D]
*Serves:* G-2, G-8
| Field | Type | Notes |
|---|---|---|
| lanes | `{id, label: Size}[]` | unique ids, at least one |
| spans | `{lane, from, to}[]` | seconds |
| events | `{lane, at, label?: Size}[]` | |
| links | `{from, to, at}[]` | lane to lane at a time |
| scale | number | px per second, must be > 0 |
| rowHeight?, bar? | number | defaults 56, 18 |
| LanesLayout.rows / labels | `Map<id, Box>` / `Map<id, Point>` | row includes the label column |
| LanesLayout.track | Box | x(0) to x(end), every row |
| LanesLayout.end | number | max(1, every time) |
| LanesLayout.x | `(t) => number` | column + t * scale |
| LanesLayout.spans / events / links / ticks | Box[] / `{at, label?}[]` / `[Point, Point][]` / `{t, x}[]` | input order |

#### VectorField, TraceOptions, Polyline — [D]
*Serves:* G-2, G-8
| Field | Type | Notes |
|---|---|---|
| VectorField | `(x, y) => [u, v]` | |
| TraceOptions.bounds | Box | lines end at the bounds |
| spacing, step, maxLength, minLength | number | gap between lines, integration step, length caps; shorter lines dropped |
| seeds? | Point[] | trace from exactly these points and do not fill gaps |
| Polyline.points / closed | Point[] / boolean | last point joins the first when `closed`; grid units (x over columns, y over rows) |

#### Diagram<Id> and DiagramOptions (extras/diagrams/kit.ts) — [D]
*Serves:* G-4, G-8, G-5
| Field | Type | Notes |
|---|---|---|
| Diagram.node | SvgNode | everything drawn |
| Diagram.get(id) | `Rect` | node box; for a group, lane or actor head, its box |
| Diagram.bounds | Rect | includes labels |
| DiagramOptions.theme | Base16 | default `defaultDark` |
| x, y, anchor | number, number, `"top-left" \| "center" \| Edge` | which point of `bounds` lands on x, y; default `"top-left"` at 0,0 |
| fontSize | number | default 14 |
| font | FontValue | embedded on the root and used to measure labels |
| class | string | on the root group |

#### NodeRole — [D]
*Serves:* G-8
`"task" | "input" | "output" | "tool" | "decision" | "store"`. Role picks outline shape, label box size and a base16 slot: task 0D, input 0B, output 0C, tool 08, decision 0A, store 0E. `Labelled = string | {label, role?}`; a bare string is a `task`.

#### Flowchart<N, G>, FlowchartEdge, FlowchartGroup, FlowchartOptions — [D]
*Serves:* G-4, G-8
| Field | Type | Notes |
|---|---|---|
| spec.nodes | `Record<id, Labelled>` | ids are the literal keys (`const` generic) |
| spec.groups? | `Record<id, {label, nodes: N[]}>` | node ids checked against `nodes` |
| spec.edges | `[from, to] \| [from, to, {label?}]` | ids checked against `nodes` |
| options.direction | Direction | default TB |
| options.play | `{at: Beats, step?: Seconds}` | step default 0.4 |
| result.edge(from, to) | `Point[]` | samples of the first edge from to |
| result.route(from, to) | `Point[]` | shortest directed path, polyline through each hop |
| result.layers | `{under, over}` | groups + edges under; nodes + labels over |

#### StateSpec, Transition, StateMachine<S>, Walk<S> — [D]
*Serves:* G-4, G-8, G-3
| Field | Type | Notes |
|---|---|---|
| StateSpec | string, `{label, final?}`, or `{label, final?, states, initial}` | composite has its own `initial` |
| spec.initial | key of top-level states | draws the start dot |
| spec.transitions | `[from, to] \| [from, to, label]` | ids are any nested state id (`StateIds<S>`) |
| Checked<S> | type | holds each composite's `initial` to its own states |
| StateMachine.edge(from, to) | `Point[]` | first transition from to, sampled |
| StateMachine.walk(path, {at, dwell?, speed?, token?}) | `Walk<S>` | dwell default 1, speed default 220 |
| Walk.node / spans / end | SvgNode / `Record<S, Span[]>` / Seconds | spans empty for an unvisited state |

#### SequenceMessage, Sequence<A>, SequenceOptions — [D]
*Serves:* G-4, G-8
`messages` entries: `[from, to, label]`, `[from, to, label, {reply?}]` (dashed), or `{note, text}`. `play: {at: Beats, step?}` step default 0.8. `message(i)` returns `{span, points}`.

#### TreeSpec, Tree<N> — [D]
*Serves:* G-4, G-8
Node is a string (a root) or `{label, parent?, role?}`; `parent` is typed to exclude the node's own key. `play: {at: Beats, step?}` step default 0.3. `route(from, to)` goes up to the common ancestor then down.

#### LaneSpan, LaneEvent, LaneLink, LanesOptions, Lanes<L> — [D]
*Serves:* G-4, G-8, G-3
`scale` required (px per second). `play: {at: Seconds}` (not Beats). `x(t)` is the x of lane time t. Lane time 0 plays at `play.at` on the scene timeline.

#### Curve — [D]
*Serves:* G-8
`{d: string, samples: Point[]}` from `curve(points)`; `samples` is the polyline the token/route helpers follow (9 samples per smoothed piece).

### Extras

#### Span / Seconds — [D]
*Serves:* G-3, *honest timing*
Owned by the motion core (not this area) but every extras API takes or returns it.
| Field | Type | Notes |
|---|---|---|
| at | Seconds | start on the scene timeline, must be >= 0 where checked |
| over | Seconds | length, > 0 where checked |

#### Timeline<K> — [D]
*Serves:* G-3, G-8
| Field | Type | Notes |
|---|---|---|
| [name] | Span | one per key of `durations`, in insertion order |
| duration | Seconds | `end - start` of the whole run |
| end | Seconds | when the last scene ends |
| show(name) | Motion<"opacity"> | `during(span, fade)` |
| enter(name) | Motion<"opacity"> | fade in at the scene's start and stay |

`TimelineOptions`: `at` (default 0), `gap` (0), `fade` (0.3), `pace` (1). Names `duration`, `end`, `show`, `enter` are reserved.

#### Beats — [D]
*Serves:* G-3
`Seconds | readonly Seconds[]`. A number is a start from which items follow `step` apart; a list is one non-negative, non-decreasing time per item.

#### Base16 / CodeRole — [D]
*Serves:* G-5, G-8
| Field | Type | Notes |
|---|---|---|
| base00..base0F | Color | 00-07 background to foreground, 08-0F accents. Colors may be `var(--baseNN)` strings |
| CodeRole | union of 18 names | plain muted comment punct keyword fn string number constant type variable tag red green yellow blue magenta cyan; each maps to one slot (see Structure) |

Ready-made: `defaultDark`, `defaultLight`, `tomorrowNight`, `tomorrow`, `systemLight`, `systemDark`, `solarizedDark`, `solarizedLight`, `gruvboxDark`, `gruvboxLight`.

#### Code / CodeWord / CodeMetrics — [D]
*Serves:* G-8, G-2
| Field | Type | Notes |
|---|---|---|
| node | SvgNode | optional gutter numbers, then one `<text>` per word |
| words | CodeWord[] | `{ text, line, column, x, y, color?, fontStyle?, id? }`. A word is a maximal run of non-whitespace characters; `y` is the top of its line; line and column are 1-based |
| metrics | CodeMetrics | `origin` (x of column 1), `y`, `fontSize`, `height` (= fontSize * lineHeight), `advance`, `fontFamily`, `theme` |
| lineCount, gutter, bounds | number, boolean, Rect | `bounds = lines(1, lineCount)` |
| lines/find/get/at/draw | functions | see rule queries |

Input: a string (split on `\n`) or `CodeTokens` (`CodePiece[][]`). A piece is a string, a role run `[role, text, id?]`, or a Shiki-style `{ content, color?, fontStyle? }` (`fontStyle` bit 1 italic, bit 2 bold).

#### Morphable / MorphPiece — [D]
*Serves:* G-8
`MorphPiece { text, x, y, id? }`; `Morphable<P> { words: P[]; draw(piece, animation?) }`. `Code` is a Morphable; `@svjeez/math`'s `tex()` is another.

#### Result structs — [D]
*Serves:* G-3 (they hand out times so other beats can hang on them)
| Struct | Fields |
|---|---|
| MorphResult | `node`, `spans[i]` (move into version i+1), `end` (0 for a single version) |
| TypewriterResult | `node`, `end`, `spans[i]` (line i+1 types) |
| RevealResult | `node`, `spans[k]` (block k enters), `end` |
| TerminalResult | `node`, `end`, `bounds` |
| AppWindowResult | `node`, `body` (area under the title bar) |
| FlowResult | `node`, `end` |
| Plot / Curve | `node`, `d`, `points` (drawn points in scene px, rounded to 0.1) |
| Riemann | `node`, `sums` (one per stage) |
| Line | `node`, `slope(t)` |
| Area | `node`, `value(t)` |
| Dot | `node`, `motion` (x/y), `point(t)` |
| Streamlines | `lines` (point lists in scene px), `d` |
| VectorFieldResult | `d`, `arrows` (`{ from, to, magnitude }`) |
| SlopeFieldResult / SlopeSolution | `d` / `points`, `d` |
| ContourLevel | `level`, `lines` (`{ points, closed }`), `d` |
| ContourSweep | `d` (at `from`), `animation: Motion<"d">` |

#### Moving / Sweep — [D]
*Serves:* G-3, G-7
`Sweep = Span & { from, to, ease? }`; `Moving = number | Sweep | Sweep[]`. A number holds; a sweep eases `from`→`to` over its span (default `ease.inOut`) and holds `to` afterward; a list chains them, each holding between.

#### Axes — [D]
*Serves:* G-8, G-2
`AxesOptions { x:[min,max], y:[min,max], width, height, at?, ticks?:{x?,y?}, labels?, grid?, theme?, fontSize?, font? }` returns `Axes { node, bounds, point(x,y), plot(f, opts), ...Calculus }`.

#### CameraStop / FocusStop / Marker stop — [D]
*Serves:* G-8
`CameraStop { during: Span, target: Rect | "all" }`; `FocusStop { during, target: Rect | Rect[] }`; Marker stop `{ during, target: Rect }`.

#### FlowOptions — [D]
*Serves:* G-8, G-2
`at`, `speed` (220 px/s), `over`, `style` (`dot | comet | trace | packet`), `theme`, `color`, `size`, `arrive`, `label`, `fontSize`, `font`, `ink`, `fill`, `class`, `loop`, `tail`.

### Frames, CLI, plugins and release

#### SceneOptions — [D]
*Serves:* G-3, G-5
| Field | Type | Notes |
|---|---|---|
| scale | number? | Device pixel ratio. Default 1. Must be finite and > 0. |
| colorScheme | "light" \| "dark" \| "system"? | Default "system": this machine's appearance via `systemColorScheme()`. |
| background | string? | CSS background behind the SVG. Default `Canvas`. "transparent" gives alpha. |
| executablePath | string? | Chromium/Chrome binary used instead of Playwright's. |

#### FrameTimes / FrameOptions — [D]
*Serves:* G-3
| Field | Type | Notes |
|---|---|---|
| times | Seconds[] (xor count) | Exact playback times. Each finite and >= 0. |
| count | number (xor times) | Positive integer. Frame i is at `i * duration / count`. |
| sheet | boolean \| {columns?: number} | Adds a labelled contact sheet. columns is a positive integer, default 4, capped at the frame count. |

#### Scene (open scene) — [D]
*Serves:* G-3
| Field | Type | Notes |
|---|---|---|
| width, height | number | The SVG root's numeric size in CSS px. Captures are `scale` times larger. |
| scale | number | Resolved scale. |
| duration | Seconds | `loopLength()` of the page: one loop. |
| colorScheme | "light" \| "dark" | After resolving "system". |
| capture(time) | Promise<Uint8Array> | Seeks, then PNG of `#stage`. |
| evaluate(fn, arg) | Promise<R> | Runs a serialized function in the page. |
| addScript(path) | Promise<void> | Loads a classic script file into the page. |
| close() | Promise<void> | Closes the browser. |

#### Frames / Frame — [D]
*Serves:* G-3
| Field | Type | Notes |
|---|---|---|
| frames | {time, png}[] | One per requested time, in order. |
| duration | Seconds | One loop. |
| colorScheme | "light" \| "dark" | Resolved. |
| sheet | Uint8Array? | PNG, present iff `sheet` was requested. |

#### Stage (internal) — [D]
*Serves:* G-3
| Field | Type | Notes |
|---|---|---|
| width, height, scale, colorScheme | | Validated by `resolve()` before any browser starts. |
| background | string | `options.background ?? "Canvas"`. |

#### VideoOptions / Video — [D]
*Serves:* G-3, G-1 (video for places that do not take SVG)
| Field | Type | Notes |
|---|---|---|
| format | "mp4" \| "webm" | Default "mp4". |
| codec | per format | mp4: avc, hevc, vp9, av1. webm: vp9, vp8, av1. Default is the first listed. |
| fps | number | Default 30. Finite, > 0. |
| loops | number | Default 1. Positive integer. |
| quality | "low" \| "medium" \| "high" | Default "high"; mapped to Mediabunny `QUALITY_*`. |
| background | string? | "transparent" keeps alpha in webm only. |
| (SceneOptions minus background) | | scale, colorScheme, executablePath. |
| Video.bytes, mime, format, codec | | The encoded file. |
| Video.frames | number | `max(1, round(duration * loops * fps))`. |
| Video.duration | Seconds | `frames / fps`. |
| Video.colorScheme | | Resolved. |

#### SceneModule (`?svjeez` import) — [D]
*Serves:* G-1, G-2, G-5
| Field | Type | Notes |
|---|---|---|
| src | string | `/_svjeez/<hash>.svg` in dev; the emitted asset URL in a build. |
| width, height | number | From the SVG's `viewBox`. |
| title, desc | string | XML-unescaped `<title>` and `<desc>` text, for alt text. |
| posters | {light, dark}? | WebP URLs, only for `?svjeez&posters`. |

#### SceneImage (`getScene()` result) — [D]
*Serves:* G-1, G-2
| Field | Type | Notes |
|---|---|---|
| src, width, height, title, desc, svg | | As above plus the SVG text. |
| gzip | number | `gzipSync(svg).length`. |
| posters | Record<"light"\|"dark", string>? | `ROUTE + <hash>-<variant>-<scheme>.webp`. |

#### Assets (shared registry) — [D]
*Serves:* G-2
| Field | Type | Notes |
|---|---|---|
| files | Map<string, Asset{type, bytes()}> | Keyed by file name; filled by `getScene()`, read by the dev middleware and the build. Stored on `globalThis[Symbol.for("svjeez.vite.assets")]`, because the plugin and the scene environment load the module through different graphs. |
| cache | URL? | Poster disk cache dir; set by the plugin. |
| close | () => Promise<void> | Closes the poster encoder's browser. |

#### PosterOptions — [D]
*Serves:* G-5
| Field | Type | Notes |
|---|---|---|
| scale | number | Default 1. |
| quality | number | WebP quality 0..1, default 0.8. |
| background | string | Default `Canvas`. |

#### Release `Package` / `Pending` — [D]
*Serves:* G-6 (small, independently versioned packages)
| Field | Type | Notes |
|---|---|---|
| Package.dir | path | A workspace folder under `packages/`. Included iff not private, or private with a `build:package` script. |
| Package.out | path | What npm packs: `dir`, or `dir/package-dist` for a private workspace package. |
| Pending.tag | string | `v<version>` for `svjeez`; `<name>@<version>` for every other package. |
| Pending.npm / github | boolean | The version is not on npm / has no GitHub release. |

### Live editor

#### State — [D]
*Serves:* G-10, G-4
The one value the store holds (`editor.ts`). Everything but `text`, `clock`, `selected` and `history` is derived from `text` or from compile results.

| Field | Type | Notes |
|---|---|---|
| text | string | The file. Every edit is an edit to this text. |
| source | Source | `parse(text)`. Re-derived on every text change. |
| values | readonly Value[] | `valuesOf(source, schema)`, source order. |
| lines | readonly Line[] | `linesOf(source, isEditable)`; each editable literal is a piece of its own. |
| schema | Schema | Params declared by the newest compile of the current text. `{}` before the first. |
| selected | string \| null | A value key. Dropped to null by `read` when the key no longer names a value. |
| picture | Picture \| null | What is on screen. Null until the first show (or the `first` build picture). |
| compiled | CompiledFile \| null | Newest good compile; runs ahead of `picture` while it decodes. |
| grips | `{[key]: Grip}` | Handles by value key. |
| error | SourceError \| null | Why the newest compile failed; cleared by the next success. |
| clock | Clock | Playing (with `origin` page-ms) or paused (with `at` seconds). Starts playing at `now`. |
| history | `{past: string[], future: string[]}` | Whole-file snapshots. |

#### Clock — [D]
*Serves:* G-10, G-3
| Field | Type | Notes |
|---|---|---|
| playing: true, origin | number (page ms) | Clock read 0 at `origin`. |
| playing: false, at | number (s) | Held position. |

#### Picture / CompiledFile — [D]
*Serves:* G-10
| Field | Type | Notes |
|---|---|---|
| url | string | Image URL (blob URL from a compile, or the build-time `src`). |
| scene | SceneSize | width, height, duration, title. |
| svg, text | string? | Present only for pictures made by a compile: the file and the source that made it. `CompiledFile` is `Required<Omit<Picture,"url">>`. |

#### Grip (extends Move) — [D]
*Serves:* G-10
| Field | Type | Notes |
|---|---|---|
| at | Point | Scene-unit position of the handle when the value was `from`. |
| way | Point | Scene units moved per unit of the value. |
| from | number | The value at which `at` was measured/declared. |
| declared | boolean | True when from the scene's `handles` export; false when probed. |

#### Literal / Value — [D]
*Serves:* G-10, G-4
`Literal` (`source.ts`) is what the parser finds; `Value` (`controls.ts`) is a literal plus how a control treats it.
| Field | Type | Notes |
|---|---|---|
| key (Literal, Value) | string | `params.<key>[.<option>]`, else dotted path from a top-level const (`legs.1.over`), else `<scope>#<n>`. Unique per file. |
| kind (Literal) | number \| color \| string \| ease | `ease` also carries `name`: `linear\|in\|out\|inOut\|pop\|bezier`. |
| range, text, role, path?, param? | Range, string, Role, PathStep[], `{key, option?}` | `text` is as written, sign and quotes included. |
| kind (Value) | number \| color \| ease \| choice | A `string` literal is a Value only as `choice`. |
| label | string | Param label, else param key, else attribute/property/const name, else `callee()`. |
| param (number) | NumberParam | min, max, step, unit?, label, value. |
| options (choice) | readonly string[] | From the declared choice param. |

#### Source — [D]
*Serves:* G-10
`parse(text)`: `text, tree, literals, elements (key = start line), consts (name, range, uses), runs (highlight), lineAt, lineStart`.

#### Msg / Input / Cmd — [D]
*Serves:* G-10. See Interface.

#### Effects — [D]
*Serves:* G-2, G-10
The host seam: `compile(text) -> Promise<Compiled>` (optional `.stop()`), `show(svg, at, playing) -> Promise<url>`, `release(url)`, `measure(before, after, by, at) -> Promise<Move|undefined>`, `now() -> ms`. Defaults: lazy worker compiler, `showInBrowser`, `URL.revokeObjectURL`, `measureMove`, `performance.now`.

#### Compiled / SourceError / SceneStats — [D]
*Serves:* G-4, G-9
| Field | Type | Notes |
|---|---|---|
| ok:true | svg, stats{bytes,gzip,keyframes,scriptBytes}, scene?, params?, handles?, ms | `scene` only from a compile of source (read from the scene's own `render` call). |
| ok:false | error{kind: syntax\|runtime, message, line?, column?, fix?}, ms | `fix` from the skill's runtime-error table. |

#### Editor (runtime handle) — [D]
*Serves:* G-10: `getState`, `subscribe`, `send(Input)`, `destroy`.

#### Runtime-private state of createEditor — [P]
*Serves:* G-10
| Field | Type | Notes |
|---|---|---|
| listeners | Set | Subscribers. |
| made | Set<string> | URLs this editor created, the only ones it may release. |
| waiting | Cmd[] \| null | Commands held while nothing listens; null while someone does. |
| alive | boolean | False after destroy. |
| epoch | number | Bumped on each pause so a compile/probe cut short is re-queued, not reported. |

### Charts, code, fonts, icons and Mermaid

#### ChartOptions / XScale / YScale — [D]
*Serves:* G-4, G-8, G-6
| Field | Type | Notes |
|---|---|---|
| width, height | number | Plot area in px, inside the axes. Positive and finite. |
| at | Point | Top-left of plot area. Default `{x:0,y:0}`. |
| x | `BandX \| LinearX` | `BandX {kind:"band", domain:string[], padding?, format?}`; `LinearX {kind:"linear", domain?, ticks?, format?}`. |
| y | YScale `{domain?, ticks?, zero?, format?}` | Default `{}`. |
| data | `Datum[]` | `[x,y]` pairs. Only needed to fit a domain left out. Default `[]`. |
| grid | boolean | Default false. |
| theme | Base16 | Default `defaultDark`. Axis lines `comment`, labels `muted`. |
| fontSize, font | number, FontAttr | Default fontSize 12. |

#### Frame — [P]
*Serves:* G-3, G-7
Internal struct that carries the resolved scales to the series builder (`series.ts`).
| Field | Type | Notes |
|---|---|---|
| bounds | Rect | Plot area. |
| theme, fontSize, font | | Copied from options. |
| bandwidth | number | 0 on a linear scale. |
| categories | `string[] \| undefined` | Band domain; undefined on linear. |
| xDomain | `[n,n] \| undefined` | Niced x domain; undefined on band. |
| yDomain | `[n,n]` | Niced y domain. |
| x(), y(), yFormat() | functions | Scene-px scale functions. |
| nextColor() | () => Color | Closure counter over `ACCENTS`; one counter per chart. |

#### Chart — [D]
*Serves:* G-8, G-4
| Field | Type | Notes |
|---|---|---|
| node | SvgNode | Axes, ticks, labels, grid. Static. |
| bounds | Rect | Plot area. |
| x(v), y(v), bandwidth | | Scene-px placement for annotations. |
| bars | `(Record<string,number>, BarsOptions) => Bars` | Present on band charts only (type `never` otherwise); throws at runtime on linear. |
| line, area | `(Datum[], opts) => Line / Area` | |

#### Timing / SeriesOptions / BarsOptions / LineOptions / AreaOptions — [D]
*Serves:* G-3, G-4
| Field | Type | Notes |
|---|---|---|
| at, over | seconds | `at >= 0` finite; `over > 0` finite. Defaults `at` 0; `over` BAR_OVER / LINE_OVER. |
| color | Color | Default next theme accent. |
| stagger, group, radius, values | bars | `group {index,count}`; `values` true uses y format or a function. |
| curve, dots, strokeWidth, label | line | `curve` linear/monotone/step; `dots` true = radius DOT_RADIUS. |
| baseline, line | area | `baseline` default 0 (clamped into y domain); `line:false` leaves the fill unstroked. |

#### Bars / Bar / Line / Area — [D]
*Serves:* G-3, G-8
| Field | Type | Notes |
|---|---|---|
| node | SvgNode | |
| bars[] | `{key, value, bounds: Rect}` | Resting geometry in scene px. |
| d, points | string, `Point[]` | Line: path data and the placed points. |
| fill | string | Area only: the filled shape's path data. |
| end | seconds | When the series finishes; next series starts here. |

#### Highlighted / HighlightOptions / Lang — [D]
*Serves:* G-2, G-8, G-5
| Field | Type | Notes |
|---|---|---|
| Highlighted | `(string \| CodeRun)[][]` | One array per source line; bare string = plain, `[role, text]` otherwise. |
| tabSize | number | Whole, >= 1. Default TAB_SIZE. |
| grammars | `(LanguageRegistration \| LanguageRegistration[])[]` | Extra Shiki grammars; each object loads once (WeakSet). |
| Lang | `DefaultLang \| string` | Bundled name, alias, or the name of a passed grammar. |

#### SCOPES table — [D]
*Serves:* G-5, G-8
One `Record<scope-prefix, CodeRole>`; the longest matching prefix wins; unmatched scopes are `plain`. Roles used: comment, punct, keyword, number, constant, string, variable, fn, type, tag, red, green, yellow, cyan (plus `plain`).

#### GoogleOptions / GoogleFace — [D]
*Serves:* G-1, G-7, G-4
| Field | Type | Notes |
|---|---|---|
| weight | number | Default 400. |
| style | FontStyle | `"normal"` default or `"italic"`. |
| (rest) | FontOptions minus family/weight/style | Passed to svjeez `font()`. |
| GoogleFace | `{weight?, style?}` | Entry of `google.family` (a bare number is a weight at normal style). |

#### Icon — [D]
*Serves:* G-8, G-1, G-6
| Field | Type | Notes |
|---|---|---|
| grid | number | Side of the square viewBox from origin. 24 for both sets. |
| kind | `"stroke" \| "fill"` | Outline to stroke vs shape to fill. |
| paths | string[] | One path per drawn piece, source order, each can animate alone. |

#### Generator Source / Parsed — [P]
*Serves:* G-7, G-6
Internal to `icons/scripts/generate.ts`: `Source {pkg, out, folders[{dir, kind, suffix}]}` (two sources: `@tabler/icons` outline+filled, `lucide-static` stroke) and `Parsed {icon, mixed}` where `mixed` marks an outline icon holding a solid piece.

#### MermaidDoc (FlowchartDoc / SequenceDoc / StateDoc) — [D]
*Serves:* G-4, G-8, G-9
| Field | Type | Notes |
|---|---|---|
| FlowchartDoc | `{kind:"flowchart", direction: TD\|TB\|BT\|LR\|RL, nodes[{id,label,form}], edges[{from,to,label?,line: solid\|dotted\|thick, arrow}], subgraphs[{id,title,nodes}]}` | `form` in rect, round, stadium, diamond, circle, subroutine, cylinder. |
| SequenceDoc | `{kind:"sequence", participants[{id,label,role: participant\|actor}], items[message \| note]}` | message `{from,to,text,line: solid\|dashed, head: filled\|none\|cross\|async}`; note `{actor,text}`. |
| StateDoc | `{kind:"state", direction?: TB\|LR, initial, states[{id,label,final,inner?{initial,states}}], transitions[{from,to,label?}]}` | `[*]` ends live in `initial`/`final`, not in `transitions`. |
| MermaidDiagram | svjeez diagram `& {kind, doc}` | Narrow on `kind`. |

#### Line (parser) / MermaidSyntaxError — [D]
*Serves:* G-4, G-9
| Field | Type | Notes |
|---|---|---|
| Line | `{line:number, text:string}` | Meaningful line only; `line` counts from 1 in the original text. |
| MermaidSyntaxError | `Error & {line, source}` | Message `Mermaid syntax error on line N ("source"): problem`. |

### Maps and math

#### LonLat — [D]
*Serves:* G-8
| Field | Type | Notes |
|---|---|---|
| (tuple) | `readonly [lon, lat]` | Degrees, longitude first. `GeoData = Topology \| FeatureCollection \| Feature`. |

#### ProjectOptions — [D]
*Serves:* G-8, G-4
| Field | Type | Notes |
|---|---|---|
| frame | `Rect` | Where the map sits, px. Required. |
| projection | `GeoProjection` | Default `geoNaturalEarth1()`. Fitted to `frame` unless `fit` is false (mutates the projection passed in). |
| fit | `"regions" \| "sphere" \| GeoPermissibleObjects \| false` | Default `"regions"`. |
| object | `string` | TopoJSON object name. Default the first object. |
| filter | `(Feature) => boolean` | Applied before fitting. |
| tolerance | `number` px | Default 0.5. |

#### Region — [D]
*Serves:* G-8
| Field | Type | Notes |
|---|---|---|
| id | `string` | `String(feature.id ?? properties.name ?? index)`. |
| properties | `GeoJsonProperties` | |
| feature | `Feature` | Whole feature, every piece. |
| d | `string` | Path data for the whole region. |
| centroid | `Point` | Of the largest piece by spherical area. |
| bounds | `Rect` | Of the largest piece. |

#### Dot — [D]
*Serves:* G-8
| Field | Type | Notes |
|---|---|---|
| at | `LonLat` | |
| id, properties | | Of the feature containing the dot. |
| point | `Point \| undefined` | Undefined when the projection clips it (far side of a globe). |

#### GeoMap — [D]
*Serves:* G-8, G-2
| Field | Type | Notes |
|---|---|---|
| frame, projection | `Rect`, `GeoProjection` | |
| regions | `Region[]` | Kept features that produced non-empty path data. |
| land | `string` | TopoJSON: `merge` of kept polygons (shared borders gone). GeoJSON: path of the collection. |
| lines | `string` | TopoJSON: `mesh` of kept geometries (each border once). GeoJSON: path of the collection. |
| sphere | `string` | |
| region/path/graticule/point/dots/route/line/bounds | methods | See Interface. |

#### Writer — [D]
*Serves:* G-1, G-7
| Field | Type | Notes |
|---|---|---|
| #min | `tolerance * 10` | Tenths of a px. |
| #line, #tail, #closed | working ring | `#tail` is the last point dropped by tolerance, re-added on open lines. |
A d3-geo path context that writes compact path data (first `M` absolute, then relative `l`, implicit separators, leading zero stripped, closed rings end `z`).

#### ColorScale — [D]
*Serves:* G-8, G-7
| Field | Type | Notes |
|---|---|---|
| (call) | `(value) => Hex` | Clamps to the end classes, NaN gives `empty`. |
| domain | `number[]` | `[low, high]` or `[low, mid, high]`. |
| colors | `Hex[]` | `steps` class colors, OKLab blend of the ramp sampled at class centers. |
| edges | `number[]` | `steps + 1` class boundaries. |
| empty | `Hex` | Default `#8a919b`. |
| index(value) | `number` | 0..steps-1, or -1 for NaN. |

#### ChoroplethOptions / Choropleth — [D]
*Serves:* G-8, G-3
| Field | Type | Notes |
|---|---|---|
| scale | `ColorScale` | |
| at | `Seconds \| Seconds[]` | One time per value in a list. Default 0. |
| over | `Seconds` | Default 0.8, cut short between two times. |
| ease | `Ease` | Default `ease.inOut`. |
| lines, lineWidth, class | | Border overlay; width default 0.4. |
| result.node / unmatched / groups | | `unmatched` keys with no region; `groups` animated paths. |

#### MorphOptions, Morphed, Bubble, Bar — [D]
*Serves:* G-8, G-3
| Field | Type | Notes |
|---|---|---|
| at, over, ease, stagger | | `over` default 1.2, `stagger` default 0. |
| fill | `Color \| (region, value) => Color` | Default `#6b7280`. |
| detail | px | Default 2.5. |
| CartogramOptions.coverage, gap | | Defaults 0.3 and 1 px. |
| BarsOptions.frame, order, top, gap, max | | `order` default `"desc"`, `top` 12, `gap` a fifth of a slot. |
| Morphed.node / rest | | `rest` is path data of regions that do not become a shape. |
| Bubble | `{region, value, x, y, r}` | |
| Bar | `{region, value, rect}` | |

#### TrafficLine / TrafficOptions / Traffic — [D]
*Serves:* G-8, G-7
| Field | Type | Notes |
|---|---|---|
| TrafficLine | `{points, weight?, color?}` | A bare point list is weight 1. |
| during, rate, seed, back | `Span`, per second, int, 0..1 | `seed` default 1, `back` default 0. Plus `FlowOptions` minus `at/over/label/fill/ink`. |
| Traffic | `{node, count, end}` | |

#### GlobeOptions / Globe / Turning / Riding / Spin — [D]
*Serves:* G-8, G-2, G-3
| Field | Type | Notes |
|---|---|---|
| frame | `Rect` | Globe is the largest circle centered in it. |
| tilt | degrees | Latitude at the middle. Default 0. Ignored for a function `spin`. |
| spin | `Spin \| (t) => LonLat` | `Spin = {from, to, at?, over}`, longitude at middle. |
| duration | `Seconds` | Default end of `spin`; required for function spin. |
| simplify, step, tolerance | deg, deg, px | Defaults 0.6, 6, 1. |
| Turning | `{d: PathData, animation: Motion<"d">}` | Spreadable onto `<path>`. |
| Riding | `{animation: Motion<"x"\|"y"\|"opacity">}` | |
| Globe | center, radius, duration, sphere, facing, locate, land, borders, path, graticule, circle, route, night, terminator, place | |

#### Reprojected / Reprojection / ReprojectOptions — [D]
*Serves:* G-8
| Field | Type | Notes |
|---|---|---|
| regions | `{id, properties, d: PathData[]}[]` | `d[i]` is under `projections[i]`, same commands in every one. |
| land | `PathData[]` | |
| simplify, step | degrees | Defaults 0.3, 2. |

#### TrueSizeOptions, NightfallOptions — [D]
*Serves:* G-8
| Field | Type | Notes |
|---|---|---|
| TrueSize at, over, duration, ease, tolerance, step | | `at` 0, `duration` default `at + over`, `ease` `(u)=>number` default cubic in/out, tolerance 0.5, step 1 degree. |
| Nightfall duration, tolerance, columns | | Tolerance 0.5, columns 73. |

#### TexOptions / Glyph / Tex — [D]
*Serves:* G-8, G-1, G-2
| Field | Type | Notes |
|---|---|---|
| x, y | px | Top-left of box (or the `anchor` point). Default 0. |
| fontSize | px/em | Default 32. |
| theme, color | | `plain` slot of theme (default `defaultDark`); `color` overrides. |
| display | boolean | Default true. |
| anchor | `[fx, fy]` | Default `[0, 0]`. |
| Glyph.text | `string` | `"${key}@${size}"`, the morph pairing key. |
| Glyph.char, size, d, matrix, fill?, id?, bounds, x, y | | `d` in glyph units (1000/em); `matrix` glyph units to scene px; `x,y` = matrix translation. |
| Tex | node, bounds, width, height, words, get, find, write, draw | |

#### Mark / Compiled (internal) — [D]
*Serves:* G-2
| Field | Type | Notes |
|---|---|---|
| Mark.char, key, d, matrix, size, fill?, id? | | `key` is the char, or `rect:WxH` / `line:DXxDY` for a bar. `size` = matrix[0]. |
| Compiled.box, marks | | `box` is MathJax's viewBox. |

#### PlaneOptions / Plane / Step — [D]
*Serves:* G-8, G-2
| Field | Type | Notes |
|---|---|---|
| origin, unit | `Point`, px/unit | Required, `unit > 0`. |
| extent | `number \| {x: Vec2, y: Vec2}` | Default 10. |
| step | units | Default 1. |
| Step.place | `{kind:"matrix", m} \| {kind:"function", f}` | Plus `at, over, ease` (default `ease.inOut`). |
| PlaneMatrix | `[[a,b,e?],[c,d,f?]]` | By rows; stored as SVG `[a,c,b,d,e,f]`. |
Plane is immutable: `apply/applyFunction/reset` return a new plane with one more step.

#### Move / Warp (internal) — [D]
*Serves:* G-2
| Field | Type | Notes |
|---|---|---|
| Move | `{place, at, over, ease}` | |
| Warp | `rings, path, head, ride` | Sampled-outline drawing used once any step is a function. |

#### Construction (GeoPoint, GeoLine, GeoCircle, Pace, Part, World) — [D]
*Serves:* G-8, G-3
| Field | Type | Notes |
|---|---|---|
| GeoPoint | `{kind:"point", x, y, label?}` | Units, y up. |
| GeoLine | `{kind:"line", a, b, endless, extend:[past a, past b]}` | `segment` is not endless; `line`, `parallel`, `perpendicular`, bisectors are. |
| GeoCircle | `{kind:"circle", center, radius}` | |
| Pace | point, line, circle, angle, fill, label, gap, step | Seconds. |
| Part | `{aid, settle?, render(world)}` | Render deferred to `g.node` so labels see the whole figure. |
| World | points, lines, circles, polygons, px, center | center = mean of all points. |
| cursor / end / batch | internal timeline state | See construct timing rule. |

#### Fourier / FourierTerm / EpicyclesOptions / Epicycles — [D]
*Serves:* G-8, G-2
| Field | Type | Notes |
|---|---|---|
| FourierTerm | `{k, r, phase}` | Turns `k` times per loop. |
| Fourier | `{mean, terms, points}` | `terms` largest first. |
| FourierOptions | samples (even, >=4, default 1024), terms (1..samples-1) | |
| EpicyclesOptions | at, over, terms (80), circles (24), center, size, theme, color, fill, strokeWidth (2), fade (0.6) | |
| Epicycles | `{node, end, d}` | `end = at + over + fade`. |
| EpicyclesSource | path string, `Outline`, list of them, or `Point[]` | `Outline = {d, matrix?}`. |

#### DeriveStep / DeriveOptions / Derivation — [D]
*Serves:* G-8
| Field | Type | Notes |
|---|---|---|
| DeriveStep | `{tex, note?}` | A bare string is `{tex}`. |
| at, every, over, x, y, fontSize, align, stack, lineHeight, theme, color | | every 2.5, over 0.9, fontSize 36, align `"="`, lineHeight 1.9 x fontSize. |
| Derivation | `{node, end, lines, bounds}` | |

#### CounterOptions / Counter / CounterValue — [D]
*Serves:* G-8
| Field | Type | Notes |
|---|---|---|
| CounterValue | `{at, value}` | Held until the next. |
| x, y, fontSize (32), digits (0), theme, color, anchor, roll (0), duration, step (0.1) | | `duration` required with a function. |
| Counter | `{node, width, height}` | |

## §2 Relations and invariants

These hold across packages. Each area's own invariants follow.

- The `svjeez` package has no `dependencies`. A feature that needs third-party code is a separate
  `@svjeez/*` package that runs at compile time. — [D] — Serves G-6
- Library code uses no API newer than Node 20. — [D] — Serves G-6
- Only `frames.ts`, `cli.ts` and `page.ts` in `svjeez` touch a browser. — [D] — Serves G-2, G-6
- `@svjeez/fonts` is the only package that touches the network. — [D] — Serves G-1, G-7
- Every published package shares one version. — [D]
- Every runtime error quoted in the skill's error table exists in `svjeez`'s source. — [D] —
  Serves G-9
- `examples/dist/` is exactly what the examples compile to. — [D] — Serves G-7

### Timeline and motion

- A `Motion` is immutable: every method returns a new motion and the receiver is unchanged — [D] — R-4
- Every number reaching a step (`at`, `wait`, `over`, `loop` period, step values) is finite — [D] — R-1
- Within one motion, no two steps that share a lane overlap in time — [D] — R-5
- A looping motion never has a step that ends after its period — [D] — R-6
- Every key of `initial` and of a step is a channel in `CHANNELS` or a declared property — [P] — R-3 (steps) and Q-2 (initial is not checked)
- The same `Property` key declared twice with the same declaration is the same key; with a different declaration it throws — [D] — R-28
- `random(seed)` returns the same stream for the same seed on every run and runtime — [D] — R-17
- `wiggle`, `shake`, `sampled`, `sample` and `valueAt` are pure functions of their arguments: same input, same motion/values — [D] — R-16, R-21, R-24
- Every sample frame of one `sampled()` call has the same set of finite-number keys — [D] — R-19
- A schema is plain data (clonable across `postMessage`); `defaults(schema)` returns exactly each param's declared value — [D] — R-36
- `fit(p, v)` is always within `[p.min, p.max]` and on `p`'s step grid — [D] — R-37
- Only `opacity x y scale rotate blur` stack (`composition: "nest"`); every other channel is one motion per element — [D] — R-27
- The channel table is the only place that says which tag carries which channel — [D] — R-27

### Compile and output

- Same scene source and options produce the same bytes: ids, class names, keyframe names and custom property names number from 1 per render in first-use order, and nothing reads a clock or a random source — [D] — R-39
- Two renders of one tree never share ids through a ref: ids live in per-render `State`, not on the `Ref` — [P] — R-43
- The output of `render()` always passes `validateSvg` with zero errors, or `render()` throws — [D] — R-45
- With a non-empty `prefix`, no generated identifier equals one generated without it, and two prefixed scenes on one page share none — [D] — R-46
- A def is emitted only if the walked tree references it — [D] — R-47
- Every duration emitted is the scene-time length divided by `playbackRate`; a different rate changes only those numbers — [D] — R-70
- Output contains no script and no external fetch that the compiler wrote; images and fonts are `data:` URIs — [D] — R-87, R-84
- `animation`, `once` and `motions` never reach the serialized output — [P] — R-78
- `data-source` is written only when `sources: true`; with it stripped, the output equals the output without it — [D] — R-79
- A scene built with `el` or with arrays renders the same bytes as its JSX twin — [D] — R-75, R-76
- Stylesheet text never ends the `<style>` element early: `]]>` inside it is split across CDATA sections — [D] — R-74
- Output attribute values escape `&`, `<`, `>` and `"`; text nodes escape `&`, `<`, `>` — [P] — R-74

### Geometry, fonts, ink and voxels

- Every function that writes path data (`polylinePath`, `Spline.path`, `Spline.d`, `matchPaths`, `sampledPath`, `Font.path`, `strokeFont().path`, `inkPath`) starts it with `M`. — [D] — R-98
- Same input gives the same output bytes: no `Math.random`, no clock; `tool.*` noise is a seeded hash; ids and numbers print through `num`. — [D] — R-130
- `matchPaths` results for any inputs have identical command sequences, so any two can be morphed. — [D] — R-104
- `sampledPath` never emits a key set whose replay strays from any sample by more than `tolerance` (plus slack). — [D] — R-109
- `resample` returns exactly `count` points, the first and last equal to the input's first and last. — [D] — R-97
- A `Spline` passes through every input point at integer positions, and positions outside `[0, legs]` hold the end points. — [D] — R-100
- `Font.measure(text, size)` equals the sum of `Font.path(text, {size}).glyphs[].advance`. — [D] — R-113
- An embedded subset font measures every text it was cut for exactly as the whole font does. — [D] — R-117
- A subset is never made for text that forms ligatures or could meet another default lookup (when `ligatures` is true). — [D] — R-118
- Parsing a font never reads outside the file: table directory bounds are checked, composite nesting is bounded by `MAX_COMPOSITE_DEPTH` and total components by `MAX_COMPONENTS`. — [D] — R-111, R-114
- A voxel block that is hidden behind opaque, unanimated neighbours for its whole lifetime is not emitted. — [D] — R-128
- Painting order is back to front by `facing . at`; blocks of equal depth keep array order. — [D] — R-126
- Nothing animated is placed inside a `<defs>` entry: voxel symbols and ink symbols are static; animation sits on `<use>`. — [D] — R-129
- One symbol per (tool, path) pair in ink and per distinct visible-face texture tuple in voxel scenes, however many uses. — [D] — R-124, R-129
- A `Font` or `FontFamily` is never coerced to a string. — [D] — R-116

### Layout and diagrams

- `src/layout` imports only siblings (`./name`), never anything outside the folder. — [D] — R-132
- No two nodes of a `layered` layout overlap, in TB or LR. — [D] — R-135
- A `layered` group box overlaps exactly its members' boxes and no other node. — [D] — R-136
- Every `layered` edge starts on the border of `from`, ends on the border of `to`, and moves only along x or y between points. — [D] — R-137
- Every edge goes forward in rank: for each non-loop edge, the lower-ranked node ends before the higher-ranked node starts along the direction. — [D] — R-134
- No two `layered` edges share a stretch of line except the final approach into one shared port; no edge segment runs through a node. — [D] — R-138
- A `layered` edge label overlaps no node, no other label and no other edge's segment (when a clear spot exists). — [D] — R-141
- In a `tree` layout a parent is centered over its first and last child; no two boxes overlap; siblings keep input order. — [D] — R-144
- A `sequence` message label lies strictly between the lifelines it spans; a self-message label clears the next lifeline. — [D] — R-146
- Rows of a `sequence` layout run top to bottom in input order; every lifeline extends below the last row. — [D] — R-147
- `lanes` time maps linearly to x: `x(t) = column + t * scale`. — [D] — R-149
- `bounds` of a diagram starts at `x, y` (as moved by `anchor`) and contains every node, group and head. — [D] — R-155
- A decision's edges end on the diamond outline, not its bounding box. — [D] — R-156
- A diagram node tree renders to valid SVG with and without `play`. — [D] — R-167
- All layout and routing is deterministic: no randomness, fixed sweep counts, stable tie-breaks (input order, then id). — [P] — R-168

### Extras

- Every animation in this area is emitted as ordinary `animation` motions (CSS keyframes, or SMIL `d` for morphing paths); no extras function adds script or a fetch — [D] — R-181
- Annotation components (Arrow, Callout, Brace, Underline, Camera) have keyframe stops only between `span.at` and `span.at + span.over` (plus the camera's `over`), so nothing moves outside its span — [D] — R-181
- Any span argument the runtime checks is non-negative `at` and positive `over`; checks name the call, the constraint and the value — [D] — R-176, R-188, R-194
- Same inputs give the same bytes: no `Math.random`, coordinates are rounded to 0.1 px in plots and fields, and tick labels print through `toPrecision(12)` — [P] — R-192, R-193
- All lines and columns in `Code` are 1-based; all `Code` queries that go out of range throw — [D] — R-170
- Every glyph in `code()` shares one `advance`; a proportional `font` throws — [D] — R-171
- Default accent of Marker, Arrow, Callout, Brace, Underline and flow is the theme's `base09` — [D] — R-182
- `Camera` with a stop at 0 starts at that stop's view; without one it starts at `"all"` — [D] — R-187
- All stages of one `riemann()` or `morph()` curve have the same path commands, so the `d` motion interpolates — [D] — R-197, R-198
- Scalar-field contour lines never leave the bounds — [D] — R-204
- Streamline spacing between neighbouring lines is at least about half of `spacing` — [P] — R-200
- `extras.ts` re-exports every public result type named in a signature — [P, unbuilt] — R-206

### Frames, CLI, plugins and release

- Every option of `renderFrames`/`openScene` is validated before a browser is launched — [D] — R-207
- Pixels for a given SVG, time, scale, scheme and background are identical across runs — [D] — R-211
- Frames always render with `reducedMotion: "no-preference"` and `prefers-color-scheme` forced to the resolved scheme — [D] — R-212
- `seek` pauses every CSS and SMIL animation in its root and sets time in seconds; `loopLength` reads durations in ms and returns seconds — [D] — R-210, R-213
- The CLI never loads `@svjeez/video` or `playwright-core` unless the command needs it; `svjeez` has no dependency on either — [D] — R-221, R-217
- A browser launched by `renderFrames`/`renderVideo`/`openScene` is closed on every path (success or throw) — [D] — R-211, R-228
- The published `package.json` of a plugin/component package has no `private`, `scripts` or `devDependencies`, and every `workspace:` dependency range is `^<that package's current version>` — [D] — R-235
- A release step already done (npm publish, GitHub release) is skipped on rerun — [D] — R-238
- A version containing `-` publishes to dist-tag `next`, otherwise `latest`; only a non-prerelease `svjeez` release is marked GitHub's latest — [D] — R-238
- The Vite plugin bundle never contains svjeez output or scene code, only URLs — [D] — R-231
- A scene served by `getScene()` has a content-hashed URL: equal SVG text gives an equal URL — [D] — R-232
- The shipped skill's error table lists only messages that exist in `src/`; every doc path it mentions exists; every reference is routed from SKILL.md — [D] — R-223
- The root `bun test` always fails with a pointer to `bun run test` — [D] — R-241

### Live editor

- `update` is pure: same state and message give the same next state and commands. — [D] — R-255
- Every edit writes only the replaced literal's byte range; all other bytes of the file are unchanged. — [D] — R-249
- No two literals in one file share a key; a key stays with its literal when another value changes length or another declaration is edited. — [D] — R-247
- `State.values`, `lines`, `source` are always the parse of `State.text` read through `State.schema`. — [P] — R-257
- Undo/redo move whole-file snapshots; a drag (first `set` then `continues` sets) is one history step. — [D] — R-256
- The editor starts no compile before its first subscriber; with no subscriber it holds commands and runs none. — [D] — R-263
- At most one compile, one show and one probe run at a time; of jobs arriving meanwhile only the newest runs. — [D] — R-264
- A URL the editor made is released once nothing shows it; `destroy` releases the rest. A build-time `first.src` is never released. — [D] — R-265
- A compile cut short by a pause is never reported as the file's error. — [D] — R-266
- A destroyed editor starts no work and notifies no listener. — [D] — R-267
- A grip measured on older text is kept only when the older text differs from the current only in the measured value. — [D] — R-262
- A declared grip is never probed and survives selection changes. — [D] — R-261
- Adapters bring no CSS; they emit the class and data-attribute contract of `editor.css`. — [D] — R-286
- The runtime-error fix table in `skill-errors.ts` equals the skill's table. — [D] — R-273
- `source.ts`, `controls.ts`, `gestures.ts`, `editor.ts` import no DOM API; only `probe.ts` and `showInBrowser` touch `document`/`Image`/`URL`. — [P] — not yet covered

### Charts, code, fonts, icons and Mermaid

- No package here has a runtime effect in the viewer: charts, highlighted runs, fonts, icons and parsed diagrams all reduce to numbers, strings and svjeez elements before render — [D] — R-304
- A series never draws outside its chart: a datum outside the niced y (or linear x) domain throws instead of clipping — [D] — R-297
- Every series returns `end`, the second it finishes, equal to the last animation's start plus its duration (plus the label fade for line/area with `label`) — [D] — R-298
- Chart output is deterministic: scene coordinates are rounded to 0.1 and tick values to 12 significant digits, so the same inputs give the same bytes — [D] — R-304
- Series colors come from the theme's accents in the fixed order of `ACCENTS`, counted per chart — [D] — R-296
- `highlight()` never emits hex: every non-plain run carries a role so `adaptive()`/`variables()` keep working — [D] — R-308
- The pieces of a highlighted line concatenate to the source line (after tab expansion) — [D] — R-305
- Only `@svjeez/fonts` touches the network; the cache is read before any fetch — [D] — R-311
- A cache file is never torn: it is written to a temp name and renamed — [D] — R-312
- Generated icon files are a pure function of the pinned upstream versions: rerunning `generate` changes nothing — [D] — R-317
- Every generated icon has a square grid from the origin, a valid kind, a nonempty `paths`, and each path starts with `M`/`m` — [D] — R-318
- No two icons in a set share an export name (generator fails) — [D] — R-316
- Mermaid input is never silently dropped: a line the parser cannot read or draw throws `MermaidSyntaxError` — [D] — R-325
- `parse()` imports nothing from svjeez and needs no DOM — [D] — R-319

### Maps and math

- No geo or math function emits script or an external reference; every output is `<path>`/`<g>`/`<circle>` markup and `Motion`s that the core compiles to CSS or SMIL — [D] — R-371
- Same inputs give the same output: `cartogram` layout, `traffic` picks (mulberry32 by `seed`), MathJax typesetting and all path text are deterministic — [D] — R-371
- Every coordinate in `project()` path data lies on a 0.1 px grid — [D] — R-330
- Under `reproject()`, every region and `land` use identical path commands under every projection — [D] — R-351
- A `globe()` layer's path keeps one command sequence at all times (fixed point count) — [D] — R-348
- `nightfall()` keeps a fixed point count, including at an equinox — [D] — R-353
- `Region.centroid` and `bounds` describe the largest piece, `map.bounds(region.feature)` all pieces — [D] — R-332
- Glyph `text` is `char@size`; two glyphs pair under `morph()` iff their `text` (or `id`) match — [D] — R-356
- Tex `bounds` hold every glyph (within 1 px slack) — [D] — R-354
- `plane` steps never overlap in time and start at `at >= 0` — [D] — R-360
- `construct` timeline: `end >= time - gap` after any element; elements without `at` start at the cursor — [D] — R-363
- `fourier().terms` is sorted by descending `r`; mean + terms reproduces the sample points — [D] — R-367
- `epicycles` pen position equals the drawn trace at every time — [D] — R-368
- A choropleth's groups are exactly the distinct color courses among named regions — [D] — R-342
- `counter` holds one glyph per place per distinct digit shown there, not one per change — [D] — R-370
- `@svjeez/math` and `@svjeez/geo` import `svjeez` only as peer; relative imports end in `.ts` — [D] — not a numbered rule (AGENTS.md, checked by `test:package`)

## §3 Structure

### Timeline and motion

**Channel table (lanes and composition).**
| Channel | Lane | Composition | Identity | Range | Backend |
|---|---|---|---|---|---|
| opacity | opacity | nest | 1 | [0,1] | css |
| x, y | translate | nest | 0 | none | css |
| scale | scale | nest | 1 | none | css |
| rotate | rotate | nest | 0 | none | css |
| blur | blur | nest | 0 | [0,inf) | blur (filter) |
| draw | draw | replace | none | [0,1] | css (pins pathLength=1, dasharray=1) |
| d | d | replace | none | none | smil |
| width, height | width, height | replace | none | [0,inf) | css/attr |
| fill, stroke, color, stopColor, stopOpacity | own lane | replace | none | none | css |
| floodColor, floodOpacity, stdDeviation, baseFrequency, seed, displace, dx, dy | own lane | replace | none | none | smil (all `fe*` tags) |

`backendOf(tag, channel)`: any `fe*` tag is SMIL, else the row's `backend` or CSS. `laneOf` returns the row's `attr` (or the channel name) for SMIL and the row's `lane` otherwise. A registered property is its own lane, composition `replace`, identity = `initial`, on every tag that has a channel except `fe*`.

**keysOf(initial, segments, period).** Keys start at `{t:0, initial, ease.out}`. `nudge = period * NUDGE`. For each step (sorted by start by the caller), `next = {...current, ...step.values}`:
- over >= nudge (a transition): if contiguous with the last key (`start < last.t + nudge`) the last key takes this step's ease; otherwise a hold key at `start` carrying `current` is pushed with this step's ease. Then a key at `start+over` with `next`.
- over < nudge, first key, `start == 0`: overwrite key 0's values (a cut at 0 is the initial value).
- over < nudge, contiguous, and a nudge past `last.t` would overshoot `period`: pull the last key back one nudge with `ease.hold`, push `{t: period, next}` (a cut at the very end still lands on 100%).
- otherwise a cut: last key gets `ease.hold`; push `next` at `start` (or `last.t + nudge` if contiguous).
After the loop, if the last key is before `period`, push `{t: period, current}`.

**valueAt(keys, t).** Pick the last key with `key.t <= t + EPSILON`; ease progress through `easeAt`; numbers lerp by the eased amount, `d` goes through `blendPaths`, colors hold the earlier key's value. This is what a still frame, `sample`, and frame rendering read.

**sampled algorithm.** Times `0, step, 2*step, ...` plus `duration`. Per lane: walk consecutive points; if the lane distance exceeds the tolerance, `jump()` halves the span up to 20 times following the larger half; a change that survives every halving above `max(tolerance, distance/1000)` is a jump and the lane splits into runs (the earlier run ends at the last smooth point, the next run starts after the jump and begins with a `set`). Each run is simplified by Ramer-Douglas-Peucker on the multi-channel point (hypot distance) at the lane tolerance, and emitted as linear `to()` segments.

**sample layer composition.** Per target, a layer's own keys are built with `keysOf` and read with `valueAt` at the layer-local time. Local time: `scene = loop ? ((t mod duration)+duration) mod duration : clamp(t, 0, duration)`; `local = ((scene mod snapped)/snapped) * period`, where `snapped = snapPeriod(period, duration)`, and in the non-loop case at `scene == duration` local is `period`. Combining across layers: `opacity`,`scale` multiply, `x`,`y`,`rotate` add, `blur` is `hypot`; anything else is "Two motions both animate".

**Calc lowering.** Precedence `+ - = 1`, `* / = 2`; a child op is parenthesized only when its precedence is lower, or equal on the right side of `-` or `/`. Literals print with `significant` (six significant digits minimum) plus the dim's unit (`px`, `deg`, none). `length(expr)` is `expr * 1px`. `calc(` wraps only a top-level `op`; a `call` (`cos`, `min`, ...) or literal/var stands alone. Typing: `mul`/`div` take at most one dimensioned operand, first; `add`/`sub`/`clamp`/`min`/`max` take operands of the same dimension; `sin`/`cos` take an angle.

**restyle.** Clocks: CSS `--t0:-<at>s` (and `--t1:-<onceAt>s` when `onceAt` is given) are written into the root `<svg style>`. Every `<animate>` without a `begin` gets `begin = -min(clock, runs - HOLD)` (clock = `once` if the tag has `data-once`, else loop); with `paused` it instead freezes (`begin = HOLD - max(min(clock, runs), HOLD)`, `end = HOLD s`, `fill="freeze"` unless set). `still` swaps `REDUCED_MOTION` for `@media all{` so the reduced-motion still frame always applies; `paused` swaps it for `@media not all{` and appends `*{animation-play-state:paused!important}`.

### Compile and output

#### Document layout
```
<!-- comment -->?                      (render only)
<svg xmlns viewBox width height role="img" aria-labelledby="{p}t [{p}d]">
  <title id="{p}t">…</title>
  <desc id="{p}d">…</desc>?
  <defs>…</defs>?                      (only if a ref was used)
  <style><![CDATA[\n{css}\n]]></style>?
  …body
```
CSS order inside `<style>`: authored CSS, blank line, then `@font-face` rules, `@property` rules, `.{p}a` base rule (only if any keyframe rule exists), `.{p}o` once rule (only if an `<Once>` has a css lane), `.{p}fb` pivot rule, keyframes and class rules in first-use order, then the reduced-motion block.

#### Generated names (all prefixed)
| Kind | Pattern | Counter base |
|---|---|---|
| filter | `f{n}` | `f`, shared with blur filters |
| gradient (linear and radial) | `g{n}` | `g` |
| pattern, clipPath, mask, marker, symbol | `p`, `c`, `m`, `k`, `s` + n | one counter each |
| keyframes | `[label-]k{n}` | `k` or `{label}-k` |
| motion class | `[label-]m{n}` | `m` or `{label}-m` |
| custom property | `--p{n}` | `--p` |
| still twin of a filter | `{id}s` | none |
Fixed class names: `a` (base animation), `o` (once clock), `fb` (fill-box pivot), `dm` and `ds` (moving and still path twin). Title and description ids: `t` and `d`.

#### Compile pipeline (walk)
For each element: resolve attrs (Css to text, FontValue to family and embed, Ref to id and emit def); build lanes per motion; place lanes into shells; walk children with `veiled` (a hidden ancestor) and `once` flags; wrap shells innermost first.

Lane building: group touched channels by `laneOf(tag, channel)`; `x` and `y` share `translate`. The first shell holds every replace lane. A nest lane gets the innermost shell unless the lane key is taken there or (on the innermost shell) `collides` with the element's own attributes (`transform` for scale/rotate, `filter` for blur, `opacity`) or the tag is in `wrapsOn` (`text` for scale/rotate); then a new `<g>` shell is added. Layers are taken last to first, so stack index 0 ends outermost.

#### Backends
| Backend | Used for | Output |
|---|---|---|
| css | Most channels, custom properties | `@keyframes` + `.{p}a .{p}m{n}` class. `x`,`y` → `translate`; `rotate` → `rotate`; `draw` → `stroke-dashoffset` (+ `visibility`); `width`/`height` in px. |
| blur | `blur` | A generated `<filter>` with `<feGaussianBlur stdDeviation>` animated by SMIL; the element gets `filter="url(#f{n})"`. |
| smil | `fe*` primitives, `d` on `<path>` | `<animate>` child with `values`, `keyTimes`, `calcMode`, `keySplines`, `dur`, `repeatCount`. |

#### SMIL emission (`smilAttributes`)
- One point per key. A moving key with `steps(n)` easing is expanded into `n` points (plus a held point before the next step when not all moving keys are steps).
- `calcMode="discrete"` when every moving key is a steps ease; `calcMode="spline"` with `keySplines` when any bezier ease is not linear; otherwise linear (no attribute).
- `keyTimes` use 5 decimal places; `dur` is `snapped / playbackRate`; `repeatCount="indefinite"`, or `repeatCount="n" fill="freeze"` when `loop` is false.

#### CSS keyframe emission (`cssKeyframes`)
- Percentages use 3 decimal places; if two keys collide, 4; if still colliding, throw.
- The lane timing is the most common bezier/linear timing among moving keys (tie → first seen; default `BASE_TIMING` = `ease.out`). A moving key whose timing differs carries `animation-timing-function` inline.
- Keys with identical declaration blocks merge: `0%,20%{…}`.
- Class body: `animation-name`, and only when different from the `.a` base: `animation-duration` (lane `snapped / playbackRate`), `animation-iteration-count` (when not looping: `round(duration / snapped)`), `animation-timing-function`.
- Base rule `.a`: `animation-duration:{duration/rate}s; animation-iteration-count:infinite|1; animation-fill-mode:both; animation-timing-function:{BASE_TIMING}; animation-delay:var(--t0,0s)`. The `--t0` variable is the hook `restyle()` uses.
- Once rule `.o`: `animation-iteration-count:1; animation-delay:var(--t1,var(--t0,0s))`. SMIL inside `<Once>` carries `data-once` so `restyle` can find it.

#### Reduced motion
`@media (prefers-reduced-motion:reduce){ .a{animation-delay:-{stillAt/rate}s!important;animation-play-state:paused!important} … stills }`. The block is empty and omitted when there are no rules and no stills. `stills` holds two kinds of swap, both because CSS cannot pause SMIL: `[filter="url(#f1)"]{filter:url(#f1s)}` pointing at a twin filter with its `<animate>` removed, and `.dm{display:none}.ds{display:inline}` for a moving `d` path beside a still copy.
The still value of a SMIL lane (`attrs[lane.key]`, blur `stdDeviation`) is `valueAt(keys, (stillAt mod snapped) / snapped * period)`.

#### Hard cuts
A lane of channel `opacity` whose values are only 0 and 1, where each value changes only through a `steps(1)` ease or at the same value, and the element sets none of `opacity`, `visibility`, `style`, compiles to `visibility:hidden|visible`. `veil` falls back to `opacity` (and `draw` to `stroke-dashoffset` alone) for any lane inside an element or shell that already toggles visibility, because a descendant's `visibility:visible` overrides a hidden ancestor.

#### Validation checks
Errors: root is not `<svg>` (after comments); duplicate `id`; `url(#x)`, `href="#x"`, `aria-labelledby` ids with no match; duplicate `@keyframes`; `animation-name` or `animation:` shorthand name with no `@keyframes`.
Warnings: no `viewBox`; unreferenced `@keyframes`; `image`/`feImage`/`use` with a non-fragment, non-`data:` href; a data URI over `EMBED_WARN_BYTES`; an embedded `@font-face` over `EMBED_WARN_BYTES`; an element with a `filter` attribute over `FILTERED_ANIMATION_LIMIT` or more animated descendants (counting `<animate>` and elements with the base class).

#### Picture sniffing
| Format | Match | Size |
|---|---|---|
| png | 8-byte signature | IHDR width and height |
| jpeg | `FF D8 FF` | First SOF; APP1 EXIF orientation 5 to 8 swaps width and height |
| gif | `GIF87a`/`GIF89a` | Logical screen |
| webp | RIFF…WEBP | VP8X, VP8L or VP8 |
| svg | Root `<svg` after BOM, XML decl, comments, doctype | `width`/`height` px, else the viewBox ratio |
Order tried: png, jpeg, gif, webp, svg.

### Geometry, fonts, ink and voxels

#### Path conversion (`paths.ts`)
`parse` turns path data into rings of absolute cubics: `L H V` become lines (cubics with thirds control points), `Q T` raise to cubic by 2/3 rule, `A` becomes up to one cubic per quarter turn (SVG implementation-notes endpoint-to-centre; radii scaled up when too small; zero radius or coincident ends become a line), `S T` mirror the previous control only after a matching curve type, `Z` adds a closing line if the pen is off the start. `M` followed by more pairs continues as `L`. Relative commands resolve against the pen. `ARITY` table: M2 L2 H1 V1 C6 S4 Q4 T2 A7 Z0.

`matchPaths(paths)`: parse all; ring count = max; a path short of rings takes, for each missing ring, a zero-length ring at the bounding-box middle of the nearest donor path's ring (earlier paths first, nearest first) with the donor's `closed`; per ring index, target curve count = max over paths (at least 1); `split` repeatedly halves the curve whose chord is longest (de Casteljau) until the count is reached, so original corners stay; then each path's closed rings are rotated so they start where they lie closest (sum of squared distances between curve end points) to the previous path's ring, applied in sequence. Output is `M…C…[Z]` per ring with `precision` decimals.

#### Spline (`spline.ts`)
Uniform Catmull-Rom with duplicated end points: leg `i` is the cubic `[p_i, p_i + (p_{i+1} - p_{i-1})/6, p_{i+1} - (p_{i+2} - p_i)/6, p_{i+1}]`, neighbours clamped at the ends. `locate(position)` clamps, floors, and assigns the last point to the last leg. `path` cuts each crossed cubic by de Casteljau. `nearest` scans `NEAREST_SCAN` samples per leg, then 40 ternary-search steps around the best.

#### Font reading and layout (`font/`)
- `sfnt`: table directory (offset, length per tag); `metrics`, `advance` (glyphs past `numberOfHMetrics` share the last advance), `name`, `weightOf`, `isItalic`, `isFixedPitch`.
- `shape`: cmap formats 4 and 12 (Unicode platform 0, or 3/1, 3/10; format 12 preferred). GSUB/GPOS lookups are selected by the Latin script (else DFLT, else the first), default language system, features `liga clig rlig` (type 4) and `kern` (GPOS type 2; extension lookups unwrapped). Kerning falls back to a format-0 `kern` table only when GPOS has no kerning lookup. Ligatures apply lookup by lookup, left to right. `beyond` collects every other lookup that a default-on feature (`DEFAULT_FEATURES`) enables in any script's default language system, then asks `mayApply` per subtable.
- `glyf`: simple glyphs (flag runs, delta coordinates) and composites (offset, scale / xy-scale / 2x2 matrix), flattened to contours; `pathData` writes quadratics, inserting the implied on-curve midpoint between two off-curve points and starting from the midpoint of the last and first for an all-off-curve contour.
- `subset`: keeps glyph 0, the drawn glyphs and their composite components, empties every other glyph in `glyf` (glyph ids unchanged), rebuilds `loca` (short if the data is under `0x20000` bytes), `cmap` (format 4, plus format 12 when any code lies beyond `0xFFFF`), a `post` v3 header, and a format-0 `kern` table of the kerned pairs among kept glyphs (at most `MAX_KERN_PAIRS`). Drops layout and variation tables (`DROP`). Fixes `head.checkSumAdjustment`.

#### Stroke fonts (`font/stroke.ts`)
Reads an SVG font by regex: `<font>`, `<font-face>` (`units-per-em`, `font-family`), and each `<glyph>` with a one-character `unicode`; `horiz-adv-x` falls back to the font's, then `unitsPerEm / 2`. Glyph `d` is flattened (`flatten`) and each polyline smoothed as Catmull-Rom cubics with tangent `(next - prev) / 6`; end points and corners with a negative dot product between the incoming and outgoing segment (sharper than a right angle) get a zero tangent. Glyph y is up, flipped to y down on output.

#### Ink (`ink/`)
`flatten(d)` tokenises with the `NUMBER` regex, supports all path commands (implicit repetition, `M` becoming `L`), and turns curves into polylines of `clamp(ceil(controlPolygonLength / 3), 2, 64)` points and arcs into `clamp(ceil(arcLength-ish / 3), 2, 96)` points. `outline(points, tool)` resamples at `INK_SPACING` px, offsets each sample along its normal by `drift(s)`, builds left and right edges at `max(INK_MIN_WIDTH, width) / 2`, closes with rounded quadratic caps (a straight join when a half-width is under `INK_CAP_MIN_HALF`), and writes the result in tenths of a px as relative `l`/`q` moves from rounded points. `Ink` with `draw` renders a `<g>` with two `<use>` of the same symbol: a masked one (mask path is the centerline drawn on with `draw` recipe, stroke width `tool.size * 2 + 2`) that hides at `at + over`, and a plain one that appears then.

#### Voxel (`voxel.ts`, `space.ts`, `texture.ts`)
`facingOf(camera)` is `[sign(sin yaw), 1, sign(cos yaw)]` with components under `EDGE_ON` read as 0. Visible faces: `east`/`west` by sign of x, `south`/`north` by sign of z, and always `top`. Face `SIDES` give shade, origin and u/v axes in cell space; shades `top 1`, `south/north 0.8`, `east/west 0.6`. One `<symbol>` per distinct tuple of resolved textures for the visible faces, each face projected through the camera and grown by `BLEED / unit`. Depth is `fx*x + y + fz*z`.

### Layout and diagrams

**Layered pipeline (layout/layered.ts), in TB space (LR flips w/h in, flips boxes and points out):**
1. Drop self loops from ranking. DFS from each node in input order; an edge into a node on the DFS stack is a back edge and is reversed for ranking.
2. Rank = longest path from sources over the (reversed) DAG.
3. A dummy vertex in every rank a long edge crosses. A backward edge also gets an anchor dummy in each end's own rank, beside that end.
4. Order: 8 alternating barycenter sweeps (down on even, up on odd). Group members sort together (sort key = group barycenter), anchors pinned right after their node. Final key gives each group one value so groups keep one left-to-right order through all ranks.
5. Outside routing: a backward edge whose two ends sit at the same end of their ranks sends its dummies to that end of every rank it spans (innermost first); otherwise its dummies stay just right of the ends.
6. Place: each rank is a row of items (ungrouped vertex, or a whole group column). Items start packed left under separation constraints, then 60 relaxation sweeps move each toward the weighted mean of its neighbours' x, clamped between neighbours. Weight 8 for dummy-dummy or anchor links, 4 for one-to-one links, else 1. A group keeps one x through every rank it spans. Outer-channel dummies sit out the relaxation and snap to a shared x just clear of everything inside them.
7. Ports: outgoing edges leave the bottom of a node ordered by their target's x, `PORT` apart, spread no further than the node reaches; incoming edges share one port at top center and merge `MERGE` above it. An edge within `SNAP` of straight is drawn straight.
8. Tracks (`route.tracks`): bent crossings in a rank gap get horizontal tracks by interval colouring in an order that stops fans crossing; merging crossings take the lowest tracks; two meeting from opposite sides share one. Gap height = max(`rankGap`, group padding + 16, room for track count and labels).
9. Self loops: 4-point box `LOOP` wide on the right at 30% and 70% of node height.
10. Labels: `placeLabels` slides each label along the longest straight run (jog middles excluded), 4 px steps clear of `BEND` at each end, to the first position with zero cost; cost = 8 per node/placed-label hit, 2 per other segment crossed, 1 for a run too short.

**Tree:** contour-based tidy tree (each subtree packed against its left siblings' merged right contour by `siblingGap`, parent centered over first and last child). Level thickness = tallest node in the level; edges are parent bottom-center, down to mid-gap, across, down to child top-center, passed through `simplify`. LR = lay out TB with w/h swapped, then `flip`.

**Sequence:** adjacent head gaps start at `w_i/2 + w_{i+1}/2 + actorGap`. Demands (message label width + 2 PAD between its actors; a self message `LOOP.w + 8 + label.w + PAD` to the right; a note `w/2 + PAD` each side) are processed narrowest span first; a short span's missing length is shared equally across its gaps.

**Lanes:** label column = widest label + 24; rows `rowHeight` apart; ticks every smallest `NICE` step whose pixel width >= 56.

**Marching squares:** cell mask TL=8, TR=4, BR=2, BL=1 with `>= level` inside; saddles (5, 10) resolved by the cell average; segments joined at shared cell edges into open or closed polylines.

**Streamlines (Jobard and Lefer):** RK4 on the normalised field, both ways from a seed, break at bounds / stagnation (|v| <= `STILL`) / closeness (< spacing/2) to any earlier line or a non-adjacent part of itself / `maxLength`. New seeds a `spacing` to both sides of every `round(spacing/step)`th sample; when the queue runs dry a grid scan finds uncrossed regions. With `seeds`, only those are traced.

**Curve (diagrams/curve.ts):** a down-across-down jog becomes one cubic S whose ends leave and arrive straight (ends take up to `BEND` of the neighbouring runs); any other corner is a cubic quarter-round of radius <= `CORNER`.

**Diagram node shapes:** task = rounded rect r8; tool = r3 with two inner verticals; input = parallelogram skew 0.35h; output = stadium; decision = diamond; store = cylinder with lid `LID`.

### Extras

**Role to slot table** (`ROLES` in `theme.ts`): plain 05; muted, comment 03; punct 04; keyword, magenta 0E; fn, blue 0D; string, green 0B; number, constant 09; type, yellow 0A; variable, tag, red 08; cyan 0C.

**Code layout.** `origin = x + (gutter ? (digits(lineCount) + 2) * advance : 0)`. Word x = `origin + col * advance`; row top = `y + (line-1) * height`; baseline = top + height/2 + fontSize * 0.35. Gutter numbers right-align at `origin - 2 * advance`.

**Morph pairing** (`match`): (1) runs with equal `id` pair by occurrence index; (2) the remaining words go through an LCS on `text` in order; (3) leftover words with equal text pair nearest first by pixel distance.

**Morph choreography.** Per transition starting at `at[i]`: kept word with same text moves by delta over `over` (`ease.inOut`); kept word with a changed text (same id) fades out while moving, and a new word fades in while moving from the old position; unpaired old words fade out over `over/2` at `at[i]`; unpaired new words fade in during the second half. Gutter numbers fade at the version where the line count changes.

**Typewriter clock.** `t = at - 1/cps`; per line: `start = t + 1/cps`, `t = start + chars/cps`, where `chars = last.column + last.text.length - first.column` (indent is not typed). Reveal is a clipPath rect animated with `ease.steps(chars)`. Cursor is two stacked blocks: a blinking one (looped 1 s) and a steady one that hides at `end`.

**Terminal clock.** For each command: prompt-line types from `clock` at `cps`; output prints at `typed.end + think`, one line every 0.06 s; `clock = printed + output.length * 0.06 + gap`; `end = clock - gap`.

**Axes mapping.** `px = at.x + (gx-min)/span * width`; `py = at.y + height - (gy-min)/span * height`. The x axis line sits at graph y=0 if in range else the bottom edge; the y axis likewise at x=0 else the left edge. Tick values are `ceil(min/step - 1e-9)..floor(max/step + 1e-9)` times step; at most MAX_TICKS per axis. The y label at 0 is skipped when the x axis crosses there.

**Plot trace.** A sample is dropped when non-finite or outside `[ymin - yspan, ymax + yspan]`; a drop ends the run; consecutive points join only if `|dy| <= yspan` (calculus `trace` also needs `|dx| <= xspan`); each run is its own `M`. Clipped to the plot rect by a `clipPath`.

**Calculus baking.** Moving values bake into keyframes through `sampled()` (dots, translate tolerance 0.3) or `sampledPath()` (lines and areas, tolerance 0.4). Derivative is a central difference with `h = xSpan * 1e-5`; a secant with `|h| < xSpan * 1e-6` uses the derivative.

**Riemann.** Each stage emits MOST = `max(n)` rectangles; rectangle k copies stage rectangle `floor(k*n/most)`, so every stage has equal commands and `d` morphs. Sum = mean sampled height times `(to-from)`.

**Streamline tracing** lives in `layout/field.ts` (area owning layout): seeds from the middle outward; lines then simplified to `tolerance`.

**Field flow.** Line i's particle starts `((i+1) * 0.618...) mod 1` of the way along, so lines never pulse together. A part-way start runs as two flow pieces (ahead, then behind after `rest`) each looping with `period = trip + reach + rest`.

**Contour sweep.** Levels are sampled evenly at `frames` points from `from` to `to`; each yields a full path through marching squares; `matchPaths(precision 1)` aligns them; the motion steps linearly, `over/(frames-1)` per frame.

### Frames, CLI, plugins and release

**Page protocol.** `svjeez/page` exports two functions that are serialized into the page (`fn.toString()`), so they may use only their argument and page globals; helpers are nested inside. Used by `frames.ts`, `scripts/preview.ts`, and consumers via `scene.evaluate`.

**Stage page.** `https://svjeez.local/` is intercepted with `page.route` and fulfilled with `<div id="stage">${svg}</div>` (inline `<svg>`, `body{margin:0}`, `line-height:0`, `color-scheme`). The origin is HTTPS so the page is a secure context (WebCodecs, used by `@svjeez/video`, needs one; about:blank is not). Capture: `locator("#stage").screenshot({animations:"allow", omitBackground:true})`.

**Contact sheet.** A second page: CSS grid of `columns` tracks of the frame's CSS width, `GAP` between, each `<figure>` an `<img>` data-URL PNG plus `<figcaption>t = <time to 3dp>s`. Sheet CSS size `max(across*(w+GAP)+GAP, rows*(h+GAP+CAPTION)+GAP)` on its larger side; scale = `min(scale, MAX_CAPTURE / thatSize)`.

**Browser launch order.** `import("playwright-core")` (error: install it) → `chromium.launch({executablePath})` → if no `executablePath` and that fails, `chromium.launch({channel:"chrome"})` → error naming `install chromium-headless-shell` or `executablePath`, with the first failure appended.

**Loop length.** Collect CSS animation durations (ms) from `getAnimations()` and SMIL `dur` attributes of `animate, animateTransform, animateMotion, set`. `longest = max`. For k = 1..1000: `loop = longest*k`; accept when every period `p` fits: `cycles = round(loop/p) > 0` and `|loop - cycles*p| < max(1, cycles*0.5 + 0.01)` ms (emitted durations are rounded to 1 ms). Else fall back to `longest`. Result in seconds; `0` when nothing animates.

**CLI command table.** `svg | frames | video | skill`, dispatched from a `Map`. Unknown or missing command prints USAGE, exit 1. Any thrown error prints `error.stack ?? message`, exit 1.

**Scene loading (CLI).** `.svg` is read as text. Anything else is `import(fileURL)`; on `ERR_UNKNOWN_FILE_EXTENSION` it registers `tsx/esm/api` (resolved from `cwd/package.json`, else bare) and retries. The module's default export is a string, or a function (sync or async) returning a string; else the CLI fails.

**Video encode pipeline.** open scene → `addScript(mediabunny.min.cjs)` → capture frame 0, read PNG IHDR width/height, round each down to even → `M.canEncodeVideo(codec, {width,height,frameRate,quality,alpha})` → create `Output` (Mp4/WebM format, `BufferTarget`) + `VideoSampleSource` in the page → for each frame i: capture `(i/fps) % duration`, send base64 PNG, `createImageBitmap(blob, 0, 0, width, height)`, `VideoSample{timestamp:i/fps, duration:1/fps}` → `finalize()` → base64 bytes back (chunked 0x8000).

**Plugin pipeline (Vite).** `load(id)` with `id` ending `?svjeez` or `?svjeez&posters` → per-environment `Runner` (a runnable Vite dev environment `svjeez`, `consumer: "server"`, JSX `automatic` with `importSource: "svjeez"`, resolve options copied from the app's `ssr` environment, app aliases) imports the scene file and `./scene` (`getScene`) inside it → `serve`: module exports JSON; `build`: `this.emitFile` for the SVG and each poster, module exports `import.meta.ROLLUP_FILE_URL_*` expressions. `watchChange` invalidates the module graph and evaluated modules (and importers) of the changed file; every file the scene imports is `addWatchFile`d.

**Posters.** Per scheme: render at t=0 to learn the loop, then `stillAt(svg, duration)` = the `animation-delay:-Ns!important` the scene holds under reduced motion, else `0.72 * duration`; second render at that time with `scale`, `background`; PNG → WebP via canvas in a long-lived headless page (JPEG paints white). Files named `<hash>-<variant>-<scheme>.webp`, `variant` = hash of `[scale, quality, background]`. Disk cache under `assets.cache`; at most `LANES` renders at once; identical in-flight requests share a promise.

**Release flow.** `plan` → names packages with something to release (writes `packages=` to `$GITHUB_OUTPUT`). `publish` → for each pending package in dependency order: build (if `out != dir`), `npm pack`, `npm publish <tarball> --provenance --access public --tag <distTag>` if not on npm, `gh release create <tag> <tarball> --target <sha> --notes <git log of that package's folder since its previous tag>` if no release. `claim <dir>` → first publish by a maintainer (`npm publish`, staged), then `npm trust github … release.yml --env npm`.

**CI jobs.** `test` (ubuntu: frozen install, Chromium, root typecheck, root test, `npm pack --dry-run`), `dist` (macOS: rebuild examples; `git diff --exit-code dist`), `node` (matrix Node 20, 22: `test:node` in svjeez and examples; `test:package` in svjeez, code, fonts, geo, math, charts, mermaid, live, svelte, react, vite, video; astro on Node 22 only). `release.yml` = `ci` → `plan` → `publish` (environment `npm`, Node 24, OIDC).

### Live editor

**Key grammar (`keyed` in `source.ts`).** `params.<paramKey>` (+ `.<option>` for min/max/step/option literals of an `export const params` entry); else the path from a *top-level* const joined by `.`; else `<scope>#<n>` where scope is the top-level const/function name, `default`, or `@<statement index>` and n counts unnamed literals in that scope. A clash gets `#1`, `#2` appended.

**Literal discovery (`literalsOf`).** One Lezer `jsx ts` parse. A literal is: `String`/`JSXAttributeValue` (color if it matches `^(["'])#(3|6|8 hex digits)\1$`, else string), `ease.<named>` member, `ease.bezier(a,b,c,d)` call with four numeric args (one literal; inner numbers are not literals), `Number` (a leading `-` joins it). Text containing a newline is skipped. Numbers parse `_` separators and hex.

**Role.** From the nearest non-arithmetic parent: const, property, JSX attribute (also via `{…}`), call argument (callee + index), or other.

**Message flow.** `send(Input)` stamps `now` on play/pause/seek/select, runs `update`, stores the next state, notifies listeners, performs commands. Command results come back as the runtime-only messages `compiled`, `shown`, `probed`.

**Pause/resume.** Last unsubscribe: `waiting = []`, `epoch++`, `compile.stop()`. Commands performed meanwhile queue in `waiting`. Next subscribe: `waiting = null`, queue replayed. A compile or probe finishing under an old epoch is re-performed (queued), not dispatched.

**Probe (`measureMove`).** Draw `before` and `nudged` into hidden shadow-root hosts held at the clock time; compare each drawn shape's centre, right-edge midpoint and bottom-edge midpoint; the point with greatest summed travel over shapes that moved gives `at` (mean of old positions) and `way` (mean displacement / `by`). Undefined when no DOM, shape counts differ, or nothing moved.

**Declared handles.** Compiler calls the scene's `handles(defaults)` and `handles(defaults with key + h)` per number param, `h = (max-min)/PROBE_DECLARED_DIVISOR`, and returns `{at, way}` per param.

**Compile pipeline.** sucrase (`typescript`, `jsx` automatic with `svjeez` import source, `imports`) → `load` required packages lazily → `new Function("require","exports",code)` → call default export → measure. Module allow-list: `svjeez`, `svjeez/extras`, `svjeez/jsx-runtime`, `svjeez/jsx-dev-runtime`, `svjeez/params`, plus lazily `@svjeez/{charts,code,geo,math,mermaid}`, `@svjeez/icons/{lucide,tabler}`, `world-atlas/{countries,land}-110m.json`.

**Adapter markup contract** is documented in the header of `editor.css`: `section.sj-code > header.sj-file, pre.sj-source > code > span.sj-line > span.sj-<kind> | .sj-num | .sj-color | .sj-ease | select.sj-choice`, `p.sj-error[role=status]`; `figure.sj-picture > img.sj-img, div.sj-grip*`; `div.sj-transport > button.sj-play, input.sj-scrub, output.sj-time`; every control `data-sj-key`, `data-selected`, number `data-dragging`.

### Charts, code, fonts, icons and Mermaid

**Chart frame (chart.ts).** `scaleLinear` for y: domain from `y.domain` or from data extended by 0 (unless `zero:false`), single-value domains widened by 1, then `.nice(ticks)` onto `[at.y+height, at.y]`. x band: `scaleBand` with `paddingInner = padding`, `paddingOuter = padding/2`. x linear: domain from `x.domain` or data min/max, niced. Draw order of `node`: grid (stroke-opacity 0.25), zero line when the y domain spans 0, x axis (1.5), y axis (1.5), y ticks + labels, x ticks (+ labels on band: labels only, no tick marks). Label baselines: x at `bottom + TICK + fontSize`; y at `yScale(v) + fontSize*0.35`, right-aligned `TICK+3` left of the axis.

**Bars.** Each bar rect is `radius` px longer than its visible length; a clipPath at the zero line (one above, one below) trims the base square, so only the free end is round. Grow animation is `height 0 -> long` (positive bars also move `y`). Labels fade/slide in at `start + 0.6*over`, `LABEL_FADE` long.

**Line/area.** Path through placed points via `d3-shape` with `digits(1)`; `draw` with linear ease. A dot appears at `at + over * (cumulative length / total length)`. Area: gradient (`stopOpacity` 0.4 to 0) clipped by a rect whose width grows 0 -> plot width, linear, same span as the stroke.

**Role-tag sentinel trick (code).** `ROLES = ["plain", ...unique roles in SCOPES]`; each role maps to sentinel hex `#00000N` (index+1). One Shiki theme `svjeez-roles` colors each scope prefix by its role's sentinel. Tokenising yields sentinel colors, mapped back through `roleOf`. Adjacent equal roles merge; `plain` runs become bare strings.

**Google font fetch (fonts).** CSS URL `https://fonts.googleapis.com/css2?family=<name with +>:wght@W` (italic: `ital,wght@1,W`) with user-agent `svjeez-fonts` so Google returns a static TTF URL (first `src:\s*url(...)`). Cache file `<cacheDir>/<slug(family)>-<weight>-<style>.ttf`; `slug` replaces runs of non `[A-Za-z0-9]` with `-`.

**Icon export-name grammar.** `arrow-left` -> `arrowLeft`; hyphen between digits -> `_`; a name that is not an identifier or is reserved gets an `icon` prefix and capitalized first letter (`delete` -> `iconDelete`, `3d-cube` -> `icon3dCube`). Tabler filled icons append `-filled` before naming.

**Icon element conversion.** circle/ellipse -> two arcs; rect (optionally rounded, rx/ry clamped to half the side) -> `M h v h z` with corner arcs; line -> `M L`; polyline/polygon -> `M L...` (+`z`); path -> `d` as is. Numbers print through `num` (rounded to 3 decimals). Elements with `stroke="none"` and `fill="none"` (Tabler's frame) are skipped.

**Mermaid forms.** Openers tried in order: `[[ ]]` subroutine, `[( )]` cylinder, `(( ))` circle, `([ ])` stadium, `[ ]` rect, `( )` round, `{ }` diamond. `FORM_ROLES`: rect and round -> task, stadium -> input, diamond -> decision, circle -> output, subroutine -> tool, cylinder -> store. Edge tokens: `-->`, `---`, `-.->`, `-.-`, `==>`, `===`, with `|text|` or `-- text -->` labels; dotted if token contains `.`, thick if starts `=`; arrow if ends `>`.

**Sequence arrows.** `->>` filled solid, `-->>` filled dashed, `->` none solid, `-->` none dashed, `-x`/`--x` cross, `-)`/`--)` async. Only `line` (dashed = reply) reaches svjeez; `head` is kept in the doc only.

**State scopes.** A stack of scopes (root + one per open composite). A state belongs to the scope where it is first mentioned. Each scope needs exactly one `[*] -->` whose target belongs to that scope.

### Maps and math

#### Geo pipeline
`GeoData` -> `features()` (Topology: `topojson.feature` of the chosen object; FeatureCollection; Feature) -> `filter` -> `projection.fitExtent(frame, fit target)` -> per-feature `Writer` path -> regions. `land`/`lines` use `merge`/`mesh` only when `data` is a Topology whose object is a `GeometryCollection` (geometry i is feature i, so `kept` indexes map back to geometries).

#### Path writer
tenths grid -> drop points closer than `tolerance` (keep the last dropped point as `#tail` on open lines) -> Douglas-Peucker at `tolerance/2` (in tenths: `#min/2`) -> drop rings with <3 points (open lines <2) -> `M x y l dx dy ...` relative.

#### Colour scale
`toLab` (sRGB hex -> OKLab) -> class colors at `(i+0.5)/steps` along the ramp -> `index = clamp(floor(position(v) * steps))`. Diverging position is piecewise linear with `mid` at 0.5.

#### Globe projection
Front hemisphere: orthographic (`dot` with right/up/toward). Back hemisphere: folded outward past the rim around a pivot point `hole` (the hidden pole, or the parallel clearing every outline by the most, `REACH` limited, 0.5 degree candidates), distance beyond the rim `1 + BEYOND * (1 - share)`. A polygon containing the pivot gets one extra octagon ring to turn the fill back. Layers split into `BAND`-degree longitude pieces by the first strand's mean vector. Every layer is `sampledPath(sample, {duration, tolerance, slack})` where `slack` lets folded points stray half their distance past the rim. Arcs (graticule, circle, route, terminator) are drawn by `visible()` with a point every 3 degrees; hidden arcs collapse to the point where they will appear. `night` is a 49-point half-ellipse edge plus rim.

#### Morph targets
`rings(region)`: split `d` on `M`, sort by bounding-box area, drop pieces under `MIN_PIECE` px^2 (keep the first), thin with Douglas-Peucker at `max(detail, size * RELATIVE) * 5` tenths. Mainland -> target shape; other pieces -> radius 0.01 circles at the target center. `matchPaths(..., {precision: 1})` equalizes commands. Shapes hidden (`opacity 0`) until `at`; each region i starts at `at + i * stagger`.

#### Dorling relax
400 passes max: pull each disc `0.04 * (1 - pass/400)` toward origin, push overlapping pairs apart along their line (smaller moves further, `share = b.r/(a.r+b.r)`), clamp into frame; stop when max push < 0.01 after pass 40. Disc radius `k * sqrt(value)`, `k = sqrt(coverage * w * h / (PI * sum))`.

#### MathJax compile
One shared `mathjax.document` (lazily built; `TeX` with `AllPackages` minus `noundefined` and `noerrors`; SVG output with `fontCache: "none"`). Walk the SVG: `g`/`a` recurse composing `translate()`/`scale()` transforms and inheriting `fill` and `id`; `path` becomes a mark (char from `data-c`, NFKC); `rect`/`line` become bar marks (stroked ones expanded to outline polygons); `data-mjx-error` throws; `<text>` with content throws; any other element throws; `data-hitbox` rects are skipped.

#### Plane drawing modes
All steps matrices: one `.plane-map` transform `matrix(var(--plane-a..f))` animated by registered `@property` numbers; heads/labels read `--plane-u`, `--plane-x/y/dx/dy/k` through CSS `atan2`. Any step a function: every outline refined (`refine`, midpoint kept when any placement bends it more than `TOLERANCE` 0.5 px, depth <= 8) and morphed through `d`; heads and labels follow sampled/travel motions.

#### Construct label placement
`clearestDirection(rays, away)`: widest angular gap between rays leaving the point, score `min(gap, PI) + 0.8 * dot(dir, away)`, with `away` = point minus figure center; no rays gives `away` or `[0,1]`. `stand` pushes the label out until its box clears.

## §4 Rules

### Timeline and motion

#### Time arguments — [D]
*Serves:* G-3, G-4
*Code:* `motion.ts` (`time`, `Track.at`, `Track.wait`, `Track.to`, `Track.loop`)
```pseudo
at(t)   : require finite t >= 0  else throw "at() needs a finite, non-negative number of seconds, got ..."
wait(d) : require finite d >= 0  else throw "wait() needs ..."; cursor += d
to(v, over): require finite over  (same message) then over > 0 else throw "to() needs a positive duration, got ... Use set() for a cut."
loop(p)  : require finite p >= 0, then p > 0 else throw "loop() needs a positive period, got ..."
```
*Criterion:* R-1

#### to() needs a duration, set() is the cut — [D]
*Serves:* G-3
*Code:* `motion.ts` (`Track.to`, `Track.set`)
```pseudo
to(values, over, curve = ease.out): step{start: cursor, over, ease: curve, values}; cursor = start+over
set(values): step{start: cursor, over: 0, ease: ease.hold, values}; cursor = start
```
*Criterion:* R-2

#### Step values are checked — [D]
*Serves:* G-4
*Code:* `motion.ts` (`checkValues`)
```pseudo
if no keys             throw "A transition needs at least one channel."
for key:
  if isProperty(key)   declarationOf(key)  // throws "<key> was never declared with def.property()."
  else if !isChannel   throw "\"<key>\" is not an animatable channel."
  if number and !finite throw "A transition needs a finite <key>, got ..."
```
Colors and path data are not checked here. `initial` passed to `motion()` is not run through this check (Q-2).
*Criterion:* R-3

#### Cursor model and immutability — [D]
*Serves:* G-3
*Code:* `motion.ts` (`Track`, `motion`, `dataOf`, `isMotion`)
```pseudo
motion(initial = {})  -> Track{initial, steps: [], cursor: 0}
at(t): cursor = t (absolute)      wait(d): cursor += d
to/set: append a step at cursor, then cursor = step end
every method returns a new Track; the receiver is untouched
```
Between transitions every channel holds its value (Compile and output emits the hold keys through `keysOf`). `isMotion` is `instanceof Track`; `dataOf` assumes any `Motion` is a `Track`.
*Criterion:* R-4

#### Lane overlap is an error — [D]
*Serves:* G-3, G-4
*Code:* `motion.ts` (`Track.push`, `sharedLane`)
```pseudo
for other in steps:
  if shares a lane with other and step.start < end(other) - EPSILON and other.start < end(step) - EPSILON:
     throw "Two transitions move `<lane>` between <a>s and <b>s. Move them in one .to(), or stack two motions."
```
Different lanes may overlap freely; steps that touch end-to-start do not overlap.
*Criterion:* R-5

#### Loop period — [D]
*Serves:* G-3
*Code:* `motion.ts` (`Track.loop`, `Track.push`)
```pseudo
loop(p): last = max end of steps (0 if none)
         if last > p + EPSILON throw "loop(p) is shorter than the motion, which runs until <last>s."
         period = p
push(step) when period is set: if end(step) > period + EPSILON throw "A step ending at <t>s overruns loop(p)."
```
Render later snaps the period to divide the scene duration (see snapPeriod rule).
*Criterion:* R-6

#### Labels — [D]
*Serves:* G-4
*Code:* `motion.ts` (`Track.label`)
```pseudo
label(name): if !/^[A-Za-z][\w-]*$/.test(name) throw "Label \"<name>\" must be a CSS identifier."
```
*Criterion:* R-7

#### Channels are typed per tag — [D]
*Serves:* G-4, G-9
*Code:* `channels.ts` (`TagChannels`, `Exact`), `motion.ts` (`Exact`, `Motion<K>`), `properties.ts` (`Property`, `PropertyValues`)
```pseudo
motion().to({ <name>: v }): name must be a Target, extra keys are `never`
<tag animation={m}>: m's channels must be in TagChannels<tag>
registered properties are allowed on every styled tag (no fe*) and typed by their syntax
```
Type-level only; no runtime tag check here (B/validate own runtime).
*Criterion:* R-8

#### Ease values — [D]
*Serves:* G-3, G-4
*Code:* `motion.ts` (`ease`, `bezier`, `steps`)
```pseudo
ease.steps(n): if !Number.isInteger(n) or n < 1 throw "ease.steps needs a positive whole count, got n."
presets: linear; in = (0.55,0.06,0.68,0.19); out = (0.23,1,0.32,1); inOut = (0.77,0,0.175,1);
         pop = (0.34,1.56,0.64,1); hold = steps(1)
ease.bezier(x1,y1,x2,y2): no validation (see Known bugs in CRITERIA.md)
```
*Criterion:* R-9

#### easeAt — [D]
*Serves:* G-3
*Code:* `ease-at.ts` (`easeAt`)
```pseudo
x = clamp(progress, 0, 1)
linear -> x;  steps -> floor(x*count)/count
bezier -> bisect 40 times for u with cubicX(x1,x2,u) = x, return cubicY(y1,y2,u)
```
A `pop` returns > 1 while it overshoots. `easeAt(hold, 1) = 1`, `easeAt(hold, <1) = 0`.
*Criterion:* R-10

#### Keys from steps — [D]
*Serves:* G-3, G-2
*Code:* `keys.ts` (`keysOf`, `moving`, `snapPeriod`)
```pseudo
keys = [{t:0, initial, ease.out}]; nudge = period*NUDGE
for step in start order: transition / cut-at-0 / cut-at-end / cut (see Structure)
if last.t < period - EPSILON: push {t: period, current}
moving(keys, i) = next key exists and its values differ from this key's
```
*Criterion:* R-11

#### Period snapping — [D]
*Serves:* G-3
*Code:* `keys.ts` (`snapPeriod`)
```pseudo
snapPeriod(period, duration) = duration / max(1, round(duration / period))
```
So a loop of 0.9s in a 3s scene plays 3 times at exactly 1s each. `sample` and B both use it.
*Criterion:* R-12

#### valueAt — [D]
*Serves:* G-3, G-5
*Code:* `keys.ts` (`valueAt`, `blend`)
```pseudo
i = last key with key.t <= t + EPSILON; from = keys[i]; to = keys[i+1]
if no `to`: return from.values
amount = easeAt(from.ease, (t - from.t)/(to.t - from.t))
number: from + (to - from)*amount;  target "d": blendPaths(from, to, amount);  color: from (holds)
```
*Criterion:* R-13

#### enter, exit, draw — [D]
*Serves:* G-4
*Code:* `recipes.ts` (`enter`, `exit`, `draw`, `span`)
```pseudo
span({at, over}): at finite >= 0 else throw "<fn>() needs a start of 0 or later, got ..."
                  over finite > 0  else throw "<fn>() needs a positive duration, got ..."
enter(span, from = {opacity: 0}, curve = ease.out): motion(from).at(at).to(rest(from), over, curve)   // rest = channel identity
exit(span, to = {opacity: 0}, curve = ease.out):    motion().at(at).to(to, over, curve)
draw(span, curve = ease.out): motion({draw: 0}).at(at).to({draw: 1}, over, curve)
```
`enter`/`exit` accept only rest channels (`opacity x y scale rotate blur`) by type.
*Criterion:* R-14

#### shake — [D]
*Serves:* G-7, G-4
*Code:* `recipes.ts` (`shake`)
```pseudo
span checked; count = max(2, round(over * (rate ?? SHAKE_RATE)))
for k in 1..count: at(start + (k-1)*over/count).to(swing(k), over/count, ease.linear)
swing(k) per channel = k == count ? 0 : (k odd ? -1 : 1) * amp * (1 - k/count)
```
Deterministic damped oscillation that ends at rest; only `x y rotate`.
*Criterion:* R-15

#### wiggle — [D]
*Serves:* G-7, G-2
*Code:* `recipes.ts` (`wiggle`), `random.ts`
```pseudo
period = options.period ?? WIGGLE_PERIOD; count = max(2, round((rate ?? WIGGLE_RATE) * period))
next = random(String(seed)); channels sorted by name
sample[c][i] = clamp(c, identity(c) + amp(c) * (next()*2 - 1))   // drawn channel by channel, count draws each
motion(at(0)); for i in 1..count: at((i-1)*period/count).to(at(i), period/count, ease ?? ease.inOut)
return .loop(period)     // at(count) == at(0) because indexes wrap, so it loops seamlessly
```
Values are baked at call time. Seed `5` and seed `"5"` give the same noise.
*Criterion:* R-16

#### random — [D]
*Serves:* G-7
*Code:* `random.ts` (`random`, `fnv1a`, `mulberry32`)
```pseudo
random(seed): string -> mulberry32(fnv1a(seed))
              integer -> mulberry32(seed)          // not hashed
              else throw "random() needs a whole number or a string seed, got <seed>."
stream value in [0, 1)
```
*Criterion:* R-17

#### sampled options — [D]
*Serves:* G-4, G-7
*Code:* `recipes.ts` (`sampled`)
```pseudo
duration finite > 0 else throw "sampled() needs a positive duration, got ..."
step     finite > 0 else throw "sampled() needs a positive step, got ..."
precision, if given, whole >= 0 else throw "sampled() needs a whole, non-negative precision, got ..."
```
*Criterion:* R-18

#### sampled frames share keys — [D]
*Serves:* G-4
*Code:* `recipes.ts` (`sampled`, `frameAt`, `present`)
```pseudo
channels = sorted keys of frame 0 whose value is finite
for each t: if the finite keys differ from `channels`
  throw "sampled() returned different channels at t=<t> than at t=0; every sample needs the same keys, each a finite number."
```
*Criterion:* R-19

#### sampled tolerance per lane — [D]
*Serves:* G-4, G-9
*Code:* `recipes.ts` (`sampled`, `Tolerance`, `Covered`)
```pseudo
group channels by lane (x,y -> translate; a property is its own lane)
tolerance[lane] undefined or < 0 -> throw "sampled() needs a non-negative tolerance for `<lane>`, got ..."
types: a returned key whose lane has no tolerance is a type error
```
*Criterion:* R-20

#### sampled simplification — [D]
*Serves:* G-1, G-3
*Code:* `recipes.ts` (`sampled`, `ramerDouglasPeucker`)
```pseudo
times = 0, step, 2step, ... < duration - duration*NUDGE, then duration
per lane run: keep = RDP(points, tolerance)      // multi-channel hypot distance, endpoints always kept
emit keep[j-1] -> keep[j] as .to(values, dt, ease.linear)
guarantee: replay (linear between kept keys) is within tolerance of every sample
```
Morphs come out dense, holds sparse (a flat lane keeps only its two end keys).
*Criterion:* R-21

#### sampled jumps become cuts — [D]
*Serves:* G-3
*Code:* `recipes.ts` (`sampled`, `jump`)
```pseudo
if distance(last, next) > tolerance: cut = jump(last, next)   // bisect up to 20 times; survives all halvings -> jump
if cut: close the run at cut[0] (if later than last), start a new run at cut[1] (or next)
new run after the first: track.at(run[0].t).set(values)
smooth-but-steep functions are not jumps and keep their tween
```
A jump at the end of the timeline lands on 100% (via `keysOf`).
*Criterion:* R-22

#### sampled precision — [D]
*Serves:* G-1
*Code:* `recipes.ts` (`sampled`, `read`)
```pseudo
if precision defined: value = round(value * 10^precision) / 10^precision   // finite values only, before simplifying
```
*Criterion:* R-23

#### sample() time mapping — [D]
*Serves:* G-3
*Code:* `sample.ts` (`layerAt`, `sample`)
```pseudo
require duration > 0 (else throw "sample() needs a positive duration, got ...") and finite t (else "sample() needs a finite time, got ...")
loop: scene = ((t mod duration)+duration) mod duration (also for negative t); no loop: clamp to [0, duration]
local = ((scene mod snapPeriod) / snapPeriod) * period  (period = layer.period ?? duration)
value = valueAt(keysOf(initial, steps of this target sorted by start, period), local)
```
Eased as the browser plays it; matches the drawn element within 0.5px/0.005 opacity in Chromium.
*Criterion:* R-24

#### sample() stacks layers — [D]
*Serves:* G-3
*Code:* `sample.ts` (`STACKED`, `sample`)
```pseudo
layers = stack minus falsy
for each target of each layer: combine with prior value by STACKED[target]
   opacity,scale: a*b;  x,y,rotate: a+b;  blur: hypot(a,b)
   otherwise (any non-stacking channel or property twice): throw "Two motions both animate `<target>` in sample(): put them in one motion()."
```
A layer that turns or scales outside one that moves is not composed as a matrix.
*Criterion:* R-25

#### sample() reads numbers only and names what is missing — [D]
*Serves:* G-4, G-9
*Code:* `sample.ts` (`layerAt`)
```pseudo
skip targets whose value kind is not a number (colors, d, color properties)
start = initial value ?? channel identity; if neither (width, height, draw, ...)
   throw "sample() needs a starting value for <target>. Pass it to motion({ <target>: … })."
```
Numeric registered properties are read like channels.
*Criterion:* R-26

#### Channel table — [D]
*Serves:* G-2, G-4
*Code:* `channels.ts` (`CHANNELS`, `spec`, `isChannel`, `backendOf`, `laneOf`, `clamp`, `formatValue`)
```pseudo
isChannel(name) = own key of CHANNELS
spec(property)  = {tags: STYLED (no fe*), lane: key, composition: replace, identity: initial}
clamp(channel, v) = clamp to row.range if any
backendOf(tag, c) = tag starts with "fe" ? smil : (spec(c).backend ?? css)
laneOf(tag, c)    = smil ? (row.attr ?? c) : row.lane
```
*Criterion:* R-27

#### Registered properties — [D]
*Serves:* G-2, G-4
*Code:* `properties.ts` (`property`, `declarationOf`, `isProperty`, `formatProperty`, `propertyRule`)
```pseudo
property(name, {syntax, inherits, initial}):
   name must match /^[A-Za-z][\w-]*$/  else throw "Property name \"<n>\" must be a CSS identifier without the leading --."
   syntax in SYNTAX                     else throw "Unknown property syntax \"<s>\"."
   key = "--name:syntax"; same key + different inherits/initial -> throw "<key> is already declared with inherits <a> and initial <b>."
   same declaration again -> same key
declarationOf(undeclared key) -> throw "<key> was never declared with def.property()."
formatProperty: number -> num(v) + unit(syntax) (px, deg, none); string passes through
propertyRule -> @property --name{syntax:'<...>';inherits:..;initial-value:..}
```
*Criterion:* R-28

#### css template — [D]
*Serves:* G-2, G-4
*Code:* `properties.ts` (`css`, `Css`)
```pseudo
css`...${hole}...`: number -> printed with num(); Css -> its parts spliced; Property -> "var(", {property}, ")"
```
Render later replaces `{property}` parts with the per-file `--pN` name and emits one `@property` per used property.
*Criterion:* R-29

#### calc expressions — [D]
*Serves:* G-4, G-2
*Code:* `calc.ts` (`calc`, `Calc`, `lower`, `side`, `nodeOf`)
```pseudo
add/sub/mul/div fold left over operands; sin cos clamp min max build calls
side(): parenthesize a child op iff child precedence < parent, or == parent on the right of - or /
literal -> significant(value) + unit(dim); non-finite literal -> throw (from significant/num)
calc( ... ) wraps only a top-level op; calls/literals/vars are not wrapped
units checked in types: mul/div have at most one dimensioned operand, first; cos/sin take an angle
```
*Criterion:* R-30

#### Once — [D]
*Serves:* G-3, G-5
*Code:* `once.ts` (`Once`)
```pseudo
Once(props) = node("g", props) with once: true
B: every motion on it and inside it plays the timeline once on --t1 (falls back to --t0), holding the last frame
   CSS: shared rule  .o{animation-iteration-count:1;animation-delay:var(--t1,var(--t0,0s))}
   SMIL: repeatCount=1 fill=freeze data-once
   an inner .loop(p) repeats only to the end of the timeline
```
A scene without `<Once>` carries no once rule.
*Criterion:* R-31

#### Pivot — [D]
*Serves:* G-3
*Code:* `pivot.ts` (`Pivot`)
```pseudo
Pivot({at = {0,0}, animation, children}) = el.g({style: {transformBox: "view-box", transformOrigin: "<num(at.x)>px <num(at.y)>px"}, animation}, children)
every layer of a stack gets its own group; each inherits that style, so each turns about `at`
```
*Criterion:* R-32

#### Stack wrappers keep the element's origin — [D]
*Serves:* G-3
*Code:* `channels.ts` (`pivot: true` rows) with the wrapper emission in Compile and output
```pseudo
element style carries transform-origin/transform-box -> every wrapper group of a split stack repeats that style
   (instead of the default fill-box class `fb`, which would turn each about its own centre)
two 45 degree layers == one 90 degree turn in the frame
```
*Criterion:* R-33

#### restyle clocks — [D]
*Serves:* G-5, G-10
*Code:* `restyle.ts` (`restyle`, `activeDuration`)
```pseudo
if at || paused || onceAt defined: write --t0 (and --t1 if onceAt) into the root <svg style>
for each <animate> without begin: clock = data-once ? onceAt ?? at : at
   begin = -min(clock, activeDuration - HOLD)        // played
   paused: begin = HOLD - max(min(clock, runs), HOLD); end = HOLD s; fill=freeze unless set
at = 0 and no pause leaves the file as is (plus css)
```
`restyle(svg, { at: 2 })` sets `--t0:-2s` and no `--t1`; `onceAt: 0` sets `--t1:-0s`.
*Criterion:* R-34

#### restyle still, paused, css — [D]
*Serves:* G-5, G-10
*Code:* `restyle.ts` (`restyle`)
```pseudo
still : replace REDUCED_MOTION with "@media all{" (the reduced-motion still frame always applies); at/paused ignored
paused: replace REDUCED_MOTION with "@media not all{"; extra css gets "*{animation-play-state:paused!important}"
css   : appended as <style> before the last </svg>, after the scene's own css so it wins
```
*Criterion:* R-35

#### Param declarations — [D]
*Serves:* G-10, G-4
*Code:* `params.ts` (`number`, `count`, `seconds`, `color`, `easing`, `choice`, `defaults`, `check`)
```pseudo
number checks: min < max ("needs min below max"), step > 0, value in [min, max] ("is outside its range"),
               log scale needs min > 0 ("has a log scale, so its min must be positive")
number(v, {min,max,step=0.01,...}); count: integer value ("needs a whole number."), min 0, step 1; seconds: min 0, step 0.01, unit "s"
choice(v, options): v must be in options else throw "choice(\"<v>\") is not one of ..."
defaults(schema) = { key: param.value }
```
*Criterion:* R-36

#### Param fitting and slider mapping — [D]
*Serves:* G-10
*Code:* `params.ts` (`fit`, `fitValues`, `withValues`, `positionOf`, `valueAt`)
```pseudo
fit(p, v)   = min + round((clamp(v)-min)/step)*step, capped to max, toFixed(max(decimals(step), decimals(min)))
fitValues(schema, patch) = fit each number-param entry, pass others through
withValues(schema, values) = schema with each param's value replaced (kind, range kept)
positionOf: linear (v-min)/(max-min); log ln(v/min)/ln(max/min)
valueAt(p, pos) = fit(p, linear or min * (max/min)^pos)
```
*Criterion:* R-37

#### Handle drags — [D]
*Serves:* G-10
*Code:* `params.ts` (`follow`, `Handles`)
```pseudo
h = (max-min)/10000; way = (at(v+h) - at(v))/h        // direction the handle travels as v grows
length = |way|^2; if length == 0 return v
return clamp(v + dot(by, way)/length, min, max)       // not rounded; the page writes fit(p, raw)
```
A handle on an arc follows the arc.
*Criterion:* R-38

### Compile and output

#### Render options guard — [D]
*Serves:* G-4, G-9
*Code:* render.ts (`render`)
```pseudo
if !(width > 0) or !(height > 0): throw "render() needs a positive width and height, got … by …."
if !(duration > 0): throw "render() needs a positive duration, got …."
rate = playbackRate ?? 1; if !(rate > 0 and finite): throw "render() needs a positive, finite playbackRate, got …."
prefix = prefix ?? ""; if prefix != "" and !/^[A-Za-z][\w-]*$/.test(prefix): throw "render() needs a prefix of letters, digits, _ and -, starting with a letter, got …."
```
*Criterion:* R-40, R-41, R-42

#### Generated names are per render — [D]
*Serves:* G-7
*Code:* compile.ts (`State`, `nextName`, `refId`), render.ts
```pseudo
each render() starts a fresh State: every counter (f g p c m k s, k, m, --p) starts at 1
names are handed out in first-use order of the walk; nothing reads a clock or a random source
a Ref holds no id: the same ref in two renders gets an id from each render's own State
```
*Criterion:* R-39, R-43

#### Document shape — [D]
*Serves:* G-1, G-5
*Code:* render.ts (`render`), svg.ts (`serialize`)
```pseudo
root = <svg xmlns viewBox="0 0 W H" width height role="img" aria-labelledby="{p}t [{p}d]">
children = title(id {p}t), desc(id {p}d)?, defs?, style?, body
source = serialize(root)
errors = validateSvg(source).errors
if errors: throw "Generated SVG is invalid:\n  - …"
return (comment ? "<!-- comment -->\n" : "") + source + "\n"
```
*Criterion:* R-44

#### Output is validated — [D]
*Serves:* G-4, G-9
*Code:* render.ts, validate.ts
```pseudo
render() never returns a document for which validateSvg(doc).errors is non-empty
a hand-written duplicate id → "Generated SVG is invalid" with 'Duplicate id "…".'
```
*Criterion:* R-45

#### Defs are emitted on use — [D]
*Serves:* G-1, G-7
*Code:* defs.ts (`def`), compile.ts (`refId`, `addDef`)
```pseudo
refId(ref): if known return id
  id = next(PREFIX[tag])            // f g p c m k s
  record id; walk the def node (so nested refs, motions and fonts resolve)
  filter without filterUnits/x/y/width/height gets userSpaceOnUse 0 0 W H
  push def into State.defs
attribute value: name == "href" ? "#id" : "url(#id)"
```
*Criterion:* R-47

#### Def refs are not strings — [D]
*Serves:* G-4
*Code:* defs.ts (`Reference.toString`), svg.ts (`serializeAttrs`)
```pseudo
String(ref) → throw "A def ref is not a string. Pass it as the attribute value itself."
serializeAttrs: a non-string value left in attrs → throw "Unresolved ref in …"
```
*Criterion:* R-48, R-49

#### Identical keyframes and classes are shared — [D]
*Serves:* G-1
*Code:* compile.ts (`keyframesName`, `className`)
```pseudo
body = cssKeyframes(...).body; name = keyframes.get(body) ?? next("[label-]k"); push "@keyframes name{body}" once
class body = classBody(...); class = classes.get(body) ?? next("[label-]m"); push ".class{body}" once
```
*Criterion:* R-50

#### Keyframe emission — [D]
*Serves:* G-3
*Code:* css.ts (`cssKeyframes`, `cssDeclarations`, `percents`, `timing`)
```pseudo
percent = key.t / period * 100 at 3 places; if any two equal, 4 places; if still equal: throw "Two keys are too close to tell apart on a …s timeline: …."
lane timing = most common timing among moving keys, else BASE_TIMING
a moving key with a different timing adds animation-timing-function inline
keys with the same declaration block merge into one selector list
```
*Criterion:* R-51, R-52

#### Lane building — [D]
*Serves:* G-3, G-4
*Code:* compile.ts (`lanesOf`, `startValue`)
```pseudo
for each channel the motion touches:
  if element's tag does not list the channel: throw "<tag> cannot animate channel."
group channels by laneOf(tag, channel)
initial value = given | channel identity (non-smil) | numeric/colour attribute on the element
  else throw "channel on <tag> has no starting value. Pass it to motion({ channel: … }) or set the attribute."
if last step end > period + EPSILON: throw "A motion on <tag> runs until …s, past the …s scene."
if keys > MAX_KEYS: throw "key on <tag> has … keys; the cap is …."
if lane is d and the keys' commands differ: throw "d on <path> moves between paths with different commands, so it would jump. Write them through matchPaths() first."
```
*Criterion:* R-53, R-54, R-55, R-56, R-57

#### Lane placement and stacking — [D]
*Serves:* G-3, G-4
*Code:* compile.ts (`placeLanes`, `collides`)
```pseudo
shell[0] = every replace lane; a lane key twice → throw "Two motions both animate `key` on <tag>: put them in one motion()."
for layer from last to first:
  nest lanes join the current innermost shell unless a lane key is already there
    or (innermost shell and collides(element, lane)) → open a new <g> shell
emit shells inside out; shell i>0 is <g style="transform-box/origin copied from the element">
```
*Criterion:* R-58, R-59, R-60

#### Pivot and wrapper rules — [D]
*Serves:* G-3
*Code:* compile.ts (`emitShell`, `collides`), channels.ts rows (“Timeline and motion”)
```pseudo
scale/rotate present and style has no transform-box/origin → add class "{p}fb", state.pivot = true
scale/rotate on <text>, or on an element with a transform attribute → the lane lands on a wrapper <g>
a wrapper copies the element's own transform-box/transform-origin declarations
.{p}fb { transform-box: fill-box; transform-origin: center }
```
*Criterion:* R-61

#### Channel requirements are pinned — [D]
*Serves:* G-4
*Code:* compile.ts (`pin`)
```pseudo
for each pin (name, value) of the lane's channels:
  if the element sets name to something else: throw "channel needs name="value"; this <tag> sets name="own"."
  else set attrs[name] = value          // draw → pathLength="1" stroke-dasharray="1"
```
*Criterion:* R-62

#### Hard 0/1 cuts compile to visibility — [D]
*Serves:* G-2
*Code:* compile.ts (`lanesOf` emit, `veil`), css.ts (`cssDeclarations`)
```pseudo
discrete(opacity keys) and element has none of opacity|visibility|style → emit "visibility"
else emit "value"
inside any element or shell whose lane emits visibility: lane.emit = (draw ? "dash" : "value")
```
*Criterion:* R-63

#### Blur is a generated SMIL filter — [D]
*Serves:* G-2
*Code:* compile.ts (`blurFilter`, `emitShell`)
```pseudo
signature = blur|keys|snapped|once; reuse id if seen
filter(id, userSpaceOnUse canvas region) > feGaussianBlur(stdDeviation = still value) > <animate stdDeviation>
element.filter = url(#id)
element that already has a filter attribute: blur lands on a wrapper <g>
```
*Criterion:* R-64

#### SMIL lanes keep a reduced-motion still — [D]
*Serves:* G-5, G-2
*Code:* compile.ts (`addDef`, `stillTwin`, `withoutSmil`), smil.ts
```pseudo
filter def containing <animate> and stillAt defined:
  push twin filter id "{id}s" with all <animate> removed
  stills += [filter="url(#id)"]{filter:url(#id s)}
path with an animated d and stillAt defined:
  emit [moving copy class dm, still copy class ds display:none, no id]; stills += .dm{display:none}.ds{display:inline}
```
*Criterion:* R-65, R-66

#### SMIL emission — [D]
*Serves:* G-2, G-3
*Code:* smil.ts (`smilAttributes`, `animate`)
```pseudo
points = keys; a moving steps(n) key expands to n points
calcMode = all moving keys steps ? discrete : any non-linear bezier ? spline(keySplines) : linear
keyTimes = t/period at 5 places; dur = snapped/playbackRate s
repeat = loop ? indefinite : (round(duration/snapped), fill=freeze)
```
*Criterion:* R-67

#### Reduced-motion freeze — [D]
*Serves:* G-5
*Code:* render.ts, css.ts (`freezeRule`)
```pseudo
stillAt = reducedMotion === false ? undefined : clamp(reducedMotion.at ?? duration * 0.85, 0, duration)
if stillAt defined and (css rules or stills exist):
  @media (prefers-reduced-motion:reduce){ .a{animation-delay:-{stillAt/rate}s!important;animation-play-state:paused!important} stills }
```
*Criterion:* R-68

#### Loop false plays once — [D]
*Serves:* G-3
*Code:* css.ts (`baseRule`, `classBody`), smil.ts (`animate`), compile.ts (`canvasOf`)
```pseudo
base rule: animation-iteration-count 1
lane with period != duration: animation-iteration-count = round(duration / snapped)
smil: repeatCount = round(duration / snapped), fill = freeze
<Once> lanes use canvas with loop = false
```
*Criterion:* R-69

#### Playback rate — [D]
*Serves:* G-3
*Code:* css.ts (`seconds`), smil.ts (`animate`), compile.ts
```pseudo
every animation-duration, animation-delay (stillAt) and SMIL dur = scene seconds / playbackRate
keyframe percentages, keyTimes and the timeline are untouched
```
*Criterion:* R-70

#### Prefix scoping — [D]
*Serves:* G-1, G-7
*Code:* compile.ts (`nextName`, `fontFamily`), render.ts
```pseudo
name = lead + prefix + base + counter       // ids, classes, keyframes, --properties, font-family, t/d ids
user-written classes, ids and css are never renamed
```
*Criterion:* R-46, R-71

#### Custom properties are named and registered per render — [D]
*Serves:* G-4, G-7
*Code:* compile.ts (`propertyName`, `resolveCss`), properties.ts (`formatProperty`, `propertyRule`)
```pseudo
render: name = --{p}p{n} by first use in the walk, not declaration order
emit @property --pN{syntax:'<…>';inherits:…;initial-value:…} once, only for keys a motion, style or css hole uses
style values get the syntax's unit (length px, angle deg); a css hole becomes var(--pN)
declaring and checking keys (bad name, redeclaration, undeclared key) is “Timeline and motion”'s R-28
```
*Criterion:* R-72

#### Font embedding — [D]
*Serves:* G-1
*Code:* compile.ts (`fontFamily`, `walk` text collection), “Geometry, fonts, ink and voxels”'s `font/font.ts`
```pseudo
FontValue attribute → family string "'{prefix}Name', fallback" ; each face embedded once, keyed by (name, weight, style); a font no element uses is not embedded
two faces on one slot with different bytes → throw "Two different fonts claim … Give one of them another family name with font(bytes, { family })."
same bytes, one subset and one whole → the whole one wins
@font-face rules are cut to the glyphs in every text node of the scene (“Geometry, fonts, ink and voxels” decides how)
```
*Criterion:* R-73

#### Text, escaping and well-formedness — [D]
*Serves:* G-1
*Code:* svg.ts (`serialize`, `serializeAttrs`, `cdata`, `children`), format.ts (`escapeText`, `escapeAttr`)
```pseudo
text nodes: & < > escaped; attrs: also "; style body: raw inside CDATA, "]]>" → "]]]]><![CDATA[>"
children(): null, undefined, true, false drop; arrays flatten; fragments flatten; numbers print via num
whitespace-only text is dropped except inside text, tspan, title, desc
other values → throw "Unsupported SVG child: …"
```
*Criterion:* R-74

#### JSX and `el` build the same tree — [D]
*Serves:* G-4
*Code:* jsx-runtime.ts, el.ts, svg.ts (`node`, `attrValue`, `stack`), attributes.ts (the attribute table)
```pseudo
jsx(Fragment) = fragment; jsx(fn) = fn(props) ?? empty fragment; jsx("tag") = node(tag, props)
node: skip children, animation, key; class array filters falsy and joins; style object → "a-b:c;…" (Css if it has a property key)
attributeName(tag, prop): aria-*, data-*, class, style, id, role pass through; else table lookup or throw "<tag> has no attribute "prop"."
animation entries must be motions: else throw "animation takes motions built with motion() or a recipe."
undefined, null, false attrs are dropped; other non-string values → throw "Unsupported value for …"
el.tag(props, content) = node(tag, { ...props, children: content })
```
*Criterion:* R-75, R-76, R-77, R-78

#### Source locations — [D]
*Serves:* G-10
*Code:* sources.ts (`remember`, `withSources`), jsx-dev-runtime.ts, render.ts
```pseudo
jsxDEV(type, props, key, isStatic, source) = remember(jsx(type, props), source)
remember: only the first source recorded for a node sticks (a component root keeps the inner place, else the use site)
render({ sources: true }) maps withSources over the tree: data-source="file:line:column" (empty parts skipped)
```
*Criterion:* R-79

#### Number formatting — [D]
*Serves:* G-7
*Code:* format.ts (`num`, `significant`)
```pseudo
num(v, places=3): non-finite → throw "Expected a finite number, received …"; round half up at places; -0 → 0; String()
significant(v): enough digits for 4 significant figures after the leading digit, min 6
```
*Criterion:* R-80

#### Authored CSS ordering — [D]
*Serves:* G-4
*Code:* compile.ts (`compile`)
```pseudo
css = [authored (resolved, trimmed), generated].filter(nonEmpty).join("\n\n")
authored first, so generated rules can override it
```
*Criterion:* R-81

#### Validation errors — [D]
*Serves:* G-4, G-9
*Code:* validate.ts (`validateSvg`)
```pseudo
errors: root not <svg>; duplicate id; url(#x)/href="#x"/aria-labelledby with no id;
        duplicate @keyframes; animation-name or animation: shorthand with no @keyframes
warnings: no viewBox; unreferenced @keyframes
```
*Criterion:* R-82

#### Validation warnings — [D]
*Serves:* G-1, G-9
*Code:* validate.ts (`filteredAnimation`, `imageHrefs`, `embeddedFonts`)
```pseudo
filter attribute over >= FILTERED_ANIMATION_LIMIT animated descendants → warning (class name found from the base rule, so a prefix still works)
image|feImage|use href not "#…" and not "data:…" → warning that <img> will not load it; names picture.load()
data: href over EMBED_WARN_BYTES → warning with size; @font-face data: url over EMBED_WARN_BYTES → warning
warnings never throw
```
*Criterion:* R-83, R-84, R-85, R-86

#### Picture embedding — [D]
*Serves:* G-1
*Code:* picture.tsx (`picture`, codecs, `svgHref`, `base64`)
```pseudo
format = first of png,jpeg,gif,webp,svg whose matcher accepts the bytes; none → throw "Unknown image format. picture() reads svg, png, jpeg, gif, webp."
size absent or not > 0 → throw svg: "This SVG has no size. Give the root <svg> a width and height or a viewBox." | else "Could not read the size of this … image. The file may be truncated."
href = svg ? "data:image/svg+xml," + percent-encode(% # < > " \r \n \t) : "data:{mime};base64,{b64}"
bytes = href.length; string input is SVG markup; reading is pure and synchronous
```
*Criterion:* R-87, R-88, R-89

#### Picture loading — [D]
*Serves:* G-1
*Code:* picture.tsx (`picture.load`), source.ts (`readSource`)
```pseudo
readSource: path or file: URL → read file; http(s) → fetch, non-ok → throw "Could not load …: status text"; other scheme → throw "Cannot load …. Use an http(s) or file: URL, or a path."
picture.load = picture(await readSource(src)); format comes from content
```
*Criterion:* R-90

#### Picture placement — [D]
*Serves:* G-1, G-5
*Code:* picture.tsx (`Picture`, `symbolOf`)
```pseudo
w = width ?? (height ? height*aspect : intrinsic); h likewise
scale = fill ? (w/iw, h/ih) : (cover ? max : min)(w/iw, h/ih); image centered in the frame
clip to the frame (clipPath rect with rx=radius) when fit=cover, radius is set, or animation is set
one <symbol> per PictureData object, so repeated use embeds the href once
alt → role=img aria-label; no alt → aria-hidden=true
```
*Criterion:* R-91

#### Icon drawing — [D]
*Serves:* G-8
*Code:* icon.tsx (`Icon`)
```pseudo
scale = size / icon.grid (size defaults to grid)
transform = [translate(x y) if x or y, scale(s) if s != 1] joined
stroke kind: fill=none stroke=(stroke ?? currentColor) round caps and joins, stroke-width (default 2, in grid units)
fill kind: fill=(fill ?? currentColor); stroke props ignored
one <path> per icon.paths entry; animation is a stack or (d, i) => stack
alt → role=img aria-label; no alt → aria-hidden=true
```
*Criterion:* R-92

#### Glyph drawing — [D]
*Serves:* G-8, G-1
*Code:* glyphs.tsx (`Glyphs`)
```pseudo
face = font is a family ? (weight|style given ? family.face(weight, style) : regular face) : font
glyphs = face.path(text, { size, x, y }).glyphs
<g role=img aria-label=(alt ?? text)> one <path d> per glyph with a non-empty d; no font is embedded
animation: a stack for all, or (glyph, i) => stack
```
*Criterion:* R-93

#### Filter effects — [D]
*Serves:* G-8
*Code:* fx.tsx (`fx`)
```pseudo
glow(blur=5): blur copy merged under SourceGraphic
boil(strength=3, rate=10, seed=1, detail=.04): feTurbulence seed steps over BOIL_FRAMES steps per (BOIL_FRAMES/rate)s loop, then feDisplacementMap scale = 2*strength
grayscale(amount=1): saturate(1 - clamp(amount, 0, 1)), sRGB
duotone({dark, light}): hex only (hexOf throws "fx.duotone() needs #rgb or #rrggbb colors, got …."); Rec. 709 luminance matrix
blur(dev); shadow(dx=0, dy=4, blur=6, color=black, opacity=.4)
```
*Criterion:* R-94

#### Hex colour guard — [D]
*Serves:* G-4
*Code:* color.ts (`hexOf`, `hexBytes`)
```pseudo
hexOf(color, caller, alpha=false): alpha ? /^#(rgb|rrggbb|rrggbbaa)$/ : /^#(rgb|rrggbb)$/; else throw "{caller} needs #rgb or #rrggbb colors, got …." (alpha: "#rgb, #rrggbb or #rrggbbaa")
hexBytes: expands #rgb, defaults alpha 255
```
*Criterion:* R-95

#### Public surface — [D]
*Serves:* G-4, G-6
*Code:* index.ts
```pseudo
index.ts re-exports the documented API only; svjeez/jsx-runtime, jsx-dev-runtime, extras, voxel, frames, page, params are separate entries
the core imports nothing outside node: built-ins used only in source.ts (fs, url, lazily) and scheme.ts (child_process, imported by frames only)
```
*Criterion:* R-96

### Geometry, fonts, ink and voxels

#### Resample points along a polyline — [D]
*Serves:* G-2, G-7
*Code:* geometry.ts (`resample`, `pathLength`)
```pseudo
resample(points, count):
  if points.length < 2: throw "resample() needs at least two points, got n."
  if !isInteger(count) || count < 2: throw "resample() needs a whole count of 2 or more, got n."
  total = cumulative length of the straight runs
  for i in 0..count-1: point at distance total*i/(count-1) along the runs
  # zero total length: every output equals the first point
```
*Criterion:* R-97

#### Polyline path data — [D]
*Serves:* G-2, G-7
*Code:* geometry.ts (`polylinePath`)
```pseudo
polylinePath(points, {closed=false, precision=1}):
  if points.length == 0: throw "polylinePath() needs at least one point."
  "M<x> <y>" for the first, "L<x> <y>" for each after, numbers via num(v, precision)
  append "Z" if closed
```
*Criterion:* R-98

#### Rect anchors and algebra — [D]
*Serves:* G-4
*Code:* geometry.ts (`rect`)
```pseudo
rect(x,y,w,h): top/right/bottom/left are edge midpoints, center is the middle
pad(n): rect(x-n, y-n, w+2n, h+2n)
union(o): bounding box of both
side(edge, t): top/bottom -> (x + w*t, y or y+h); left/right -> (x or x+w, y + h*t)
```
*Criterion:* R-99

#### Spline through points — [D]
*Serves:* G-2, G-4
*Code:* spline.ts (`spline`)
```pseudo
spline(points):
  if points.length < 2: throw "spline() needs at least two points, got n."
  legs = points.length - 1
  leg i = Catmull-Rom cubic with neighbours clamped at the ends
  point(at): clamp at to [0, legs]; leg = min(legs-1, floor(at)); u = at - leg; evaluate cubic
  d = path(0, legs)
```
*Criterion:* R-100

#### Spline path cut — [D]
*Serves:* G-2
*Code:* spline.ts (`path`)
```pseudo
path(from=0, to=legs):
  start = clamp(min(from,to)); end = clamp(max(from,to))      # order is normalised
  d = "M" + point(start)
  for each leg crossed with u1 > u0: append "C" of cut(cubic, u0, u1)   # de Casteljau
  coordinates print with 2 decimals
```
*Criterion:* R-101

#### Spline tangent and angle — [D]
*Serves:* G-2
*Code:* spline.ts (`tangent`, `angle`)
```pseudo
tangent(at) = derivative of the leg cubic at u          # speed per unit of position
angle(at) = atan2(tangent.y, tangent.x) * 180 / PI     # degrees, 0 along +x, 90 along +y
```
*Criterion:* R-102

#### Spline nearest position — [D]
*Serves:* G-2
*Code:* spline.ts (`nearest`)
```pseudo
nearest(p, from, to):
  scan max(1, ceil((end-start)*32)) samples, keep the best
  ternary-search 40 steps in the bracket around the best, clamped to [start, end]
  return the midpoint
```
*Criterion:* R-103

#### Match paths to common commands — [D]
*Serves:* G-2, G-3
*Code:* paths.ts (`matchPaths`, `parse`, `split`, `halve`)
```pseudo
matchPaths(paths, {precision=2}):
  if paths.length == 0: return []
  rings = parse(each); if a path has no ring: throw 'matchPaths() found no shape in "d".'
  pad every path to the max ring count; then every ring index to the max curve count by halving the longest-chord curve
  return rings written as M..C..[Z] with identical command text
```
*Criterion:* R-104

#### Missing subpaths grow from a point — [D]
*Serves:* G-2
*Code:* paths.ts (`matchPaths`, `middle`)
```pseudo
for ring index r missing in path v:
  donor = first path (nearest earlier, then later) that has ring r
  ring = { start: bbox middle of donor ring r, curves: [], closed: donor.closed }   # splits into zero-length curves
```
*Criterion:* R-105

#### Closed rings start where they lie closest — [D]
*Serves:* G-3, G-2
*Code:* paths.ts (`align`, `rotate`)
```pseudo
for v in 1..: for each ring r:
  if ring.closed && previous.closed:
    best = rotation minimising sum of squared end-point distances to even[v-1][r]  (early exit when over the best)
    ring = rotate(ring, best)           # open rings are left as they are
```
*Criterion:* R-106

#### Match path errors — [D]
*Serves:* G-4
*Code:* paths.ts (`parse`)
```pseudo
unknown command letter   -> throw 'matchPaths() cannot read the "c" command in "d".'
count % arity != 0 or 0  -> throw 'matchPaths() found n numbers after "c" in "d".'
no ring                  -> throw 'matchPaths() found no shape in "d".'
```
*Criterion:* R-107

#### Blend two matched paths — [D]
*Serves:* G-3
*Code:* paths.ts (`blendPaths`, used by `keys.ts` `valueAt`)
```pseudo
blendPaths(a, b, amount):
  replace each number in a with a + (b_k - a) * amount, k-th number of b; commands of a are kept
  # a number with no partner in b becomes NaN and num() throws
```
*Criterion:* R-108

#### Sampled path keeps the keys the shape needs — [D]
*Serves:* G-2, G-3
*Code:* paths.ts (`sampledPath`)
```pseudo
times = i*step for i < ceil((duration - duration*NUDGE)/step), then duration
frames = times.map(sample)
kept = {first, last}; divide(a,b): worst = frame i in (a,b) whose point distance from the linear blend of a and b
       exceeds tolerance (less slack(x,y) of its point when slack given) the most; if any, keep it and recurse on both halves
result = motion({d: first}) then .at(t_prev).to({d: next}, dt, ease.linear) for each kept pair
```
*Criterion:* R-109

#### Sampled path argument and shape errors — [D]
*Serves:* G-4
*Code:* paths.ts (`sampledPath`)
```pseudo
duration not finite or <= 0 -> throw "sampledPath() needs a positive duration, got n."
step not finite or <= 0     -> throw "sampledPath() needs a positive step, got n."
!(tolerance >= 0)           -> throw "sampledPath() needs a non-negative tolerance, got n."
commandsOf(frame i) != commandsOf(frame 0) -> throw "sampledPath() returned a path with different commands at t=T than at t=0. Write every sample through matchPaths() or with the same points."
```
*Criterion:* R-110

#### Read a font from bytes — [D]
*Serves:* G-1, G-4
*Code:* font/font.ts (`font`, `Font` constructor), font/sfnt.ts
```pseudo
font(source, options):
  bytes < 12 -> throw "This font is empty or truncated."
  signature "ttcf" -> throw "This is a font collection (.ttc). Extract one face to a .ttf or .otf and load that."
  format = first of ttf (0x00010000 or "true"), otf ("OTTO"), woff, woff2 matching the signature, else throw "Unknown font format. font() reads ttf, otf, woff, woff2."
  table directory or a table running past the file end -> throw "This font is truncated: ..."
  family/weight/style/fallback from options, else the file; weight outside 1..1000 -> throw "font() needs a weight between 1 and 1000, got n."
  href = data URI with the format MIME; bytes = href.length
```
*Criterion:* R-111

#### Compressed formats embed but are not read — [D]
*Serves:* G-1, G-6
*Code:* font/font.ts (`#readable`)
```pseudo
woff / woff2: no Sfnt is parsed. family defaults to font-<hash>, weight 400, style normal, fallback sans-serif.
metrics, has(), measure(), path() -> throw "<what> needs the TTF or OTF file. A WOFF2 font embeds, but its tables are compressed."
```
*Criterion:* R-112

#### Measure text as the browser lays it out — [D]
*Serves:* G-2, G-3
*Code:* font/font.ts (`measure`, `has`), font/shape.ts (`typesetter`)
```pseudo
layoutGlyphs(text): glyph per code point (cmap, 0 if absent); apply liga/clig/rlig type-4 lookups in order (if ligatures);
  advance = hmtx advance + pair kern with the next glyph          # last glyph gets no kern
measure(text, size) = sum(advance) * size / unitsPerEm
has(char) = cmap(char) != 0
ligatures:false -> no GSUB lookups; kerning only
```
*Criterion:* R-113

#### Text as outlines — [D]
*Serves:* G-2, G-8
*Code:* font/font.ts (`path`), font/glyf.ts (`contours`, `pathData`)
```pseudo
path(text, {size, x=0, y=0}):
  format otf -> throw "path() reads TrueType outlines. This OTF stores CFF outlines, which path() does not read yet."
  !(size > 0) or non-finite x+y -> throw "path() needs a positive size and finite coordinates, got size S at X, Y."
  pen = x; for each laid-out glyph: d = quadratic outline scaled by size/unitsPerEm, origin (pen, y), y down; pen += advance
  composite nesting > MAX_COMPOSITE_DEPTH or components > MAX_COMPONENTS -> throw "This font nests composite glyphs too deeply." / "This font's composite glyphs have too many components."
  width = pen - x; d = all glyph d joined; coordinates rounded to 2 decimals
```
*Criterion:* R-114

#### Font families and face matching — [D]
*Serves:* G-2, G-4
*Code:* font/font.ts (`font.family`, `FontFamily.face`)
```pseudo
font.family(...faces):
  two faces with the same "weight style" -> throw "font.family() got two <style> faces of weight W. Each weight and style needs its own file."
  name and fallback come from the first face
face(weight, style):
  pool = faces of that style (all if none); exact weight wins
  weight > 500: heavier ascending, else lighter descending
  weight < 400: lighter descending, else heavier ascending
  400..500: heavier up to 500 first, then lighter descending, then heavier
```
*Criterion:* R-115

#### Font values stay out of strings and CSS — [D]
*Serves:* G-1, G-4
*Code:* font/font.ts (`toString`, `cssString`, `fontFaces`, `fontFaceRule`)
```pseudo
`${font}` -> throw "A font is not a string. Pass it as fontFamily={font}."
`${family}` -> throw "A font family is not a string. Pass it as fontFamily={family}."
cssString(name) = 'name' with ' and \ backslash-escaped and control characters (< 0x20, 0x7f) as \hex<space>
fontFaces(value) -> { family: "'Name', fallback...", faces: [{name, font}] }
fontFaceRule(name, font, texts) = @font-face{font-family:'name';src:url(<embed(texts)>) format('...');font-weight:W;font-style:S}
```
*Criterion:* R-116

#### Subset embed — [D]
*Serves:* G-1, G-2
*Code:* font/font.ts (`embed`), font/subset.ts (`subset`)
```pseudo
embed(texts): key = sorted distinct characters + texts; cache per key
  cut = subset(bytes, sfnt, typesetter, kern, texts, this.ligatures)
  keeps glyph 0, drawn glyphs, composite components; others empty; glyph ids unchanged
  cmap rebuilt (format 4; plus 12 beyond BMP); layout/variation tables dropped; kerned pairs among kept glyphs -> kern table
  result = data:font/ttf;base64,...
```
*Criterion:* R-117

#### Embed the whole font when a cut would change the layout — [D]
*Serves:* G-1, G-5
*Code:* font/font.ts (`embed`), font/subset.ts (`subset`)
```pseudo
return font.href (whole file) when:
  no sfnt (woff, woff2), subset == false, or no glyf table (CFF OTF)
  ligatures == true and any text lays out to a multi-character glyph
  ligatures == true and typesetter.beyond(runs)           # contextual alternates, mark positioning, other scripts
  subset() returns undefined
with ligatures == false the layout checks are skipped: dropping GSUB and GPOS is the point
```
*Criterion:* R-118

#### Read a single-line SVG font — [D]
*Serves:* G-8
*Code:* font/stroke.ts (`strokeFont`)
```pseudo
strokeFont(markup string | bytes | ArrayBuffer):
  no <font> -> throw "strokeFont() reads SVG fonts, and this has no <font> element."
  glyphs = <glyph> with one-character unicode; none -> throw "strokeFont() found no single-character <glyph> elements."
  advance = glyph horiz-adv-x, else font horiz-adv-x, else unitsPerEm/2
  has(char) = glyph present; measure(text, size) = sum advances * size/unitsPerEm; unknown characters take the default advance
```
*Criterion:* R-119

#### Stroke font paths — [D]
*Serves:* G-8, G-2
*Code:* font/stroke.ts (`path`, `smooth`)
```pseudo
path(text, {size, x, y}):
  !(size > 0) or non-finite x+y -> throw "path() needs a positive size and finite coordinates, got size S at X, Y."
  per glyph: each polyline -> smooth(points scaled by size/unitsPerEm, placed at pen, y flipped)
  smooth: < 3 points -> M..L..; else Catmull-Rom cubics, end tangents 0, tangent 0 where dot(in, out) < 0 (corner)
  a space or unknown character advances and draws nothing
```
*Criterion:* R-120

#### Flatten path data — [D]
*Serves:* G-8
*Code:* ink/path.ts (`flatten`)
```pseudo
flatten(d) -> Polyline[] {points, closed}
  must begin with a command letter, else throw 'Path data must start with a command, got "t".'
  too few numbers -> throw "Path command c needs N numbers."
  M starts a polyline (extra pairs are lineto); Z closes by adding the start point and sets closed
  S/T mirror the previous control only after C/S or Q/T; otherwise the control is the current point
  an arc whose end equals its start is skipped; zero radius becomes a line
  polylines with a single point are dropped
```
*Criterion:* R-121

#### Drawing tools — [D]
*Serves:* G-8, G-7
*Code:* ink/ink.tsx (`pen`, `brush`, `nib`, `pencil`, `noise`, `envelope`)
```pseudo
pen:    width = size * envelope(t, taper, 0.45) * (1 + 0.06 * noise(seed)(s/18)); Tool.size = size*1.1
brush:  width = size * envelope(t, taper, 0.04) * (1 - pressure*(0.5 + 0.5*noise(seed)(s/40))); drift = wobble*noise(seed+101)(s/60)
nib:    width = size * (thin + (1-thin) * |sin(direction - angleRad)|)
pencil: width = size * envelope(t, 0.05, 0.5) * (0.8 + 0.3*noise(seed)(s/3.5)); drift = size*0.25*noise(seed+7)(s/14)
noise: seeded 1D value noise in -1..1, smoothstep between hashed integer knots; same seed -> same line
```
*Criterion:* R-122

#### Ink outline — [D]
*Serves:* G-8, G-1
*Code:* ink/ink.tsx (`inkPath`, `outline`, `resample`, `writer`)
```pseudo
inkPath(d, tool) = flatten(d).map(outline).join("")      # one closed filled outline per subpath
outline: resample at INK_SPACING; left/right edges at max(INK_MIN_WIDTH, tool.width(t, s, angle))/2 about the drifted centre;
  round caps as one quadratic, or a straight join if half-width < INK_CAP_MIN_HALF; fewer than 2 samples -> ""
output is relative l/q moves between points rounded to tenths of a px
```
*Criterion:* R-123

#### Ink component — [D]
*Serves:* G-8, G-2
*Code:* ink/ink.tsx (`Ink`, `outlineOf`)
```pseudo
symbol = one def.symbol per (tool object, d string)      # reused across uses
no draw:  <use href=symbol fill opacity class animation/>
draw:     <g fill opacity class animation>
            <use href=symbol mask=reveal opacity-hide at (at+over)/>
            <use href=symbol opacity-show at (at+over)/>
          reveal = mask over a +-1e4 userSpaceOnUse box, containing the centerline stroked white, width tool.size*2+2, round caps/joins, animated with draw(span, ease)
```
*Criterion:* R-124

#### Voxel arguments are checked — [D]
*Serves:* G-4
*Code:* space.ts (`camera`), voxel.ts (`check`), texture.ts (`texture`)
```pseudo
camera: yaw not finite -> throw "camera() needs a finite yaw, got y."
        !(0 < pitch < 90) -> throw "camera() needs a pitch between 0 and 90 degrees, got p."
        !(unit > 0) -> throw "camera() needs a positive unit, got u."
scene: any block.at component not an integer -> throw "voxel.scene() needs blocks on whole cells, got [x, y, z]."
       !(0 <= from < to) -> throw "voxel.scene() needs 0 <= from < to, got from F to T on the block at [x, y, z]."
texture: no rows -> throw "texture() needs at least one row of pixels, got none."; ragged row -> throw "texture() row Y has N pixels; row 0 has W."
         key missing from the palette -> throw 'texture() row Y uses "k", which the palette lacks.'; a color not #rgb/#rrggbb/#rrggbbaa -> throw "texture() needs #rgb, #rrggbb or #rrggbbaa colors, got c."
```
*Criterion:* R-125

#### Voxel painting order — [D]
*Serves:* G-8, G-7
*Code:* voxel.ts (`scene`, `depth`)
```pseudo
facing = [sign(sin yaw), 1, sign(cos yaw)]
depth(block) = fx*x + y + fz*z
visible blocks sorted ascending by depth (stable)      # far first, equal depth and same cell keep the given order
camera.project is linear: project(midpoint) = midpoint(project)
a block's y step projects to unit*cos(pitch) upward on screen
```
*Criterion:* R-126

#### Voxel lifetimes — [D]
*Serves:* G-2, G-3
*Code:* voxel.ts (`lifetime`)
```pseudo
from == 0 && to == Infinity -> no animation on the use
else opacity 0 until from (when from > 0), opacity 1 from `from`, opacity 0 from `to` (when finite)
a block's own animation is appended after the lifetime motion (its opacity channel is excluded by type)
```
*Criterion:* R-127

#### Buried block culling — [D]
*Serves:* G-1, G-2
*Code:* voxel.ts (`buried`, `covers`, `solid`)
```pseudo
neighbours = [x,y+1,z], [x+fx,y,z] if fx != 0, [x,y,z+fz] if fz != 0
buried(block) = block.animation undefined && every neighbour cell has a block that:
  has no animation, a skin whose every face resolves to an opaque texture,
  from <= block.from and to >= block.to
buried blocks are not emitted
```
*Criterion:* R-128

#### Voxel symbols and skins — [D]
*Serves:* G-1, G-8
*Code:* voxel.ts (`symbolOf`), texture.ts
```pseudo
faces = visible sides for the camera (east|west, south|north by sign, always top)
skin resolve(skin, face) = skin[face] ?? skin.side (or the texture itself if the skin is one texture)
one <symbol overflow:visible> per distinct tuple of texture ids over the visible faces; blocks <use> it at project(at)
each face grown by BLEED/unit on every side; shades top 1, south/north 0.8, east/west 0.6
```
*Criterion:* R-129

#### Ink and voxel output is deterministic — [D]
*Serves:* G-7
*Code:* ink/ink.tsx (`noise`, `pencil`), voxel.ts (`scene`)
```pseudo
every tool's noise(seed) is seeded value noise over hashed integer knots, never Math.random or a clock
voxel order = depth, then the given order for blocks on one cell; numbers print through num
=> the same scene rendered twice gives the same bytes
```
*Criterion:* R-130

#### Text width fallback — [P]
*Serves:* G-2
*Code:* font/font.ts (`textWidth`, `regularFace`)
```pseudo
textWidth(text, fontSize, font?) =
  font ? regularFace(font).measure(text, fontSize) : text.length * fontSize * 0.6
regularFace(family) = family.face()   # weight 400, normal
```
*Criterion:* R-131

### Layout and diagrams

#### Layout isolation — [D]
*Serves:* G-6
*Code:* `src/layout/*.ts`
```pseudo
for each file in src/layout:
  for each import path: path must match "./<sibling>"
```
*Criterion:* R-132

#### Layered input validation — [D]
*Serves:* G-4
*Code:* `layout/layered.ts` (layered), `layout/box.ts` (indexing)
```pseudo
indexing(nodes): index; unique = (index.size == nodes.length)
if !unique:                       throw "layered() node ids must be unique."
edge/group member id not in nodes: throw "layered() has no node "…"."
group with no members:            throw "Group "…" has no members."
node in two groups:               throw "Node "…" is in two groups."
```
*Criterion:* R-133

#### Layered ranking — [D]
*Serves:* G-8
*Code:* `layout/layered.ts` (backEdges, longestPath)
```pseudo
proper = edges where u != v
back   = DFS(input order) edges that close a cycle
rank   = longest path over proper edges with back edges reversed
rank(edge.to) > rank(edge.from) for every non-back edge; back edges point up in rank
```
*Criterion:* R-134

#### Layered node placement — [D]
*Serves:* G-8
*Code:* `layout/layered.ts` (order, place)
```pseudo
order ranks by 8 barycenter sweeps; groups contiguous
x = packed-left under min separation (r + l + max(gap)), relaxed 60 sweeps toward neighbours
LR: run in TB with w/h swapped, flip boxes and points out
no two node boxes overlap
```
*Criterion:* R-135

#### Layered groups — [D]
*Serves:* G-8
*Code:* `layout/layered.ts` (place, groupBoxes)
```pseudo
a group is one item per rank it spans, width = widest rank of members + padding (>= label width + 2*groupPad in TB)
group box = [top[r0]-padTop, bottom[r1]+groupPad] x column
non-members never sit inside the box (a group keeps one column through every rank)
```
*Criterion:* R-136

#### Layered edge routing — [D]
*Serves:* G-8
*Code:* `layout/layered.ts` (layered, ports), `layout/box.ts` (simplify)
```pseudo
route = simplify(port-out, track-y run, port-in, ...)   // axis-aligned segments only
first point on border of from, last point on border of to
a reversed (backward) edge's route is reversed back so it still runs from -> to
```
*Criterion:* R-137

#### Layered edge separation — [D]
*Serves:* G-8
*Code:* `layout/route.ts` (tracks, over), `layout/layered.ts`
```pseudo
every bent crossing in a rank gap gets a track (interval colouring, fans do not cross)
edges entering one node share a top-center port and merge MERGE above it; only that final segment may be shared
no segment passes through the interior of a node
```
*Criterion:* R-138

#### Layered straightness — [D]
*Serves:* G-8
*Code:* `layout/layered.ts` (ends, place weights)
```pseudo
if |outPortX - targetCenterX| <= min(SNAP, target.w/2): enter straight at outPortX
long edges (dummy chains) and one-to-one links pull with weight 8 / 4 so chains line up
a chain whose nodes have backward edges on both sides keeps one x, its edges 2 points
a wide source fans out so each edge leaves from above its target (<= 2 points)
```
*Criterion:* R-139

#### Layered backward edges and self loops — [D]
*Serves:* G-8
*Code:* `layout/layered.ts` (outside, sides, routes)
```pseudo
back edge: leaves and enters its nodes on the right (or left) side, climbing in its own channel
both ends at the same end of their ranks -> dummies go to that end of every spanned rank, innermost channel nearest
self loop: 4 points on the node's right edge, LOOP wide; its label sits right of the loop
```
*Criterion:* R-140

#### Edge label placement — [D]
*Serves:* G-8
*Code:* `layout/route.ts` (placeLabels)
```pseudo
for each labelled edge (self loops excluded): candidates = positions along each straight (non-jog) run,
  longest first, shifts of 0, ±4, ±8 ... within the room left after BEND at each end
cost = 8*(node hits + placed-label hits) + 2*(other segments crossed) + (run too short ? 1 : 0)
take the first zero-cost candidate, else the cheapest (never throws)
```
*Criterion:* R-141

#### Parallel and opposite edges — [D]
*Serves:* G-8
*Code:* `layout/layered.ts`
```pseudo
a->b, b->a, and a second a->b each get their own route; none equals another's, and their labels do not overlap
```
*Criterion:* R-142

#### Tree validation — [D]
*Serves:* G-4
*Code:* `layout/tree.ts` (tree)
```pseudo
ids not unique              -> throw "tree() node ids must be unique."
parent not a node           -> throw "tree() node "…" has an unknown parent "…"."
roots.length != 1           -> throw "tree() needs exactly one root, got …."
BFS from root misses nodes  -> throw "tree() parents form a cycle."
```
*Criterion:* R-143

#### Tree layout — [D]
*Serves:* G-8
*Code:* `layout/tree.ts` (tree)
```pseudo
lay(v): contours of children merged left to right, each child shifted so its left >= merged right + siblingGap at every depth
parent x = midpoint of first and last child; boxes never overlap; siblings keep input order
y per level = running sum of tallest-in-level + levelGap, nodes centered in their level band
LR: size w/h swapped, results flipped
```
*Criterion:* R-144

#### Tree edges and order — [D]
*Serves:* G-8
*Code:* `layout/tree.ts`
```pseudo
order = BFS from root, siblings in input order
edges[k] = parent bottom-center, mid-gap, child top-center (simplified), for order[k+1]
each edge starts on the parent's border and ends on the child's border
bounds = union(nodes, edge points)
```
*Criterion:* R-145

#### Sequence layout — [D]
*Serves:* G-8
*Code:* `layout/sequence.ts` (sequence)
```pseudo
actors empty or ids not unique -> throw "sequence() needs actors with unique ids."
row names unknown actor        -> throw "sequence() has no actor "…"."
gaps[i] = w_i/2 + w_{i+1}/2 + actorGap
demands sorted narrowest span first; need(from,to,len): if sum(gaps[from..to]) < len, grow each gap equally
```
*Criterion:* R-146

#### Sequence rows — [D]
*Serves:* G-8
*Code:* `layout/sequence.ts`
```pseudo
cursor starts at tallest head + 24; a message advances it by label.h + 4 + rowGap; a note by size.h + rowGap
message a != b: 2 points lifeline to lifeline at the same y; a == b: 4-point loop LOOP.w right
lifeline = head bottom to cursor + 8; bounds covers heads, labels, lifelines, points
```
*Criterion:* R-147

#### Lanes validation — [D]
*Serves:* G-4
*Code:* `layout/lanes.ts` (lanes)
```pseudo
!(scale > 0)                     -> throw "lanes() needs a positive scale, got …."
lanes empty or ids not unique    -> throw "lanes() needs lanes with unique ids."
unknown lane in a span/event/link-> throw "lanes() has no lane "…"."
any time < 0 or non-finite, or span.to <= span.from -> throw "lanes() times must be finite and non-negative, and each span must end after it starts."
```
*Criterion:* R-148

#### Lanes time axis — [D]
*Serves:* G-3, G-8
*Code:* `layout/lanes.ts`
```pseudo
end = max(1, all times); column = widest label + 24
x(t) = column + t*scale; row i spans y = i*rowHeight .. +rowHeight, width x(end)+16
tick step = first NICE value with step*scale >= 56 (else the last); ticks at k*step for k*step <= end
```
*Criterion:* R-149

#### Lanes marks — [D]
*Serves:* G-8
*Code:* `layout/lanes.ts`
```pseudo
span box: x(from), row mid - bar/2, (to-from)*scale wide, bar tall
event point: (x(at), row mid); its label box sits above the bar
link: vertical at x(at) from the edge of the first lane's bar to the edge of the second lane's bar, direction by row order
```
*Criterion:* R-150

#### Marching squares — [D]
*Serves:* G-2, G-8
*Code:* `layout/contour.ts` (marchingSquares)
```pseudo
for each cell with four non-NaN samples: mask of (sample >= level); saddle -> resolve by cell mean
segments between edge crossings (linear interpolation); join through shared edges
a loop returns closed = true with the last point not repeated; otherwise an open polyline
a cell with a NaN sample contributes nothing
```
*Criterion:* R-151

#### Evenly spaced streamlines — [D]
*Serves:* G-2, G-8
*Code:* `layout/field.ts` (traceStreamlines)
```pseudo
seed at bounds center; grow(seed): RK4 both ways, stop at bounds / |v| <= STILL / within spacing/2 of another line / maxLength
drop a line shorter than minLength; queue new seeds a spacing to both sides of the line
with options.seeds: trace exactly those (inside bounds), no filling; else scan the bounds when the queue is empty
each line runs with the field
```
*Criterion:* R-152

#### Polyline simplification — [D]
*Serves:* G-1, G-7
*Code:* `layout/field.ts` (simplify, Douglas-Peucker), `layout/box.ts` (simplify, axis-aligned)
```pseudo
field.simplify(points, tol): points.length < 3 or tol <= 0 -> copy; else keep endpoints and any point farther than tol from the chord (recursive)
box.simplify(points): drop repeated points and the middle of three on one x or one y
```
*Criterion:* R-153

#### Edge smoothing — [D]
*Serves:* G-8
*Code:* `extras/diagrams/curve.ts` (curve)
```pseudo
for corner i: if the next corner turns back to the incoming direction (a jog): one cubic S from points[i] to points[i+1], ends taking <= BEND
else: quarter-round cubic of radius min(CORNER, half of each neighbour run; whole run minus 2 at the route's ends)
d = "M…L…C…L…"; samples = ends + 9 points per cubic, consecutive duplicates removed; numbers printed to 2 decimals
```
*Criterion:* R-154

#### Diagram placement — [D]
*Serves:* G-4, G-8
*Code:* `extras/diagrams/kit.ts` (corner, placer, look)
```pseudo
corner = (x,y) - anchorPoint(bounds size)    // "top-left" | "center" | Edge
every box/point/bounds shifts by (corner - layout bounds origin)
bounds.x,y = the shifted corner; options default theme defaultDark, fontSize 14, anchor "top-left", x = y = 0
```
*Criterion:* R-155

#### Role shapes and outline attachment — [D]
*Serves:* G-8
*Code:* `extras/diagrams/kit.ts` (sizeOf, outline, onOutline, drawNode)
```pseudo
size = text width + 2.2*fontSize (h = round(2.8*fontSize)); input adds 0.7h, output 0.4h, tool 16, store h + 10; decision w = 1.45*text + 4*fontSize, h = round(4.4*fontSize)
onOutline(role, box, end, toward): decision -> end moved to the diamond edge; input/output/store -> to the slanted/rounded/lidded outline; task/tool -> unchanged
flowchart and state edges apply it to both ends after layout
```
*Criterion:* R-156

#### Flowchart lookups — [D]
*Serves:* G-4, G-9
*Code:* `extras/diagrams/flowchart.ts` (flowchart, paths), `kit.ts` (lookup)
```pseudo
get(id) not a node or group -> throw "flowchart() has no "…"."
edge(a,b): first edge a->b, curve(points).samples; none -> throw "No edge from "…" to "…"."
route(a,b): a == b -> [center(a)]; else BFS over directed edges, concatenating each hop's samples; unreachable -> throw "No path from "…" to "…"."
node/group/edge ids not in spec.nodes are a compile error (const generics)
```
*Criterion:* R-157

#### Flowchart play timing — [D]
*Serves:* G-3
*Code:* `extras/diagrams/flowchart.ts`
```pseudo
order = nodes by rank then cross-axis position; rank-0 nodes are visible from the start (-Infinity)
later = rank > 0 nodes; times = beats(play.at, later.length, step)
node pops in at its time (popIn); edge draws at max(0, shown(from), shown(to) - drawOver), drawOver = min(0.4, step); label fades at draw end
group fades in at its first member's time; without play nothing animates
```
*Criterion:* R-158

#### Direction option — [D]
*Serves:* G-8
*Code:* `flowchart.ts`, `state.ts`, `tree.ts`
```pseudo
direction "TB" (default): later ranks have larger y; "LR": larger x, same cross-axis position preserved
```
*Criterion:* R-159

#### Sequence diagram timing — [D]
*Serves:* G-3
*Code:* `extras/diagrams/sequence.ts` (sequence)
```pseudo
times = beats(play.at, rows.length, step 0.8); span(i) = {at: times[i], over: next - this, or step for the last}
message(i): i out of range -> throw "sequence() has no message …."; else {span, points} (points = arrow, or note center)
arrow draws at span.at over min(0.5, 0.7*over) (0.3 if that is 0); label fades 0.25 s; lifelines present from the start
```
*Criterion:* R-160

#### State machine construction — [D]
*Serves:* G-4
*Code:* `extras/diagrams/state.ts` (stateMachine, scope, chain, home)
```pseudo
state id seen twice anywhere            -> throw "stateMachine() has two states named "…"."
scope.initial not among scope's states  -> throw "stateMachine() initial "…" is not one of its scope's states."
transition names unknown id             -> throw "stateMachine() has no state "…"."
each scope draws a start dot to its initial; final states lead to one bullseye
```
*Criterion:* R-161

#### State composite layout — [D]
*Serves:* G-8
*Code:* `extras/diagrams/state.ts` (lay, home)
```pseudo
lay(scope): lay inner scopes first; composite size = max(own label size, inner + 2*PAD wide); header = round(2.6*fontSize) + inner + 2*PAD tall
a transition lives in the scope of the deepest common ancestor of its ends, attached to the two ancestors that are direct members
inner boxes sit inside the container below its header; a transition into a composite ends on its border; one from an inner state leaves the container
```
*Criterion:* R-162

#### Walk timing — [D]
*Serves:* G-3
*Code:* `extras/diagrams/state.ts` (walk)
```pseudo
leg(k).over = max(0.35, pathLength / speed)
at: number -> arrive[k] = at + k*dwell + sum(leg.over before k); token runs [arrive[k+1]-over, arrive[k+1]]
at: list   -> arrive = beats(at, path.length); token over = min(leg.over, gap/2)
state lit from arrive[k] until the next token starts (last: dwell); end = arrive.last + dwell
```
*Criterion:* R-163

#### Walk legality — [D]
*Serves:* G-4, G-9
*Code:* `extras/diagrams/state.ts` (walk, step)
```pseudo
path empty -> throw "walk() needs at least one state, got none."
step(a,b): a transition b from a or any composite holding a; else if b is the initial state of composite a -> its start line; else throw "walk() has no way from "…" to "…"."
```
*Criterion:* R-164

#### Tree diagram route and play — [D]
*Serves:* G-3, G-8
*Code:* `extras/diagrams/tree.ts`
```pseudo
times = beats(play.at, nodeCount - 1, step 0.3); root visible from the start; breadth-first order
edge draws at max(0, shown(parent), shown(child) - min(0.35, step))
route(a,b): a == b -> [center]; else samples up from a to the nearest common ancestor then down to b along drawn edges
```
*Criterion:* R-165

#### Lanes diagram play — [D]
*Serves:* G-3
*Code:* `extras/diagrams/lanes.ts`
```pseudo
x(t) = shifted out.x(t); lane time 0 = play.at
with play: span width grows from 0 over (to - from) linear; event pops (scale 0.3 -> 1) at when(at); link arrow draws 0.3 s at when(at) with a dot travelling it; a playhead sweeps the track in `end` seconds
without play: everything static
```
*Criterion:* R-166

#### Diagram renders valid SVG — [D]
*Serves:* G-1, G-4
*Code:* all `extras/diagrams/*.ts`
```pseudo
render(scene, diagram.node) does not throw, with or without play, for an empty-edge flowchart and for walk overlays
```
*Criterion:* R-167

#### Deterministic layout — [P]
*Serves:* G-7
*Code:* `layout/*.ts`
```pseudo
same input -> same output: tie-breaks use input order / vertex index; sweeps are fixed counts; no Math.random, no Date, no object-key iteration of unordered data
```
*Criterion:* R-168

### Extras

#### Code layout — [D]
*Serves:* G-8, G-2, G-7
*Code:* `extras/code.ts` (`code`)
```pseudo
rows = (string ? split("\n") : tokens).map(pieces -> {content,color,id}); role runs color via tint(theme, role)
origin = x + (gutter ? (digits + 2) * advance : 0)
advance = options.advance ?? (font ? monospaceAdvance(font) : fontSize * 0.6)
words = for each piece, each /\S+/ run -> {text, line, column, x = origin + col*advance, y = top(line), color, fontStyle, id}
```
*Criterion:* R-169

#### Code queries — [D]
*Serves:* G-4, G-9
*Code:* `extras/code.ts` (`lines`, `at`, `find`, `get`)
```pseudo
lines(a, b=a): integers, 1 <= a <= b <= lineCount else throw; Rect(origin, top(a), longestLine*advance, (b-a+1)*height)
at(line, col): 1 <= col <= length(line)+1 else throw; Point(origin+(col-1)*advance, top(line))
find(s, nth=1): nth-th occurrence in the joined line text, spanning token boundaries; throw with the count found
get(id): union of Rects of all words with that id; throw when none
```
*Criterion:* R-170

#### Code input validation — [D]
*Serves:* G-4, G-9
*Code:* `extras/code.ts` (`code`, `monospaceAdvance`)
```pseudo
if any token content matches /[\n\r\t]/ throw "code() tokens must not contain line breaks or tabs."
if font given and measure("i") != measure("W") (> 0.01) throw "code() needs a monospaced font, and … is proportional. …"
if fontSize, lineHeight or advance is not > 0, or x+y not finite throw "code() needs finite coordinates and positive metrics, …"
```
*Criterion:* R-171

#### Role colors — [D]
*Serves:* G-5, G-8
*Code:* `extras/theme.ts` (`base16`, `tint`)
```pseudo
base16(...colors): colors.length must be 16 else throw "base16() needs 16 colors, got …"; slot i -> colors[i]
tint(theme, role) = theme[ROLES[role]]
```
*Criterion:* R-172

#### CSS-variable themes — [D]
*Serves:* G-5, G-7
*Code:* `extras/theme.ts` (`variables`, `adaptive`)
```pseudo
variables(dark, light?): names must match /^[A-Za-z_][\w-]*$/ else throw
  vars[name] = "var(--name)"
  css = "svg{--n:v;...}" + (light ? "\n@media (prefers-color-scheme:light){svg{...}}" : "")
adaptive({dark, light}) = { theme: vars(dark), css }    // one declaration per base16 slot, dark first
```
*Criterion:* R-173

#### Morph pairing — [D]
*Serves:* G-8
*Code:* `extras/morph.ts` (`match`, `unnamed`)
```pseudo
named = pairs (i,j) of equal id and equal occurrence index
rest  = LCS on text over words not in named, in order
left  = remaining equal-text words, paired nearest first by distance (swapped words cross)
return named ++ rest ++ left
```
*Criterion:* R-174

#### Morph choreography — [D]
*Serves:* G-8, G-3
*Code:* `extras/morph.ts` (`morph`)
```pseudo
for each transition i at at[i], over:
  paired same text   -> move by delta (ease.inOut)
  paired text changed (same id) -> old fades while moving, new moves from old position and fades in (both render)
  unpaired old -> opacity 0 over over/2 at at[i];  unpaired new -> opacity 1 over over/2 starting at at[i]+over/2
spans[i] = {at[i], over}; end = at.last + over, or 0 for one version
each piece is drawn by its own source Morphable
```
*Criterion:* R-175

#### Morph validation — [D]
*Serves:* G-4, G-9
*Code:* `extras/morph.ts` (`morph`)
```pseudo
if versions.length == 0 or at.length != versions.length-1 or !(over > 0) throw "morph() needs one start per transition …"
if at[i] < at[i-1] + over throw "morph() transition i starts before transition i-1 ends."
if gutter and not every version is code() throw "morph() draws a gutter only for code() versions."
```
*Criterion:* R-176

#### Typewriter timing — [D]
*Serves:* G-8, G-3
*Code:* `extras/typewriter.ts` (`typewriter`)
```pseudo
if !(at >= 0 && cps > 0) throw "typewriter() needs a non-negative start and a positive cps, …"
line k: start_k = prevEnd + 1/cps (first: at); over_k = chars_k / cps; blank line takes only its newline
end = last line's end; spans[k] = {start_k, over_k}
cursor: blinks (1 s loop) following the typing; with blink=false it hides at end
```
*Criterion:* R-177

#### Reveal blocks — [D]
*Serves:* G-8, G-3
*Code:* `extras/reveal.ts` (`reveal`, `paragraphs`)
```pseudo
blocks = explicit ranges | "line" | paragraphs split at blank lines (blank lines join the block after)
each range must be integers within 1..lineCount else throw "reveal() block a-b is outside lines 1-n."
a line in two blocks throws "reveal() has line n in two blocks."
lines in no block render unanimated; spans[k] = {beats(at)[k], over}; end = max(at+over)
step >= 0, over > 0 else throw
```
*Criterion:* R-178

#### Terminal session — [D]
*Serves:* G-8, G-3
*Code:* `extras/terminal.ts` (`terminal`)
```pseudo
session must have >= 1 command else throw
each command line = prompt + " " + cmd laid out one row below the last; typed with a cursor; blink only on the last command
output lines appear printed + i*0.06 after the typed end + think
end = last output (or last typed char) time; bounds = union of line bounds
```
*Criterion:* R-179

#### App window — [D]
*Serves:* G-8
*Code:* `extras/window.ts` (`appWindow`)
```pseudo
node = rounded rect + bar divider at frame.y + bar + dots (muted | traffic | none) + centered title
body = Rect(frame.x, frame.y + bar, frame.w, frame.h - bar)
```
*Criterion:* R-180

#### Annotation timing — [D]
*Serves:* G-3, G-8, *honest timing*
*Code:* `extras/annotations.ts` (`Arrow`, `Callout`, `Brace`, `Underline`), `extras/timeline.ts` (`during`)
```pseudo
Arrow/Callout/Brace/Underline: opacity = during(span, 0.2); Arrow draws its shaft over min(0.6, over/2), head pops after
Underline also draws on over min(0.5, over/2)
no keyframe stop falls outside [span.at, span.at+span.over]
```
*Criterion:* R-181

#### Accent default — [D]
*Serves:* G-5, *typed authoring*
*Code:* `extras/annotations.ts`, `marker.ts`, `flow.ts`
```pseudo
color = options.color ?? theme.base09, theme = options.theme ?? defaultDark
```
*Criterion:* R-182

#### Brace sides — [D]
*Serves:* G-8
*Code:* `extras/annotations.ts` (`Brace`)
```pseudo
side left/right: vertical brace 8px outside the target; label 20px further out, anchor end/start
side above/below: horizontal brace 8px above/below the target; label centered on the target at edge ∓ (4+fontSize | 10+fontSize)
```
*Criterion:* R-183

#### Callout layout — [D]
*Serves:* G-8
*Code:* `extras/annotations.ts` (`Callout`)
```pseudo
words wrap greedily at `columns` characters
w = max(textWidth(line)) + 20;  h = lines * fontSize * 1.4 + 16;  gap = 20
box sits `side` of target (default right), vertically/horizontally centered; leader joins the target's side midpoint to the box's near edge
```
*Criterion:* R-184

#### Focus — [D]
*Serves:* G-8
*Code:* `extras/focus.ts` (`Focus`)
```pseudo
if !(0 <= dim <= 1) throw "Focus() needs dim between 0 and 1, got …"
mask = white base rect (opacity dim during merged stop spans, 1 otherwise) + white rect per stop target faded with during(stop.during, fade)
stops whose spans touch or overlap merge, so back-to-back stops keep the dim (no flash)
children wrapped in <g mask>
```
*Criterion:* R-185

#### Marker — [D]
*Serves:* G-8
*Code:* `extras/marker.ts` (`Marker`)
```pseudo
if stops.length == 0 throw "Marker() needs at least one stop, got none."
if !(over > 0) throw "Marker() needs a positive over, got …"
box starts at stops[0].target; for each later stop at stop.during.at it translates and resizes to the target over `over`
```
*Criterion:* R-186

#### Camera and Steady — [D]
*Serves:* G-8
*Code:* `extras/camera.ts` (`fit`, `Camera`, `Steady`)
```pseudo
fit(frame, "all") = {x:0,y:0,scale:1}
fit(frame, r) = scale = min(frame.w/r.w, frame.h/r.h), r centered in frame; throw if r.w or r.h is not > 0
Camera: stop at 0 -> set; else at span.at ease to fit(...) over `over` (default 0.5, ease.inOut)
Steady: scale = 1 / fit(...).scale at the same times, transform-origin at `at`
```
*Criterion:* R-187

#### Timeline scenes — [D]
*Serves:* G-3, *honest timing*
*Code:* `extras/timeline.ts` (`timeline`, `beats`, `readingTime`)
```pseudo
timeline(durations, {at=0,gap=0,fade=0.3,pace=1}): throw if !(at>=0 && gap>=0 && fade>0 && pace>0)
  names duration|end|show|enter are reserved; each length must be > 0
  scene i: at = i==0 ? start : prevEnd + gap;  over = length * pace   // gap not scaled by pace
  show(name) = during(span, fade); enter(name) fades in and stays; unknown name throws "No scene named …"
beats(at, count, step): number -> at + i*step (at >= 0); list -> length == count, non-negative, non-decreasing, else throw
readingTime(text) = max(min=2, words/3.5 + settle=1)
```
*Criterion:* R-188

#### Span envelopes — [D]
*Serves:* G-3, G-8
*Code:* `extras/timeline.ts` (`during`, `cut`, `visible`, `shot`, `mergeSpans`)
```pseudo
during(span, fade=0.3): fade in at span.at, out by span.at+over; f = min(fade, over/2)
cut(span): opacity 1 only inside span, hard edges (at 0: starts on)
visible(spans, fade=0.15): merge spans closer than 2*fade, fade in/out on each merged span
shot(span, {enter=cut, exit=cut, over=0.45}): throws unless at>=0, over>0, move>0; moves cut|fade|rise(y24)|zoom(scale .94)|slide(x80) happen inside the span; exit mirrors the entry
```
*Criterion:* R-189

#### Travel and heading — [D]
*Serves:* G-8, G-3
*Code:* `extras/timeline.ts` (`travel`, `facings`)
```pseudo
total = path length; duration = over ?? total/speed(300); throw if !(total>0 && duration>0)
token hidden until `at`, appears, runs each leg at constant speed (ease.linear), vanishes at the end
heading: rotate = leg angle (vertex = mean of adjacent legs, unwrapped within 180 of the previous) + offset
```
*Criterion:* R-190

#### Flow tokens — [D]
*Serves:* G-8, G-2
*Code:* `extras/flow.ts` (`flow`)
```pseudo
over = options.over ?? pathLength/speed; end = at+over (+0.7 with arrive)
loop with style trace or arrive throws "flow() loops a dot, comet or packet. …"
loop for a comet must be >= at+over+REACH/speed else throw "flow() needs a loop period past …"
styles: dot | comet (halo + tail dots lagging REACH/tail/speed) | trace (path draws, fades) | packet (labelled pill sized by textWidth)
```
*Criterion:* R-191

#### Axes geometry and validation — [D]
*Serves:* G-4, G-8
*Code:* `extras/axes.ts` (`axes`, `ticksIn`, `checkRange`)
```pseudo
each range must be finite with max > min else throw "axes() needs a finite … range with max above min, …"
width and height > 0 and finite; fontSize > 0; tick step > 0 and finite; more than 500 ticks throws "axes() would draw … ticks. Raise the step …"
point(gx, gy) maps graph to scene px (y flipped); axes cross at 0 when in range, else on the bottom/left edge
labels printed via toPrecision(12), "-0" never; y label at 0 omitted when the x axis crosses at 0
no ticks (no step) -> no tick labels
```
*Criterion:* R-192

#### Function plots — [D]
*Serves:* G-8, G-7
*Code:* `extras/axes.ts` (`plot`)
```pseudo
samples integer >= 2 else throw; from < to else throw "plot() needs from below to, …"
sample f at samples points over [from,to]; drop non-finite and > one plot height outside the range; break the run at a drop or a jump taller than the y range
points rounded to 0.1 px; no point left -> throw "plot() found no finite values inside the y range …"
node clipped to the plot rect; animation (e.g. draw) applied to the path
```
*Criterion:* R-193

#### Moving values — [D]
*Serves:* G-3, G-4
*Code:* `extras/calculus.ts` (`valueOf`, `sweepsOf`, `endOf`)
```pseudo
number: must be finite else throw "… needs a finite value, got …"
sweeps: >=1; each needs finite from/to, at >= 0, over > 0; sweep i+1 must not start before sweep i ends (1e-9)
value(t) = s.from + (s.to - s.from) * easeAt(s.ease ?? inOut, clamp((t - s.at)/s.over)), s = last sweep with at <= t, else the first (before it: from)
holds `to` between and after sweeps
```
*Criterion:* R-194

#### Dot, tangent, secant — [D]
*Serves:* G-8, G-2
*Code:* `extras/calculus.ts` (`dot`, `tangent`, `secant`, `segment`, `lineNode`)
```pseudo
dot: on f at x(t); point(t) = scene px; non-finite f throws "dot() found no finite value of f at x=…"
tangent: segment length (default plot.w/2) centered on the curve with slope = central difference; non-finite slope throws
secant(f, x, h): slope (f(x+h)-f(x))/h, derivative when |h| tiny; dots at both ends unless points:false; length >= chord + 48
moving lines bake into a d motion through sampledPath(tolerance 0.4); static lines have no animation
length must be > 0
```
*Criterion:* R-195

#### Area — [D]
*Serves:* G-8
*Code:* `extras/calculus.ts` (`area`)
```pseudo
region between f and base (default 0) over [from(t), to(t)], samples (default 120, integer >= 2) points, curve clamped to 10% past the plot, closed with Z
value(t) = trapezoid sum of (f - base) dx, using the unclamped f; either bound may be a Moving
```
*Criterion:* R-196

#### Riemann stages — [D]
*Serves:* G-8
*Code:* `extras/calculus.ts` (`riemann`)
```pseudo
n: whole numbers >= 1; from < to; at.length == stages - 1 else throw "riemann() has k stages, so it needs k-1 start times in at, got …"
every stage emits max(n) rectangles (copies of its own), so all stages share commands; one path; stage s begins at at[s-1], over (0.8), ease
sums[s] = (sum of sampled heights / n) * (to - from); rule left|mid|right picks the sample point
```
*Criterion:* R-197

#### Curve morph, parametric, polar — [D]
*Serves:* G-8
*Code:* `extras/calculus.ts` (`morph`, `parametric`, `polar`, `trace`)
```pseudo
morph(fs, {at, over=1}): >= 2 functions; at.length == fs.length-1; colors none, one, or one per function; from < to; values clamped near the plot; one grid -> same commands -> d motion; stroke follows with per-function colors
parametric(fn, [t0,t1], {samples=400}): t1 > t0, samples >= 2; polar = parametric of (r cos t, r sin t), default range [0, 2π]
trace breaks a run at non-finite points, points far outside the y range, or jumps over a full x or y span; no run -> throw "… found no finite points inside the y range."
```
*Criterion:* R-198

#### Readout — [D]
*Serves:* G-8, G-3
*Code:* `extras/calculus.ts` (`readout`)
```pseudo
at >= 0, over > 0, step > 0 (default 1/12) else throw
sample text(t) at round(over/step)+1 times across [at, at+over]
one <text> per distinct string, shown while it holds (visibility toggled); the first string is shown from t=0; the last stays after the span
```
*Criterion:* R-199

#### Streamlines — [D]
*Serves:* G-8, G-2
*Code:* `extras/field.ts` (`streamlines`)
```pseudo
bounds need w,h > 0; spacing, step, maxLength > 0 else throw "streamlines() needs a positive …"
tracing, spacing and seeds are R-152 (`layout/field.ts`); minLength defaults to spacing
each line simplified to tolerance (0.25) and rounded; d = one subpath per line
```
*Criterion:* R-200

#### Field lines and flow — [D]
*Serves:* G-8, G-2
*Code:* `extras/field.ts` (`fieldLines`, `fieldFlow`)
```pseudo
fieldLines: over, each > 0; line i draws at at + i/(n-1) * max(0, over-each), nearest the middle first
fieldFlow: speed > 0; one particle per line, start offset ((i+1)*GOLDEN) mod 1 of the line; period = trip + reach + rest;
  a part-way start runs as two flow() pieces; comet costs 4-8 animated elements per line, dot 1-2
group fades in at `at` over 0.6
```
*Criterion:* R-201

#### Vector field — [D]
*Serves:* G-8
*Code:* `extras/field.ts` (`vectorField`)
```pseudo
columns = max(1, floor(w/spacing)), rows likewise; lattice centered in bounds; arrow centered on its lattice point
zero or non-finite field values draw nothing; longest arrow = 0.85*spacing unless scale; normalize -> 0.7*spacing each
d = shaft + open head per arrow (head <= 6px, wings ±0.45 rad)
```
*Criterion:* R-202

#### Slope field and solution — [D]
*Serves:* G-8
*Code:* `extras/field.ts` (`slopeField`, `slopeSolution`)
```pseudo
slopeField: marks at multiples of step/stepY (default 1/20 of the range) in graph units; NaN -> none; ±Infinity -> vertical mark; flat slope -> flat mark
slopeSolution(f, axes, start): RK4 both ways from start (graph units) with step range/400, <= 4000 steps per side, stops when y leaves one range height beyond; points in scene px
```
*Criterion:* R-203

#### Contours — [D]
*Serves:* G-8
*Code:* `extras/field.ts` (`contours`, `gridOf`, `levelOf`)
```pseudo
needs bounds or axes else throw "contours() needs bounds or axes to place the samples."
grid source: cols,rows >= 2 and values.length == cols*rows else throw; row 0 is the top
function source: sampled every `resolution` px (4), in graph units when axes is given
marching squares per level (R-151); lines simplified to tolerance (0.2); closed rings end in Z
```
*Criterion:* R-204

#### Contour sweep — [D]
*Serves:* G-8, G-2
*Code:* `extras/field.ts` (`contourSweep`)
```pseudo
frames integer >= 2 (16); over > 0
levels evenly from `from` to `to`; any level without a line throws "contourSweep() found no line at level …"
matchPaths(precision 1) -> motion {d}, starting at `at`, each step over/(frames-1), linear
```
*Criterion:* R-205

#### Public type surface — [P, unbuilt]
*Serves:* G-4
*Code:* `extras.ts`
```pseudo
every type that appears in an exported signature is exported from svjeez/extras
(missing today: MorphResult, TypewriterResult, RevealResult, TerminalResult, AppWindowResult, FlowResult, AdaptiveResult, VariablesResult)
```
*Criterion:* R-206

### Frames, CLI, plugins and release

#### Validate frame options before launching — [D]
*Serves:* G-4, G-3
*Code:* `src/frames.ts` (`resolve`, `size`, `renderFrames`)
```pseudo
size(svg): root = first <svg ...> tag; width/height = numeric attrs; throw unless both > 0
resolve: scale = options.scale ?? 1; throw unless finite and > 0
         scheme = system -> systemColorScheme(); throw unless light|dark
renderFrames: times each finite and >= 0, or count positive integer;
              sheet.columns, if given, positive integer
all of this runs before launch(); thrown messages start with the caller ("renderFrames()", "openScene()", or the caller passed in)
```
*Criterion:* R-207

#### SVG root must carry a numeric size — [D]
*Serves:* G-4
*Code:* `src/frames.ts` (`size`)
```pseudo
width = parseFloat(/\swidth="([\d.]+)"/ in the root tag); height likewise
if !(width > 0 && height > 0) throw "<caller> needs an <svg> root with numeric width and height, got … by …."
```
*Criterion:* R-208

#### Frame times — [D]
*Serves:* G-3
*Code:* `src/frames.ts` (`renderFrames`)
```pseudo
times = options.times ?? [0..count-1].map(i => i * duration / count)
duration = page loopLength()   // one loop, seconds
frames[i] = { time: times[i], png: capture(times[i]) }   // in order
```
*Criterion:* R-209

#### Seek pauses every animation at a time — [D]
*Serves:* G-3
*Code:* `src/page.ts` (`seek`), `src/frames.ts` (`stage.capture`)
```pseudo
seek(time, root = document):
  for a in root.getAnimations(subtree if Element): a.pause(); a.currentTime = time*1000
  for svg in root.querySelectorAll("svg") + (root itself if an <svg>): svg.pauseAnimations(); svg.setCurrentTime(time)
```
CSS and SMIL (filter primitives) both land at the same time. A `loop: false` scene holds its last frame past its end; a scene started past its end is valid.
*Criterion:* R-210

#### Same inputs give the same pixels — [D]
*Serves:* G-7, G-3
*Code:* `src/frames.ts` (`stage`, `renderFrames`)
```pseudo
two renderFrames(svg, same options) in parallel -> byte-identical PNG at each time
```
*Criterion:* R-211

#### Frames render the scene as a viewer would — [D]
*Serves:* G-5, G-2
*Code:* `src/frames.ts` (`stage`, `resolve`)
```pseudo
page.colorScheme = resolved scheme; reducedMotion = "no-preference"
#stage background = options.background ?? "Canvas"; screenshot omitBackground:true
colorScheme "system" -> systemColorScheme(); same as passing that scheme explicitly
```
Light and dark side of an adaptive scene differ; an embedded raster and an embedded SVG `<image>` paint their own colors.
*Criterion:* R-212

#### Loop length is the common period — [D]
*Serves:* G-3
*Code:* `src/page.ts` (`loopLength`)
```pseudo
periods = CSS durations + SMIL dur, ms, > 0 ; longest = max(periods)
for k in 1..1000: loop = longest*k; if every p fits(loop, p) return loop/1000
return longest/1000   // no common period found
fits(loop,p): cycles = round(loop/p) > 0 && |loop - cycles*p| < max(1, cycles*0.5 + 0.01)
no animation -> 0
```
Scenes of only inner loops (2s and 3s) last 6 s; periods that are rounded fractions of the duration (12/7 s rounded to 1714 ms) still give the duration.
*Criterion:* R-213

#### Seek and loopLength scope to a root — [D]
*Serves:* G-3, G-10
*Code:* `src/page.ts` (`seek`, `loopLength`)
```pseudo
seek(t, svgEl) / loopLength(svgEl): only animations in svgEl's subtree; the rest of the page keeps running
loopLength() with no root: the whole document
```
*Criterion:* R-214

#### Contact sheet — [D]
*Serves:* G-3, G-9
*Code:* `src/frames.ts` (`sheetHtml`, `renderFrames`)
```pseudo
if !options.sheet: no sheet
across = min(columns ?? 4, frames.length)
sheetSize = max(across*(w+GAP)+GAP, ceil(n/across)*(h+GAP+CAPTION)+GAP)   // CSS px
dsf = min(scale, MAX_CAPTURE / sheetSize)
sheet = screenshot of body, each frame captioned "t = <time>s" (3 dp, trailing zeros trimmed)
```
A sheet bigger than one capture is returned whole at a lower scale, never cropped.
*Criterion:* R-215

#### openScene shares the render path — [D]
*Serves:* G-3
*Code:* `src/frames.ts` (`openScene`, `stage`)
```pseudo
settings = resolve(caller, svg, options)       // errors name `caller`
browser = launch(caller, executablePath); scene = stage(browser, ...)
on error during stage: close browser, rethrow
scene.capture(t) equals renderFrames({times:[t]}) bytes at the same options
page is a secure context (VideoEncoder exists)
```
*Criterion:* R-216

#### Chromium launch and its failures — [D]
*Serves:* G-9
*Code:* `src/frames.ts` (`launch`)
```pseudo
import playwright-core else throw "<caller> needs playwright-core. Install it with …"
try launch({executablePath})
catch if executablePath -> rethrow
catch -> launch({channel:"chrome"}) else throw "No Chromium to render with. Run … or pass executablePath.\n<first error>"
```
*Criterion:* R-217

#### System color scheme — [P]
*Serves:* G-5
*Code:* `src/scheme.ts` (`systemColorScheme`)
```pseudo
darwin: `defaults read -g AppleInterfaceStyle` == "Dark" -> dark
win32:  registry AppsUseLightTheme == 0x0 -> dark
other:  gsettings color-scheme contains "dark" -> dark
any failure or 2 s timeout -> light
```
*Criterion:* R-218

#### CLI loads a scene from .svg or a module — [D]
*Serves:* G-4, G-9
*Code:* `src/cli.ts` (`loadSvg`)
```pseudo
.svg -> read text
else import(file URL); on ERR_UNKNOWN_FILE_EXTENSION: register tsx (cwd first), retry; no tsx -> fail "Node cannot load <file>. Install tsx, …"
default export: string, or function (sync/async) -> string; else fail "<file> must export default an SVG string, or a function that returns one."
```
*Criterion:* R-219

#### svjeez svg — [D]
*Serves:* G-4, G-1
*Code:* `src/cli.ts` (`svgCommand`, `report`)
```pseudo
svg = loadSvg(positionals[0] ?? fail(USAGE))
for w in validateSvg(svg).warnings: stderr "warning: w"
--out/-o file -> write file; else write stdout
```
*Criterion:* R-220

#### svjeez frames — [D]
*Serves:* G-3, G-9
*Code:* `src/cli.ts` (`framesCommand`, `when`, `number`, `parseScheme`)
```pseudo
--times and --count together -> fail "Pass --times or --count, not both."
--times a,b,c : each a finite number, empty entry fails ; --count default 6, positive integer
--sheet or --columns (implies sheet); --scale, --color-scheme system|light|dark (checked before loading the scene), --background
write <out ?? "frames">/frame-NN-<t 3dp, '.' -> '_'>s.png, plus sheet.png; print "loop <duration>s, <scheme>" then the paths
```
*Criterion:* R-221

#### svjeez video — [D]
*Serves:* G-3
*Code:* `src/cli.ts` (`videoCommand`, `loadVideo`)
```pseudo
format = --format ?? ext(--out) in {mp4,webm} ?? "mp4"; --out ext and --format disagree -> fail "--format … doesn't match --out …."
out = --out ?? <basename of file>.<format>
loadVideo: resolve @svjeez/video from cwd/package.json, then from the CLI's own location, else fail "svjeez video needs @svjeez/video. Install it with …"
renderVideo(svg, {format,fps,loops,quality,scale,colorScheme,background}); print "<out>: <codec>, <frames> frames, <duration>s, <scheme>"
```
*Criterion:* R-222

#### svjeez skill — [D]
*Serves:* G-9
*Code:* `src/cli.ts` (`skillCommand`)
```pseudo
no --install : print skills/svjeez/SKILL.md to stdout, byte for byte
--install [--dir D (default .claude/skills)] : cp -r skills/svjeez -> D/svjeez, overwriting; rerun is safe
print "installed the svjeez skill in <relative path>"
```
Installs SKILL.md, `references/`, `examples/` (the examples carry their own JSX pragma).
*Criterion:* R-223

#### Unknown command and failures exit 1 — [D]
*Serves:* G-4
*Code:* `src/cli.ts` (`fail`, `COMMANDS`)
```pseudo
COMMANDS.get(cmd) ?? fail(USAGE)    // includes a missing command and the removed "render"
run(args).catch(e => fail(e.stack ?? e.message))   // stderr, exit code 1
```
*Criterion:* R-224

#### Skill documentation is checked against the code — [D]
*Serves:* G-9
*Code:* `tests/skill.test.ts`
```pseudo
each skills/svjeez/examples/*.tsx default export builds an SVG with no validateSvg errors and contains "@keyframes"
every `examples/x.ext` / `references/x.ext` path mentioned in SKILL.md or a reference exists (> 10 mentions)
every references/* file name appears in SKILL.md
every row of SKILL.md's "Runtime errors" table appears (split on "…") on one line in some src/**/*.ts
```
*Criterion:* R-225

#### Skill examples render on Node 20 and 22 — [D]
*Serves:* G-6, G-9
*Code:* `packages/svjeez/scripts/node-check.ts`
```pseudo
for each skills/svjeez/examples/*.tsx: import default, call, validateSvg; errors -> mark failed
exit 1 if any failed; print "<n>/<total> scenes rendered on <node version>"
```
Run by CI through `tsx` on Node 20 and 22. It does not require `@keyframes`.
*Criterion:* R-226

#### Package build for svjeez — [D]
*Serves:* G-6, G-1
*Code:* `packages/svjeez/scripts/package.ts`
```pseudo
rm package-dist; Bun.build 9 entrypoints (index, extras, voxel, jsx-runtime, jsx-dev-runtime, frames, page, params, cli), root ./src, target node, splitting, external playwright-core
tsc -p tsconfig.package.json for declarations; non-zero exit -> fail
append ".js" to relative specifiers in every .d.ts
copy ../../README.md and ../../LICENSE next to package.json
```
*Criterion:* R-227

#### Packed svjeez tarball is checked as a consumer — [D]
*Serves:* G-4, G-6, G-9
*Code:* `packages/svjeez/scripts/package-check.ts`
```pseudo
npm pack; publint --strict; attw (ignore cjs-resolves-to-esm)
extract into consumer/node_modules/svjeez
for compiler in [TypeScript 5.4, latest], resolution in [node10 (TS 5 only), node16, nodenext, bundler]: tsc -p on a TSX consumer
  (the consumer has a @ts-expect-error on an unknown flowchart node id, so typed ids stop checking -> failure)
for entry in 8 entry points: import() and require() succeed
exit 1 if any check failed
```
*Criterion:* R-228

#### renderVideo option validation — [D]
*Serves:* G-4
*Code:* `packages/video/src/index.ts` (`renderVideo`, `isFormat`, `allows`, `isQuality`)
```pseudo
format in {mp4,webm}; codec in FORMATS[format].codecs (default first); fps finite > 0; loops positive integer
quality in {low,medium,high}; background === "transparent" requires the format to carry alpha (webm)
all throw "renderVideo() needs …" before any browser starts; scale/colorScheme are checked by openScene(…, "renderVideo()")
```
*Criterion:* R-229

#### renderVideo frame schedule and size — [D]
*Serves:* G-3
*Code:* `packages/video/src/index.ts` (`renderVideo`)
```pseudo
scene.duration must be > 0 else throw "renderVideo() needs an animated scene, got one whose loop lasts 0s. Use renderFrames() for a still."
frames = max(1, round(duration*loops*fps)); frame i is captured at (i/fps) % duration; sample timestamp i/fps, length 1/fps
width,height = captured PNG size & ~1 (4:2:0 needs even sides); createImageBitmap crops to that
Video.duration = frames/fps
```
*Criterion:* R-230

#### renderVideo checks the browser can encode — [D]
*Serves:* G-9
*Code:* `packages/video/src/index.ts` (`renderVideo`)
```pseudo
ok = Mediabunny.canEncodeVideo(codec, {width,height,frameRate,quality,alpha: transparent ? "keep" : "discard"}) in the page
!ok -> throw "renderVideo() needs a Chromium that can encode <codec> at <w> by <h>, and this one can't. Try another codec or format: \"webm\", or pass executablePath to Google Chrome."
webm + transparent background -> every packet carries alpha side data; mp4 never does
```
*Criterion:* R-231

#### ?svjeez import compiles a scene at build time — [D]
*Serves:* G-2, G-1
*Code:* `packages/vite/src/index.ts` (`load`), `runner.ts`, `scene.ts`
```pseudo
id matches /\?svjeez(&posters)?$/ else pass
runner = per-environment createRunner(config); {image, dependencies} = runner.load(file, query.posters ? (options.posters ?? true) : false)
addWatchFile(each dependency)
serve : export default JSON {src,width,height,title,desc,posters}
build : emitFile(SVG, each poster as <name>-<scheme>.webp); export default object of ROLLUP_FILE_URL expressions
```
The scene compiles with svjeez JSX even inside a React app; the browser bundle holds only the URLs.
*Criterion:* R-232

#### Dev server serves and reloads scenes — [D]
*Serves:* G-10, G-2
*Code:* `packages/vite/src/index.ts` (`configureServer`, `watchChange`), `runner.ts` (`invalidate`)
```pseudo
middleware at /_svjeez/: asset = assets.files.get(decoded path); none -> next(); ok -> bytes with its Content-Type, Cache-Control: no-store; error -> next(error)
watchChange(f): invalidate f in every runner (module graph + evaluated modules, then importers transitively)
editing the scene or any file it imports triggers a full-reload/update and the next fetch is the new SVG
```
*Criterion:* R-233

#### getScene gives a content-addressed URL — [D]
*Serves:* G-7, G-2
*Code:* `packages/vite/src/scene.ts` (`getScene`, `compile`)
```pseudo
svg = scene is string ? scene : memoized scene()           // WeakMap by function
name = sha256(svg) base64url[0..12]; assets.files[name+".svg"] = {image/svg+xml, bytes}
width,height from viewBox; title,desc = text of <title>/<desc>, entities unescaped
posters: for each scheme, file = name-variant-scheme.webp registered lazily; URL = ROUTE + file
```
*Criterion:* R-234

#### Posters are rendered once per change — [D]
*Serves:* G-5
*Code:* `packages/vite/src/posters.ts`, `encode.ts`
```pseudo
poster(file): reuse in-flight promise; else read assets.cache/file; on miss, run under LANES limit:
  t = stillAt(svg, duration); png = renderFrames(svg, {times:[t], colorScheme, scale, background}); webp = encode(png, quality)
  write cache; return bytes
failed job leaves the pending map
```
*Criterion:* R-235

#### writeScenes emits every handed-out file — [D]
*Serves:* G-2
*Code:* `packages/vite/src/assets.ts` (`writeScenes`), `packages/astro/src/index.ts` (`astro:build:done`)
```pseudo
mkdir <dir>/_svjeez/; for each assets.files: write bytes at its URL path; await assets.close(); return count
astro:build:done: logs "<n> scene files in /_svjeez/"
```
Files are written at build end because pages call `getScene()` while rendering, after Vite has bundled.
*Criterion:* R-236

#### Astro integration wiring — [D]
*Serves:* G-2, G-4
*Code:* `packages/astro/src/index.ts`, `Scene.astro`, `scene.ts`
```pseudo
astro:config:setup : add svjeez({cacheDir: <astro cacheDir>/svjeez}) and a build-only plugin that, in server-consumer builds of non-node_modules JS/TS, replaces import.meta.url/dirname/filename with the module's own path
astro:config:done  : injectTypes types.d.ts -> /// <reference types="@svjeez/astro/client" />
<Scene scene=…> : getScene(scene); <img src width height alt={alt ?? (desc || title)} …attrs>
```
*Criterion:* R-237

#### Plugin package build — [D]
*Serves:* G-6
*Code:* `scripts/package-plugin.ts`, `scripts/package-manifest.ts` (`writeManifest`), `scripts/package-svelte.ts`
```pseudo
rm package-dist; tsc -p tsconfig.package.json; rewrite new URL("./x.ts", import.meta.url) -> ".js" in emitted JS
exports: "./src/a.ts" -> {types: "./a.d.ts", default: "./a.js"}; non-.ts target -> copied; {types} object -> types file copied
writeManifest: drop private/scripts/devDependencies; dependencies "workspace:*" -> "^<current version of that package>"; copy package README and root LICENSE
package-svelte: svelte-package src -> package-dist, exports {".": {types, svelte, default}}
```
*Criterion:* R-238

#### Plugin package check — [D]
*Serves:* G-6, G-4
*Code:* `scripts/package-plugin-check.ts`
```pseudo
build:package; publint --strict package-dist; attw (esm-only) over entries that are compiled .ts exports
pack svjeez + this package + every @svjeez/* it depends on (transitively), each from its package-dist
copy test/consumer to a temp dir; npm@11 install the tarballs + playwright-core (repo's version); run its `check` script
```
*Criterion:* R-239

#### Release plan and publish — [D]
*Serves:* G-6, G-3
*Code:* `scripts/release.ts` (`packages`, `pending`, `publish`, `plan`, `tagFor`, `distTag`, `previous`, `notes`)
```pseudo
packages(): every packages/* that is public, or private with build:package; dependencies first
pending(): skip a package npm has never had (warn: run claim); else {npm: !versions.has(v), github: !releases.has(tag)}; keep if either
publish: per pending, build if needed, npm pack, publish (--provenance --access public --tag latest|next) if npm, gh release create if github
         notes = git log --no-merges of that package's folder from its previous release tag (semver-lower) to the target sha
         --latest only for svjeez non-prerelease
```
*Criterion:* R-240

#### Release claim — [D]
*Serves:* G-6
*Code:* `scripts/release.ts` (`claim`, `stage`, `trusted`)
```pseudo
claim(dir): pkg must be public or have build:package; repository.url must be GitHub
if npm has it: only add trust. else npm publish (staged); a refusal "previously staged version" is not an error
if release.yml already trusted for name: stop; else npm trust github <name> --repo --file release.yml --env npm --allow-publish
```
*Criterion:* R-241

#### CI gates — [D]
*Serves:* G-7, G-6
*Code:* `.github/workflows/ci.yml`, `release.yml`
```pseudo
pull_request / workflow_call: test (typecheck, test, npm pack --dry-run) ; dist (macOS rebuild must equal committed examples/dist) ; node (20,22: test:node, test:package per package; astro 22 only)
release: ci -> plan -> publish only if plan.packages != ''; publish serialized (concurrency group "release", no cancel)
```
*Criterion:* R-242

#### Root bun test is refused — [D]
*Serves:* G-4
*Code:* `scripts/root-test-guard.ts`, `bunfig.toml`
```pseudo
bun test at the root preloads the guard: stderr "Run `bun run test` at the root, or `bun test` inside a workspace …"; exit 1
```
*Criterion:* R-243

#### Live preview — [D]
*Serves:* G-10, G-3
*Code:* `packages/svjeez/scripts/preview.ts`
```pseudo
watch dirname(source) and src/ ; ignore *.svg and dotfiles; debounce 60 ms; one build at a time, a change during a build queues exactly one more
build = child `cli.ts svg <source> --out <target>`; success or error text is pushed to clients over SSE /events
page serves seek/loopLength (serialized) with play/pause and a scrubber; port $PORT ?? 5173
```
*Criterion:* R-244

### Live editor

#### Literal discovery — [D]
*Serves:* G-10
*Code:* packages/live/src/source.ts (`literalsOf`, `signed`, `numberOf`, `COLOR`)
```pseudo
for node in tree:
  skip if text has "\n"
  String|JSXAttributeValue: color if COLOR else string; do not descend
  ease.bezier(4 numeric args): one ease literal; else descend (numbers are literals)
  ease.<linear|in|out|inOut|pop>: one ease literal
  Number: number literal incl. leading "-", "_" separators, hex
```
*Criterion:* R-245

#### Role and path — [D]
*Serves:* G-10
*Code:* packages/live/src/source.ts (`roleOf`, `pathOf`, `isTopLevel`)
```pseudo
role = const | property | attribute(name,tag) | argument(callee,index) | other   // arithmetic around a literal is transparent
path = [const, ...property names/array indices] only through ObjectExpression/ArrayExpression
       and only when the const is top-level; else no path
```
*Criterion:* R-246

#### Keys — [D]
*Serves:* G-10
*Code:* packages/live/src/source.ts (`keyed`, `scopeOf`, `placeOf`)
```pseudo
key = param ? "params."+key[+"."+option] : path ? path.join(".") : scope+"#"+n(scope)
make unique: on clash append "#1", "#2"…
unnamed statement scope = "@"+index among non-comment statements
```
*Criterion:* R-247

#### Declared params are found in source — [D]
*Serves:* G-10, G-4
*Code:* packages/live/src/source.ts (`paramsObject`, `paramOf`)
```pseudo
params = object of `export const params = {…}`
literal.param = {key} if it is arg 0 of a call that is a property of params
              = {key, option} if it is a property inside arg 1+ of that call
```
*Criterion:* R-248

#### Write a value back — [D]
*Serves:* G-10, G-7
*Code:* packages/live/src/source.ts (`write`, `numberText`, `decimalsOf`, `easeText`, `apply`, `set`)
```pseudo
number: toFixed(decimals ?? decimalsOf(text)), strip trailing zeros unless explicit decimals; "-0" -> "0"
color|string: keep the original quote char
ease: "ease.<name>" if value is that very named ease, else "ease.bezier(2-decimal points)"
        throws "Only a bezier ease is written as ease.bezier(…), got ease <kind>." otherwise
apply(text, edits): edits sorted by descending start, all ranges against the original text
```
*Criterion:* R-249

#### Highlighted lines — [D]
*Serves:* G-10, G-8
*Code:* packages/live/src/source.ts (`linesOf`, `runsOf`, `KINDS`)
```pseudo
flat = highlight runs, with each live literal cut out as a "literal" piece; gaps are "plain"
split pieces at "\n" into Line{n, pieces}
concat of all piece texts == file text
```
*Criterion:* R-250

#### Code-to-element linking — [D]
*Serves:* G-10
*Code:* packages/live/src/source.ts (`madeBy`, `callsIn`, `made`)
```pseudo
madeBy(offset): enclosing built-in JSX element; or elements inside a {…}/arrow function;
                or, for a const/param, the union over every use of the name (cycle-guarded)
callsIn(element, method): `.method(…)` calls in animation={…}, following animation={name} to its const, in source order
```
*Criterion:* R-251

#### Values from literals — [D]
*Serves:* G-10
*Code:* packages/live/src/controls.ts (`valuesOf`)
```pseudo
skip literals that are a param's own option (min/max/step/option)
number|color|ease -> Value of that kind
string -> choice Value only if schema[param.key].kind == "choice", else not a value
label = schema label ?? param key ?? labelOf(role)
```
*Criterion:* R-252

#### Number range from where it sits — [D]
*Serves:* G-10
*Code:* packages/live/src/controls.ts (`paramFor`, `MEANINGS`, `span`)
```pseudo
if schema declares this literal's param as number: use it with value = literal.value
else meaning = MEANINGS[name or callee#index](v) ?? {}
  step = min(written precision, meaning.step ?? written precision)
  min = min(meaning.min ?? v - span(v,10), v); max = max(meaning.max ?? v + span(v,10), v)
span(v, least) = max(2|v|, least)
```
*Criterion:* R-253

#### Control math — [D]
*Serves:* G-10
*Code:* packages/live/src/controls.ts (`scrub`, `nudge`, `bend`, `bezierOf`, `curveOf`, `rgbOf`, `withRgb`)
```pseudo
scrub: fit(param, from + dx*(max-min)/SCRUB_PIXELS * (fine ? FINE_SCALE : 1))
nudge: fit(param, v + by*step*(big ? BIG_STEPS : 1))
bend:  x clamped 0..1, y clamped BEND_Y, both rounded to 0.01, returns ease.bezier
withRgb: keep original hex case and alpha digits
```
*Criterion:* R-254

#### Set a value — [D]
*Serves:* G-10
*Code:* packages/live/src/editor.ts (`update` case "set", `edited`)
```pseudo
v = valueOf(state, key); if none: return [state, []]      // no edit, no compile
places(number) = max(placesOf(msg.value), placesOf(step), decimalsOf(literal.text)), placesOf <= 6
text' = apply(text, [{range, write(literal{value}, places)}])
if text' == text: [state, []]
else read(state with text'), history.past gets old text unless continues, future cleared, cmds [compile text']
```
*Criterion:* R-255, R-288

#### History — [D]
*Serves:* G-10
*Code:* packages/live/src/editor.ts (`update` cases "undo", "redo", `edited`)
```pseudo
undo: past empty -> no-op; else text = past.pop, future.unshift(current), cmds [compile text]
redo: future empty -> no-op; else text = future.shift, past.push(current), cmds [compile text]
set with continues=true adds no past entry; set/replace clears future
```
*Criterion:* R-256

#### Replace the file — [D]
*Serves:* G-10, G-9
*Code:* packages/live/src/editor.ts (`update` case "replace", `read`)
```pseudo
text' == text: no-op
else history step, compile; selected kept iff its key is still a value after re-reading
```
*Criterion:* R-257

#### The clock — [D]
*Serves:* G-10, G-3
*Code:* packages/live/src/editor.ts (`timeAt`, `reshown`, cases "play","pause","seek")
```pseudo
timeAt(clock, now) = playing ? max(0, (now-origin)/1000) : at
play: playing -> no-op; else origin = now - at*1000
pause: paused -> no-op; else at = timeAt(now)
seek(at): same play state, origin = now - at*1000 or at = at
each change of clock with a compiled file emits show(compiled.svg, timeAt, playing)
seek(at) stores at as given: no clamp to 0..duration (Q-45)
```
*Criterion:* R-258, R-290

#### A compile result is shown, or its error kept — [D]
*Serves:* G-10, G-4
*Code:* packages/live/src/editor.ts (`update` case "compiled", "shown")
```pseudo
compiled ok: compiled = {scene, svg, text}; error = null; cmds [show at clock time]
compiled fail: error = result.error; picture and compiled unchanged; no cmds
shown: picture = msg.picture; previous URL released by the runtime; probe if picture.text == text
```
*Criterion:* R-259

#### Schema comes only from a compile of the current text — [D]
*Serves:* G-10, G-4
*Code:* packages/live/src/editor.ts (`update` case "compiled")
```pseudo
schema = (msg.text == state.text) ? result.params ?? {} : state.schema
values re-read through the schema (a string param declared choice becomes a control)
```
*Criterion:* R-260

#### Declared handles become grips — [D]
*Serves:* G-10
*Code:* packages/live/src/editor.ts (`declaredGrips`, `withDeclared`, `onlyDeclared`), packages/live/src/compile.ts (`handlesOf`)
```pseudo
for each handles[key] where literal "params.<key>" is a number literal:
  grips["params.<key>"] = {...handle, from: literal.value, declared: true}
replace the set of declared grips on each compile; keep measured grips
select never removes declared grips and never probes a declared grip
```
*Criterion:* R-261

#### Probe a selected bare number — [D]
*Serves:* G-10
*Code:* packages/live/src/editor.ts (`probeOf`, `measures`, cases "select","shown","probed")
```pseudo
select(key): equal to selected -> no-op; else selected = key, drop measured grips, maybe probe
probeOf: value is number, not declared, picture.svg exists and picture.text == text
  by = max(step, (max-min)/PROBE_NUDGE_DIVISOR); nudged = text with value+by
probed: ignore unless key == selected and `measures` (text equal, or differs only in that value)
  grip = msg.grip, or none when null
```
*Criterion:* R-262

#### Lazy start, pause and resume — [D]
*Serves:* G-10, G-6
*Code:* packages/live/src/editor.ts (`createEditor`: `subscribe`, `perform`, `lazyCompiler`)
```pseudo
before first subscribe: waiting = []; perform pushes cmds to waiting; no compile runs
subscribe: if waiting, run queue
last unsubscribe: waiting = [], epoch++, compile.stop?.()
lazyCompiler: creates a worker on the first compile after creation or stop
```
*Criterion:* R-263

#### Newest job wins — [D]
*Serves:* G-10
*Code:* packages/live/src/client.ts (`latestWins`), packages/live/src/editor.ts (`compile`, `show`, `probe`)
```pseudo
latestWins(run): one job at a time; while busy only the newest arriving job is kept
a job that throws is logged (console.error); the queue still runs the next job
```
*Criterion:* R-264

#### Picture URLs are freed — [D]
*Serves:* G-10, G-6
*Code:* packages/live/src/editor.ts (`createEditor`: `release`, `show`, `dispatch`, `destroy`)
```pseudo
show makes url -> made.add(url); if !alive release it
shown replacing a picture with a different url -> release old (only if in made)
destroy: alive = false, listeners cleared, compile.stop, release every URL in made
```
*Criterion:* R-265

#### A failing compile call is the file's error; a cut-short one is not — [D]
*Serves:* G-4, G-10
*Code:* packages/live/src/editor.ts (`compiling`, `compile`, `probe`)
```pseudo
run.compile throws -> {ok:false, error:{kind:"runtime", message}}
compile or probe whose epoch changed (pause) or finished while waiting -> perform(cmd) again, no message dispatched
```
*Criterion:* R-266

#### A destroyed editor is inert — [D]
*Serves:* G-10
*Code:* packages/live/src/editor.ts (`dispatch`, `perform`, `subscribe`)
```pseudo
!alive: dispatch returns; perform returns; subscribe does not release the queue
```
*Criterion:* R-267

#### A no-change message notifies nobody — [D]
*Serves:* G-10
*Code:* packages/live/src/editor.ts (`createEditor`: `dispatch`)
```pseudo
[next, cmds] = update(state, msg)
if next === state: no listener is called (cmds is empty)
else state = next; notify every listener; perform cmds
```
*Criterion:* R-287

#### Page code sends Input, not runtime messages — [D]
*Serves:* G-4, G-10
*Code:* packages/live/src/editor.ts (`Input`, `Editor.send`)
```pseudo
Input = Msg without "compiled" | "shown" | "probed" and without now
send(input): stamps now from Effects.now on play/pause/seek/select, then dispatches
sending a runtime-only message from page code is a type error
```
*Criterion:* R-289

#### First picture — [D]
*Serves:* G-10, G-1
*Code:* packages/live/src/editor.ts (`init`, `First`)
```pseudo
first -> picture = {url: first.src, scene{width,height,duration: first.duration ?? 0,title}}
init always emits compile(text); clock starts playing at now
```
*Criterion:* R-268

#### Compile reports what a scene declares — [D]
*Serves:* G-4, G-3, G-9
*Code:* packages/live/src/compile.ts (`compileScene`, `compileBuild`, `run`, `measure`, `handlesOf`)
```pseudo
ok: svg, stats(bytes, gzip, keyframes, scriptBytes, ms)
    scene{width,height,duration ?? 0,title ?? ""} from the first render() call
    params if export `params` is an object of {kind} entries; handles only if params declared and `handles` is a function
default export must be a function returning a string, else throws a message that names the fix
```
*Criterion:* R-269

#### Compile errors carry place and fix — [D]
*Serves:* G-4, G-9
*Code:* packages/live/src/compile.ts (`outcome`, `parseSyntax`, `placeOf`, `HEADER_LINES`), packages/live/src/fixes.ts (`fixFor`)
```pseudo
SyntaxError or message ending "(l:c)" -> {kind:"syntax", message, line, column+1}
otherwise {kind:"runtime", message, line/column from V8 stack minus HEADER_LINES, fix: fixFor(message)}
```
*Criterion:* R-270

#### Import allow-list — [D]
*Serves:* G-4, G-6
*Code:* packages/live/src/compile.ts (`modules`, `packages`, `load`, `requireModule`)
```pseudo
require(name): known module -> it; lazily loadable package -> loaded on first require
else throw `Cannot import "<name>". Scenes here can import "<…>", ….`
```
*Criterion:* R-271

#### Sources marking — [D]
*Serves:* G-9, G-10
*Code:* packages/live/src/compile.ts (`watched.render`, `compileScene({sources})`)
```pseudo
sources=true: render options get sources:true, so each element carries the line of source that made it; jsx dev transform on
```
*Criterion:* R-272

#### Fix table equals the skill's — [D]
*Serves:* G-9
*Code:* packages/live/src/fixes.ts (`errorTable`, `errorFixes`, `fixFor`), packages/live/scripts/generate.ts, packages/live/src/skill-errors.ts
```pseudo
generate: skill-errors.ts = JSON text of the "Runtime errors." section of skills/svjeez/SKILL.md
row pattern: backticked message, each "…" matches any text; first matching row gives the fix
```
*Criterion:* R-273

#### Compile worker timeout and stop — [D]
*Serves:* G-4, G-6
*Code:* packages/live/src/client.ts (`createCompiler`, `compilerFor`)
```pseudo
job unfinished after timeout -> terminate worker, start a fresh one, fail every job owed by it with
  "The scene ran for over <n>s without finishing, so it was stopped."
stop(): worker terminated, owed jobs resolve "The compiler was stopped."; later compiles fail at once, no worker starts
worker onerror/onmessageerror -> every compile fails with the reason
```
*Criterion:* R-274

#### Measure what a number moves — [D]
*Serves:* G-10
*Code:* packages/live/src/probe.ts (`measureMove`, `boxesOf`, `pointsOf`)
```pseudo
no document -> undefined
boxes of drawn shapes (not under defs/clipPath/mask/pattern/marker/symbol), in scene units, at clock time
counts differ or none moved (> MOVE_EPSILON) -> undefined
else Move{at, way} for the candidate point with greatest travel
```
*Criterion:* R-275

#### Strokes make one undo step — [D]
*Serves:* G-10
*Code:* packages/live/src/gestures.ts (`stroke`, `scrubbing`, `following`, `bending`, `arrowNumber`, `arrowEase`)
```pseudo
stroke(editor,key)(v): send set{key, v, continues: going}; going ||= text changed
scrubbing keeps the param range it began with; following moves the value so the handle follows the pointer along grip.way
arrowNumber: arrow key -> one nudge (shift: ten); returns whether key was an arrow
arrowEase: arrow key moves a control point by EASE_ARROW_STEP (shift: EASE_ARROW_BIG)
```
*Criterion:* R-276

#### Focus selects a value — [D]
*Serves:* G-10
*Code:* packages/live/src/gestures.ts (`selection`)
```pseudo
focus: send select{key}
blur(from, to): ignore if `to` is inside `from` or inside another element with the same data-sj-key
                else if selected == key: send select{null}
```
*Criterion:* R-277

#### Server render starts nothing — [D]
*Serves:* G-10, G-6
*Code:* packages/react/src/editor.ts (`useEditor`), packages/svelte/src/editor.ts (`SceneEditor`)
```pseudo
render reads getState() (no subscription) -> no compile effect runs; Code renders the controls, Picture renders an empty figure
svelte: subscription starts on first reactive read inside an effect (createSubscriber)
```
*Criterion:* R-278

#### Controls edit the source — [D]
*Serves:* G-10
*Code:* packages/react/src/NumberControl.tsx, ColorControl.tsx, EaseControl.tsx, EasePop.tsx, ChoiceControl.tsx; packages/svelte/src/ (same names)
```pseudo
pointerdown on number -> scrubbing; move -> set; one drag = one undo step
arrow keys on number / ease handle -> arrowNumber / arrowEase
color input -> stroke of withRgb(...) until native "change"; select -> set choice
```
*Criterion:* R-279

#### Control override — [D]
*Serves:* G-10
*Code:* packages/react/src/Code.tsx (`control` render prop), packages/svelte/src/Code.svelte (`control` snippet)
```pseudo
control(value, plain): returned node replaces the built-in control; rendering plain keeps it
```
*Criterion:* R-280

#### Ease popover dismissal — [D]
*Serves:* G-10
*Code:* packages/react/src/EasePop.tsx, packages/svelte/src/EasePop.svelte
```pseudo
pointerdown outside popover and glyph, Escape, or any scroll -> close; focus returns to glyph when focus was inside
closing leaves the ease deselected
```
*Criterion:* R-281

#### Handles on the picture — [D]
*Serves:* G-10
*Code:* packages/react/src/Picture.tsx, Grip.tsx; packages/svelte/src/Picture.svelte, Grip.svelte
```pseudo
for each grip whose key is a number value: render div.sj-grip at handleAt(grip, value) as % of scene size
drag -> following(scale = scene.width / picture.clientWidth); arrow keys -> arrowNumber
```
*Criterion:* R-282

#### Broken edit keeps the last picture — [D]
*Serves:* G-4, G-10
*Code:* packages/react/src/Code.tsx, packages/svelte/src/Code.svelte
```pseudo
state.error set -> p.sj-error visible with "Line n: message"; img.sj-img src unchanged
```
*Criterion:* R-283

#### Render rules of the host framework — [D]
*Serves:* G-10
*Code:* packages/react/src/editor.ts (`useEditorState` via `useSyncExternalStore`)
```pseudo
state read through the store, not props: a memo'd Picture still updates; a hidden-then-shown Activity resubscribes and resumes compiling
```
*Criterion:* R-284

#### Undo and redo from the keyboard — [P]
*Serves:* G-10
*Code:* packages/react/src/Code.tsx, packages/svelte/src/Code.svelte (`history`)
```pseudo
keydown inside section.sj-code: (meta|ctrl)+Z -> undo; +shift -> redo; preventDefault
```
*Criterion:* R-285

#### Generate the fix table — [D]
*Serves:* G-9
*Code:* packages/live/scripts/generate.ts
```pseudo
bun run generate: write src/skill-errors.ts from the skill's "Runtime errors." section
```
*Criterion:* R-273

#### Stylesheet contract — [D]
*Serves:* G-10
*Code:* packages/live/src/editor.css (header comment)
```pseudo
adapters emit the documented markup; theming only through --sj-* properties
```
*Criterion:* R-286

### Charts, code, fonts, icons and Mermaid

#### Fit the y scale — [D]
*Serves:* G-4, G-8
*Code:* charts/src/chart.ts (chart)
```pseudo
ticks = y.ticks ?? 5; require whole >= 1
if y.domain: require finite, max >= min; use it
else: require data nonempty; low/high = min/max of data values (plus 0 unless zero === false); equal -> [low, low+1]
scale = linear(domain).nice(ticks) onto [at.y+height, at.y]
```
*Criterion:* R-291

#### Fit the x scale (linear) — [D]
*Serves:* G-4
*Code:* charts/src/chart.ts (chart)
```pseudo
ticks = x.ticks ?? 6; require whole >= 1
domain = x.domain (finite, max >= min) else min/max of data x (needs data); equal -> [a, a+1]
scale = linear(domain).nice(ticks) onto [at.x, at.x+width]; xDomain = niced domain
```
*Criterion:* R-292

#### Lay out band categories — [D]
*Serves:* G-4
*Code:* charts/src/chart.ts (chart)
```pseudo
require domain nonempty and unique; padding = x.padding ?? 0.3 in [0,1)
bands in domain order, evenly spaced across [at.x, at.x+width]
x(key) = band start + bandwidth/2; unknown key throws "x() got … Add it to x.domain."
```
*Criterion:* R-293

#### Validate chart options — [D]
*Serves:* G-4, G-9
*Code:* charts/src/chart.ts (chart, finitePair, countOf)
```pseudo
width,height positive finite; fontSize > 0
every datum has finite y (and finite x on linear)
no y.domain and no data -> throw; same for linear x
domains finite with max >= min; tick counts whole >= 1
```
*Criterion:* R-294

#### Draw axes and grid — [D]
*Serves:* G-5, G-8
*Code:* charts/src/chart.ts (chart)
```pseudo
lines stroke tint(theme,"comment"); labels fill tint(theme,"muted"), font and fontSize from options
y ticks: mark + label at each tick; x: labels for each category (band) or ticks+labels (linear)
zero line when y domain spans 0; grid (opacity 0.25) only when grid:true
```
*Criterion:* R-295

#### Rotate series accents — [D]
*Serves:* G-8
*Code:* charts/src/chart.ts (nextColor, ACCENTS)
```pseudo
color = options.color ?? tint(theme, ACCENTS[used++ % 7])
// ACCENTS = blue, number, green, magenta, cyan, yellow, red; counter is per chart and
// advances only when a series takes the default
```
*Criterion:* R-296

#### Keep series inside the domain — [D]
*Serves:* G-4, G-9
*Code:* charts/src/series.ts (place, within, bars)
```pseudo
within(v, [lo,hi]) allows slack (hi-lo)*1e-9
line/area: >= 2 points; each finite; category in domain; y (and linear x) within domain else throw "… Pass the data to chart({ data }) or widen the domain."
bars: each key in domain, finite, within y domain
```
*Criterion:* R-297

#### Validate and report series timing — [D]
*Serves:* G-3
*Code:* charts/src/series.ts (timing, line, area, bars)
```pseudo
at finite >= 0 else throw "… needs an at of 0 or later"
over finite > 0 else throw "… needs a positive over"
bars.end = max(at + i*stagger + over); line.end = at+over (+0.4 with label); area.end likewise
```
*Criterion:* R-298

#### Draw bars — [D]
*Serves:* G-8, G-3
*Code:* charts/src/series.ts (bars)
```pseudo
zero = y(0 clamped into domain); tip = round(y(value))
bounds = rect(x, min(tip,zero), barWidth, |zero-tip|)     // resting box in scene px
up bars sit above zero, down bars hang below; radius = min(radius, barWidth/2), clipped square at the baseline
grow: height 0 -> long over `over`, ease.out, start = at + i*stagger (i = domain order of keys present)
values: label at the free end, enters at start + 0.6*over
```
*Criterion:* R-299

#### Group bars — [D]
*Serves:* G-8
*Code:* charts/src/series.ts (bars)
```pseudo
require count whole >= 1 and 0 <= index < count (else throw)
slot = bandwidth / count; gap = 2 if count > 1 else 0; barWidth = max(1, slot - gap)
x = bandCenter - bandwidth/2 + index*slot + gap/2
```
*Criterion:* R-300

#### Validate bars input — [D]
*Serves:* G-4, G-9
*Code:* charts/src/series.ts (bars)
```pseudo
categories undefined (linear scale) -> throw "bars() needs a band x scale"
stagger finite >= 0; values nonempty; key in x.domain; value finite and within y domain
```
*Criterion:* R-301

#### Draw a line — [D]
*Serves:* G-8, G-3
*Code:* charts/src/series.ts (line, trace, curveOf)
```pseudo
points = place(): one {x,y} per datum, rounded to 0.1
d = d3 line(curve linear|monotone|step).digits(1); other curve names throw
stroke animates with draw(at,over, linear); width default 2.5
dots: radius true->4; dot i pops at at + over*(length reached / total); label placed past last point, fades in at at+over
```
*Criterion:* R-302

#### Draw an area — [D]
*Serves:* G-8
*Code:* charts/src/series.ts (area)
```pseudo
baseline finite else throw; base = y(baseline clamped into domain)
fill = d3 area(y0=base) through placed points, gradient color 0.4 -> 0 opacity
clip rect widens 0 -> plot width over the same span (wipe)
top edge stroked via trace unless line === false
```
*Criterion:* R-303

#### Round scene coordinates — [P]
*Serves:* G-7
*Code:* charts/src/series.ts (round); charts/src/chart.ts (compact)
```pseudo
round(n) = Math.round(n*10)/10          // all emitted px
compact(n) = String(Number(n.toPrecision(12)) + 0)   // tick labels: no 0.30000000000000004, no -0
```
*Criterion:* R-304

#### Highlight into role runs — [D]
*Serves:* G-2, G-5, G-8
*Code:* code/src/index.ts (highlight)
```pseudo
tokens = shiki.codeToTokensBase(text, lang, theme svjeez-roles)
per line: role = roleOf(token.color) ?? plain; merge adjacent equal roles
emit role === plain ? text : [role, text]; an empty source line -> []
```
*Criterion:* R-305

#### Normalise source and tabs — [D]
*Serves:* G-4
*Code:* code/src/index.ts (highlight, expandTabs)
```pseudo
tabSize whole >= 1 else throw "highlight() needs tabSize to be a whole number of at least 1"
CR and CRLF -> LF; drop one trailing LF
each tab -> spaces to the next multiple of tabSize
```
*Criterion:* R-306

#### Resolve languages — [D]
*Serves:* G-9, G-6
*Code:* code/src/index.ts, code/src/langs.ts
```pseudo
load each new grammar object once (WeakSet)
lang not among loaded languages (bundled names + aliases + loaded grammars) -> throw "highlight() does not know the language … It knows: <sorted list>. Pass another grammar …"
```
*Criterion:* R-307

#### Map scopes to roles — [D]
*Serves:* G-5
*Code:* code/src/scopes.ts, code/src/index.ts (THEME, sentinel)
```pseudo
theme settings = one entry per SCOPES prefix, foreground = sentinel(role)
Shiki picks the longest matching prefix; token with no match stays plain
a run's color in the SVG comes from the scene theme via the role (adaptive/variables work)
```
*Criterion:* R-308

#### Tokenize without a time limit — [D]
*Serves:* G-7
*Code:* code/src/index.ts (highlight)
```pseudo
codeToTokensBase(..., tokenizeTimeLimit: 0)   // no per-line cutoff
// a slow first regex compile otherwise merges the rest of a line into one color: output would depend on machine speed
```
*Criterion:* R-309

#### Resolve the font cache folder — [D]
*Serves:* G-7, G-1
*Code:* fonts/src/index.ts (cacheDir)
```pseudo
SVJEEZ_FONTS_CACHE if set
else (XDG_CACHE_HOME || ~/.cache)/svjeez/fonts
```
*Criterion:* R-310

#### Load from cache before network — [D]
*Serves:* G-1, G-2
*Code:* fonts/src/index.ts (bytesOf, google)
```pseudo
path = cacheDir/slug(family)-weight-style.ttf
if readFile(path) succeeds: return Font from those bytes (no fetch)
weight default 400, style default "normal"; remaining options go to font()
```
*Criterion:* R-311

#### Download and cache a face — [D]
*Serves:* G-1, G-9
*Code:* fonts/src/index.ts (download, bytesOf, message)
```pseudo
GET css2 URL (UA svjeez-fonts); not ok -> GoogleError "Google Fonts has no "<family>" at weight W (style): HTTP n, <title text>"
no src url -> GoogleError; file fetch not ok -> GoogleError
network failure (non GoogleError) -> Error naming family, weight, style and the cache path; "Run once with a network connection."
success: write temp file (pid.time.tmp), rename onto path (atomic)
```
*Criterion:* R-312

#### Group faces into a family — [D]
*Serves:* G-8
*Code:* fonts/src/index.ts (google.family)
```pseudo
faces: number | {weight?, style?} ; load each via google() in parallel with shared options
return font.family(...fonts)
```
*Criterion:* R-313

#### Convert upstream SVG to path data — [D]
*Serves:* G-1, G-6, G-8
*Code:* icons/scripts/generate.ts (parse, toPath)
```pseudo
require <svg> viewBox square from origin; root paint matches kind (fill: currentColor | fill none + stroke currentColor, stroke-width 2 for stroke)
for each child element: allowed tags/attrs only (GEOMETRY + paint + DROPPED[file])
skip elements with stroke none and fill none (the invisible frame)
paths.push(toPath(tag, attrs)); no paths -> error
```
*Criterion:* R-314

#### Fail the generator on anything unknown — [D]
*Serves:* G-7, G-4
*Code:* icons/scripts/generate.ts (parse, generate)
```pseudo
unknown element or stray attribute, bad viewBox, bad root paint, duplicate export name -> collect "<pkg> <file>: <message>"
if any problem: throw "N icons failed:\n…" and write nothing
```
*Criterion:* R-315

#### Name the exports — [D]
*Serves:* G-4, G-9
*Code:* icons/scripts/generate.ts (exportName)
```pseudo
camel = file with digit-hyphen-digit -> "_", other hyphens -> capitalized next char
if camel is a valid identifier and not reserved: camel
else "icon" + Capitalize(camel)
```
*Criterion:* R-316

#### Emit sorted, reproducible files — [D]
*Serves:* G-7
*Code:* icons/scripts/generate.ts (generate)
```pseudo
read upstream version and LICENSE from node_modules; names sorted by code unit
write header (licence as comment) + one `export const name: Icon = {...}` per icon
two sources: tabler.ts (outline stroke + filled "-filled" fill), lucide.ts (stroke)
same upstream versions -> byte-identical output
```
*Criterion:* R-317

#### Hold the Icon data shape — [D]
*Serves:* G-8
*Code:* icons/src/icon.ts, icons/src/tabler.ts, icons/src/lucide.ts
```pseudo
every export: grid > 0, kind in {stroke, fill}, paths nonempty, every d starts M or m
tabler filled icons are kind fill and end in "Filled"
```
*Criterion:* R-318

#### Preprocess Mermaid text and dispatch — [D]
*Serves:* G-4, G-9
*Code:* mermaid/src/parse.ts (lines, parse)
```pseudo
split on \n; trim; strip one trailing ";"; drop blank and %% lines; keep original line numbers
a "%%{" line -> MermaidSyntaxError
no meaningful line -> Error "parse() got no Mermaid text…"
first word: flowchart|graph | sequenceDiagram | stateDiagram(-v2) -> that parser; else error listing supported types
```
*Criterion:* R-319

#### Parse flowchart nodes — [D]
*Serves:* G-8, G-9
*Code:* mermaid/src/flowchart.ts (readRef, parseFlowchart)
```pseudo
header: "flowchart|graph [TD|TB|BT|LR|RL]", default TD, extra tokens -> error
node: id then optional opener per Structure; body quoted ("…") may hold brackets; <br> and whitespace in label -> one space
a bare id first seen -> label = id, form rect; a later definition with a form sets label and form
empty label, unclosed bracket -> error; no nodes at all -> error
```
*Criterion:* R-320

#### Parse flowchart edges — [D]
*Serves:* G-8
*Code:* mermaid/src/flowchart.ts (readGroup, readOp)
```pseudo
group = ref ("&" ref)*; op = LABELLED | PLAIN token; label from |text| or -- text --> (unquoted, cleaned)
for each edge segment: push an edge for every (from in left group, to in right group); the right group becomes the next left
op with no node after it -> error "an edge needs a node after it."
```
*Criterion:* R-321

#### Parse subgraphs — [D]
*Serves:* G-8
*Code:* mermaid/src/flowchart.ts (parseFlowchart)
```pseudo
"subgraph id [Title]" | "subgraph Title" (id = title) ... "end"
nodes mentioned inside belong to the first subgraph that mentions them
errors: nested, duplicate id, no title, unclosed, empty, same id as a node, "end" with none open
```
*Criterion:* R-322

#### Reject unsupported flowchart syntax — [D]
*Serves:* G-9, G-4
*Code:* mermaid/src/flowchart.ts, mermaid/src/sequence.ts, mermaid/src/state.ts, mermaid/src/errors.ts
```pseudo
classDef class style linkStyle click direction accTitle accDescr title (flowchart); activate/loop/alt/… /autonumber/box/create/link (sequence);
choice fork join note concurrency "A : desc" (state); `:::`, other arrow heads
-> fail(line, "<what> is not supported … Supported: …") with the original line number and text
```
*Criterion:* R-325

#### Parse sequence diagrams — [D]
*Serves:* G-8
*Code:* mermaid/src/sequence.ts (parseSequence)
```pseudo
"participant|actor ID [as Label]" sets/replaces the entry; a message or note mentions ids, declaring unknown ones in first-mention order (role participant)
message: from, arrow, to, ":" text (non-empty); arrow starting "--" is dashed; head by arrow tail
"Note over A: text" only (one actor, text required); left of/right of/several actors -> error
+/- activation marks -> error; no participants -> error
```
*Criterion:* R-323

#### Parse state diagrams — [D]
*Serves:* G-8
*Code:* mermaid/src/state.ts (parseState)
```pseudo
"[*] --> X" = scope initial (once per scope, no label, X belongs to that scope); "X --> [*]" sets X.final
"state "Long" as ID", "state ID {" opens a composite (own scope); "}" closes (no open -> error)
"direction TB|LR" once at the top level
every scope must end with an initial; unclosed composite, "[*] --> [*]", no states -> error
```
*Criterion:* R-324

#### Draw a Mermaid diagram — [D]
*Serves:* G-8, G-9
*Code:* mermaid/src/index.ts (mermaid, flow, sequenceOf, stateOf, FORM_ROLES)
```pseudo
doc = parse(text); build svjeez spec from doc (nodes by FORM_ROLES, groups from subgraphs, messages/notes, states recursively)
direction = options.direction ?? (doc TD -> TB); flowchart BT or RL -> throw "mermaid() cannot draw direction … Write TD or LR, or pass { direction }."
return { ...diagram, kind, doc }; options pass straight through (play, theme, font, x, y, anchor)
```
*Criterion:* R-326

#### Report syntax errors with a location — [D]
*Serves:* G-4, G-9
*Code:* mermaid/src/errors.ts (MermaidSyntaxError, fail)
```pseudo
fail(line, problem) throws MermaidSyntaxError(line.line, line.text, problem)
message = `Mermaid syntax error on line N (JSON(source)): problem`; fields .line and .source
```
*Criterion:* R-327

### Maps and math

#### Project reads and fits — [D]
*Serves:* G-8, G-4
*Code:* geo/src/index.ts (`project`, `features`, `topologyObject`)
```pseudo
objects = Topology ? topology.objects : n/a
key = options.object ?? first object name
if Topology and no objects[key]: throw "project() found no TopoJSON object named <key>. The topology has <names>."
features = feature(topology, objects[key]) | collection.features | [feature]
kept = features.filter(options.filter)            // before fitting
if fit != false: projection.fitExtent(frame, fit=="regions" ? kept : fit=="sphere" ? Sphere : fit)
```
*Criterion:* R-328 (reading, first object, named object error), R-329 (filter before fit, frame fit)

#### Filter and fit — [D]
*Serves:* G-8
*Code:* geo/src/index.ts (`project`)
```pseudo
kept = all.filter(filter)
fitExtent(frame, kept regions)   // so one kept country fills the frame
land, lines built from kept only
```
*Criterion:* R-329

#### Compact path writing — [D]
*Serves:* G-1, G-4 (size)
*Code:* geo/src/writer.ts (`Writer`, `straighten`)
```pseudo
every coordinate -> round(v*10)/10
lineTo: drop if hypot(delta) < tolerance*10 tenths (remember as tail)
flush: open line re-adds tail; line = douglasPeucker(line, tolerance*5)
emit only if points >= 3 (closed) or >= 2 (open); first M absolute, rest relative, closed ends z
```
*Criterion:* R-330

#### Shared borders from TopoJSON — [D]
*Serves:* G-1
*Code:* geo/src/index.ts (`project`)
```pseudo
if Topology and object is GeometryCollection:
  land  = path(merge(topology, kept Polygon/MultiPolygon geometries))
  lines = path(mesh(topology, kept geometries))      // each shared arc once
else: land = lines = path(collection)
```
*Criterion:* R-331

#### Region identity and lookup — [D]
*Serves:* G-8, G-9
*Code:* geo/src/index.ts (`idOf`, `region`, `largest`)
```pseudo
id = String(f.id ?? f.properties.name ?? index)
region(key) = first r with r.id == String(key) or r.properties.name == key
none -> throw 'project() has no region "<key>". Regions are found by id or properties.name, as in <first 3 ids>.'
centroid, bounds = of the polygon with greatest geoArea (MultiPolygon), else of the feature
a feature whose path is empty yields no region
```
*Criterion:* R-332

#### Place a point — [D]
*Serves:* G-8
*Code:* geo/src/index.ts (`point`, `locate`, `lines`)
```pseudo
p = stream Point through projection, rounded to 0.1 px
p undefined -> throw "point([lon, lat]) falls outside the projection, on the far side of the globe or past its clip."
```
*Criterion:* R-333

#### Great-circle route — [D]
*Serves:* G-8, G-9
*Code:* geo/src/index.ts (`route`, `arc`)
```pseudo
steps = options.steps ?? max(2, ceil(degrees between ends))
pieces = stream LineString(arc) through projection (clip + antimeridian cut honored)
pieces.length != 1 -> throw "route() from [..] to [..] crosses the edge of the map. Rotate the projection ... or use line()."
return the one piece; its ends equal point(from), point(to)
```
*Criterion:* R-334

#### Multi-stop line — [D]
*Serves:* G-8
*Code:* geo/src/index.ts (`line`)
```pseudo
points.length < 2 -> throw "line() needs at least two places."
coordinates = concat arc(points[i-1], points[i]) (shared stop dropped)
return pieces of the streamed LineString with > 1 point    // cut where it leaves the map
```
*Criterion:* R-335

#### Camera bounds — [D]
*Serves:* G-8
*Code:* geo/src/index.ts (`bounds`)
```pseudo
Region -> region.bounds (main piece)
GeoJSON (has "type") -> geoPath.bounds
list: empty -> throw "bounds() needs at least one region or place."
      each Region -> bounds; each LonLat -> 0x0 rect at point() ; union all
pad > 0 -> rect.pad(pad)
```
*Criterion:* R-336

#### Dot map — [D]
*Serves:* G-8
*Code:* geo/src/index.ts (`dots`)
```pseudo
rows = round(180/step); lat_r = -90 + (r+0.5)*180/rows
count = max(1, round(360*cos(lat)/step)); lon_i = -180 + (i+0.5)*360/count
dot kept iff some kept feature contains it (bbox pre-test, then geoContains); first match names it
point = locate(at), undefined when clipped (far side kept)
```
*Criterion:* R-337

#### Sun position and night — [D]
*Serves:* G-8
*Code:* geo/src/sun.ts (`sun`, `night`)
```pseudo
n = days since J2000; low-precision Almanac formulas -> [subsolar lon wrapped to -180..180, declination]
night(date) = geoCircle centered at [wrap(lon+180), -lat], radius 90 degrees
```
*Criterion:* R-338

#### Distance — [D]
*Serves:* G-8
*Code:* geo/src/index.ts (`distance`)
```pseudo
km = sum over legs of geoDistance(a, b) * EARTH_RADIUS_KM
```
*Criterion:* R-339

#### Colour scales — [D]
*Serves:* G-8, G-4
*Code:* geo/src/scale.ts (`sequential`, `diverging`, `build`, `toLab`)
```pseudo
ramp.length < 2 -> throw "<what> needs at least two colors, got n."
steps not integer >= 2 -> throw "<what> needs a whole number of steps of at least 2, got n."
sequential: !(high > low) -> throw "sequential() needs a domain that rises, got [..]."
diverging: !(low < mid < high) -> throw "diverging() needs a domain of [low, middle, high] that rises, got [..]."
hex not /#rgb|#rrggbb/ -> throw 'A color scale needs hex colors such as "#1f77b4", got "<x>". Names and CSS variables can't be blended at compile time.'
index(NaN) = -1 -> color = empty; out of domain clamps to nearest class
```
*Criterion:* R-340

#### Legend — [D]
*Serves:* G-8, G-5
*Code:* geo/src/scale.ts (`legend`)
```pseudo
one rect per class (width/count + 0.5 overlap), a tick + label at every n-th edge and the last edge
every = options.every ?? ceil(count / max(1, floor(width/48)))
optional title above, optional empty swatch after the bar
```
*Criterion:* R-341

#### Choropleth — [D]
*Serves:* G-8, G-3
*Code:* geo/src/choropleth.ts (`choropleth`, `resolveRegions`, `times`)
```pseudo
resolve keys (id first, then properties.name); unmatched keys listed in `unmatched`
list lengths must be all equal or 1 -> else throw "choropleth() needs every region to have the same number of values, got lists of .."
times(at): length != frames -> throw "choropleth() has N value(s) per region but M time(s) in at. Pass one time per value."
          not rising from >= 0 -> throw "choropleth() needs times that rise from 0 or later, got .."
group regions by joined color course; one path per group; unnamed regions one `empty` path
track: if at[0] != 0 start at scale.empty and fade in over `over`; step i lasts min(over, at[i]-at[i-1])
```
*Criterion:* R-342

#### Morph a region into a shape — [D]
*Serves:* G-8, G-3
*Code:* geo/src/morph.ts (`morphs`, `rings`, `singles`)
```pseudo
singles(values): each value one positive number; list -> throw "<what> takes one number per region, but <id> has a list. Pass one time's values, ..."
                 value not > 0 -> throw "<what> needs positive values, got v for <id>."
                 no regions -> throw "<what> found no region to draw. Check the keys of values against the map's region ids and names."
start d = region outline (thinned), end d = target + shrunk pieces; matchPaths aligns commands
group opacity 0 until `at`; path i starts at at + i*stagger; rest = d of unused regions
```
*Criterion:* R-343

#### Dorling cartogram — [D]
*Serves:* G-8, G-7
*Code:* geo/src/morph.ts (`cartogram`, `relax`)
```pseudo
r_i = k * sqrt(value_i), k = sqrt(coverage * frame.w * frame.h / (PI * total))
discs start at region centroids; relax(discs, gap, frame) until no overlap
bubbles rounded to 0.1 px; same inputs give same bubbles
```
*Criterion:* R-344

#### Bars from regions — [D]
*Serves:* G-8
*Code:* geo/src/morph.ts (`toBars`)
```pseudo
sort desc by value, keep `top`; order "asc" reverses
slot = frame.h / n; bar_i = rect(frame.x, frame.y + i*slot + gap/2, max(1, frame.w*value/max), slot-gap)
max = options.max ?? largest shown value (so the longest bar spans the frame)
```
*Criterion:* R-345

#### Traffic — [D]
*Serves:* G-8, G-7
*Code:* geo/src/traffic.ts (`traffic`, `generator`)
```pseudo
!(rate > 0) -> throw "traffic() needs a positive rate, got r."
!(during.over > 0) -> throw "traffic() needs a span with a positive length, .."
no lines -> throw "traffic() needs at least one route."; weights negative or all zero -> throw
count = max(1, round(rate * during.over)); particle k leaves at during.at + (k + rand())/count * over
route picked by weight with mulberry32(seed); reversed with probability `back`; each is a flow() token
end = max arrival
```
*Criterion:* R-346

#### Arc on a flat map — [D]
*Serves:* G-8
*Code:* geo/src/traffic.ts (`arc`)
```pseudo
a, b = map.point(lonlat) or the given Point; chord = distance; !(chord > 0) -> throw "arc() needs two different places."
height = options.height ?? chord/4; steps = options.steps ?? clamp(ceil(chord/6), 8, 200)
normal chosen to point up the page (ties: -x); quadratic Bezier with control at 2*height off the chord midpoint
points rounded to 0.1 px; same bow whichever end is first
```
*Criterion:* R-347

#### Globe layers — [D]
*Serves:* G-8, G-2
*Code:* geo/src/globe.ts (`globe`, `path`, `place` internal, `pivot`), geo/src/sphere.ts (`prepare`)
```pseudo
prepare(object, simplify, step): simplify on sphere, densify legs to <= step degrees, drop pole points, antimeridian cut, tiny rings (and their holes)
list empty -> throw "globe() found no lines or rings to draw."
pieces grouped by BAND degrees of longitude; each piece = sampledPath(frame t -> M..) with fixed point count
back hemisphere folded outward around pivot; polygon containing pivot gets an enclosing octagon ring
```
*Criterion:* R-348

#### Globe configuration — [D]
*Serves:* G-4, G-3
*Code:* geo/src/globe.ts (`globe`, `pivot`, `borders`)
```pseudo
spin function and no options.duration -> throw "globe() with a spin function needs a duration, as in { duration: 24 }."
!(duration > 0) -> throw "globe() needs a positive duration, got d."
borders() on non-Topology -> throw "globe().borders() needs TopoJSON, which knows which edges two regions share."
no pivot parallel with reach <= REACH and clearance >= 0.5 -> throw "globe() found no parallel behind the globe clear of every outline .."
unknown TopoJSON object -> throw "globe() found no TopoJSON object named <key>. ..."
```
*Criterion:* R-349

#### Globe places and arcs — [D]
*Serves:* G-8
*Code:* geo/src/globe.ts (`place`, `locate`, `route`, `circle`, `night`, `terminator`)
```pseudo
locate(at, t) = {screen point, z = dot(p, toward)}
place(at, {fade}) = sampled {x, y, opacity = clamp(z / fade)} ; fade default 0.08
route/circle/terminator: arcs() sampled every 3 degrees; a hidden arc shrinks to where it will appear
night(date): 49-point terminator edge + rim; date is a Date or (t) => Date
```
*Criterion:* R-350

#### Reproject — [D]
*Serves:* G-8
*Code:* geo/src/reproject.ts (`reproject`, `rings`, `tidy`, `draw`)
```pseudo
projections.length < 2 -> throw "reproject() needs at least two projections."
each projection fitExtent(frame, kept collection)
rings cut at the antimeridian (equirectangular stream), DP to `simplify` degrees, legs split to <= `step` degrees
a projected point non-finite or more than max(frame.w, frame.h) outside the frame -> throw "reproject() puts <name> far outside the frame under projection i. Filter it out: Mercator stretches the poles without end."
all projections write the same points -> same commands; unknown key -> throw 'reproject() has no region "<key>". ..'
```
*Criterion:* R-351

#### True-size slide — [D]
*Serves:* G-8
*Code:* geo/src/reproject.ts (`trueSize`)
```pseudo
geometry not Polygon/MultiPolygon -> throw "trueSize() needs a region with polygons."
main = largest polygon; rotate every outline point about axis (from x to) by theta * ease(u), u = clamp((t-at)/over)
each frame projected through map.projection; sampledPath(sample, {duration, tolerance})
```
*Criterion:* R-352

#### Moving night side — [D]
*Serves:* G-8
*Code:* geo/src/nightfall.ts (`nightfall`)
```pseudo
lons = columns evenly across the map's visible longitudes (epsilon inside the ends)
per column: terminator latitude = atan(-cos(lon - sunLon) / tan(sunLat)), span [-90, edge] (sunLat >= 0) or [edge, 90]
points clamped to frame +/- one frame; path = top edge forward, bottom edge back, Z
sunLat within 1e-6 of 0 uses 1e-6 (equinox keeps one shape)
```
*Criterion:* R-353

#### Typeset a formula — [D]
*Serves:* G-8, G-2, G-1
*Code:* math/src/index.ts (`tex`), math/src/mathjax.ts (`compile`)
```pseudo
!(fontSize > 0) or non-finite x+y+anchor -> throw "tex() needs finite coordinates and anchor and a positive fontSize, got .."
k = fontSize/1000; box origin = (x - anchor0*boxW*k, y - anchor1*boxH*k)
glyph matrix = translate(box) * scale(k) * translate(-minX,-minY) * mark.matrix, rounded to 3 decimals
bounds = rect(x, y, boxW*k, boxH*k); words in reading order, y-flipped (matrix[3] < 0)
```
*Criterion:* R-354

#### Reject what cannot be drawn — [D]
*Serves:* G-4, G-9
*Code:* math/src/mathjax.ts (`compile`, `convert`), math/src/matrix.ts (`parseTransform`), math/src/path.ts (`pathPoints`)
```pseudo
data-mjx-error on any node -> throw 'tex() could not parse "<src>": <MathJax message>'
<text> with content -> throw 'tex() cannot draw "<c>" in "<src>": the MathJax font has no glyph for it.'
other element kinds (svg, use, clipPath..) -> throw 'tex() cannot draw a <kind> element in "<src>". ..'
viewBox missing/NaN -> throw "tex() could not read the box MathJax drew for .. A \tag draws a full-width table that has none."
transform other than translate/scale, relative path command -> throw
MathJax packages exclude noundefined and noerrors so typos throw
```
*Criterion:* R-355

#### Glyph pairing key — [D]
*Serves:* G-8
*Code:* math/src/index.ts (`tex`), math/src/mathjax.ts (`Mark.key`, `size`)
```pseudo
text = key + "@" + round(size, 3)       // key = NFKC char, or "rect:WxH" / "line:DXxDY" for a bar
size = product of nested scale() = matrix[0]  (0.707 per superscript level)
morph() pairs equal text (or equal id); a superscript 2 never pairs with a full-size 2
```
*Criterion:* R-356

#### Name parts of a formula — [D]
*Serves:* G-8, G-9
*Code:* math/src/index.ts (`get`, `find`)
```pseudo
get(id) = union of bounds of glyphs with that id; none -> throw 'tex.get() found no part named "<id>".'
find(text, nth=1) = union of the nth run of consecutive glyphs whose chars spell text (matches must start and end on glyph boundaries)
fewer than nth runs -> throw 'tex.find() found <seen> of "<text>", not <nth>.'
```
*Criterion:* R-357

#### Write a formula on — [D]
*Serves:* G-8, G-3
*Code:* math/src/index.ts (`write`)
```pseudo
!(over >= 0 and stroke > 0) -> throw "tex.write() needs a non-negative span and a positive stroke time, got over o and stroke s."
step = max(0, over - stroke)/(n-1); glyph i starts at at + i*step
per glyph: outline draws (draw 0 to 1 over 0.7*stroke) then fades (0.3*stroke); fill fades in from start + stroke/2 over stroke/2
```
*Criterion:* R-358

#### Colour precedence — [D]
*Serves:* G-8, G-5
*Code:* math/src/index.ts (`tex`, `draw`), math/src/mathjax.ts (`walk`)
```pseudo
fill(glyph) = \color value of the part if set (not none/currentColor)
            else options.color ?? tint(theme, "plain")
```
*Criterion:* R-359

#### Plane steps — [D]
*Serves:* G-4, G-3
*Code:* math/src/plane.ts (`make.push`, `then`, `toMatrix`, `plane`)
```pseudo
plane(): !(unit > 0) or !(step > 0) or origin not finite -> throw "plane() needs a finite origin and a positive unit and step, got .."
push: !(over > 0) or at not finite or at < 0 -> throw "A plane step needs a non-negative start and a positive length, got .."
      at < last.at + last.over -> throw "A plane step starts at <at>s, before the previous step ends at <end>s."
apply(rows): non-finite -> throw "plane.apply() needs finite numbers in its matrix, got .."
matrix after matrix multiplies; any function wraps into a composed function; reset() pushes the identity
point(x,y) = origin + (x*unit, -y*unit); map(x,y) = point of the composed placement
```
*Criterion:* R-360

#### Plane drawing mode — [D]
*Serves:* G-2, G-1
*Code:* math/src/plane.ts (`make.draw`, `cssDrawing`, `warpDrawing`), math/src/warp.ts (`warp`, `refine`)
```pseudo
if every step is a matrix: one .plane-map transform driven by registered --plane-a..f numbers (only moving ones animated)
else: outlines refined and morphed through `d`, one key per move (same commands at every key)
applyFunction: f(x,y) non-finite -> throw "plane.applyFunction() sent (x, y) to (..), which is not a finite point."
```
*Criterion:* R-361

#### Plane vectors, spans and labels — [D]
*Serves:* G-8
*Code:* math/src/plane.ts (`vector`, `span`, `label`, `basis`), math/src/warp.ts (`head`, `ride`)
```pseudo
vector: non-finite or zero length -> throw "plane.vector() needs a finite arrow of nonzero length, from [..] to [..]."
head: upright polygon at the tip, rotated by atan2 of the transformed shaft's last leg (CSS atan2 or sampled)
label: TeX centered, pushed past the tip, turned LEAN (35 degrees) off the arrow
span: zero direction -> throw "plane.span() needs a nonzero direction, got [dx, dy]."
basis: i-hat green, j-hat red entering 0.2 s later
```
*Criterion:* R-362

#### Construct timeline — [D]
*Serves:* G-3, G-8
*Code:* math/src/construct.ts (`slot`, `together`, `step`, `settle`)
```pseudo
slot(kind, {at, over}): at = timing.at ?? batch.start ?? cursor; over = timing.over ?? pace[kind]
  !(at >= 0 and over >= 0) or non-finite -> throw "An element needs a finite start of 0 or more and a duration of 0 or more, got .."
  end = max(end, at+over); outside a batch cursor = at+over+gap
together(build): nested -> throw "together() cannot nest. Put the elements in one together() block."; cursor = batch.end + gap
step(pause = pace.step): cursor += pause, returns cursor;  g.time reads cursor, g.end the last finish
settle(): every aid not yet settled fades to `faint` from `at` over 0.8 s
```
*Criterion:* R-363

#### Construct intersections — [D]
*Serves:* G-8, G-9
*Code:* math/src/construct.ts (`cross`, `intersections`, `crossCircles`, `crossLineCircle`, `crossLines`)
```pseudo
no crossing -> throw "intersect() found no crossing of <a> and <b>. Raise a radius, move a center, or use lines that are not parallel."
any crossing outside a non-endless segment -> throw "intersect() crossing (x, y) lies past the end of segment <ab>. Draw it with g.line() so it runs on, .."
one result for two lines; otherwise both, in order: along the line (line/circle), left of c1->c2 first (circle/circle)
pick 0|1 keeps one (else throw "intersect() pick is 0 or 1, got p."); each kept point draws a dot and optional label
```
*Criterion:* R-364

#### Construct composites — [D]
*Serves:* G-8
*Code:* math/src/construct.ts (`perpendicularBisector`, `angleBisector`, `through`, `midpoint`)
```pseudo
perpendicularBisector(a,b): a==b -> throw; compass:true draws two aid arcs (+-78/102..258 degrees) and crosses them; line extended 20%
angleBisector(a,b,c): vertex coincides with an end -> throw "angleBisector() needs the vertex in the middle and two other points, got .."; ray from b, compass arcs as aids
parallel/perpendicular(line, p): endless line through p, length-of-line direction, extension 30% of line length
midpoint = point at the mean; line with equal points -> throw "A line needs two different points, got <p> twice."
```
*Criterion:* R-365

#### Construct element validation — [D]
*Serves:* G-4, G-9
*Code:* math/src/construct.ts (`construct`, `circle`, `point`, `polygon`, `angle`, `tick`)
```pseudo
unit/fontSize not > 0 or origin non-finite -> throw "construct() needs a positive unit and fontSize and a finite origin, got .."
circle radius not > 0 or non-finite -> throw "circle() needs a positive radius, got r. Pass a point other than the center, or a radius above 0."
point non-finite -> throw "point() needs finite coordinates, got x, y."
polygon < 3 points -> throw "polygon() needs at least three points, got n."
angle with a == b or b == c -> throw "angle() needs the vertex in the middle and two other points, ..."; bad radius/count -> throw; tick count < 1 -> throw
angle mark is a square when within 0.5 degree of 90 unless `mark` says otherwise
```
*Criterion:* R-366

#### Fourier series of an outline — [D]
*Serves:* G-8, G-2
*Code:* math/src/epicycles.ts (`fourier`, `spectrum`, `resample`, `loop`, `contours`)
```pseudo
samples not even integer >= 4 -> throw "fourier() needs an even number of samples, 4 or more, got n."
terms not integer in 1..samples-1 -> throw "fourier() keeps 1 to <samples-1> terms, got n."
outline joined to one closed loop (straight bridges), < 3 points -> throw "<caller> needs an outline with at least three points."; zero length -> throw "<caller> needs an outline with some length."
resample evenly by arc length; DFT for k = -n/2+1..n/2; k=0 is `mean`; the rest sorted by r descending (ties: smaller |k|)
```
*Criterion:* R-367

#### Epicycles — [D]
*Serves:* G-8, G-3, G-2
*Code:* math/src/epicycles.ts (`epicycles`)
```pseudo
!(over > 0) or at not finite -> throw "epicycles() needs a finite start and a positive duration, got .."
terms not integer in 1..511, circles < 0, fade < 0 -> throw "epicycles() needs 1 to 511 terms, .."
path arcs "A"/"a" -> throw 'epicycles() cannot read a "A" path command. ..'
placed = outline centered at `center`, longer side scaled to `size`; 1024 samples; `terms` kept
circle i spins by (k_i - k_{i-1}) turns over `over`, linear; ring+arm drawn only for i < circles
trace = 400-point polyline of the same sum, `draw` track sampled from its own arc length; fade rings after at+over
```
*Criterion:* R-368

#### Derivation — [D]
*Serves:* G-8, G-3
*Code:* math/src/derive.ts (`derive`, `alignPoint`)
```pseudo
no steps, or !(every >= over), or !(over > 0), or !(fontSize > 0) -> throw "derive() needs a step, a positive over that fits in every, .."
align "=" and no "=" in a line -> throw 'derive() found no "=" in step i, "<chars>". Put one in every step, or pass align as the id of a \cssId in each.'
each line shifted so its align point sits on x; line i starts at at + i*every
stack: line i at y + i*lineHeight fading in; else lines morph() in place
note (not on step 0): TeX at 0.65*fontSize after an arrow, fades with the next change unless stacked
end = start(last) + over (0 for one step)
```
*Criterion:* R-369

#### Counter — [D]
*Serves:* G-8, G-3
*Code:* math/src/counter.ts (`counter`, `changes`, `format`)
```pseudo
digits not whole >= 0, fontSize not > 0, roll < 0 -> throw "counter() needs a whole number of digits, a positive fontSize and a non-negative roll, got .."
function values: duration/step missing or not > 0 -> throw "counter() of a function needs a positive duration and step, .."
no values or non-finite -> throw "counter() needs at least one value, each with a finite time and number."
roll > 0 and two changes closer than roll -> throw "counter() changes faster than its roll of <roll> seconds."
text = value.toFixed(digits) (-0 prints as 0); change only when the text changes
one glyph per place per distinct digit, toggled by stepped opacity (roll: translate + fade); places sized to the widest value, sign place only if any value is negative
```
*Criterion:* R-370

#### Compile-time only, deterministic — [D]
*Serves:* G-2, G-7, G-6
*Code:* all of geo/src and math/src
```pseudo
d3-geo, topojson-client, MathJax run during the scene build; output holds paths, groups and Motions only
seeded generators only (traffic: mulberry32(seed)); no Date.now, no Math.random
```
*Criterion:* R-371

## §5 Agents and automation

Three non-human actors use svjeez, and each goes through the same public interface as a person.

- **A coding agent writing a scene.** It knows only the shipped skill (`SKILL.md` and its
  references), the type errors and the compile errors. It calls the same API, and the
  error-table invariant keeps the skill and the errors in step. — Serves G-9
- **An agent driving the live editor.** It sends the same editor messages as a drag or a
  keystroke, so it gets no capability a person lacks. — Serves G-10
- **The release workflow.** `release.yml` publishes every package whose version is not on npm
  yet, after CI passes. Its rules are under Frames, CLI, build plugins, video, packaging and
  release.

## §6 Numbers — [T]

Every tunable constant. Elsewhere the docs and tests name the constant, never its value. A name marked [P] is a literal in the code that should become that named constant.

| Name | Value | Unit | File | Decision |
|---|---|---|---|---|
| `EPSILON` | 1e-9 | s | motion.ts | D-8 |
| `NUDGE` | 1e-5 | fraction of the period/duration | motion.ts | D-8 |
| ease.in points | 0.55, 0.06, 0.68, 0.19 | cubic-bezier | motion.ts | D-9 |
| ease.out points (default) | 0.23, 1, 0.32, 1 | cubic-bezier | motion.ts | D-9 |
| ease.inOut points | 0.77, 0, 0.175, 1 | cubic-bezier | motion.ts | D-9 |
| ease.pop points | 0.34, 1.56, 0.64, 1 | cubic-bezier | motion.ts | D-9 |
| ease.hold | steps(1) | steps | motion.ts | D-9 |
| `SHAKE_RATE` [P] (inline `12`) | 12 | direction changes/s | recipes.ts | D-10 |
| `SHAKE_MIN_COUNT` [P] (inline `2`) | 2 | swings | recipes.ts | D-10 |
| `WIGGLE_RATE` [P] (inline `8`) | 8 | samples/s | recipes.ts | D-10 |
| `WIGGLE_PERIOD` [P] (inline `2`) | 2 | s | recipes.ts | D-10 |
| `WIGGLE_MIN_COUNT` [P] (inline `2`) | 2 | samples | recipes.ts | D-10 |
| `SAMPLED_STEP` [P] (inline default `0.05`) | 0.05 | s | recipes.ts | D-5 |
| `JUMP_HALVINGS` [P] (inline `20`) | 20 | bisections | recipes.ts | D-5 |
| `JUMP_FLOOR_DIVISOR` [P] (inline `1000`) | 1000 | divisor of the span's distance | recipes.ts | D-5 |
| `EASE_BISECTIONS` [P] (inline `40`) | 40 | iterations | ease-at.ts | D-9 |
| `FOLLOW_PROBE_DIVISOR` [P] (inline `10_000`) | 10000 | divisor of the param range | params.ts | D-12 |
| `NUMBER_DEFAULT_STEP` [P] (inline `0.01`) | 0.01 | param units | params.ts | D-12 |
| `HOLD` | 0.001 | s | restyle.ts | D-7 |
| `FNV_OFFSET` / `FNV_PRIME` [P] (inline) | 0x811c9dc5 / 0x01000193 | hash constants | random.ts | D-4 |
| mulberry32 increment [P] (inline) | 0x6d2b79f5 | PRNG constant | random.ts | D-4 |
| `SIGNIFICANT_DIGITS_MIN` [P] (inline `6` in `significant`) | 6 | digits | format.ts (used by calc) | D-11 |
| calc operator precedence (`PRECEDENCE`) | + - : 1, * / : 2 | rank | calc.ts | none |
| Sampled-match tolerance in test | 0.5px, 0.005 opacity | px, unit | tests/sample.test.tsx | not a tunable |
| `MAX_KEYS` | 2000 | keys per lane | compile.ts | D-21 |
| default `reducedMotion.at` (inline `duration * 0.85`; propose `STILL_FRACTION`) [P] | 0.85 | fraction of duration | render.ts | D-16 |
| `BASE_TIMING` | `timing(ease.out)`, the curve is “Timeline and motion”'s `ease.out` | CSS timing | css.ts | D-21 |
| `num` default places | 3 | decimal places | format.ts | D-25 |
| percent places (inline `[3, 4]`) [P: `PERCENT_PLACES`] | 3, then 4 | decimal places | css.ts | D-25 |
| keyTimes places (inline `5`) [P: `KEYTIME_PLACES`] | 5 | decimal places | smil.ts | D-25 |
| `FILTERED_ANIMATION_LIMIT` | 40 | animated descendants | validate.ts | D-22 |
| `EMBED_WARN_BYTES` | 262144 | characters of data URI | validate.ts | D-20 |
| `BOIL_FRAMES` | 4 | seeds per loop | fx.tsx | D-24 |
| `boil` defaults | strength 3, rate 10, seed 1, detail 0.04 | px, seeds per s, seed, frequency | fx.tsx | D-24 |
| `glow` default blur | 5 | px | fx.tsx | D-24 |
| `shadow` defaults | dx 0, dy 4, blur 6, black, opacity 0.4 | px | fx.tsx | D-24 |
| `grayscale` default amount | 1 | fraction | fx.tsx | D-24 |
| Rec. 709 luminance weights (inline) [P: `LUMA`] | 0.2126, 0.7152, 0.0722 | weight | fx.tsx | D-24 |
| duotone matrix places (inline `4`) | 4 | decimal places | fx.tsx | D-25 |
| `Icon` default strokeWidth | 2 | grid units | icon.tsx | D-26 |
| `Picture` default fit | cover | enum | picture.tsx | D-20 |
| `Picture` transform places (inline `4` and `6`) | 4 translate, 6 scale | decimal places | picture.tsx | D-25 |
| `base64` CHUNK (inline `0x8000`) [P: `BASE64_CHUNK`] | 32768 | bytes per `fromCharCode` call | picture.tsx | none, avoids call stack overflow |
| `PREFIX` id letters | f g p c m k s | | compile.ts | D-15 |
| SMIL default spline (inline `"0 0 1 1"`) | linear | keySplines | smil.ts | D-14 |
| `POLYLINE_PRECISION` [P] (default `precision` in `polylinePath`) | 1 | decimals | geometry.ts | D-36 |
| `SPLINE_PRECISION` [P] (`at()` in spline.ts) | 2 | decimals | spline.ts | D-36 |
| `NEAREST_SCAN` [P] (literal 32) | 32 | samples per leg | spline.ts | D-36 |
| `NEAREST_REFINE` [P] (literal 40) | 40 | ternary steps | spline.ts | D-36 |
| `MATCH_PRECISION` [P] (`options.precision ?? 2`) | 2 | decimals | paths.ts | D-36 |
| `ARC_PIECE` [P] (`Math.PI / 2`) | 90 | degrees per cubic | paths.ts | D-30 |
| `SAMPLE_STEP` [P] (`step = 0.05`) | 0.05 | s | paths.ts | D-31 |
| `SAMPLED_PRECISION` [P] (`options.precision ?? 1`) | 1 | decimals | paths.ts | D-31 |
| `NUDGE` | 1e-5 | fraction of duration | motion.ts | (“Timeline and motion”) |
| `MAX_COMPONENTS` | 4096 | glyph components | font/glyf.ts | D-34 |
| `MAX_COMPOSITE_DEPTH` [P] (literal 8) | 8 | nesting levels | font/glyf.ts | D-34 |
| Weight bounds [P] `MIN_WEIGHT`, `MAX_WEIGHT` | 1, 1000 | CSS weight | font/font.ts | D-33 |
| `GLYPH_PRECISION` [P] (`fixed` rounds to 2) | 2 | decimals | font/glyf.ts | D-36 |
| `BASE64_CHUNK` (`CHUNK`) | 0x8000 | bytes | font/font.ts | |
| `DEFAULT_FEATURES` | 49 feature tags | | font/shape.ts | D-32 |
| `SKIPS` | 0xff1e | lookup flag mask | font/shape.ts | D-32 |
| `MAX_KERN_PAIRS` [P] (`slice(0, 10000)`) | 10000 | pairs | font/subset.ts | D-32 |
| `SHORT_LOCA_LIMIT` [P] | 0x20000 | bytes of glyf | font/subset.ts | D-32 |
| `EMBED_WARN_BYTES` | 256 * 1024 | bytes | validate.ts | (Compile and output) |
| Fallback advance and em (`unitsPerEm`, `horiz-adv-x`) | 1000, unitsPerEm/2 | font units | font/stroke.ts | D-37 |
| `STROKE_PRECISION` [P] (`round`) | 2 | decimals | font/stroke.ts | D-37 |
| Monospace estimate (`textWidth`) | 0.6 | em per character | font/font.ts | D-33 |
| `INK_SPACING` (`SPACING`) | 1.5 | px | ink/ink.tsx | D-38 |
| `INK_MIN_WIDTH` [P] | 0.05 | px | ink/ink.tsx | D-38 |
| `INK_CAP_MIN_HALF` [P] | 0.4 | px half-width | ink/ink.tsx | D-38 |
| `INK_END_GAP` [P] | 0.2 | px | ink/ink.tsx | D-38 |
| `INK_RESOLUTION` [P] | 0.1 | px | ink/ink.tsx | D-38 |
| Curve flatten density [P] `FLATTEN_CHORD` | 3 px per point, clamp 2..64 (arcs 2..96) | | ink/path.ts | D-38 |
| Pen defaults | size 1.5, taper 0.08, tip 0.45, wobble 0.06 over 18 px, hull `size*1.1` | px | ink/ink.tsx | D-38 |
| Brush defaults | size 6, taper 0.3, pressure 0.35, wobble `size*0.12`, tip 0.04 | px | ink/ink.tsx | D-38 |
| Nib defaults | size 5, angle 35, thin 0.12 | px, degrees | ink/ink.tsx | D-38 |
| Pencil defaults | size 1.2, taper 0.05, tip 0.5, grain 0.8 +- 0.3 at 3.5 px, drift `size*0.25`, hull `size*1.4` | px | ink/ink.tsx | D-38 |
| Reveal mask | box +-1e4, stroke `tool.size*2 + 2` | px | ink/ink.tsx | D-38 |
| `BLEED` | 0.4 | screen px | voxel.ts | D-39 |
| Face shades | top 1, south/north 0.8, east/west 0.6 | multiplier | voxel.ts | D-39 |
| `EDGE_ON` | 1e-9 | sine/cosine | space.ts | D-39 |
| `rankGap` default | 48 | px | layout/layered.ts | D-45 |
| `nodeGap` default | 36 (dummies use half) | px | layout/layered.ts | D-45 |
| `groupPad` default | 12 | px | layout/layered.ts | D-47 |
| `LOOP` (layered) | 20 (+4 +8 +label.w for room) | px | layout/layered.ts | D-45 |
| `PORT` | 12 | px | layout/layered.ts | D-45 |
| `TRACK` | 14 | px | layout/layered.ts | D-45 |
| `SNAP` | 6 | px | layout/layered.ts | D-45 |
| `MERGE` | 16 | px | layout/layered.ts | D-45 |
| `BEND` (exported) | 16 | px | layout/layered.ts | D-51 |
| barycenter sweeps | 8 (literal) | count | layout/layered.ts | D-54 [P]: name `ORDER_SWEEPS` |
| relaxation sweeps | 60 (literal) | count | layout/layered.ts | D-54 [P]: name `PLACE_SWEEPS` |
| relaxation weights | 8 / 4 / 1 (literals) | weight | layout/layered.ts | D-54 [P]: name `CHAIN_PULL`, `LINK_PULL` |
| loop attach fractions | 0.3 / 0.7 of node height (literals) | ratio | layout/layered.ts | [P]: name `LOOP_TOP`, `LOOP_BOTTOM` |
| group gap floor | 16 (`below + above + 16`) | px | layout/layered.ts | [P]: name `GROUP_GAP` |
| label run slack | `tallest + 2*BEND + 4`; `BEND` when none | px | layout/layered.ts | D-51 |
| `SAME` (route) | 0.5 | px | layout/route.ts | D-45 |
| `CLEAR` (route) | 6 | px | layout/route.ts | D-45 |
| label slide step | 4 (literal) | px | layout/route.ts | [P]: name `LABEL_STEP` |
| label cost weights | node/label hit 8, segment cross 2, short run 1 (literals) | cost | layout/route.ts | D-55 [P] |
| `levelGap` default | 40 | px | layout/tree.ts | D-44 |
| `siblingGap` default | 24 | px | layout/tree.ts | D-44 |
| `LOOP` (sequence) | w 28, h 18 | px | layout/sequence.ts | D-44 |
| `PAD` (sequence) | 16 | px | layout/sequence.ts | D-44 |
| `actorGap` default | 32 | px | layout/sequence.ts | D-44 |
| `rowGap` default | 14 | px | layout/sequence.ts | D-44 |
| first row offset below heads | 24 (literal) | px | layout/sequence.ts | [P]: name `HEAD_GAP` |
| `rowHeight` default | 56 | px | layout/lanes.ts | D-44 |
| `bar` default | 18 | px | layout/lanes.ts | D-44 |
| `NICE` tick steps | 0.1 0.2 0.5 1 2 5 10 15 30 60 120 300 600 | s | layout/lanes.ts | D-44 |
| min tick spacing | 56 (literal) | px | layout/lanes.ts | [P]: name `TICK_MIN` |
| label column pad | 24 (literal) | px | layout/lanes.ts | [P]: name `COLUMN_PAD` |
| `STILL` | 1e-9 | field units | layout/field.ts | D-53 |
| closeness test distance | spacing / 2 | field units | layout/field.ts | D-53 |
| own-line exemption | ceil(1.5 * spacing / step) steps | steps | layout/field.ts | D-53 |
| `CORNER` | 10 | px | diagrams/curve.ts | D-51 |
| `ROUND` | 0.55 | ratio | diagrams/curve.ts | D-51 |
| samples per curve piece | 9 (8 intervals) | points | diagrams/curve.ts | [P]: name `PIECE_SAMPLES` |
| default `fontSize` | 14 (small = 0.85x) | px | diagrams/kit.ts | D-49 |
| node size factors | w = text + 2.2*fontSize, h = round(2.8*fontSize); decision 1.45 / 4 / 4.4 | ratio | diagrams/kit.ts | D-49 |
| `SKEW` | 0.35 | ratio of h | diagrams/kit.ts | D-49 |
| `LID` | 5 | px | diagrams/kit.ts | D-49 |
| `HEAD` (arrowhead) | 8 | px | diagrams/kit.ts | D-49 |
| `popIn` duration / rise | 0.35 s / 6 px | s, px | diagrams/kit.ts | D-48 |
| arrow draw `over` default | 0.4 | s | diagrams/kit.ts | D-48 |
| flowchart `step` | 0.4 | s | diagrams/flowchart.ts | D-52 |
| tree `step` | 0.3 | s | diagrams/tree.ts | D-52 |
| sequence `step` | 0.8 | s | diagrams/sequence.ts | D-52 |
| state walk `dwell` | 1 | s | diagrams/state.ts | D-52 |
| state walk `speed` | 220 | px/s | diagrams/state.ts | D-52 |
| min walk leg | 0.35 | s | diagrams/state.ts | D-52 |
| `DOT` / `RING` / `PAD` (state) | 14 / 18 / 16 | px | diagrams/state.ts | D-57 |
| composite header | round(2.6 * fontSize) | px | diagrams/state.ts | D-57 |
| `BAR` (lanes diagram) | 18 | px | diagrams/lanes.ts | D-44 |
| lane link duration | 0.3 | s | diagrams/lanes.ts | D-52 |
| `TICK` | 4 | px, tick half-length | axes.ts | |
| `MAX_TICKS` | 500 | ticks per axis | axes.ts | D-63 |
| plot `samples` default | 200 | points | axes.ts | |
| plot `strokeWidth` default | 2.5 | px | axes.ts | |
| axes `fontSize` default | 12 | px | axes.ts | |
| coordinate rounding (`round`) | 0.1 | px | axes.ts, calculus.ts, field.ts | D-63 |
| code `fontSize`, `lineHeight` defaults | 14, 1.6 | px, x fontSize | code.ts | |
| code advance fallback | 0.6 × fontSize | px | code.ts | |
| monospace tolerance | 0.01 | px | code.ts | |
| baseline offset | 0.35 × fontSize | px | code.ts | |
| gutter width | digits + 2 | columns | code.ts | |
| morph `over` default | 0.8 | s | morph.ts | |
| typewriter `cps` default | 28 | chars/s | typewriter.ts | |
| caret blink period | 1 | s | typewriter.ts | |
| caret height / fill opacity | 1.25 × fontSize / 0.8 | | typewriter.ts | |
| reveal `step`, `over`, `from` | 0.6, 0.4, `{opacity:0,y:6}` | s | reveal.ts | |
| terminal `at`, `cps`, `think`, `gap` | 0.5, 18, 0.35, 0.6 | s, chars/s | terminal.ts | |
| terminal output stagger | 0.06 | s | terminal.ts | |
| terminal prompt | `❯`, role `blue` | | terminal.ts | |
| window `bar`, `radius` | 40, 12 | px | window.ts | |
| window dot radius / spacing | 5.5 / 18 | px | window.ts | |
| annotation fade (`during`) | 0.2 | s | annotations.ts | |
| Arrow barb length / half-angle | 8 / 0.45 | px / rad | annotations.ts | |
| Arrow shaft draw | min(0.6, over/2) | s | annotations.ts | |
| Underline draw | min(0.5, over/2) | s | annotations.ts | |
| Underline squiggle period | 8 | px | annotations.ts | |
| Callout `fontSize`, `columns` | 14, 24 | px, chars | annotations.ts | |
| Callout line height / padding / gap | 1.4 / 20 wide, 16 tall / 20 | | annotations.ts | |
| Brace `fontSize`, offset, radius | 12, 8, 8 | px | annotations.ts | |
| Marker `over`; corner radius | 0.4 s; 6 px | | marker.ts | |
| Focus `dim`, `fade` | 0.3, 0.3 | opacity, s | focus.ts | |
| Camera `over` | 0.5 | s | camera.ts | |
| timeline `fade` | 0.3 | s | timeline.ts | |
| `during` default fade | 0.3 | s | timeline.ts | |
| `visible` default fade | 0.15 | s | timeline.ts | |
| shot `over`; MOVES rise / zoom / slide | 0.45 s; y 24, scale 0.94, x 80 | | timeline.ts | |
| travel `speed` | 300 | px/s | timeline.ts | |
| readingTime `wps`, `min`, `settle` | 3.5, 2, 1 | words/s, s | timeline.ts | |
| flow `speed`, `size` | 220, 4.5 | px/s, px | flow.ts | |
| `TAIL` | 8 | dots | flow.ts | |
| `REACH` | 36 | px | flow.ts | |
| flow arrive ring duration | 0.7 | s | flow.ts | |
| dot `r`; line `strokeWidth` | 5; 2 | px | calculus.ts | |
| area `opacity`, `samples` | 0.25, 120 | | calculus.ts | |
| riemann `over`, `opacity` | 0.8, 0.3 | s | calculus.ts | |
| parametric / polar samples; morph samples | 400; 200 | points | calculus.ts | |
| curve morph `over` | 1 | s | calculus.ts | |
| derivative `h`; secant "near zero" | xSpan × 1e-5; xSpan × 1e-6 | | calculus.ts | |
| clamp margin past plot | 10% of ySpan | | calculus.ts | |
| secant chord margin | 48 | px | calculus.ts | |
| bake tolerances: path 0.4 px, dot translate 0.3 px | | | calculus.ts | |
| readout `step` | 1/12 | s | calculus.ts | |
| streamlines `spacing`, `step`, `maxLength`, `tolerance` | 24, 2, 900, 0.25 | px | field.ts | |
| fieldLines `each` | over / 3 | s | field.ts | |
| fieldLines `strokeWidth`, `opacity` | 1.25, 0.6 | | field.ts | |
| fieldFlow `speed`, `rest`, `tolerance`, `size` | 120, 0.4 × trip, 1, 2.5 | px/s, s, px | field.ts | |
| fieldFlow comet `tail` | 3 | dots | field.ts | |
| fieldFlow group fade | 0.6 | s | field.ts | |
| `GOLDEN` | 0.6180339887498949 | | field.ts | |
| vectorField `spacing`; fill factor; normalized length; head | 28; 0.85; 0.7 × spacing; ≤ 6 px, ±0.45 rad | | field.ts | |
| slopeField steps | range / 20 | graph units | field.ts | |
| slopeField mark length | 0.6 × nearer neighbour | px | field.ts | |
| slopeSolution step; max iterations per side | range / 400; 4000 | | field.ts | |
| contours `resolution`, `tolerance` | 4, 0.2 | px | field.ts | |
| contourSweep `frames`, `tolerance`, matchPaths precision | 16, 0.4, 1 | | field.ts | |
| `1e-9` tick epsilon; sweep-order epsilon | 1e-9 | | axes.ts, calculus.ts | [P] name them |
| default scale | 1 | device px / CSS px | frames.ts `resolve` | D-74 |
| `MAX_CAPTURE` | 16000 | device px | frames.ts | D-74 |
| `GAP` | 12 | CSS px | frames.ts | — |
| `CAPTION` | 20 | CSS px | frames.ts | — |
| sheet caption padding (literal `4`) | 4 | CSS px | frames.ts `sheetHtml` | [P] name `CAPTION_PAD` |
| default sheet columns (literal `4`) | 4 | columns | frames.ts | [P] name `DEFAULT_COLUMNS` |
| default frame count (CLI literal `6`) | 6 | frames | cli.ts `when` | [P] name `DEFAULT_COUNT` |
| `ORIGIN` | `https://svjeez.local/` | URL | frames.ts | D-73 |
| loop search bound (literal `1000`) | 1000 | multiples of the longest period | page.ts | [P] name `MAX_LOOP_MULTIPLE` |
| loop drift budget (literal `0.5`, `0.01`, `1`) | 0.5 ms/cycle, 0.01 ms slack, 1 ms floor | ms | page.ts `fits` | D-77 |
| scheme read timeout (literal `2000`) | 2000 | ms | scheme.ts | [P] name `SCHEME_TIMEOUT` |
| `FORMATS.mp4.codecs` | avc, hevc, vp9, av1 | | video index.ts | D-78 |
| `FORMATS.webm.codecs` | vp9, vp8, av1 | | video index.ts | D-78 |
| default `fps` | 30 | frames/s | video index.ts | — |
| default `loops` | 1 | loops | video index.ts | — |
| default `quality` | "high" | | video index.ts | — |
| even-side mask (`& ~1`) | 2 | px | video index.ts | D-78 |
| base64 chunk (`0x8000`) | 32768 | bytes | video index.ts | — |
| poster default scale | 1 | | posters.ts / README | — |
| poster default quality | 0.8 | 0..1 | posters.ts | D-80 |
| `encode` default quality (dead) | 0.82 | 0..1 | encode.ts | [P] delete (see Known bugs in CRITERIA.md) |
| `stillAt` fallback fraction (literal `0.72`) | 0.72 | of duration | posters.ts | [P] name `STILL_FRACTION`; D-80 |
| `LANES` | 4 | concurrent renders | posters.ts | D-80 |
| scene hash length (literal `12`) | 12 | base64url chars | scene.ts | D-79 |
| `ROUTE` | `/_svjeez/` | path | assets.ts | D-79 |
| preview debounce (literal `60`) | 60 | ms | preview.ts | [P] name `DEBOUNCE` |
| preview default port | 5173 | | preview.ts | — |
| `distTag` rule | `-` in version -> next | | release.ts | D-81 |
| gh release list limit (literal `1000`) | 1000 | releases | release.ts | [P] see Known bugs in CRITERIA.md |
| minimum playwright-core | >= 1.49 | version | package.json peers | D-72 |
| supported Node | 20, 22 (CI); astro 22 only | | ci.yml | D-82 |
| oldest TypeScript | 5.4 | version | package-check.ts | D-82 |
| module resolutions checked | node10 (TS 5), node16, nodenext, bundler | | package-check.ts | D-82 |
| `timeout` default of `createCompiler` (propose `COMPILE_TIMEOUT_MS`) | 10_000 | ms | client.ts | D-89 [P name] |
| `HEADER_LINES` | 2 | lines | compile.ts | D-89 |
| scrub divisor (inline `300`; propose `SCRUB_PIXELS`) | 300 | px per full range | controls.ts | D-92 [P] |
| fine scrub factor (inline `0.2`; propose `FINE_SCALE`) | 0.2 | ratio | controls.ts | D-92 [P] |
| big step multiplier (inline `10`; propose `BIG_STEPS`) | 10 | steps | controls.ts | [P] |
| `BEND_Y` | min -0.8, max 2.2 | unit square | controls.ts | D-92 |
| bend rounding (inline `100`) | 0.01 | unit | controls.ts | [P] |
| `curveOf` samples default | 40 | points | controls.ts | [P] |
| ease arrow step (inline `0.05`; propose `EASE_ARROW_STEP`) | 0.05 | unit square | gestures.ts | [P] |
| ease arrow big step (inline `0.25`; propose `EASE_ARROW_BIG`) | 0.25 | unit square | gestures.ts | [P] |
| probe nudge (inline `/200`; propose `PROBE_NUDGE_DIVISOR`) | range/200, at least one step | value | editor.ts | D-91 [P name] |
| declared handle step (inline `/10_000`; propose `PROBE_DECLARED_DIVISOR`) | range/10 000 | value | compile.ts | D-93 [P name] |
| move epsilon (inline `1e-3`; propose `MOVE_EPSILON`) | 0.001 | scene units | probe.ts | [P] |
| `placesOf` cap (inline `6`) | 6 | decimals | editor.ts | D-97 |
| ease literal decimals (inline `2`) | 2 | decimals | source.ts | D-97 |
| MEANINGS: opacity-like | 0..1 step 0.01 | | controls.ts | D-92 |
| MEANINGS: rotate-like | -360..360 step 1 unit ° | | controls.ts | D-92 |
| MEANINGS: time-like | 0..max(2|v|, 4) step 0.05 unit s | | controls.ts | D-92 |
| MEANINGS: size-like | 0..max(2|v|, 10) | | controls.ts | D-92 |
| MEANINGS: scale-like | 0..max(2|v|, 2) step 0.01 | | controls.ts | D-92 |
| default span (`span(v, 10)`) | max(2|v|, 10) either side | value | controls.ts | D-92 |
| `DRAWN` shape selector | path, circle, ellipse, rect, line, polyline, polygon, text, use, image, foreignObject | | probe.ts | [P] |
| popover geometry (`W`,`H`, margins 8/12/6, handle r=7) | 200x240 | px | EasePop | [P] |
| ease glyph viewBox | 24x18 | px | EaseControl | [P] |
| initial clock | playing, origin = creation time | | editor.ts | D-86 |
| TICK | 4 | px | charts/src/chart.ts | D-104 |
| ACCENTS | blue, number, green, magenta, cyan, yellow, red | theme slots | charts/src/chart.ts | D-105 |
| FONT_SIZE (proposed; inline default 12) | 12 | px | charts/src/chart.ts | [P] |
| Y_TICKS (proposed; inline default 5) | 5 | count | charts/src/chart.ts | [P] |
| X_TICKS (proposed; inline default 6) | 6 | count | charts/src/chart.ts | [P] |
| BAND_PADDING (proposed; inline default 0.3) | 0.3 | fraction of band | charts/src/chart.ts | [P] |
| GRID_OPACITY (proposed; inline 0.25) | 0.25 | opacity | charts/src/chart.ts | [P] |
| AXIS_WIDTH (proposed; inline 1.5) | 1.5 | px | charts/src/chart.ts | [P] |
| EPSILON | 1e-9 | relative to domain span | charts/src/series.ts | D-106 |
| BAR_OVER (proposed; inline 0.7) | 0.7 | s | charts/src/series.ts | [P] |
| LINE_OVER (proposed; inline 1.2) | 1.2 | s | charts/src/series.ts | [P] |
| STAGGER (proposed; inline 0.08) | 0.08 | s | charts/src/series.ts | [P] |
| BAR_RADIUS (proposed; inline 3) | 3 | px | charts/src/series.ts | [P] |
| GROUP_GAP (proposed; inline 2) | 2 | px | charts/src/series.ts | [P] |
| VALUE_LABEL_AT (proposed; inline 0.6 of over) | 0.6 | fraction of over | charts/src/series.ts | [P] |
| LABEL_FADE (proposed; inline 0.35 values, 0.4 series label) | 0.35 / 0.4 | s | charts/src/series.ts | [P] |
| STROKE_WIDTH (proposed; inline 2.5) | 2.5 | px | charts/src/series.ts | [P] |
| DOT_RADIUS (proposed; inline 4) | 4 | px | charts/src/series.ts | [P] |
| DOT_POP (proposed; inline 0.3) | 0.3 | s | charts/src/series.ts | [P] |
| AREA_FILL_OPACITY (proposed; inline 0.4 -> 0) | 0.4 | opacity | charts/src/series.ts | [P] |
| ROUND (proposed; `round` multiplier 10) | 0.1 | px | charts/src/series.ts | D-107 |
| TAB_SIZE (proposed; inline default 2) | 2 | spaces | code/src/index.ts | [P] |
| tokenizeTimeLimit | 0 | ms (0 = none) | code/src/index.ts | D-108 |
| HEADERS user-agent | `svjeez-fonts` | string | fonts/src/index.ts | D-109 |
| DEFAULT_WEIGHT (proposed; inline 400) | 400 | CSS weight | fonts/src/index.ts | [P] |
| cache folder | `$SVJEEZ_FONTS_CACHE` / `$XDG_CACHE_HOME/svjeez/fonts` / `~/.cache/svjeez/fonts` | path | fonts/src/index.ts | D-109 |
| `num` precision | 3 | decimals | icons/scripts/generate.ts | D-111 |
| Icon grid | 24 | units | icons/src/*.ts (upstream) | D-111 |
| icon stroke-width check | 2 | grid units | icons/scripts/generate.ts | D-111 |
| pinned upstreams | @tabler/icons 3.50.0, lucide-static 1.63.0 | versions | icons/package.json | D-111 |
| icon counts | tabler 6257, lucide 2193 | icons | generated | D-111 |
| FLOW_DEFAULT_DIRECTION | TD | enum | mermaid/src/flowchart.ts | D-112 |
| `tolerance` default (project) | 0.5 | px | geo/src/index.ts | D-117 |
| path grid (`tenth` in Writer) | 0.1 | px | geo/src/writer.ts | D-117 |
| DP epsilon factor (`#min / 2`) | tolerance / 2 | px | geo/src/writer.ts | D-117 |
| `EARTH_RADIUS_KM` [P] (literal 6371 in `distance`) | 6371 | km | geo/src/index.ts | |
| dots `step` default | 2 | degrees | geo/src/index.ts | |
| graticule `step` default; pole inset | 10; 1e-6 | degrees | geo/src/index.ts | |
| route default steps | 1 per degree, min 2 | segments | geo/src/index.ts | |
| `lines` rounding | 0.1 | px | geo/src/index.ts | |
| `SUN_J2000_DAYS` [P] (literal 10_957.5) | 10957.5 | days | geo/src/sun.ts | |
| scale `steps` default | 9 | classes | geo/src/scale.ts | D-128 |
| scale `empty` default | `#8a919b` | color | geo/src/scale.ts | |
| legend width / height / fontSize / ink | 240 / 10 / 11 / `#c9d1d9` | px | geo/src/scale.ts | |
| `LEGEND_LABEL_PX` [P] (literal 48 px per label) | 48 | px | geo/src/scale.ts | |
| choropleth `over` default | 0.8 | s | geo/src/choropleth.ts | |
| choropleth `lineWidth` default | 0.4 | px | geo/src/choropleth.ts | |
| morph `over` default | 1.2 | s | geo/src/morph.ts | |
| morph `fill` default | `#6b7280` | color | geo/src/morph.ts | |
| morph `detail` default | 2.5 | px | geo/src/morph.ts | D-122 |
| `RELATIVE` | 0.012 | share of piece diagonal | geo/src/morph.ts | D-122 |
| `MIN_PIECE` | 150 | px^2 bbox | geo/src/morph.ts | D-122 |
| cartogram `coverage` | 0.3 | share of frame | geo/src/morph.ts | |
| cartogram `gap` | 1 | px | geo/src/morph.ts | |
| `RELAX_PASSES` [P] (literal 400), pull 0.04, stop push < 0.01 after pass 40 | 400 / 0.04 / 0.01 / 40 | passes | geo/src/morph.ts | |
| toBars `top` default; gap | 12; slot * 0.2 | bars; px | geo/src/morph.ts | |
| traffic `seed` default | 1 | | geo/src/traffic.ts | D-123 |
| arc height default; steps clamp | chord/4; 8..200, chord/6 | px | geo/src/traffic.ts | |
| globe `simplify` / `step` / `tolerance` | 0.6 / 6 / 1 | deg / deg / px | geo/src/globe.ts | D-119 |
| `BEYOND` | 1 | share of radius | geo/src/globe.ts | D-119 |
| `REACH` | 80 | degrees | geo/src/globe.ts | D-119 |
| `SAMPLE` | 0.05 | s | geo/src/globe.ts | |
| `BAND` | 30 | degrees of longitude | geo/src/globe.ts | D-120 |
| pivot candidate step / min clearance | 0.5 / 0.5 | degrees | geo/src/globe.ts | |
| arc sampling | 3 | degrees | geo/src/globe.ts | |
| night edge points; octagon margin 1.05 | 49; 1.05 | points | geo/src/globe.ts | |
| place `fade` default | 0.08 | cos z | geo/src/globe.ts | |
| graticule `step` (globe) | 15 | degrees | geo/src/globe.ts | |
| reproject `simplify` / `step` | 0.3 / 2 | degrees | geo/src/reproject.ts | |
| trueSize `tolerance` / `step` | 0.5 / 1 | px / degrees | geo/src/reproject.ts | |
| nightfall `tolerance` / `columns` | 0.5 / 73 | px / columns | geo/src/nightfall.ts | D-129 |
| tex `fontSize` default | 32 | px | math/src/index.ts | |
| glyph unit | 1000 per em | units | math/src/index.ts | |
| `round` | 0.001 | px | math/src/matrix.ts | |
| write `stroke` default; draw share | 0.6; 0.7 | s; share | math/src/index.ts | |
| write stroke width | 1.2 / scale | px | math/src/index.ts | |
| plane `extent` / `step` defaults | 10 / 1 | units | math/src/plane.ts | |
| `TOLERANCE` (warp refine) | 0.5 | px | math/src/warp.ts | |
| refine depth | 8 | levels | math/src/warp.ts | |
| warp spacing | 16 / unit | units | math/src/plane.ts | |
| head sampledPath tolerance | 0.25 | px | math/src/warp.ts | |
| `LEAN` | 35 | degrees | math/src/warp.ts | |
| vector `width` default; head | 3; (4/3, 8/3, 11/6) x width | px | math/src/plane.ts | |
| vector label push | 4/3 width + 6 + half label diagonal; font 17 | px | math/src/plane.ts | |
| polygon fillOpacity / strokeWidth | 0.22 / 1.5 | | math/src/plane.ts | |
| basis delay between i and j | 0.2 | s | math/src/plane.ts | |
| construct `PACE` | point .3, line .7, circle 1, angle .5, fill .6, label .35, gap .15, step .6 | s | math/src/construct.ts | |
| construct `faint` | 0.22 | opacity | math/src/construct.ts | |
| construct `fontSize` | 20 | px | math/src/construct.ts | |
| `DOT`, `LABEL_GAP` | 3.6, 5 | px | math/src/construct.ts | |
| `EPS` | 1e-9 | | math/src/construct.ts | |
| settle `over` | 0.8 | s | math/src/construct.ts | |
| compass arc spans (perp. bisector 78 / 102..258; angle bisector 28; start offset 10) | | degrees | math/src/construct.ts | |
| angle `radius`, ring step, square factor | 26, 4.5, 0.55 | px | math/src/construct.ts | |
| right-angle tolerance | 0.5 | degrees | math/src/construct.ts | |
| tick half-length / spacing | 5 / 5 | px | math/src/construct.ts | |
| bisector `extend` fractions | 0.2 (perp.), 0.55 arm, 0.7 | share | math/src/construct.ts | |
| parallel/perpendicular extension | 0.3 | share of line length | math/src/construct.ts | |
| label direction away weight | 0.8 | | math/src/construct.ts | |
| polygon `opacity` default | 0.2 | | math/src/construct.ts | |
| `SAMPLES` | 1024 | points | math/src/epicycles.ts | D-127 |
| `CURVE_STEPS` | 16 | chords per curve | math/src/epicycles.ts | |
| `TRACE_POINTS` | 400 | points | math/src/epicycles.ts | |
| epicycles `terms` / `circles` / `strokeWidth` / `fade` | 80 / 24 / 2 / 0.6 | | math/src/epicycles.ts | |
| max epicycles terms | `SAMPLES / 2 - 1` = 511 | | math/src/epicycles.ts | |
| pen radius; ring opacity; arm opacity | 4; 0.4; 0.8 | px | math/src/epicycles.ts | |
| trail sample step; tolerance | over / 160; 0.002 | s; draw | math/src/epicycles.ts | |
| entry fade | min(0.5, over / 4) | s | math/src/epicycles.ts | |
| derive `every` / `over` / `fontSize` | 2.5 / 0.9 / 36 | s / s / px | math/src/derive.ts | |
| derive lineHeight; note size; note gap; arrow | 1.9; 0.65; 1.1; 0.8 | x fontSize | math/src/derive.ts | |
| derive notes box width | 8 x fontSize | px | math/src/derive.ts | |
| counter `step` default; `lift` | 0.1; 0.45 x fontSize | s; px | math/src/counter.ts | |
| mulberry32 increment | 0x6d2b79f5 | | geo/src/traffic.ts | D-123 |

## §7 Interface

The public API of each package, its commands and the errors it throws. For the live editor this includes the editor messages and the client contract.

### Timeline and motion

#### Public API
| Export (module) | Signature (short) | Legal when | Effect | Errors |
|---|---|---|---|---|
| `motion` (svjeez) | `motion(initial?) -> Motion` | always | New empty motion with initial values | none at runtime (initial unchecked) |
| `Motion.at` | `(t) -> Motion` | finite t >= 0 | Moves the cursor | at() needs a finite, non-negative number of seconds |
| `Motion.wait` | `(d) -> Motion` | finite d >= 0 | Cursor += d | wait() needs ... |
| `Motion.to` | `(values, over, ease?) -> Motion` | over > 0, values valid, no lane overlap, within period | Adds a transition | to() needs ...; Two transitions move ...; A step ending at ... overruns loop |
| `Motion.set` | `(values) -> Motion` | values valid, no lane overlap, within period | Adds a hard cut | as above |
| `Motion.loop` | `(period) -> Motion` | period > 0 and >= last end | Sets the repeat period | loop() needs ...; loop(...) is shorter than the motion |
| `Motion.label` | `(name) -> Motion` | CSS identifier | Sets the name | Label ... must be a CSS identifier |
| `ease` (svjeez) | presets, `steps(n)`, `bezier(a,b,c,d)` | steps: integer >= 1 | Ease values | ease.steps needs a positive whole count |
| `easeAt` (svjeez) | `(Ease, progress) -> number` | any progress | Value of the curve, clamped progress | none |
| `enter`, `exit`, `draw` (svjeez) | `(Span, from/to?, ease?) -> Motion` | at >= 0, over > 0 | One transition | <fn>() needs a start of 0 or later; needs a positive duration |
| `shake` (svjeez) | `(Span, amplitude, {rate?}) -> Motion` | as above | Damped oscillation | as above |
| `wiggle` (svjeez) | `(amplitude, WiggleOptions) -> Motion` | seed given; period > 0 | Seeded loop around rest | indirect: to() needs a positive duration if period is 0 |
| `sampled` (svjeez) | `(fn, SampledOptions) -> Motion` | see sampled rules | Bakes a function of time | sampled() needs ... |
| `sample` (svjeez) | `(stack, t, {duration, loop?}) -> values` | duration > 0, finite t | Reads what a stack draws at t | sample() needs ...; Two motions both animate ... |
| `random` (svjeez) | `(seed) -> () => number` | integer or string | Seeded stream in [0,1) | random() needs a whole number or a string seed |
| `Once` (svjeez) | JSX `<Once>` | anywhere a `<g>` is | Plays contents once | none |
| `Pivot` (svjeez) | JSX `<Pivot at animation>` | anywhere a `<g>` is | Rotate/scale about `at` | none |
| `restyle` (svjeez) | `(svg, RestyleOptions) -> svg` | a rendered scene | Returns a copy with clocks and css | none |
| `def.property`, `css`, `calc` (svjeez) | see rules | names valid, same declaration | Typed custom properties and expressions | Property name ... must be a CSS identifier ...; ... is already declared ... |
| `number`, `count`, `seconds`, `color`, `easing`, `choice`, `defaults`, `fit`, `fitValues`, `withValues`, `positionOf`, `valueAt`, `follow` (svjeez/params) | see rules | declarations valid | Plain-data schema and its helpers | see Errors |
| `keysOf`, `valueAt`, `snapPeriod`, `moving` (internal, keys.ts) | see rules | called by B | Key list | none |

#### CLI / build commands
None in this area. The `svjeez dev` scrubber and `render-png` read this area's data through B and the frame code.

#### Errors
| Message | Thrown when | Code |
|---|---|---|
| `<what> needs a finite, non-negative number of seconds, got …` | at/wait/to/loop given NaN, infinite or negative | motion.ts `time` |
| `to() needs a positive duration, got …. Use set() for a cut.` | over is 0 | motion.ts `Track.to` |
| `loop() needs a positive period, got ….` | period is 0 | motion.ts `Track.loop` |
| `loop(…) is shorter than the motion, which runs until …s.` | period before last step end | motion.ts `Track.loop` |
| `A step ending at …s overruns loop(…).` | step after `loop` ends past period | motion.ts `Track.push` |
| `Two transitions move `…` between …s and …s. Move them in one .to(), or stack two motions.` | two steps share a lane and overlap | motion.ts `Track.push` |
| `A transition needs at least one channel.` | empty values | motion.ts `checkValues` |
| `"…" is not an animatable channel.` | unknown key | motion.ts `checkValues` |
| `A transition needs a finite …, got ….` | NaN/inf numeric value | motion.ts `checkValues` |
| `Label "…" must be a CSS identifier.` | bad label | motion.ts `Track.label` |
| `ease.steps needs a positive whole count, got ….` | steps(0), steps(1.5) | motion.ts `steps` |
| `…() needs a start of 0 or later, got ….` | recipe span `at` < 0 or not finite | recipes.ts `span` |
| `…() needs a positive duration, got ….` | recipe span `over` <= 0 or not finite | recipes.ts `span` |
| `sampled() needs a positive duration, got ….` / `… a positive step, got ….` / `… a whole, non-negative precision, got ….` | bad sampled options | recipes.ts `sampled` |
| `sampled() returned different channels at t=… than at t=0; every sample needs the same keys, each a finite number.` | frame keys differ | recipes.ts `frameAt` |
| `sampled() needs a non-negative tolerance for `…`, got ….` | a lane has no tolerance | recipes.ts `sampled` |
| `sample() needs a positive duration, got ….` / `… a finite time, got ….` | bad arguments | sample.ts |
| `sample() needs a starting value for …. Pass it to motion({ …: … }).` | numeric channel with no initial and no identity | sample.ts `layerAt` |
| `Two motions both animate `…` in sample(): put them in one motion().` | non-stacking target in two layers | sample.ts `sample` |
| `random() needs a whole number or a string seed, got ….` | fractional or NaN seed | random.ts |
| `… was never declared with def.property().` | undeclared property key used | properties.ts `declarationOf` |
| `Property name "…" must be a CSS identifier without the leading --.` / `Unknown property syntax "…".` / `… is already declared with inherits … and initial ….` | bad `def.property` | properties.ts `property` |
| `Expected a finite number, received …` | non-finite calc literal or css hole | format.ts (via calc.ts/properties.ts) |
| `…(…) needs min below max, got … and ….` / `… needs a positive step, got ….` / `… is outside its range … to ….` / `… has a log scale, so its min must be positive, got ….` | number-kind declaration | params.ts `check` |
| `count(…) needs a whole number.` | fractional count | params.ts |
| `choice("…") is not one of ….` | value not in options | params.ts |

### Compile and output

#### Public API
| Export (module) | Signature (short) | Legal when | Effect | Errors |
|---|---|---|---|---|
| `render` (svjeez) | `(options: RenderOptions, content: Child) => string` | Positive size, duration, playbackRate; valid prefix | Compiles, serializes, validates; returns SVG text ending in `\n` | See Errors: render guards, `Generated SVG is invalid:`, every compile error |
| `def.<tag>` (svjeez) | `(attrs, children?) => Ref<Tag>` | Tag is one of the eight DefTags | A ref; emitted only if used | none |
| `def.property` | `(name, {syntax, inherits, initial}) => Property` | Name is an identifier; same key redeclared identically | Registers in the module registry | invalid name, unknown syntax, conflicting redeclaration |
| `css` | tagged template with Property, Css or number holes | Holes only | A `Css` whose holes become `var(--pN)` | none |
| `el` | `el.<tag>(props?, content?) => SvgNode` | Props typed by tag | Same node as JSX | unknown attribute, unsupported value, bad animation entry |
| `fx` | `glow boil grayscale duotone blur shadow` | duotone hex only | A filter ref | `fx.duotone() needs …` |
| `picture` | `(bytes or markup) => PictureData` | Known format with a readable size | Embeds as data URI | unknown format, no size, truncated |
| `picture.load` | `(path or URL) => Promise<PictureData>` | Path, `file:`, http(s) | Reads then `picture()` | load failures |
| `Picture` | JSX component | | Framed image | none |
| `Icon` | JSX component | | One path per piece | none |
| `Glyphs` | JSX component | Font has the glyph layout (“Geometry, fonts, ink and voxels”) | One path per glyph | font errors |
| `Once` (svjeez) | `(props) => Element` | | `<g>` with `once` set | none |
| `validateSvg` | `(source: string) => ValidationResult` | | Regex checks | none |
| `jsx`, `jsxs`, `jsxDEV`, `Fragment` (svjeez/jsx-runtime) | automatic runtime | | | as `node` |
| `jsxDEV` (svjeez/jsx-dev-runtime) | adds `source` | | records location | none |

#### CLI / build commands (if any)
| Command | Effect |
|---|---|
| `svjeez svg scene.tsx --out scene.svg` | Runs the scene module's default export and writes the SVG (the CLI is under Frames, CLI, plugins and release; it calls `render`). |
| `bun run test:node` in packages/svjeez | Renders the skill's examples on the current Node through tsx (checks Node 20 compatibility of this area). |
| `bun run build:examples` | Rebuilds `examples/dist/`; CI fails if stale. |

#### Errors
| Message (use … for filled-in values) | Thrown when | Code |
|---|---|---|
| `render() needs a positive width and height, got … by ….` | width or height not > 0 | render.ts |
| `render() needs a positive duration, got ….` | duration not > 0 | render.ts |
| `render() needs a positive, finite playbackRate, got ….` | rate not > 0 or not finite | render.ts |
| `render() needs a prefix of letters, digits, _ and -, starting with a letter, got ….` | prefix fails the pattern | render.ts |
| `Generated SVG is invalid:` then `  - …` lines | validateSvg found errors | render.ts |
| `… on <…> has no starting value. Pass it to motion({ …: … }) or set the attribute.` | no initial and no attribute | compile.ts |
| `<…> cannot animate ….` | tag not in the channel's tags | compile.ts |
| `A motion on <…> runs until …s, past the …s scene.` | last step past the period | compile.ts |
| `… on <…> has … keys; the cap is ….` | keys > MAX_KEYS | compile.ts |
| `d on <path> moves between paths with different commands, so it would jump. Write them through matchPaths() first.` | d keys differ in commands | compile.ts |
| ``Two motions both animate `…` on <…>: put them in one motion().`` | two replace lanes of one key on one element | compile.ts |
| `… needs …="…"; this <…> sets …="…".` | author attribute contradicts a pin | compile.ts |
| `Two different fonts claim …. Give one of them another family name with font(bytes, { family }).` | two files on one family, weight, style | compile.ts |
| `Two keys are too close to tell apart on a …s timeline: ….` | percentages collide at 4 places | css.ts |
| `Lane … has no value.` | internal; keys with no values | css.ts |
| `Unresolved ref in ….` | a ref reached the serializer | svg.ts |
| `A def ref is not a string. Pass it as the attribute value itself.` | `String(ref)` | defs.ts |
| `Unsupported SVG child: ….` | child is not text, number, node, array | svg.ts |
| `Unsupported value for …: ….` | attribute value of an unsupported type | svg.ts |
| `animation takes motions built with motion() or a recipe.` | animation entry is not a motion | svg.ts |
| `<…> has no attribute "…".` | prop not in the tag's table | attributes.ts |
| `Expected a finite number, received ….` | `num` or `significant` on NaN or Infinity | format.ts |
| `… was never declared with def.property().` | property key not in registry | properties.ts |
| `… is already declared with inherits … and initial ….` | conflicting redeclaration | properties.ts |
| `Property name "…" must be a CSS identifier without the leading --.` | bad name | properties.ts |
| `Unknown property syntax "…".` | syntax not in the table | properties.ts |
| `Unknown image format. picture() reads ….` | no codec matches | picture.tsx |
| `This SVG has no size. Give the root <svg> a width and height or a viewBox.` | SVG with no usable size | picture.tsx |
| `Could not read the size of this … image. The file may be truncated.` | raster size unreadable | picture.tsx |
| `Could not load …: ….` | non-ok fetch | source.ts |
| `Cannot load …. Use an http(s) or file: URL, or a path.` | other URL scheme | source.ts |
| `… needs #rgb or #rrggbb colors, got ….` (alpha form: `#rgb, #rrggbb or #rrggbbaa`) | hex guard | color.ts |

### Geometry, fonts, ink and voxels

#### Public API
| Export (module) | Signature (short) | Legal when | Effect | Errors |
|---|---|---|---|---|
| `resample` (svjeez) | `(points, count) => Point[]` | >= 2 points, integer count >= 2 | Even points along the polyline | see Errors |
| `polylinePath` (svjeez) | `(points, {closed, precision}) => PathData` | >= 1 point | M/L path | see Errors |
| `rect` (svjeez) | `(x, y, w, h) => Rect` | always | Box with anchors, `pad`, `union`, `side` | none |
| `spline` (svjeez) | `(points) => Spline` | >= 2 points | Catmull-Rom curve object | see Errors |
| `matchPaths` (svjeez) | `(paths, {precision}) => PathData[]` | each path has a shape and readable commands | Same commands for all | see Errors |
| `sampledPath` (svjeez) | `(sample, options) => Motion<"d">` | positive duration and step, tolerance >= 0, same commands every sample | Simplified keys | see Errors |
| `font` (svjeez) | `(bytes, FontOptions) => Font` | TTF/OTF/WOFF/WOFF2 bytes | Embeddable font | see Errors |
| `font.load` | `(source, options) => Promise<Font>` | http(s) URL or path | Reads via `readSource` | as `font`, plus read errors |
| `font.family` | `(...faces) => FontFamily` | distinct weight/style slots | Groups faces | see Errors |
| `Font.measure/path/has/metrics/embed` | | TTF/OTF only (embed works for all) | Layout, outlines, glyph test, metrics, data URI | see Errors |
| `FontFamily.face` | `(weight?, style?) => Font` | always | CSS-matched face | none |
| `strokeFont`, `strokeFont.load` | `(markup \| bytes) => StrokeFont` | an SVG font | Centerline text | see Errors |
| `Ink`, `inkPath`, `tool.pen/brush/nib/pencil` (svjeez) | | valid path data | Filled hand-drawn outline | see Errors |
| `voxel.camera/texture/scene` (svjeez/voxel) | | see rule | Voxel picture node | see Errors |
| Internal, not exported from `svjeez`: `pathLength`, `blendPaths`, `commandsOf`, `flatten`, `fontFaces`, `fontFaceRule`, `isFontValue`, `textWidth`, `regularFace` | | | Used by compiler, keys, extras, glyphs | |

#### CLI / build commands
None in this area. Tests run in `packages/svjeez` with `bun test`; fonts for tests are the TTFs in `tests/fixtures/`.

#### Errors
| Message (use … for filled-in values) | Thrown when | Code |
|---|---|---|
| `resample() needs at least two points, got ….` | fewer than 2 points | geometry.ts |
| `resample() needs a whole count of 2 or more, got ….` | count not an integer >= 2 | geometry.ts |
| `polylinePath() needs at least one point.` | empty points | geometry.ts |
| `spline() needs at least two points, got ….` | fewer than 2 points | spline.ts |
| `matchPaths() cannot read the "…" command in "…".` | unknown command letter | paths.ts |
| `matchPaths() found … numbers after "…" in "…".` | wrong number count for a command | paths.ts |
| `matchPaths() found no shape in "…".` | no subpath | paths.ts |
| `sampledPath() needs a positive duration, got ….` / `… positive step …` / `… non-negative tolerance …` | bad option | paths.ts |
| `sampledPath() returned a path with different commands at t=… than at t=0. Write every sample through matchPaths() or with the same points.` | sample command mismatch | paths.ts |
| `This font is empty or truncated.` | under 12 bytes | font/font.ts |
| `This is a font collection (.ttc). Extract one face to a .ttf or .otf and load that.` | `ttcf` | font/font.ts |
| `Unknown font format. font() reads ttf, otf, woff, woff2.` | no signature match | font/font.ts |
| `This font is truncated: its table directory runs past the end of the file.` / `… a table runs past the end of the file.` | bad directory | font/sfnt.ts |
| `This font has no … table.` | required table missing | font/sfnt.ts |
| `This font has no Unicode character map (cmap format 4 or 12).` | no usable cmap | font/shape.ts |
| `font() needs a weight between 1 and 1000, got ….` | bad weight | font/font.ts |
| `… needs the TTF or OTF file. A … font embeds, but its tables are compressed.` | metrics/has/measure/path on WOFF | font/font.ts |
| `path() reads TrueType outlines. This OTF stores CFF outlines, which path() does not read yet.` | path() on OTF | font/font.ts |
| `path() needs a positive size and finite coordinates, got size … at …, ….` | bad size or origin (Font and StrokeFont) | font/font.ts, font/stroke.ts |
| `This font nests composite glyphs too deeply.` / `This font's composite glyphs have too many components.` | hostile composites | font/glyf.ts |
| `font.family() got two … faces of weight …. Each weight and style needs its own file.` | slot collision | font/font.ts |
| `font.family() needs at least one font, got none.` | empty (unreachable by type) | font/font.ts |
| `A font is not a string. Pass it as fontFamily={font}.` / `A font family is not a string. Pass it as fontFamily={family}.` | string coercion | font/font.ts |
| `strokeFont() reads SVG fonts, and this has no <font> element.` / `strokeFont() found no single-character <glyph> elements.` | not a stroke font | font/stroke.ts |
| `Path data must start with a command, got "…".` / `Path command … needs … numbers.` | malformed ink path | ink/path.ts |
| `voxel.scene() needs blocks on whole cells, got […].` / `voxel.scene() needs 0 <= from < to, got from … to … on the block at […].` | bad block | voxel.ts |
| `camera() needs a finite yaw, got ….` / `… a pitch between 0 and 90 degrees, got ….` / `… a positive unit, got ….` | bad camera | space.ts |
| `texture() needs at least one row of pixels, got none.` / `texture() row … has … pixels; row 0 has ….` / `texture() row … uses "…", which the palette lacks.` / `texture() needs #rgb, #rrggbb or #rrggbbaa colors, got ….` | bad texture | texture.ts |

Messages thrown by neighbours on this area's behalf: `Two different fonts claim …` (compile.ts), `An embedded font is … KB …` warning (validate.ts), `code() needs a monospaced font …` (extras/code.ts), `d on <path> moves between paths with different commands …` (compile.ts).

### Layout and diagrams

#### Public API
| Export (module) | Signature (short) | Legal when | Effect | Errors |
|---|---|---|---|---|
| `flowchart` (svjeez/extras) | `(spec{nodes, groups?, edges}, options?) => Flowchart` | edge/group ids are node keys (compile-time) | layered layout, outline-attached edges, optional rank-by-rank play | beats errors for `play.at` lists |
| `Flowchart.edge/route/get` | `(from,to)`, `(id)` | edge exists / path exists / id is node or group | samples or box | "No edge from …", "No path from …", `flowchart() has no "…".` |
| `stateMachine` | `(spec{states, initial, transitions}, options?) => StateMachine` | initial in own scope; ids unique across nesting | scoped layered layout | duplicate state, bad initial, unknown state |
| `StateMachine.walk` | `(path, {at, dwell?, speed?, token?}) => Walk` | path non-empty, each hop has a way | overlay with lit rings and a token | "walk() needs at least one state, got none.", "walk() has no way from …", beats errors |
| `StateMachine.edge/get` | `(from,to)`, `(id)` | transition exists | samples / box | "stateMachine() has no transition from … to …", `stateMachine() has no "…".` |
| `sequence` (extras) | `(spec{actors, messages}, options?) => Sequence` | message actor ids are actor keys | sequence diagram | layout errors for empty actors; beats errors |
| `Sequence.message` | `(i) => {span, points}` | 0 <= i < messages.length | slot and geometry | "sequence() has no message …." |
| `tree` (extras) | `(spec{nodes}, options?) => Tree` | exactly one node without parent; parent not self (type) | tidy tree | "tree() needs exactly one root, got …." and the other layout errors; beats errors |
| `Tree.route/get` | `(from,to)`, `(id)` | ids are node keys | up-then-down samples | `tree() has no "…".` |
| `lanes` (extras) | `(spec{lanes, spans?, events?, links?}, {scale, play?, ...}) => Lanes` | scale > 0; times valid | lane chart | layout errors from `layout/lanes.ts` |
| `Lanes.x/get` | `(t)`, `(id)` | | x of lane time / row box | `lanes() has no "…".` |
| `layered`, `tree`, `sequence`, `lanes` (layout/*) | pure layout functions on sizes | internal; imported by diagrams and `svjeez/*` builds | boxes and polylines | see Errors |
| `traceStreamlines`, `marchingSquares`, `simplify` (layout/field, contour) | see Entities | internal; used by `extras/field.ts` | polylines | none thrown |
| `groupBy` (layout/group) | `(items, key) => Map` | | Node 20-safe `Map.groupBy` | |

#### CLI / build commands (if any)
| Command | Effect |
|---|---|
| `bun test tests/layout.test.ts tests/diagrams.test.ts` (in `packages/svjeez/`) | runs this area's 157 tests |
| `bun run render-png <file> --sheet` | looks at a diagram's frames (AGENTS.md rule for visual changes) |

#### Errors
| Message (use … for filled-in values) | Thrown when | Code |
|---|---|---|
| `layered() node ids must be unique.` | duplicate node id | layout/layered.ts |
| `layered() has no node "…".` | edge or group member names an unknown node | layout/layered.ts (indexing) |
| `Group "…" has no members.` | empty group | layout/layered.ts |
| `Node "…" is in two groups.` | node listed in two groups | layout/layered.ts |
| `tree() node ids must be unique.` | duplicate id | layout/tree.ts |
| `tree() node "…" has an unknown parent "…".` | parent not a node | layout/tree.ts |
| `tree() needs exactly one root, got ….` | 0 or 2+ nodes without parent | layout/tree.ts |
| `tree() parents form a cycle.` | BFS misses nodes | layout/tree.ts |
| `sequence() needs actors with unique ids.` | empty or duplicate actors | layout/sequence.ts |
| `sequence() has no actor "…".` | row names unknown actor | layout/sequence.ts |
| `lanes() needs a positive scale, got ….` | scale not > 0 | layout/lanes.ts |
| `lanes() needs lanes with unique ids.` | empty or duplicate lanes | layout/lanes.ts |
| `lanes() has no lane "…".` | unknown lane | layout/lanes.ts |
| `lanes() times must be finite and non-negative, and each span must end after it starts.` | bad time or span | layout/lanes.ts |
| `No edge from "…" to "…".` | `Flowchart.edge` with no such edge | diagrams/flowchart.ts |
| `No path from "…" to "…".` | `Flowchart.route` unreachable | diagrams/flowchart.ts |
| `stateMachine() has two states named "…".` | repeated state id | diagrams/state.ts |
| `stateMachine() initial "…" is not one of its scope's states.` | initial outside scope | diagrams/state.ts |
| `stateMachine() has no state "…".` | transition names unknown state | diagrams/state.ts |
| `stateMachine() has no transition from "…" to "…".` | `StateMachine.edge` | diagrams/state.ts |
| `walk() needs at least one state, got none.` | empty walk path | diagrams/state.ts |
| `walk() has no way from "…" to "…".` | consecutive walk states not connected | diagrams/state.ts |
| `sequence() has no message ….` | `message(i)` out of range | diagrams/sequence.ts |
| `<diagram>() has no "…".` | `get(id)` unknown id (flowchart(), stateMachine(), sequence(), tree(), lanes()) | diagrams/kit.ts (lookup) |
| `<what> needs a non-negative start, got ….` / `<what> needs … times, got ….` / `<what> needs non-negative times in order, got ….` | bad `play.at` (what = `flowchart() play`, `sequence() play`, `tree() play`, `walk()`) | extras/timeline.ts |

### Extras

#### Public API
| Export (module) | Signature (short) | Legal when | Effect | Errors |
|---|---|---|---|---|
| `code` (extras/code) | `(input, CodeOptions) => Code` | tokens have no `\n\r\t`; monospaced font | lays out words | code() messages |
| `morph` | `(versions, {at, over?, gutter?}) => MorphResult` | one `at` per transition, non-overlapping | node + spans + end | morph() messages |
| `typewriter` | `(code, {at, cps?, cursor?, blink?}) => TypewriterResult` | `at >= 0`, `cps > 0` | line-by-line reveal | typewriter() |
| `reveal` | `(code, {at: Beats, blocks?, step?, over?, from?}) => RevealResult` | blocks in range, disjoint | block enters | reveal() |
| `terminal` | `(session, TerminalOptions) => TerminalResult` | >= 1 command | typed shell | terminal() |
| `appWindow` | `(frame, WindowOptions) => {node, body}` | always | window chrome | none |
| `Arrow`, `Callout`, `Brace`, `Underline` | `(props) => SvgNode` | `during: Span` | annotation inside span | none checked |
| `Marker` | `({stops, theme?, color?, over?})` | >= 1 stop, `over > 0` | gliding box | Marker() |
| `Focus` | `({stops, dim?, fade?, children})` | `0 <= dim <= 1` | masked dim | Focus() |
| `Camera`, `Steady` | `({frame, stops, over?, children})` | targets with positive size | pan/zoom, inverse zoom | Camera() |
| `timeline` | `(durations, TimelineOptions) => Timeline` | positive lengths, non-reserved names | named spans | timeline() |
| `during`, `cut`, `visible`, `shot` | span envelopes | `shot`: `at>=0, over>0` | opacity (and move) motions | shot() |
| `readingTime` | `(text, {wps,min,settle}) => Seconds` | always | seconds | none |
| `travel` | `(points, {at, speed?, over?, heading?}) => Motion` | path length > 0 | moving token | travel() |
| `flow` | `(points, FlowOptions) => FlowResult` | loop rules | moving token styles | flow() |
| `base16`, `tint`, `variables`, `adaptive`, ready-made themes | see rules | 16 colors; identifier names | schemes, CSS | base16(), variables() |
| `axes` | `(AxesOptions) => Axes` | see rule | axes + calculus | axes() |
| `readout` | `(text, ReadoutOptions) => SvgNode` | `at>=0, over>0, step>0` | timed text | readout() |
| `streamlines`, `fieldLines`, `fieldFlow`, `vectorField`, `slopeField`, `slopeSolution`, `contours`, `contourSweep` | see rules | positive numeric options | path data / nodes | per-call |

#### CLI / build commands
None owned. (`tests/skill.test.ts` renders the skill's examples, which include `examples/explainer.tsx` and `examples/terminal.tsx`.)

#### Errors
| Message (use … for filled-in values) | Thrown when | Code |
|---|---|---|
| `base16() needs 16 colors, got …` | wrong color count | theme.ts |
| `variables() needs CSS identifiers for names, got "…".` | bad variable name | theme.ts |
| `code() tokens must not contain line breaks or tabs.` | tokens with `\n\r\t` | code.ts |
| `code() needs a monospaced font, and … is proportional. …` | `font` not monospaced | code.ts |
| `code() needs finite coordinates and positive metrics, got x …, y …, fontSize …, lineHeight … and advance ….` | bad metrics | code.ts |
| `code.lines(…, …) is outside lines 1-….` | range out of bounds | code.ts |
| `code.at(…, …) is outside the code.` | position out | code.ts |
| `code.find() found … of "…", not ….` | nth match missing | code.ts |
| `code.get() found no run named "…".` | id unknown | code.ts |
| `morph() needs one start per transition and a positive duration, got … versions, … starts and over ….` | at/over wrong | morph.ts |
| `morph() transition … starts before transition … ends.` | overlapping transitions | morph.ts |
| `morph() draws a gutter only for code() versions.` | gutter with non-code | morph.ts |
| `typewriter() needs a non-negative start and a positive cps, got at … and cps ….` | bad args | typewriter.ts |
| `reveal() needs a non-negative step and a positive duration, got step … and over ….` | bad args | reveal.ts |
| `reveal() block …-… is outside lines 1-….` / `reveal() has line … in two blocks.` | bad block | reveal.ts |
| `terminal() needs at least one command, got none.` | empty session | terminal.ts |
| `Marker() needs at least one stop, got none.` / `Marker() needs a positive over, got ….` | bad args | marker.ts |
| `Focus() needs dim between 0 and 1, got ….` | bad dim | focus.ts |
| `Camera() needs a target with a positive width and height, got … by ….` | zero-size target (also raised for Steady) | camera.ts |
| `timeline() needs a non-negative start and gap, a positive fade and a positive pace, got …` | bad options | timeline.ts |
| `"…" is reserved in a timeline.` / `Scene … needs a positive length, got ….` / `No scene named ….` | bad names | timeline.ts |
| `shot() needs a non-negative start, a positive length and a positive move, got …` | bad shot | timeline.ts |
| `… needs a non-negative start, got ….` / `… needs N times, got ….` / `… needs non-negative times in order, got ….` | bad `Beats` | timeline.ts (`beats`) |
| `travel() needs a path of positive length and a positive speed or duration, got length … over …s.` | degenerate path | timeline.ts |
| `flow() loops a dot, comet or packet. Drop loop, or leave out the ….` | loop with trace/arrive | flow.ts |
| `flow() needs a loop period past …s to hold the trip and the comet's tail, got …s.` | loop too short | flow.ts |
| `axes() needs a finite … range with max above min, got […, …].` | bad range | axes.ts |
| `axes() needs a positive width and height, got … and ….` / `axes() needs a positive fontSize, got ….` | bad size | axes.ts |
| `axes() needs a positive … tick step, got ….` / `axes() would draw … … ticks. Raise the step … to draw at most 500.` | bad ticks | axes.ts |
| `plot() needs a whole number of samples, at least 2, got ….` / `plot() needs from below to, got from … and to ….` / `plot() found no finite values inside the y range between … and ….` | plot args | axes.ts |
| `… needs a finite value, got ….` / `… needs at least one sweep.` / `… needs finite from and to, a non-negative at and a positive over, got ….` / `… has a sweep at …s that starts before the one before it ends.` | bad `Moving` | calculus.ts |
| `… found no finite value of f at x=….` / `tangent() found no finite slope at x=….` / `secant() found no finite slope at x=…, h=….` | non-finite f | calculus.ts |
| `… needs a positive length, got ….` | line length | calculus.ts |
| `riemann() needs whole rectangle counts of at least 1, got […].` / `riemann() needs from below to, …` | bad riemann | calculus.ts |
| `… has N stages, so it needs N-1 start times in at, got ….` | stage/at mismatch | calculus.ts |
| `graph.morph() needs at least two functions, got ….` / `graph.morph() needs one color per function, got … for ….` | morph args | calculus.ts |
| `parametric() needs a range with its end above its start, got […, …].` / `… found no finite points inside the y range.` | curve args | calculus.ts |
| `readout() needs a non-negative at and a positive over, got at … and over ….` / `readout() needs a positive step, got ….` | bad args | calculus.ts |
| `… needs a positive …, got ….` (streamlines, vectorField, slopeField, slopeSolution, fieldLines, fieldFlow, contourSweep) | non-positive number | field.ts |
| `… needs bounds with a positive w and h, got … by ….` | bad bounds | field.ts |
| `… needs bounds or axes to place the samples.` / `… needs a grid of at least 2 by 2 with cols * rows values, got … by … with ….` | contour source | field.ts |
| `contourSweep() needs a whole number of frames, at least 2, got ….` / `contourSweep() found no line at level ….` | sweep args | field.ts |

### Frames, CLI, plugins and release

#### Public API
| Export (module) | Signature (short) | Legal when | Effect | Errors |
|---|---|---|---|---|
| renderFrames (svjeez/frames) | `(svg, FrameOptions) => Promise<Frames>` | Valid size, scale, scheme, times xor count, sheet columns; Chromium present | PNG per time, optional sheet; browser closed | "renderFrames() needs …" (see Errors) |
| openScene (svjeez/frames) | `(svg, SceneOptions, caller?) => Promise<Scene>` | as above | Paused scene in a secure page | "<caller> needs …" |
| seek (svjeez/page) | `(time, root?) => void` | Runs in a page | Pauses and sets every CSS/SMIL animation | none |
| loopLength (svjeez/page) | `(root?) => Seconds` | Runs in a page | One loop in seconds, 0 if nothing animates | none |
| renderVideo (@svjeez/video) | `(svg, VideoOptions?) => Promise<Video>` | Animated scene; format/codec legal | MP4/WebM bytes | "renderVideo() needs …" |
| svjeez() (@svjeez/vite default) | `(Options?) => Plugin` | Vite >= 8 | `?svjeez` loader, dev middleware, asset emit | none |
| writeScenes, ROUTE (@svjeez/vite) | `(dir: URL) => Promise<number>`, `"/_svjeez/"` | After pages rendered | Writes handed-out files | fs errors |
| getScene (@svjeez/vite/scene, @svjeez/astro/scene) | `(scene, {posters?}) => SceneImage` | A string or `() => string` with a `viewBox` | Registers files, returns URL and size | TypeError if no viewBox (see Known bugs in CRITERIA.md) |
| integration (@svjeez/astro default) | `() => AstroIntegration` | Astro 7, Node 22 | Wires the Vite plugin and build-done write | none |
| `<Scene scene alt>` (@svjeez/astro/Scene.astro) | Astro component | | `<img>` for the scene | as getScene |

#### CLI / build commands
| Command | Effect |
|---|---|
| `svjeez svg <file> [--out f]` | Compile to an SVG on stdout or a file; warnings to stderr. |
| `svjeez frames <file> [--times … \| --count n] [--out dir] [--sheet] [--columns n] [--scale n] [--color-scheme s] [--background css]` | PNGs (and `sheet.png`) in a directory. |
| `svjeez video <file> [--out f] [--format mp4\|webm] [--fps n] [--loops n] [--quality q] [--scale n] [--color-scheme s] [--background css]` | Encodes through `@svjeez/video`. |
| `svjeez skill [--install [--dir d]]` | Prints or installs the agent skill. |
| `bun run dev <file.tsx>` (svjeez) | Live preview with scrubber. |
| `bun run render-png` (svjeez) | Alias of `src/cli.ts frames`. |
| `bun run test:node` (svjeez) | Skill examples on the current Node via tsx. |
| `bun run test:package` (svjeez) | Packed-tarball consumer checks. |
| `bun run build:package` (each publishable package) | Writes `package-dist/` with the npm manifest. |
| `bun run test:package` (plugin packages) | Install tarballs into `test/consumer` and run its `check`. |
| `bun scripts/release.ts plan \| publish \| claim <dir>` | Release steps. |

#### Errors
| Message (… = filled in) | Thrown when | Code |
|---|---|---|
| `<caller> needs playwright-core. Install it with …` | `playwright-core` cannot be imported | frames.ts `launch` |
| `No Chromium to render with. Run … or pass executablePath.` | Playwright's Chromium and Chrome both fail to launch | frames.ts `launch` |
| `<caller> needs an <svg> root with numeric width and height, got … by ….` | Root tag lacks numeric width/height | frames.ts `size` |
| `<caller> needs a positive, finite scale, got ….` | Bad scale | frames.ts `resolve` |
| `<caller> needs a colorScheme of system, light or dark, got ….` | Bad scheme | frames.ts `resolve` |
| `renderFrames() needs finite, non-negative times, got ….` | A bad time | frames.ts `renderFrames` |
| `renderFrames() needs a positive whole count, got ….` | Bad count | frames.ts `renderFrames` |
| `renderFrames() needs a positive whole number of sheet columns, got ….` | Bad columns | frames.ts `renderFrames` |
| `renderVideo() needs a format of mp4 or webm, got ….` | Bad format | video index.ts |
| `renderVideo() needs a <format> codec of …, got ….` | Codec not in the format | video index.ts |
| `renderVideo() needs a positive, finite fps, got ….` | Bad fps | video index.ts |
| `renderVideo() needs a positive whole number of loops, got ….` | Bad loops | video index.ts |
| `renderVideo() needs a quality of low, medium or high, got ….` | Bad quality | video index.ts |
| `renderVideo() can't keep a transparent background in …. Use format: "webm", or pass a background color.` | Transparent mp4 | video index.ts |
| `renderVideo() needs an animated scene, got one whose loop lasts 0s. Use renderFrames() for a still.` | duration 0 | video index.ts |
| `renderVideo() needs a Chromium that can encode … at … by …, and this one can't. …` | `canEncodeVideo` false | video index.ts |
| `--color-scheme is system, light or dark, got "…".` | CLI bad scheme | cli.ts `parseScheme` |
| `--… needs a number, got "…".` | CLI non-numeric flag | cli.ts `number` |
| `Pass --times or --count, not both.` | Both flags | cli.ts `when` |
| `--times has an empty entry: "…".` | `--times 1,,2` | cli.ts `when` |
| `--count needs a positive whole number, got ….` | Bad count | cli.ts `when` |
| `--format … doesn't match --out ….` | Extension and format disagree | cli.ts `videoCommand` |
| `svjeez video needs @svjeez/video. Install it with …` | Package not resolvable | cli.ts `loadVideo` |
| `Node cannot load …. Install tsx, run …, or compile it to .js first.` | A `.tsx` import on Node without tsx | cli.ts `loadSvg` |
| `… must export default an SVG string, or a function that returns one.` | Module default is not a string or function | cli.ts `loadSvg` |
| usage text | Missing/unknown command or missing file | cli.ts `fail(USAGE)` |
| `Run \`bun run test\` at the root, …` | `bun test` at repo root | root-test-guard.ts |
| `<name> isn't on npm yet. Run … claim …` (warning) | Release finds an unpublished package | release.ts `pending` |

### Live editor

#### Commands (messages to the store)

Every message is applied by the pure `update(state, msg) -> [state, Cmd[]]`. An illegal or no-change message returns `[state, []]` with the same state identity, and `createEditor` then notifies nobody. There is no `{ok:false}` result: `send` returns void; the outcome is read from `getState()`. Page code sends `Input` (a `Msg` without the runtime-only messages and without `now`, which `send` stamps from `Effects.now`).

| Command (`Msg.type`) | Args | Legal when | Effect | Side effects (Cmd) |
|---|---|---|---|---|
| set | key, value (typed by the key's kind: number, Hex, Ease, string), continues? | `key` names a current `Value`; otherwise no-op. Kind of `value` is a type obligation only. | Rewrites that literal's range via `write` (precision rule, R-255). No-op if the text is unchanged. Adds a history entry unless `continues`; clears redo. | compile(text'). |
| replace | text | Always. No-op if identical. | New file; history step; selection kept iff its key survives. | compile(text'). |
| undo | none | `history.past` non-empty. | Previous snapshot becomes `text`; current pushed on `future`. | compile(text). |
| redo | none | `history.future` non-empty. | Next snapshot becomes `text`. | compile(text). |
| select | key \| null, now | Always. No-op if equal to `selected`. | Sets `selected`; drops measured (non-declared) grips. Not validated against `values` (see Known bugs in CRITERIA.md). | probe(...) iff the key is a number value with no declared grip and `picture.text == text`. |
| play | now | Clock paused. | Clock becomes playing with origin so the held time continues. | show(compiled) if there is a compiled file. |
| pause | now | Clock playing. | Clock holds `timeAt(now)`. | show(compiled). |
| seek | at (s), now | Always; `at` not clamped. | Same play state at `at`. | show(compiled). |
| compiled *(runtime only)* | text, result, now | Sent by the runtime on a compile result. | ok: stores `compiled`, clears `error`, adopts `params` iff `text == state.text`, replaces declared grips. fail: sets `error` only. | ok: show(...). |
| shown *(runtime only)* | picture, now | Sent by the runtime when an image is ready. | `picture = msg.picture`. | probe iff `picture.text == state.text` and a number is selected. |
| probed *(runtime only)* | key, text, grip \| null | Sent by the runtime on a measurement. | Applied iff `key == selected` and the measurement still fits (`measures`). Null grip removes the measured grip. | none. |

| Runtime-issued command (`Cmd`) | Fields | Performed by | Notes |
|---|---|---|---|
| compile | text | `Effects.compile`, serialized by `latestWins` | Result returns as `compiled`. A throw becomes `{ok:false, error:{kind:"runtime"}}`. |
| show | svg, at, playing, picture | `Effects.show` | Result URL returns as `shown`. Default restyles the svg to `{at, paused: !playing}`, makes a blob URL, awaits `img.decode()` so the swap never shows a blank frame. |
| probe | key, text, svg, nudged, from, by, at | `Effects.compile(nudged)` then `Effects.measure` | Result returns as `probed`. |

#### Events and notifications

The store has one notification channel. There is no event log and no event type; clients learn of changes by diffing state.

| Notification | Fields | Who learns | When |
|---|---|---|---|
| listener(state) | the whole `State` | every subscriber, synchronously | after any `dispatch` that produced a new state object (`next !== state`). A no-op message produces none. `play`/`pause`/`seek` always produce a new state (new clock object) and notify. |
| compile error | `state.error` | readers of state | set by `compiled` failure; cleared by a later success. |
| console.error(error) | thrown error | developer console | a job given to `latestWins` throws. |
| Compiler failure texts | `"The compiler failed to start…"`, `"The compiler sent back something the page could not read."`, `"The compiler was stopped."`, timeout message | as `state.error` | worker errors, stop, timeout. |

#### Read-only queries

| Export | Signature | Notes |
|---|---|---|
| getState (Editor) | `() => State` | No subscription, no compile start. Safe on a server. |
| valueOf (live) | `(state, key) => Value \| undefined` | |
| timeAt (live) | `(clock, nowMs) => seconds` | Components poll it per frame. |
| handleAt (live) | `(grip, v) => Point` | Where a handle sits at value `v`. |
| paramFor, valuesOf, curveOf, bezierOf, rgbOf (live) | see controls.ts | Previews of controls are the same functions the store uses. |
| measureMove (live) | `(before, after, by, at) => Promise<Move?>` | |
| `@svjeez/live/source` | `parse, linesOf, write, apply, set, literalAt, paramLiteral, madeBy, callsIn, easeText, decimalsOf` | Exported as a subpath; not re-exported from the index. |
| `@svjeez/live/compile` | `compileScene(source, {sources}), compileBuild(build)` | Also runs under Bun/Node. |
| `@svjeez/live/client` | `createCompiler({sources, timeout}), compilerFor, sceneWorker, latestWins` | |
| `@svjeez/live/gzip` | `gzipSize(text)` | |

#### Public API

| Export (module) | Signature (short) | Legal when | Effect | Errors |
|---|---|---|---|---|
| createEditor (live) | `({text, first?}, effects?) => Editor` | any | Builds state via `init`; queues compile; starts nothing until a subscriber. | none |
| Editor.subscribe | `(listener) => unsubscribe` | not destroyed to take effect | First subscriber releases queued commands; last unsubscribe pauses (stops compiler, holds commands). | none |
| Editor.send | `(Input) => void` | not destroyed to take effect | See Commands. | `write` can throw on a non-bezier, non-named ease (see Known bugs in CRITERIA.md). |
| Editor.destroy | `() => void` | any | Terminal. Frees URLs and stops compiler. | none |
| init / update | pure | any | Elm functions. | |
| stroke, scrubbing, following, bending, arrowNumber, arrowEase, selection (live) | gesture builders over an `Editor` | a value of the right kind | Send `set`/`select`. | |
| scrub, nudge, bend, BEND_Y, bezierOf, curveOf, rgbOf, withRgb (live) | control math | | pure | |
| useEditor (react) | `(text, {first?, effects?}) => Editor` | in a component | Creates the editor once; later args ignored; never destroys on unmount (it pauses). | |
| useEditorState (react) | `(editor, select?) => State \| T` | in a component | `useSyncExternalStore` over `subscribe`. `select` must return a primitive or a part of state. | infinite re-render if `select` returns a fresh object |
| Code, Picture, Transport, Control (react) | `({editor, ...})` | | Render the contract markup. `Code` props: `file?`, `control?(value, plain)`. | |
| editor, SceneEditor (svelte) | `(text, {first?, effects?}) => SceneEditor` | | Class implementing `Editor` plus reactive `state` getter. Caller runs `onDestroy(scene.destroy)`. | |
| Code, Control, Picture, Transport (svelte) | props `{editor, file?, control? snippet}` | | Same markup. | |

#### Client contract (what components may reach into)

- A component may call only `getState()`, `subscribe()`, `send(Input)`, `destroy()` on the `Editor`, plus the pure exports of `@svjeez/live` (`valueOf`, `timeAt`, `handleAt`, control math, gestures).
- A component never mutates `State`, never calls `update` on a private copy and never sends `compiled`, `shown` or `probed` (excluded from `Input` by type).
- All edits go through messages: a drag, a keystroke, an agent and a custom control send the same `set`. A custom control uses `stroke`/`scrubbing`/`following`/`bending` or sends `continues: true` on each step after the first.
- Controls wire DOM events to gestures and carry `data-sj-key` (the value key) so `selection` can tell focus moving inside one value from focus leaving it.
- `state.picture.url` is owned by the editor; a component only reads it into an `<img>` and never revokes it.
- `useEditorState` selectors must return stable values.
- Styling is by class and data attribute only, under `@svjeez/live/editor.css`; themed with `--sj-*` custom properties.
- A host that cannot run workers passes `effects.compile` (and `show`/`measure`); a swapped compile may expose `.stop()` to be told when the editor goes idle, and must restart on a compile after a stop.

#### Worker protocol

| Message | Shape | Notes |
|---|---|---|
| page -> worker | `{id, source, sources?}` | |
| worker -> page | `{id, ...Compiled}` | One answer per id; ids per client. |

#### CLI / build commands (if any)
| Command | Effect |
|---|---|
| `bun run generate` (packages/live) | Writes `src/skill-errors.ts` from the skill. |
| `bun run test` (live, react, svelte) | `bun test --conditions @svjeez/source`. React and Svelte tests start Vite on `test/app/`, launch headless Chromium through playwright-core. |
| `bun run typecheck` (live, react: `tsc --noEmit`; svelte: `svelte-check`) | |
| `bun run build:package`, `bun run test:package` | Root `scripts/package-plugin.ts` (live, react), `package-svelte.ts` (svelte); consumer check in `test/consumer/`. |

#### Errors
| Message (use … for filled-in values) | Thrown when | Code |
|---|---|---|
| `Only a bezier ease is written as ease.bezier(…), got ease ….` | `write` on an ease that is neither a named ease nor a bezier | packages/live/src/source.ts (`easeText`) |
| `Cannot import "…". Scenes here can import "…", ….` | a scene requires a module outside the allow-list | packages/live/src/compile.ts (`requireModule`) |
| `The scene needs a default export: export default function build(): string { return render(...) }` | no default function export | compile.ts (`run`) |
| `build() should return the string from render().` | default export returned a non-string | compile.ts (`run`) |
| `The scene ran for over …s without finishing, so it was stopped.` | job exceeds `timeout` | client.ts (`createCompiler`) |
| `The compiler was stopped.` | compile after/during `stop` | client.ts (`STOPPED`) |
| `The compiler failed to start…` / `The compiler sent back something the page could not read.` | worker onerror / onmessageerror | client.ts (`compilerFor`) |
| Syntax errors `<message>` with line, column | sucrase fails to parse | compile.ts (`parseSyntax`) |
| svjeez runtime errors | scene throws; message kept verbatim with `fix` from the skill table | compile.ts (`outcome`), fixes.ts |

### Charts, code, fonts, icons and Mermaid

#### Public API
| Export (module) | Signature (short) | Legal when | Effect | Errors |
|---|---|---|---|---|
| chart (@svjeez/charts) | `chart(ChartOptions) => Chart<kind>` | valid sizes/domains/data per R-294 | Fits scales, builds axes node, returns series builders | chart() messages below |
| Chart.bars | `(Record<string,number>, BarsOptions) => Bars` | band scale | Grows bars up/down from baseline | bars() messages |
| Chart.line / area | `(Datum[], opts) => Line / Area` | >= 2 points inside domain | Draw-on stroke (+ wipe fill) | line()/area() messages |
| highlight (@svjeez/code) | `(source, lang, HighlightOptions?) => Highlighted` | lang known or grammar passed | Role-tagged runs per line | unknown language, bad tabSize |
| google (@svjeez/fonts) | `(family, GoogleOptions?) => Promise<Font>` | cache hit, or network | Loads/caches a TTF, returns svjeez Font | Google / network errors |
| google.family | `(family, faces[], opts?) => Promise<FontFamily>` | >= 1 face | Loads faces in parallel, groups | as google |
| cacheDir (@svjeez/fonts) | `() => string` | always | Resolves cache folder | none |
| icon exports (@svjeez/icons/tabler, /lucide) | `const name: Icon` | n/a | Path data for `<Icon>` | none |
| Icon (@svjeez/icons) | type | n/a | Shape of icon data | none |
| parse (@svjeez/mermaid) | `(text) => MermaidDoc` | supported Mermaid text | Plain model, no svjeez | MermaidSyntaxError, empty-text Error |
| mermaid (@svjeez/mermaid) | `(text, MermaidOptions?) => MermaidDiagram` | parse ok, direction TB/LR | svjeez diagram + kind + doc | parse errors, BT/RL |
| FORM_ROLES (@svjeez/mermaid) | `Record<FlowForm, NodeRole>` | n/a | Form to svjeez role table | none |
| MermaidSyntaxError | class | n/a | Carries line, source | n/a |

#### CLI / build commands (if any)
| Command | Effect |
|---|---|
| `bun run generate` (packages/icons) | Rewrites `src/tabler.ts` and `src/lucide.ts` from pinned `@tabler/icons` and `lucide-static`; prints counts and the mixed-icon count |
| `bun run build:package` / `test:package` (each package) | Writes `package-dist/`; installs the packed tarball on plain Node and checks it (root `scripts/`) |
| `bun run test` (each package) | Package tests |

#### Errors
| Message (use … for filled-in values) | Thrown when | Code |
|---|---|---|
| `chart() needs a positive width and height, got … and ….` | width/height not positive finite | chart.ts |
| `chart() needs a positive fontSize, got ….` | fontSize <= 0 | chart.ts |
| `chart() needs finite data, got […, …] at index ….` | non-finite datum | chart.ts |
| `chart() needs y.domain or data to fit the y scale, got neither.` (x variant likewise) | no domain, no data | chart.ts |
| `chart() needs a finite … domain with max at or above min, got […, …].` | bad explicit domain | chart.ts |
| `chart() needs a whole number of … ticks, at least 1, got ….` | bad tick count | chart.ts |
| `chart() needs at least one x.domain category, got none.` / `chart() needs distinct x.domain categories, got "…" twice.` / `chart() needs x.padding from 0 up to 1, got ….` | bad band domain/padding | chart.ts |
| `x() got "…", which is not in the x domain (…). Add it to x.domain.` | `x()` on unknown category | chart.ts |
| `bars() got "…", which is not in the x domain (…). Add it to x.domain.` (also line()/area() with `at index …`) | unknown category | series.ts |
| `bars() got … for "…", outside the y domain […]. Pass the data to chart({ data }) or widen y.domain.` / `line() got […, …] at index …, outside the chart (…)` | value outside niced domain | series.ts |
| `bars() needs a band x scale, got a linear one. Use line() or area() here.` | bars on linear | series.ts |
| `bars() needs at least one value, got none.` / `needs finite values` / `needs a stagger of 0 or more` / `needs group.index below group.count, got … of ….` | bad bars input | series.ts |
| `… needs an at of 0 or later, got ….` / `… needs a positive over, got ….` | bad timing | series.ts |
| `line() needs at least 2 points, got ….` / `… needs finite values, got […, …] at index ….` | bad points | series.ts |
| `… needs curve "linear", "monotone" or "step", got "…".` | bad curve | series.ts |
| `area() needs a finite baseline, got ….` | bad baseline | series.ts |
| `highlight() does not know the language "…". It knows: …. Pass another grammar in options.grammars, such as import toml from "shiki/langs/toml.mjs".` | unknown lang | code/index.ts |
| `highlight() needs tabSize to be a whole number of at least 1, got ….` | bad tabSize | code/index.ts |
| `Google Fonts has no "…" at weight … (…): HTTP …, ….` | Google answered non-ok for CSS | fonts/index.ts |
| `Google Fonts answered for … with no font file URL.` / `Google Fonts could not serve the file for …: HTTP ….` | bad CSS body / file fetch | fonts/index.ts |
| `Could not load "…" … … from Google Fonts, and … is not cached. Run once with a network connection.` | network failure, cold cache | fonts/index.ts |
| `Mermaid syntax error on line … ("…"): …` | any unreadable/unsupported line | mermaid/errors.ts |
| `parse() got no Mermaid text. Start with a header such as \`flowchart TD\`. Supported diagram types: …` | empty input | mermaid/parse.ts |
| `mermaid() cannot draw direction …: svjeez lays flowcharts out TB or LR. Write TD or LR, or pass { direction }.` | BT/RL flowchart with no override | mermaid/index.ts |
| generator: `<pkg> <dir>/<file>: <problem>` aggregated as `N icons failed:` | unknown element/attr, bad viewBox/paint, duplicate name | icons/scripts/generate.ts |

### Maps and math

#### Public API
| Export (module) | Signature (short) | Legal when | Effect | Errors |
|---|---|---|---|---|
| `project` (geo) | `(data, {frame, projection?, fit?, object?, filter?, tolerance?}) => GeoMap` | Valid GeoJSON/TopoJSON | Fits projection (mutates it), builds regions | no TopoJSON object |
| `GeoMap.region/path/graticule/point/dots/route/line/bounds` | see rules | | | no region, outside projection, crosses edge, <2 places, empty bounds |
| `distance` (geo) | `(LonLat[]) => km` | | great-circle km | none |
| `sun`, `night` (geo) | `(Date) => LonLat \| Polygon` | | | none |
| `sequential`, `diverging`, `palettes`, `legend` (geo) | | hex colors only | ColorScale / SvgNode | domain, steps, hex errors |
| `choropleth` (geo) | `(map, values, {scale, at?, over?, ease?, lines?, lineWidth?, class?}) => {node, unmatched, groups}` | | animated fills | time and length errors |
| `cartogram`, `toBars` (geo) | `(map, values, options) => Cartogram \| Bars` | positive single numbers | morph shapes + `rest` | values errors |
| `traffic`, `arc` (geo) | | | flow tokens / points | rate, span, routes, weights, coincident ends |
| `globe` (geo) | `(data, {frame, spin, tilt?, duration?, ...}) => Globe` | | turning paths | duration, pivot, borders |
| `reproject`, `trueSize`, `nightfall` (geo) | | >= 2 projections / polygon region | `d` morph data / Turning | far outside, polygons |
| `tex` (math) | `(source, TexOptions?) => Tex` | valid TeX in MathJax font | glyph paths | parse, glyph, element, box, options |
| `Tex.get/find/write/draw` (math) | | | | no part, find count, write span |
| `epicycles`, `fourier` (math) | | closed outline | | start/duration, terms, samples, arcs, points |
| `derive`, `counter` (math) | | | | see rules |
| `construct` (math) | `(ConstructOptions?) => Construction` | | builder | see rules |
| `plane` (math) | `(PlaneOptions) => Plane` | | immutable plane | see rules |

#### CLI / build commands
| Command | Effect |
|---|---|
| `bun test --conditions @svjeez/source` (each package) | Runs the owned tests against `svjeez` source. |
| `bun run typecheck` | `tsc --noEmit`. |
| `bun run build:package` | `scripts/package-plugin.ts`: writes `package-dist/` with the published package.json, README, LICENSE. |
| `bun run test:package` | `scripts/package-plugin-check.ts`: packs, installs into `test/consumer/`, type-checks and loads on plain Node. |

#### Errors
| Message (use ... for filled-in values) | Thrown when | Code |
|---|---|---|
| `project() found no TopoJSON object named .... The topology has ....` | named/first object missing | geo/src/index.ts |
| `project() has no region .... Regions are found by id or properties.name, as in ....` | `region(key)` finds none | geo/src/index.ts |
| `point([...]) falls outside the projection, on the far side of the globe or past its clip.` | clipped place | geo/src/index.ts |
| `route() from [...] to [...] crosses the edge of the map. Rotate the projection ... or use line() ....` | route not one piece | geo/src/index.ts |
| `line() needs at least two places.` | <2 points | geo/src/index.ts |
| `bounds() needs at least one region or place.` | empty list | geo/src/index.ts |
| `A color scale needs hex colors such as "#1f77b4", got ....` | non-hex stop | geo/src/scale.ts |
| `... needs at least two colors, got ....` / `... needs a whole number of steps of at least 2, got ....` | ramp / steps | geo/src/scale.ts |
| `sequential() needs a domain that rises, got [...].` / `diverging() needs a domain of [low, middle, high] that rises, got [...].` | bad domain | geo/src/scale.ts |
| `choropleth() has ... values per region but ... times in at. Pass one time per value.` | length mismatch | geo/src/choropleth.ts |
| `choropleth() needs times that rise from 0 or later, got ....` | non-rising `at` | geo/src/choropleth.ts |
| `choropleth() needs every region to have the same number of values, got lists of ....` | ragged lists | geo/src/choropleth.ts |
| `... takes one number per region, but ... has a list. ...` | list in cartogram/toBars | geo/src/morph.ts |
| `... needs positive values, got ... for ....` | value not > 0 | geo/src/morph.ts |
| `... found no region to draw. Check the keys of values ....` | no region matched | geo/src/morph.ts |
| `traffic() needs a positive rate, got ....` / `... a span with a positive length ...` / `... at least one route.` / `... weights that are not negative and not all zero ...` | bad options | geo/src/traffic.ts |
| `arc() needs two different places.` | coincident ends | geo/src/traffic.ts |
| `globe() with a spin function needs a duration, as in { duration: 24 }.` | no duration | geo/src/globe.ts |
| `globe() needs a positive duration, got ....` | duration <= 0 | geo/src/globe.ts |
| `globe() found no TopoJSON object named ....` | object missing | geo/src/globe.ts |
| `globe() found no parallel behind the globe clear of every outline ....` | no pivot | geo/src/globe.ts |
| `globe() found no lines or rings to draw.` | empty prepare | geo/src/globe.ts |
| `globe().borders() needs TopoJSON, ....` | non-Topology | geo/src/globe.ts |
| `reproject() needs at least two projections.` | <2 projections | geo/src/reproject.ts |
| `reproject() found no TopoJSON object named ....` | object missing | geo/src/reproject.ts |
| `reproject() puts ... far outside the frame under projection .... Filter it out: ....` | stretched point | geo/src/reproject.ts |
| `reproject() has no region ....` | `region(key)` | geo/src/reproject.ts |
| `trueSize() needs a region with polygons.` | non-polygon | geo/src/reproject.ts |
| `tex() needs finite coordinates and anchor and a positive fontSize, got ....` | options | math/src/index.ts |
| `tex.get() found no part named "...".` / `tex.find() found ... of "...", not ....` | lookups | math/src/index.ts |
| `tex.write() needs a non-negative span and a positive stroke time, got ....` | write options | math/src/index.ts |
| `tex() could not parse "...": ...` | MathJax error | math/src/mathjax.ts |
| `tex() cannot draw "..." in "...": the MathJax font has no glyph for it.` | `<text>` fallback | math/src/mathjax.ts |
| `tex() cannot draw a <...> element in "...". ...` | unsupported element | math/src/mathjax.ts |
| `tex() could not read the box MathJax drew for .... A \tag draws a full-width table ...` | no viewBox | math/src/mathjax.ts |
| `tex() got no drawing back from MathJax for ....` | no `<svg>` | math/src/mathjax.ts |
| `tex() met a transform it cannot read: ...` / `tex() met a ...() transform it cannot place: ...` / `tex() met a "..." path command, and only absolute commands are drawn.` | unsupported SVG | math/src/matrix.ts, path.ts |
| `plane() needs a finite origin and a positive unit and step, got ....` | options | math/src/plane.ts |
| `A plane step needs a non-negative start and a positive length, got ....` / `A plane step starts at ...s, before the previous step ends at ...s.` | steps | math/src/plane.ts |
| `plane.apply() needs finite numbers in its matrix, got ....` / `plane.applyFunction() sent (...) to (...), which is not a finite point.` | matrix / function | math/src/plane.ts |
| `plane.vector() needs a finite arrow of nonzero length, ....` / `plane.span() needs a nonzero direction, got ....` | | math/src/plane.ts |
| `construct() needs a positive unit and fontSize and a finite origin, got ....` | options | math/src/construct.ts |
| `An element needs a finite start of 0 or more and a duration of 0 or more, got ....` | timing | math/src/construct.ts |
| `intersect() found no crossing of ... and ... . ...` / `intersect() crossing (...) lies past the end of segment ... .` / `intersect() pick is 0 or 1, got ....` | intersect | math/src/construct.ts |
| `circle() needs a positive radius, got ....` / `point() needs finite coordinates, got ....` / `A line needs two different points, got ... twice.` | elements | math/src/construct.ts |
| `perpendicularBisector() needs two different points, ...` / `angleBisector() needs the vertex in the middle ...` / `angle() needs the vertex in the middle ...` | composites | math/src/construct.ts |
| `angle() needs a positive radius and a count of 1 or more, ....` / `tick() needs a count of 1 or more, got ....` / `polygon() needs at least three points, got ....` / `together() cannot nest. ...` | | math/src/construct.ts |
| `fourier() needs an even number of samples, 4 or more, got ....` / `fourier() keeps 1 to ... terms, got ....` | fourier options | math/src/epicycles.ts |
| `... needs an outline with at least three points.` / `... needs an outline with some length.` | degenerate outline | math/src/epicycles.ts |
| `epicycles() needs a finite start and a positive duration, got ....` / `epicycles() needs 1 to ... terms, ....` / `epicycles() cannot read a "..." path command. ....` | | math/src/epicycles.ts |
| `derive() needs a step, a positive over that fits in every, ....` / `derive() found no "=" in step ..., ....` | | math/src/derive.ts |
| `counter() needs a whole number of digits, ....` / `counter() of a function needs a positive duration and step, ....` / `counter() needs at least one value, ....` / `counter() changes faster than its roll of ... seconds.` | | math/src/counter.ts |

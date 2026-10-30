# Criteria

How we know svjeez is right. Each row has a stable ID. Rules are in [ONTOLOGY.md](ONTOLOGY.md) and cite the rows they own.

The Instrument column is the row's status, and takes one of four forms:

- `automated`: tests exist and run in `bun run test`.
- `manual — <what a human checks>`.
- `not yet covered`: a known gap.
- `retired`: a tombstone, so the ID is never reused.

Each `automated` R-row owns a directory `test/R-n/` in the package that owns the code, such as `packages/svjeez/test/R-12/`. The directory is the link: the files inside are named for what they check, and each test asserts exactly one rule. Tests that check no rule live in `test/unit/` and `test/integration/`, and shared setup lives in `test/helpers/`. `packages/svjeez/test/unit/criteria.test.ts` fails when an automated row has no directory with a test in it, when a directory has no automated row, or when an Instrument cell takes another form.

## R — Rules

| ID | Given | Expect | Instrument |
|---|---|---|---|
| R-1 | `at(-1)`, `wait(NaN)`, `to({x:1}, Infinity)`, `loop(-2)` | each throws the "finite, non-negative" message | not yet covered |
| R-2 | `to({x:1}, 0)`; `set({x:1})` | to throws "positive duration ... Use set() for a cut."; set adds a zero-length hold step | automated |
| R-3 | `to({}, 1)`, `to({ nope: 1 }, 1)`, `to({ x: NaN }, 1)`, an undeclared `--a:number` key | each throws its message | automated |
| R-4 | a chain `at(1).to(..,.5).wait(2)` | cursor 1 -> 1.5 -> 3.5; receiver motion unchanged | not yet covered |
| R-5 | two `to` steps on x and y that overlap in time | throws "Two transitions move `translate` ..."; x and opacity overlap is fine | automated |
| R-6 | `loop(1)` on a motion ending at 2; a step ending past an existing period | both throw | not yet covered |
| R-7 | `.label("1bad")` | throws; `.label("spin-1")` accepted | not yet covered |
| R-8 | `<rect animation={motion({ stopColor: ... })}>` | type error | automated |
| R-9 | `ease.steps(0)`, `steps(1.5)` | throw; presets keep their points; ease is clonable | automated |
| R-10 | linear/bezier/pop/steps/hold at sample progress values | linear clamps; bezier ends 0 and 1 and matches CSS `ease` 0.8024 at 0.5; pop > 1.05; steps jump at slice ends; hold jumps at 1 | automated |
| R-11 | cut at 0, cut mid, cut at the end, contiguous transitions | key list as in Structure; end cut lands on `period` | automated |
| R-12 | `snapPeriod(0.9, 3)` | 1 | automated |
| R-13 | two keys with a numeric transition; with a color; with `d` | numbers ease; color holds the earlier value; `d` blends | automated |
| R-14 | `enter`/`exit`/`draw` with at < 0 or over <= 0 | throws with the function name; enter reaches rest identity | not yet covered |
| R-15 | `shake({at,over},{x:6})` | alternating swings decaying to 0 at the end, deterministic | not yet covered |
| R-16 | `wiggle({x:10},{seed:5})` twice; seed 5 vs "5" | identical output; values within amplitude of rest and the channel range; loops seamlessly | automated |
| R-17 | `random(7)` twice, `random("leg-3")`, `random(0.5)`, `random(1)()` | same stream per seed, values in [0,1), integer not hashed (0.6270739405881613), fractional throws | automated |
| R-18 | `sampled(fn, {duration: 0})`, `step: 0`, `precision: -1` | throws the matching message | automated |
| R-19 | a sample that adds, drops or NaNs a key partway | throws "different channels at t=..." | automated |
| R-20 | `sampled(() => ({opacity:1}), {duration:1, tolerance:{}})` | throws; type error | automated |
| R-21 | a circle sampled at 1px tolerance; a flat opacity lane | replay within tolerance of every sample, far fewer keys; flat lane keeps `0%,100%` | automated |
| R-22 | an angle reset 360 -> 0; a steep smooth ramp | reset is a cut (held, then next key within <0.001s); steep ramp keeps its tween | automated |
| R-23 | `precision: 1` | every emitted value has at most one decimal | automated |
| R-24 | `sample(slide, t, {duration})` mid-transition, past duration with/without `loop:false`, negative t, snapped loop | eased blend; wraps; holds last frame; matches the browser in Chromium | automated |
| R-25 | a stack of motions on x, opacity, rotate, scale | x,y,rotate add; opacity,scale multiply; falsy layer ignored | automated |
| R-26 | a numeric property with a color beside it; a width with no initial; two motions both on width | color omitted; start-value error; "Two motions both animate" | automated |
| R-27 | each CHANNELS row | lane, composition, identity, range, backend, tags as the Structure table; `fe*` tags are SMIL | automated |
| R-28 | `def.property` with a bad name, a conflicting redeclaration, an identical redeclaration | throws, throws, returns same key | automated |
| R-29 | `css` with number, Css and Property holes | number printed, Css spliced, Property -> `var(--pN)`; one `@property` per property | automated |
| R-30 | nested calc expressions | parentheses only where needed; `calc(` only around top-level ops; literals keep meaning; non-finite throws | automated |
| R-31 | a scene with `<Once>` and a looping rest; SMIL inside; nested motions | once rule and `o` class on the g and nested motions; `data-once` SMIL with repeatCount=1; no once rule without `<Once>` | automated |
| R-32 | `<Pivot at animation={[a, false, b]}>` | two groups with `transform-box:view-box;transform-origin:<at>`; two 90 deg stacked turns land half way round the point | automated |
| R-33 | element with its own `transform-origin`/`transform-box` and a two-layer stack | every wrapper keeps that style, no `fb` class; two 45 deg layers equal one 90 deg turn pixel for pixel | automated |
| R-34 | `restyle(svg, {at, onceAt, paused})` on CSS and SMIL | `--t0`/`--t1` set only when asked; SMIL `begin` as in Structure; one `fill` on held tags | automated |
| R-35 | `restyle(svg, {still})`, `{paused}`, `{css}` | REDUCED_MOTION swapped as in Structure, pause rule and css appended last | automated |
| R-36 | `count(13,{max:12})`, `count(1.5,..)`, `number(1,{min:2,max:1})`, log with min 0, `choice("blue",..)`; `defaults`; `structuredClone` | each throws its message; defaults typed by kind; schema clones equal | automated |
| R-37 | `fit`, `fitValues`, `withValues`, `positionOf`, `valueAt` including log | clamped, stepped without float dust; only numbers fitted; kinds kept; log slider round-trips | automated |
| R-38 | `follow` along a straight and an arc handle; a fixed handle | moves by the projection; arc followed; clamped; unchanged for a still handle | automated |
| R-39 | The same scene, with fresh defs, rendered twice | Identical bytes | automated |
| R-40 | `playbackRate: 0` | Throws a message naming `playbackRate` | automated |
| R-41 | `prefix` of `1a`, `-a`, `a b`, `a.b`, `a"b` | Throws `needs a prefix` | automated |
| R-42 | width, height or duration of 0, negative or NaN | Throws the named message | not yet covered |
| R-43 | A ref used in two renders | Both start ids from 1 (ids not carried over) | not yet covered |
| R-44 | Any `render()` | Root `<svg>` with `viewBox="0 0 W H"`, width, height, `role="img"`, `aria-labelledby` naming the title (and desc); `comment` written first; output ends in a newline | not yet covered |
| R-45 | A hand-written duplicate `id` | `render` throws `Generated SVG is invalid` | not yet covered |
| R-46 | `scene("one-")` and `scene("two-")` | No shared generated identifier; ids, classes, keyframes, aria ids carry the prefix | automated |
| R-47 | Unused defs plus defs used twice | Only used defs emitted once, ids in first-use order, filter region defaults to the canvas | automated |
| R-48 | Tree from `String(ref)` | Throws `A def ref is not a string` | not yet covered |
| R-49 | `clipPath={gradient}`, `fill="url(#bg)"` | Type error | automated |
| R-50 | Two elements with the same motion | One `@keyframes`, one class used twice | automated |
| R-51 | A transition with an ease, a held value, a cut at the end | Ease on the transition's start key; holds merge; last key at 100% | automated |
| R-52 | Two keys closer than 0.0001 of the period | Throws `too close to tell apart` | not yet covered |
| R-53 | A channel the tag cannot animate | Throws `cannot animate` | automated |
| R-54 | `width` motion without a starting value | Throws `has no starting value` | not yet covered |
| R-55 | A motion longer than `duration` | Throws `past the …s scene` | not yet covered |
| R-56 | A lane over `MAX_KEYS` keys | Throws `the cap is` | not yet covered |
| R-57 | `d` motion between paths with different commands | Throws the matchPaths message | automated |
| R-58 | `enter` plus a scale motion | One element, no `<g>` | automated |
| R-59 | `enter` plus `exit` | Exactly one wrapper `<g>` | automated |
| R-60 | Two `fill` motions on one element | Throws naming `fill`; same for a property lane | automated |
| R-61 | `scale` on `<text>`; `scale` on an element with `transform` | Wrapper `<g class="a m1 fb">` | automated |
| R-62 | `draw` on a path with `pathLength={2}`; plain `draw` | Throws naming `pathLength`; else `pathLength="1" stroke-dasharray="1"` | automated |
| R-63 | A 0/1 opacity cut; a cut inside a cut; a fade; a static `opacity` | `visibility` for the first; one visibility toggle in nested or stacked cuts; `opacity` otherwise | automated |
| R-64 | `enter(…, { blur })`; blur on an element with `filter`; blur at a reduced-motion time | Generated filter with SMIL `stdDeviation`; wrapper `<g filter>`; still twin value equals `sample()` | automated |
| R-65 | A filter with an animated primitive and `reducedMotion` | `<filter id="f1s">` without `<animate>` and `[filter="url(#f1)"]{filter:url(#f1s)}` | automated |
| R-66 | A path with an animated `d` and `reducedMotion` | A `dm` copy and a `ds` copy with display none | automated |
| R-67 | Stepped, eased and linear lanes on filter primitives; `displace` starting from the attribute | `calcMode`, `keyTimes`, `values` as specified | automated |
| R-68 | `reducedMotion` given, `false`, and default | `@media (prefers-reduced-motion:reduce)` with delay `-stillAt/rate`; none when false; at defaults to 85% | automated |
| R-69 | `loop: false` with a 2 s loop in a 6 s scene | `iteration-count:1`, `animation-duration:2s;animation-iteration-count:3`, `repeatCount="1" fill="freeze"`, no `infinite`; default loops forever | automated |
| R-70 | `playbackRate: 2` | Every emitted duration halves; nothing else changes | automated |
| R-71 | A prefix and an embedded font | `@font-face{font-family:'one-ABeeZee'` and the same name in `font-family` | automated |
| R-72 | Properties used in motion, style and css | `@property --p1…` once; names by first use; unused not registered; style values carry the syntax's unit | automated |
| R-73 | A font used on text and on a group; a family; an unused font; the same file loaded twice; two files on one family slot | One `@font-face` per used face with the fallback in the attribute; nothing for an unused font; one embed for the same bytes; throws `Two different fonts claim` | automated |
| R-74 | Style text containing `]]>`; titles with `<`; attribute values with `"` | Well-formed XML (xmllint) | automated |
| R-75 | Same scene via `el` and JSX | Identical bytes | automated |
| R-76 | The toast and review-flow examples via `el` | Identical bytes to the shipped JSX examples | automated |
| R-77 | Unknown attribute, non-motion `animation` entry | Type error on the typed path; at runtime throws the named message | automated |
| R-78 | An element with `animation`, inside `<Once>` | The serialized element carries no `animation`, `once` or `motions` attribute | not yet covered |
| R-79 | `sources: true` | `data-source` on recorded elements; `file:line:col`, empty file name skipped, component root takes the inner place; equal bytes once stripped | automated |
| R-80 | `num(NaN)` | Throws `Expected a finite number` | not yet covered |
| R-81 | `css` option with generated rules | Authored text precedes generated rules | not yet covered |
| R-82 | Duplicate ids, missing refs, missing `@keyframes`, no viewBox, unused keyframes | Exact messages in `errors` or `warnings` | automated |
| R-83 | A filter over 60 animated elements; over 20; with a prefix | Warns only past the limit, including with a prefix | automated |
| R-84 | External `href` on image, feImage, use, quoted either way, with `xlink:` | Warning naming `<img>` and `picture.load()`; no error; fragment and `data:` hrefs pass | automated |
| R-85 | A data URI over 256 KB | Warning with the size in KB | automated |
| R-86 | An embedded font over 256 KB | Warning | automated |
| R-87 | PNG, JPEG, GIF, WebP (three layouts), SVG fixtures | Format and size read from the header; EXIF 5 to 8 swaps | automated |
| R-88 | SVG markup with quotes, whitespace, `%`, `#`; text that merely mentions `<svg` | Round-trips exactly; only a root `<svg>` counts | automated |
| R-89 | Unknown bytes; SVG without size | Throws the named messages | automated |
| R-90 | `picture.load` of a file by content, and a 404 | Reads by content; throws with the status | automated |
| R-91 | `Picture` with width only, height only, neither; each `fit`; `radius`; `alt`; many uses | Derived sides, transforms, clip only when needed, one embedded href, alt semantics, output validates | automated |
| R-92 | `Icon` stroke and fill kinds, `size`, `alt`, per-path animation | Transform, paint, paths, aria, keyframe counts as specified | automated |
| R-93 | `Glyphs` for a text with a gap glyph; a function animation; a family with `weight` | No `<path>` for glyphs without outline; group labelled with text; no font embedded; the function runs once per drawn glyph with its index; the face is picked by weight | automated |
| R-94 | Each `fx` filter; `fx.duotone` with a named colour | Primitive output as specified; duotone maps black to dark and white to light; throws the hex message | automated |
| R-95 | `hexOf("red", …)`, `hexOf("#12345678", …, false)` | Throws | automated |
| R-96 | `index.ts` exports | Public names exist and the package types check | automated |
| R-97 | Points and a count | Exactly `count` evenly spaced points, ends kept; < 2 points or non-integer / < 2 count throws | automated |
| R-98 | Points, options | `M` then `L`, 1 decimal default, `Z` when closed; empty throws | automated |
| R-99 | `rect(x,y,w,h)` | Edge midpoints, centre, `pad`, `union`, `side(edge,t)` are as defined | automated |
| R-100 | Points | Passes through each at integer positions; `i+u` is Catmull-Rom u; positions outside the range hold the ends; < 2 points throws | automated |
| R-101 | `d`, `path(from,to)` | One cubic per leg; cut equals the exact sub-curve inside a leg and across legs | automated |
| R-102 | `tangent`, `angle` | Tangent is the rate of change of `point`; angle follows travel in degrees | automated |
| R-103 | `nearest(p, from, to)` | Returns the position within range closest to `p` | automated |
| R-104 | Paths with different commands (square, circle, star) | Identical command sequences out; polygon corners survive the splitting | automated |
| R-105 | A path with fewer subpaths | Missing ring grows from the donor ring's middle point | automated |
| R-106 | Closed rings with different start points | Each starts at the rotation closest to the previous path's ring | not yet covered |
| R-107 | Unknown command, wrong number count, no shape | The three `matchPaths()` errors | not yet covered |
| R-108 | Two matched paths and `amount` | Numbers blended pairwise, commands of `a` kept | automated |
| R-109 | A function of time returning path data | Few keys for steady motion; `slack` removes keys the viewer cannot see | automated |
| R-110 | Bad duration, step, tolerance; samples with different commands | The four `sampledPath()` errors | automated |
| R-111 | Font bytes | Family, weight, style, fallback from the file; options override; short, `ttcf`, unknown, or truncated bytes throw | automated |
| R-112 | WOFF / WOFF2 bytes | Embeds with the right MIME; `measure`, `path` throw `needs the TTF or OTF file` | automated |
| R-113 | Text, size | `measure` applies pair kerning and standard ligatures, scales with size, equals the sum of `path` advances; `ligatures:false` gives one glyph per character | automated |
| R-114 | Text, size, origin | One glyph per laid-out glyph, on the baseline, scaled by size; space has no outline; composites flatten; all-off-curve contours close; hostile composites throw; bad size throws; OTF throws | automated |
| R-115 | Faces | `font.family` rejects duplicate slots; `face(weight, style)` follows CSS matching | automated |
| R-116 | A font or family; a hostile family name | Never coerces to a string; the family name cannot break out of the CSS string; fallback is written after the name | automated |
| R-117 | Scene text, TrueType font | Embedded font holds only the used glyphs, maps BMP and beyond-BMP characters, keeps pair kerning, and measures the text as the whole font does | automated |
| R-118 | Ligature text, contextual or mark text, `subset:false`, WOFF, CFF | Whole font embedded; plain text in a coding font is cut | automated |
| R-119 | SVG font markup (string, bytes, ArrayBuffer) | Family, glyphs, advances read; non-font markup throws | automated |
| R-120 | Text with a stroke font | Glyphs placed left to right from the baseline, y down; sharp corners kept, gentle turns smoothed; space and unknown characters advance only | automated |
| R-121 | Path data | Lines, curves, arcs, subpaths, smooth mirroring, skipped zero arcs; malformed data throws | automated |
| R-122 | Each tool | Pen even at its size; brush widest mid-stroke and pointed at ends; nib thick across its edge; pencil seeded | automated |
| R-123 | `inkPath` | One closed outline per subpath | automated |
| R-124 | `<Ink>` still and drawing | Still: one `<use>`, no mask. Drawing: one mask, two uses, one symbol, hand-over at `at + over`. Same path and tool embed once | automated |
| R-125 | Bad camera, block, texture | The camera, scene and texture errors | automated |
| R-126 | Blocks in any order | Emitted back to front by depth; same-cell blocks keep the given order; projection is linear | automated |
| R-127 | `from`, `to` | Visibility toggles at those times; no lifetime means no animation; block animation rides on its own `<use>` | automated |
| R-128 | A block with opaque unanimated neighbours | Culled unless a neighbour is animated, transparent, starts later, or ends sooner; a solid 3x3x3 keeps 19 | automated |
| R-129 | Blocks with equal skins; skins naming faces | One symbol per skin; missing faces fall back to `side`; nothing animated in a def | automated |
| R-130 | The same scene rendered twice (voxel, ink) | Byte-identical | automated |
| R-131 | Text with and without a font | Measured width with a font; 0.6 em per character without | automated |
| R-132 | every file in `src/layout` | each import path is `./<sibling>` | automated |
| R-133 | duplicate/unknown node ids, a node in two groups | `layered()` throws for each, and for an empty group | automated |
| R-134 | graphs chain, diamond, cycle, long, wide, grouped, twoGroups, TB and LR | every edge's endpoints have different ranks and the later rank starts after the earlier ends along the direction; a cycle's back edge ends on the right node with `rank(wait) > rank(run)` | automated |
| R-135 | the 7 sample graphs, TB and LR | no two node boxes overlap | automated |
| R-136 | grouped and twoGroups, TB and LR | a node overlaps a group box exactly when it is a member | automated |
| R-137 | the 7 sample graphs, TB and LR | first point on `from` border, last on `to` border, consecutive points share x or y | automated |
| R-138 | 10 routed graphs (incl. state example, decision fan-out, two-cycle), TB and LR | no shared stretch except a final approach into one port; no segment through a node | automated |
| R-139 | a chain with backward edges both sides; a 400-wide hub with three targets | chain nodes share one center x and its first three edges have 2 points; hub edges have <= 2 points | automated |
| R-140 | `a>b, b>b` | loop points all on or right of b's right edge, ends on b's border; a plain back edge routes around; a back edge in a tall cycle climbs a side channel | automated |
| R-141 | labelled edges in the 10 routed graphs, and a fan with two labels | no label overlaps a node, another label or another edge's segment | automated |
| R-142 | `a>b`, `b>a`, `a>b` with labels | routes differ (not reverse of each other, not equal); labels do not overlap | automated |
| R-143 | two roots / unknown parent / cycle | throws "one root" / "unknown parent" / "cycle"; duplicate ids throw | automated |
| R-144 | 10-node sample tree, TB and LR | parent center = midpoint of first and last child's centers; no boxes overlap; a, b, c keep order | automated |
| R-145 | same tree | `order` equals the breadth-first list; every edge starts/ends on the parent/child border; edges come in order and the bounds hold every node | automated |
| R-146 | three actors, labels 220/40/500 wide, a note | each label lies strictly between its lifelines; empty/duplicate actors and unknown actor throw | automated |
| R-147 | the same sequence | arrow points are lifeline to lifeline at one y; rows' tops ascend; lifelines end below the last row; self-message loop is right of its lifeline and its label clears the next | automated |
| R-148 | scale 0, empty/duplicate lanes, unknown lane, negative or non-finite time, span with to <= from | `lanes()` throws | not yet covered |
| R-149 | scale 50, lane time 1 and 2 | `x(2) - x(1)` = 50; `x(0)` > widest label; span box x = x(from), w = (to-from)*scale; ticks fall on `NICE` steps >= 56 px | automated |
| R-150 | span on a, event on b, link a to b at 2.5 | span overlaps a's row; event y = b's row middle; link x = x(2.5) at both ends and y inside a's then b's row | automated |
| R-151 | a circle sample grid, a saddle, a grid with NaN | circle gives a closed line; saddle gives two open lines; NaN cells leave gaps | automated |
| R-152 | a uniform field, a vortex, explicit seeds | spacing kept; circle radius constant; lines start only at the seeds | automated |
| R-153 | a polyline with collinear/repeated points; a noisy polyline and a tolerance | box.simplify drops them exactly; field.simplify keeps all points within tolerance and the endpoints | not yet covered |
| R-154 | a jog and a plain corner | a jog becomes one S whose ends are straight; a corner is rounded; `samples` starts and ends on the route's ends | automated |
| R-155 | `x: 100, y: 50`; `anchor: "center"`; `anchor: "top"` | `bounds` starts at 100,50; its center is 400,300; its top is 50,20 | automated |
| R-156 | a decision node with an incoming edge | `|dx|/(w/2) + |dy|/(h/2)` = 1 at the end point; input, output and store edges end on their own outlines | automated |
| R-157 | the sample flowchart | `route` starts on the first node and ends on the last and begins with the first hop's `edge`; `route("end","start")` and `edge("start","end")` throw; unknown id throws | automated |
| R-158 | `play: {at: 1}` and `play: {at: 1, step: 2}` | rank-0 nodes have no delay; later nodes follow in rank order; the last delay equals the list form's; each edge draws as its later end appears | automated |
| R-159 | a three-node chain, TB and LR | TB: c below a; LR: c right of a and same y | automated |
| R-160 | `play: {at: 2, step: 0.5}`, and `at: [1, 1.5, 4]` | `message(1).span` = {2.5, 0.5}; points x = lifeline centers; later message lower; `message(5)` throws; list form spans run to the next start, last uses `step` | automated |
| R-161 | duplicate id, initial outside scope, unknown state in a transition | each throws | not yet covered |
| R-162 | the review composite | inner states inside the container and below its header; `draft -> review` ends on the container's top border; `decision -> published` starts inside the container and `published` is outside it; the initial state sits below its dot and a final above the bullseye | automated |
| R-163 | `walk` with `speed: 1e9`, single start and list | idle lit at 1 and again at 3.7; done at 1 + 4*1.35; end = 1+5+4*0.35; list form: spans start at the given times, over = gap - 0.35, end = last + dwell | automated |
| R-164 | `["idle","done"]` and `["draft","decision"]` | throws; entering a composite through `review -> screening` works (one span for `screening`); an empty path and an unknown state throw | automated |
| R-165 | a 4-node tree | route from a1 to b touches a1 and b and its top is the root's bottom edge; root centered over a and b; play shows the root from the start and the rest breadth-first; `route(a, a)` is the node's centre | automated |
| R-166 | `scale: 50`, lanes a, b | `x(2) - x(1)` = 50; `x(0)` right of the lane box's x; b's row starts where a's ends; the playhead and spans grow with lane time | automated |
| R-167 | each sample diagram, with and without play, and walk overlays | `render` does not throw | automated |
| R-168 | the same input twice | identical output | not yet covered |
| R-169 | `code()` with two lines of tokens, `advance` 6, `lineHeight` 2, `fontSize` 10, or a gutter | `at(2,3)` is `{x:22,y:40}`; words are non-space runs with 1-based column and x; gutter shifts code by `digits+2` columns | automated |
| R-170 | `lines`, `at`, `find`, `get` queries | rects match; `at(3,1)` and `find("cd",3)` throw; `get` unions runs of one id | automated |
| R-171 | tabs/newlines in tokens, proportional `font`, non-positive metrics | each throws its message | automated |
| R-172 | `base16()` with 15 colors; `tint(theme, role)` | throws; slot per the role table | automated |
| R-173 | `variables()` with and without `light`; `adaptive()`; a name with a space | exact css strings; one declaration per slot; the error | automated |
| R-174 | swapped words, a line inserted above repeated words, runs sharing an id | swapped words both move; each word keeps its line; id pairs before content | automated |
| R-175 | morph of versions with kept, removed, added, renamed-by-id words; a custom Morphable | spans/end reported; renamed id renders both texts animated; each piece drawn by its own source | automated |
| R-176 | `at` of wrong length, overlapping `at`, gutter with non-code | each throws | automated |
| R-177 | `typewriter(code("ab\n\ncde"), {at:1, cps:10})` | spans `[1,.2],[1.3,0],[1.4,.3]`; `end` equals the last span's end; bad `at` throws | automated |
| R-178 | default paragraphs, explicit blocks, `"line"`, overlapping and out-of-range blocks | spans and end as computed; unblocked lines unanimated; bad blocks throw | automated |
| R-179 | a two-command session with output | bounds height 80, `end` as computed; empty session throws | automated |
| R-180 | `appWindow(rect, {bar:30})` | `body` starts under the bar | automated |
| R-181 | Arrow, Brace, Underline, Camera, flow rendered in a 10 s scene with span 2..5 | valid SVG; keyframe stops fall only inside the span (+ camera over) | automated |
| R-182 | each of Marker, Arrow, Callout, Brace, Underline, flow with default and `tomorrow` theme | contains the theme's `base09` | automated |
| R-183 | Brace `above` and `below` | exact path and label coordinates | automated |
| R-184 | Callout text wraps at `columns`; box sits on `side`; with `font` it fits measured lines | box/leader coordinates as in the rule | automated |
| R-185 | Focus stops that touch; `dim` outside 0..1; reduced-motion freeze | merged dim; throws; frozen dimmed with focus rect lit | automated |
| R-186 | Marker with two stops frozen at 4 s; no stops; `over: 0` | width/height at the second stop; the two errors | automated |
| R-187 | `fit` into a frame not at the origin; stop at 0; target of zero size; Steady scale | centered view; initial view; throws; scale 1 and 0.25 around the anchor | automated |
| R-188 | `pace`, `gap`, `at` nesting, reserved names, `show`, `enter`, `readingTime`, `beats` errors | spans and durations exact; reserved name throws; opacity at probe times | automated |
| R-189 | `visible` with unsorted overlapping spans; `cut` at 0 and later; `shot` with rise/slide/cut; `shot({over:0})` | opacity and y at probe times; throws "positive length" | automated |
| R-190 | `travel` along a bent path; `heading: true`, a number, none; a one-point path | constant speed, hides at end; rotations short-way; no `rotate` without heading; throws | automated |
| R-191 | `flow` comet with short loop; trace with loop | throws the two messages; styles render valid SVG | automated |
| R-192 | `axes` ranges, sizes, steps; `point`; zero crossing; labels | mapping exact; edge placement; no float noise or `-0`; the four errors | automated |
| R-193 | `plot` of `x*x`, `1/x`, `tan`, `sqrt`, `NaN`; bad samples/range | single run; breaks at asymptotes; 0.1 px; throws | automated |
| R-194 | `Moving` as number, sweep, chained sweeps, overlapping sweeps, NaN | holds between; throws for malformed | automated |
| R-195 | dot on `x*x` sweeping; tangent slope at 1.5; secant with `h` to 0 | dot sits on curve; slope 3; secant d ends on tangent d; SMIL `d` values keep their commands | automated |
| R-196 | `area` of `x*x` over [0,2] with right bound sweeping | `value(0)` ≈ 0, `value(3)` ≈ 8/3; d ends with Z | automated |
| R-197 | `riemann` n `[2,4,8]`; one `at` for three stages | same commands per stage; sums converge; the stage-count error | automated |
| R-198 | `graph.morph` of three functions with three colors; `parametric` and `polar` circle | same commands; ends at the last function; stroke color; same points both ways | automated |
| R-199 | `readout((t) => t<2?"low":"high", …)` | two `<text>` | automated |
| R-200 | `streamlines` over several lines; bad options | one subpath per line in `d`; each bad option names the fix | automated |
| R-201 | `fieldLines` + `fieldFlow` over straight lines | one particle per line, distinct translate keyframes | automated |
| R-202 | `vectorField` with a field that is zero in part | one arrow per live lattice point | automated |
| R-203 | `slopeField` flat marks; `slopeSolution` of `y' = x - y` | flat marks; follows the slope | automated |
| R-204 | `contours` of a precomputed grid; of a function through `axes`; without bounds or axes | row 0 on top; samples in graph units; throws naming bounds or axes | automated |
| R-205 | `contourSweep` of a widening circle; a level with no line | one path whose `d` morphs; error names the level | automated |
| R-206 | every type in a public signature | importable from `svjeez/extras` | not yet covered |
| R-207 | `renderFrames` with count -1 or 1.5, time -2, scale 0, columns 1.5; `openScene` with scale -1 | Throws the named message before any browser starts; `openScene` uses the caller name | automated |
| R-208 | An `<svg>` with no numeric width/height | Throws "… numeric width and height" | automated |
| R-209 | `count: 4` on a 4 s loop; `count: 4` on a 12 s scene of rounded fractions | Frame times 0,1,2,3 and 0,3,6,9; PNG size is `size*scale` | automated |
| R-210 | A scene with CSS motions and a SMIL filter animation; `loop: false` scene sampled past its end | Frames before/after a transition differ; holds are equal; SMIL is seeked; `loop:false` holds the last frame | automated |
| R-211 | Two parallel renders of the same time | Identical PNG bytes | automated |
| R-212 | Light vs dark vs system vs default; embedded raster and SVG image | Light != dark; system and default equal `systemColorScheme()`; embedded images paint their own colors | automated |
| R-213 | Only inner loops of 2 s and 3 s; periods 12/2, 12/3, 12/5, 12/7, 12/8 beside a 12 s motion | `duration` is 6 and 12; fractions that are 1 ms-rounded still resolve to the duration | automated |
| R-214 | Two inline `<svg>` in one page; `seek(1, one)`; `loopLength(one/two/none)` | Only `one` moves; `two` still "running"; lengths 4, 3, 12 | automated |
| R-215 | `sheet: {columns: 3}` on 6 frames; a 2000 px wide scene at scale 3 with 4 frames | Sheet has 3 columns; wide sheet is <= 16384 px, larger than 1x CSS, aspect preserved | automated |
| R-216 | `openScene` then `capture(1.5)` vs `renderFrames({times:[1.5]})` | Equal bytes; `VideoEncoder` exists in a secure context; `close()` works | automated |
| R-217 | No playwright-core / no Chromium / bad `executablePath` | Named install message; with `executablePath` the raw launch error | not yet covered |
| R-218 | macOS dark, Windows dark, GNOME dark, unreadable | dark, dark, dark, light | not yet covered |
| R-219 | `.svg`, `.tsx` default string, function, async function, bad default, `.tsx` without tsx | Loaded; or the named failure | not yet covered |
| R-220 | `svjeez svg` with and without `--out`, with a warning-producing scene | File vs stdout; `warning:` lines on stderr | not yet covered |
| R-221 | `--color-scheme sepia`; `--times` and `--count` together; `--columns 3` alone | Exit 1 with the message before any browser; sheet implied by `--columns`; file names `frame-00-0_000s.png` | automated |
| R-222 | `video` with no `@svjeez/video`; `--format webm --out s.mp4`; packed consumer runs `svjeez video` | Named install error; mismatch error; `scene.webm` has 5 packets | automated |
| R-223 | `svjeez skill`; `skill --install --dir d` twice | stdout equals SKILL.md; `examples/` and `references/` listings equal the shipped ones | automated |
| R-224 | `svjeez render x`; `svjeez` with no args | Exit 1, usage text containing `svjeez frames <file>` | automated |
| R-225 | The shipped skill | Examples render valid animated SVG; every mentioned path exists; every reference routed; every runtime-error row found in `src/` | automated |
| R-226 | `test:node` on Node 20 and 22 | All examples render; exit 0 | manual — run `npm run test:node` under Node 20 and 22 (CI does) |
| R-227 | `bun run build:package` in svjeez | `package-dist/` has 9 entries, `.d.ts` with `.js` specifiers, README and LICENSE beside package.json | manual — run it and inspect; CI runs `npm pack --dry-run` which triggers it |
| R-228 | `bun run test:package` in svjeez | publint, attw, 7 compiler/resolution combinations x2, 8 import+require entries pass | manual — CI runs it on Node 20 and 22 |
| R-229 | `fps: 0`, `loops: 1.5`, `scale: 0`, `mp4`+`vp8`, transparent mp4 | Each rejects by name | automated |
| R-230 | 64x48 slide at 12 fps; 3 loops at scale 2; a 65x49 scene; a still scene | 12 packets at 1 s; 30 frames, 128x96, 3 s; 64x48 (odd pixel dropped); throws "needs an animated scene" | automated |
| R-231 | webm default, vp8, transparent webm, mp4 default | vp9; vp8; `canBeTransparent` and alpha on all 6 packets; avc; unsupported codec throws the Chromium message | automated |
| R-232 | Vite build and dev server of a React app importing `hero.tsx?svjeez&posters` | SVG and WebP posters are emitted; bundle holds the URL and no `@keyframes`; dev module has the title | automated |
| R-233 | Edit the scene file, then a file it imports, in a running dev server | A reload/update message is sent and the next fetched SVG shows the change | automated |
| R-234 | Same SVG text twice; a scene with `&amp;` in its title | Same URL; alt text is unescaped | not yet covered |
| R-235 | Two requests for one poster; cache hit; 10 scenes at once | One render; cached bytes returned; at most `LANES` Chromium renders at once | not yet covered |
| R-236 | A build in Astro/Vite after `getScene()` ran | Every registered file written under `_svjeez/` and the count returned | automated |
| R-237 | Packed Astro consumer builds a page using `<Scene>`, `getScene` posters and `?svjeez` | Output has the SVG, a WebP poster, the imported file | automated |
| R-238 | `build:package` for a plugin with `workspace:*` dependencies | Published manifest has caret ranges, no private/scripts/devDependencies; `new URL("./w.ts", …)` becomes `.js` | manual — run `build:package` in `packages/astro` and read `package-dist/package.json` |
| R-239 | `test:package` in vite/video/astro/react/svelte | Tarballs install on plain Node and the consumer's `check` passes | manual — CI runs it |
| R-240 | Registry/GitHub states: nothing new; npm done, release missing; both missing; prerelease | Pending set, dist-tag, tag name, `--latest` flag follow the rule | not yet covered |
| R-241 | `claim` for a new or already-staged package | Staged publish, or trust only; no double trust | not yet covered |
| R-242 | A PR with a stale `examples/dist/` | `dist` job fails | manual — CI |
| R-243 | `bun test` at the repo root | Exit 1 with the pointer | not yet covered |
| R-244 | Edit the source during a build | Exactly one extra build is queued; the page shows the error text on failure | manual — run `bun run dev`, save the file twice quickly, break the scene |
| R-245 | Source with numbers, signed, `_`, hex, colors (3/6/8 digit), strings, named and bezier eases | Each is one literal with exact range, value and kind; ease numbers are not literals; multi-line text skipped | automated |
| R-246 | Literals in attributes, properties, call args, nested const objects/arrays | Role and path as specified; path only from top-level const | automated |
| R-247 | Edits that lengthen another value, edit another declaration, duplicate names | Keys stay; keys unique; ordinals on clash | automated |
| R-248 | `export const params = {…}` | Param literal and its options found apart | automated |
| R-249 | `set`/`write`/`apply` | Only the literal range changes; decimals, quotes kept; overlapping edits use original ranges | automated |
| R-250 | `linesOf` with live literals | Pieces rejoin to the file; live literals separate | automated |
| R-251 | Attribute, param, const, animation const | `madeBy` and `callsIn` as specified | automated |
| R-252 | Schema with choice param | Only declared choices make string values; option literals are not values | automated |
| R-253 | Declared, named and bare numbers | Range per rule; negatives and zero get room both sides | automated |
| R-254 | scrub/nudge/bend/withRgb | Full-width scrub ~ full range, fine a fifth; nudge one or ten steps; bend clamps x; hex case/alpha kept | automated |
| R-255 | `set` on a number/color/ease | Only that literal changes, compile asked for new text; precision kept through 0.9 <-> 1.0; exponent literal gets no new decimals | automated |
| R-256 | set + continues, undo, redo | A drag is one step; redo restores | automated |
| R-257 | replace with/without surviving key | selection kept/dropped | automated |
| R-258 | pause, seek, play | held time, moved time, continued time | automated |
| R-259 | compiled ok / fail | show at the clock time; failure keeps the last picture and sets error | automated |
| R-260 | compile declaring choice param | the string becomes a choice control | automated |
| R-261 | compile with handles | grips keyed by params with `declared: true`; select issues no probe | automated |
| R-262 | select, probed, set, other edits | probe asked with nudged file; grip kept only if only its value changed; re-select keeps, other select drops | automated |
| R-263 | create, subscribe, unsubscribe | nothing before first subscriber; pause stops compiler; resume compiles what changed | automated |
| R-264 | burst of edits during a compile; a throwing job | only newest runs next; queue survives throw | automated |
| R-265 | successive pictures, destroy | old URLs released once, last at destroy | automated |
| R-266 | compile throws; pause cuts compile | error shown, next edit compiles; pause never shown as error | automated |
| R-267 | destroy then subscribe | no compile | automated |
| R-268 | `first` with duration | picture holds it before any compile | automated |
| R-269 | scene with params/handles; `compileBuild` | scene size, params, handle `at`/`way`, stats | automated |
| R-270 | syntax / runtime error | line, column; message verbatim; fix attached | automated |
| R-271 | scene imports world-atlas / unknown module | maps load; unknown named with allowed list | automated |
| R-272 | `sources: true` | elements carry source line | automated |
| R-273 | skill table vs `skill-errors.ts`; each row | equal; every row has a fix; `…` matches | automated |
| R-274 | endless scene; stop; jobs in flight | timeout error, fresh worker; stop fails at once; only stuck-worker jobs fail | automated |
| R-275 | shifted, resized, still and animated shapes | handle on the shape, edge for radius, motion-time position; none if nothing moves | automated |
| R-276 | drag, arrows, grip drag, bend | one undo step per drag, per arrow; range fixed at drag start; first no-change move still starts a step | automated |
| R-277 | focus/blur between a number and its grip | focus selects; blur between linked controls does not deselect; blur away deselects | automated |
| R-278 | server render | markup with controls, no compile | automated |
| R-279 | real browser: drag, arrow, color pick, ease bend, undo | source rewritten, picture recompiled | automated |
| R-280 | `control` override | wraps every control; `plain` keeps built-in | automated |
| R-281 | open curve editor, click Undo / Escape | closes, nothing selected | automated |
| R-282 | declared handles scene; bare number selected | grip dragged moves value, source and picture | automated |
| R-283 | broken edit | error shown, picture unchanged | automated |
| R-284 | memo'd Picture; hidden/shown Activity | still updates and recompiles | automated |
| R-285 | Ctrl/Cmd+Z, +Shift in code panel | undo / redo | automated |
| R-286 | Adapter markup vs `editor.css` header | same classes and data attributes in React and Svelte | not yet covered |
| R-287 | Subscriber notified only on state change | no call for no-op messages | not yet covered |
| R-288 | `set` with a key that is not a value | state unchanged, no compile | not yet covered |
| R-289 | `Input` excludes `compiled`/`shown`/`probed` | type error on send | not yet covered |
| R-290 | `seek` outside 0..duration | `at` is stored as given; Q-45 decides whether to clamp | not yet covered |
| R-291 | Data `[12,48,31,87]`, no y domain; then `zero:false` with `[52,87]`; then explicit `y.domain [3,97]` | Fitted domain includes 0 and is niced (y(0) = bottom, y(100) = top); `zero:false` fits data alone; explicit domain is niced, wins over data and is never stretched to 0 | automated |
| R-292 | Linear x with no domain; with `domain [0,9.7], ticks 5`; with neither domain nor data | Fits data / is niced (x(10) = width); neither throws | automated |
| R-293 | Band x with 4 categories; with a duplicate; with empty domain; padding outside [0,1) | Centers in domain order, evenly spaced; bandwidth > 0; bad inputs throw | automated |
| R-294 | width 0, empty data and domain, NaN datum, bad ticks, fontSize <= 0 | Each throws its named `chart()` error | automated |
| R-295 | Default chart; `grid:true`; domain spanning 0 | Axis strokes use `comment`, labels `muted`; categories appear as text; grid adds `stroke-opacity`; plain chart has none; zero line only when domain spans 0 | automated |
| R-296 | Three series with no color, then one with `color` | First two take `blue` then `number`; explicit color is used verbatim; the 8th wraps to `blue` | automated |
| R-297 | A y above the domain, an unknown category, a non-finite y, a point outside x | Throws naming call, index, domain and the fix; nothing drawn | automated |
| R-298 | `at` < 0, `over` <= 0; bars with stagger; line with label | Throws; `end` equals last bar's `at + i*stagger + over`; line `end` = at + over | automated |
| R-299 | Positive and negative bars | Bar bounds top at y(value), foot at y(0); negative hangs from zero line; one `animation-name` per bar | automated |
| R-300 | `group {index:0,count:2}` and `{index:1,count:2}`; `values:true` | Grouped bars sit side by side, each narrower than half a band; value labels written | automated |
| R-301 | Bars on linear scale; `{}`; unknown key; NaN; out of domain; bad group; bad stagger | Each throws its named `bars()` error | automated |
| R-302 | Line with 3 points; curves linear/monotone/step; `dots:true`; `label` | One scene point per datum; three distinct paths, monotone has `C`; one circle per point; label text; stroke-dasharray present; bad curve throws | automated |
| R-303 | `area()` default; `line:false`; `baseline` NaN | Fill path closes and reaches the baseline; clipPath and linearGradient present; no stroke-dasharray when `line:false`; NaN baseline throws | automated |
| R-304 | Same chart options built twice; floats like 0.1+0.2 as ticks | Identical bytes; tick labels free of float noise and `-0`; coords have at most one decimal | not yet covered |
| R-305 | `const x = 1;`, `// b`, blank line, tsx line | Roles tag runs, plain stays bare, empty line is `[]`, one array per line, pieces spell the source, adjacent same-role runs merged | automated |
| R-306 | CRLF input; tabs with tabSize 2/4; tabSize 0 or 1.5 | CRLF accepted; tabs reach next stop; bad tabSize throws | automated |
| R-307 | Aliases (sh, py, rs, go, sql, yaml...); unknown lang; `grammars:[toml]` | Aliases resolve; unknown throws listing known; extra grammar adds a language | automated |
| R-308 | `highlight` output fed to `code()` with `defaultDark`, then `adaptive(light, dark)` | Colors come from the theme; adaptive switches with the color scheme; no baked hex | automated |
| R-309 | A line whose first tokenization is slow | Output identical regardless of speed (no merged rest-of-line) | not yet covered |
| R-310 | `SVJEEZ_FONTS_CACHE`, else `XDG_CACHE_HOME`, else home | Resolved path per Structure | automated |
| R-311 | Cached TTF present, `fetch` throws | Font loads, family/weight/fallback honored, `measure` > 0, no network used | automated |
| R-312 | Unknown family (400); network failure on cold cache; success | Google error carries family, weight and Google's title, nothing cached; network error names family and cache path; success writes exactly one cache file through temp+rename | automated |
| R-313 | `google.family("ABeeZee",[400,{weight:400,style:"italic"}])` | Both faces load, grouped, cached under two names | automated |
| R-314 | Upstream outline/filled/lucide SVGs | Paths as in Structure; frame dropped; circle -> arcs; rounded rect -> closed path; mixed icons stay stroke | automated |
| R-315 | Upstream SVG with unknown element, stray attribute or bad root | Generator exits non-zero listing every failing icon; no file written | not yet covered |
| R-316 | `arrow-left`, `rocket-filled`, `arrow-up-1-0`, `arrow-up-10`, `delete`, `3d-cube` | `arrowLeft`, `rocketFilled`, `arrowUp1_0`, `arrowUp10`, `iconDelete`, `icon3dCube`; duplicates fail the generator | automated |
| R-317 | Run `generate` twice with pinned upstreams | Committed files unchanged, sorted by name, licence header present | automated |
| R-318 | Every export of both sets | Square grid, valid kind, nonempty paths starting with M/m; > 1000 icons per set; `checkFilled` fill, `check` stroke | automated |
| R-319 | Comments, blanks, trailing `;`, empty text, other diagram type, `%%{` | Meaningful lines keep original numbers; empty -> "no Mermaid text"; unknown header lists supported types; `%%{` rejected | automated |
| R-320 | Every node form, quoted labels with brackets, bare-then-defined node | Form/label per Structure; later definition names a bare node; TD is the default direction | automated |
| R-321 | `A --> B --> C`, `A & B --> C & D`, `-->|x|`, `-- x -->`, `-.->`, `==>`, `---` | All edge pairs expand with line/arrow/label as specified | automated |
| R-322 | Subgraphs with shared nodes; nested; empty; same id as a node; unclosed | First subgraph keeps a shared node; errors name the problem | automated |
| R-323 | Participants, aliases, all arrows, notes, undeclared actors, unsupported statements | Order of first mention; line/head decoded; notes only over one actor; others rejected with reason | automated |
| R-324 | Start/end/labels/long names; composite with own start; missing start; labelled start; descriptions; choices; unclosed composite | Doc per Structure; each bad input throws with a named reason | automated |
| R-325 | `classDef`, `A:::red`, loop blocks, `<<choice>>`, `A : text`, junk after a node | Throws MermaidSyntaxError with line number, line text and the Supported list; no line dropped | automated |
| R-326 | Flowchart/sequence/state text; `LR`; `BT` with and without `direction`; `play` | Diagram has `kind` and `doc`; LR lays out left to right and options.direction wins; BT/RL throw with the fix unless overridden; `play` adds keyframes, omitting it adds none; `walk()` works on states | automated |
| R-327 | Any parse failure | `error.line` and `error.source` set; message `Mermaid syntax error on line N (…)` | automated |
| R-328 | A topology (110m world), no `object`; and a missing `object` | Reads all 177 countries from the first object; missing name throws naming available objects | automated |
| R-329 | `filter` keeping France | One region; map fits the frame; `lines` far smaller than world | automated |
| R-330 | Coordinates in path data; larger tolerance | Every number is a multiple of 0.1; tolerance 2 < 0.5 < 0 in size | automated |
| R-331 | World topology | `lines` shorter than the sum of outlines; `land` shorter than `lines` | automated |
| R-332 | `region("France")`, `region(250)`, unknown, GeoJSON feature with id | Found by name or id; unknown throws listing ids; centroid in mainland; GeoJSON `d` is `M..l..z` | automated |
| R-333 | `point()` on flat map and on an orthographic globe | y/x ordering correct; far side throws | automated |
| R-334 | `route(NY, London)`; `route(Tokyo, SF)` | Ends equal `point()`; arcs north; antimeridian crossing throws; works after rotating | automated |
| R-335 | `line()` over 3 stops; over the edge; <2 stops | One piece through each stop; two pieces across the edge; throws for <2 | automated |
| R-336 | bounds of places with pad; of one region; of empty list; of GeoJSON | Padded box covers points; region returns its own `bounds` | automated |
| R-337 | `dots(3)`; globe `dots(3)` | Inside named region; fewer toward poles; far side kept without `point` | automated |
| R-338 | `sun`, `night` at solstice and an equinox hour | Lat 23.44, lon within 1 degree; 15 degrees/hour; night excludes subsolar point | automated |
| R-339 | `distance([NY, London])`, and out-and-back | About 5570 km; sums legs | automated |
| R-340 | Scales with 5 steps, diverging with 7, bad hex, non-rising domain | Edges, clamping, NaN to empty; middle on middle class; errors | automated |
| R-341 | legend over 4 classes | 4 swatches; labels at each edge and title | automated |
| R-342 | Values with unmatched keys; lists with times; mismatched times | Groups by course; `unmatched` reports; keyframes generated; error text | automated |
| R-343 | Morph shapes | Hidden until `at`, start equals region outline, `rest` holds others, `d` channel animated | automated |
| R-344 | Six countries | Area proportional to value, no overlaps, same output twice | automated |
| R-345 | Four countries; `top`; `asc` | Sorted, longest = frame width, bars inside frame | automated |
| R-346 | `traffic` with seed | `rate * over` particles, same bytes per seed, differs between seeds, heavier route favored, `rate: 0` throws | automated |
| R-347 | `arc()` between points and places | Peak at height; same bow from either end; ends at points | automated |
| R-348 | Globe at tilts 22, 0, -40 | 98%+ agreement with true land; one command sequence over time | automated |
| R-349 | Spin function without duration | Throws naming the fix | automated |
| R-350 | `route`, `place` | Route starts at first place; place fades 1 to 0 | automated |
| R-351 | Three projections | Same commands under each; morph via `d`; Greenland shrinks on equal area; Antarctica under Mercator throws | automated |
| R-352 | Greenland slide on Mercator | Area at end < 1/5 of start | automated |
| R-353 | Nightfall through an equinox; at June solstice | Renders without error with one shape; north lit, south dark | automated |
| R-354 | `tex` at x,y,fontSize,anchor | Box starts at x,y; scales with fontSize; glyphs inside box in order; anchor places point; upright | automated |
| R-355 | Bad TeX, emoji, `\overbrace`, `\tag`, bad options | Named throws | automated |
| R-356 | Two equations | Equal char at equal size pairs; superscript 2 differs; bars keyed by size | automated |
| R-357 | `\cssId`, `find` runs | get == find box; nth run; counts in errors | automated |
| R-358 | `write` | Two paths per glyph, dash outline, 3 keyframes per glyph; bad span throws | automated |
| R-359 | `\color` and `color` | `\color` part red, rest theme or override | automated |
| R-360 | Steps compose; overlap; reset | `map` follows order, reset returns home; messages | automated |
| R-361 | Matrix-only plane; function plane | CSS properties and keyframes, no SMIL; function morphs via `d` with equal command counts; non-finite function throws | automated |
| R-362 | Vector under matrix and function | Head upright (atan2 / constant triangle); zero vector throws | automated |
| R-363 | Pace, `at`, `together`, `settle` | Timeline numbers as specified; settle fades only aids | automated |
| R-364 | Circles, line+circle, lines, segments | Order of crossings, pick, no-crossing and past-the-end errors | automated |
| R-365 | Bisectors | Perpendicular and midpoint; equal angles | automated |
| R-366 | Bad constructor/element args | Named throws | automated |
| R-367 | Circle, square, errors | One term for a circle; sum reproduces samples; sorted; errors | automated |
| R-368 | Square, glyph, pi, pen | Trace near outline; `center`/`size`; glyph upright; pen on trace in Chromium; errors | automated |
| R-369 | Two-step derivation | Equals on one x; stack spacing; align by id; errors | automated |
| R-370 | Counter changes | One glyph per digit per place; digit places; roll translates; sign place; errors | automated |
| R-371 | Any output | No script; deterministic bytes | automated |

## U — Readability

| ID | Given | Expect | Instrument |
|---|---|---|---|
| U-1 | `<Ink>` brush, nib, pen and pencil at 1x on a contact sheet | Marks look hand-drawn: round caps, tapered ends, no facets on curves | manual — look at a rendered sheet of each tool |
| U-2 | A voxel island at pitch 30 and 35.264 | No seams between faces; shading reads as light from the top | manual — look at a rendered frame |
| U-3 | a rendered flowchart/state/sequence/lanes contact sheet (`render-png --sheet`) | no label overlaps a line; arrowheads sit on node outlines; timing reads in order | manual — open `sheet.png` and look at labels, edges and the order things appear |
| U-4 | A rendered world map from `examples/world` | Borders look right, no stray lines across the antimeridian | manual — open the `bun run render-png` sheet of `examples/world` and check borders and the antimeridian |
| U-5 | Globe example frames at several times | Land continuous across the horizon; no wrong-way fill | manual — look at a sheet of globe frames for continuous land across the horizon |
| U-6 | Equation write-on and morph | Glyphs land in place, no pop at the write/morph cut | manual — look at a sheet of the equation write-on and morph for glyphs landing in place |
| U-7 | Construct example | Labels clear of lines and circles | manual — look at a sheet of the construct example for labels clear of lines and circles |

## X — Experience

| ID | Given | Expect | Instrument |
|---|---|---|---|
| X-1 | Scene with a subset font, rendered in Chromium against the whole font | Same line breaks and advance widths as the browser | automated |
| X-2 | `examples/globe` size | About 585 KB (README) | not yet covered |
| X-3 | 110m/10m region paths size | 10m countries about 150 KB in 960x540 | not yet covered |

## Status

2026-10-30.

**Not yet covered:** R-1, R-4, R-6, R-7, R-14, R-15, R-42, R-43, R-44, R-45, R-48, R-52, R-54, R-55, R-56, R-78, R-80, R-81, R-106, R-107, R-148, R-153, R-161, R-168, R-206, R-217, R-218, R-219, R-220, R-234, R-235, R-240, R-241, R-243, R-286, R-287, R-288, R-289, R-290, R-304, R-309, R-315, X-2, X-3.

**Manual only:** R-226, R-227, R-228, R-238, R-239, R-242, R-244, U-1, U-2, U-3, U-4, U-5, U-6, U-7.

**Retired:** none.

**Partial coverage.** These automated rows have tests that miss part of the Expect column.

- R-11: cuts at 0 and mid-timeline, and contiguous transitions; only the end-cut branches are asserted, through `sampled()`
- R-2: the `Use set() for a cut.` half of the message
- R-3: `to({}, 1)`, `to({ nope: 1 }, 1)` and `to({ x: NaN }, 1)` throwing (only the undeclared property key is asserted)
- R-5: two transitions that overlap on one lane throw, and `x` and `opacity` may overlap (only an adjacent move within `EPSILON` is asserted not to throw)
- R-9: `ease.steps(0)` and `steps(1.5)` throwing, the other presets' points, and cloning an ease
- R-13: a colour transition holds the earlier value
- R-18: `duration: 0` and `step: 0` throwing (only `precision` is asserted)
- R-27: the lane, composition, identity, range and tags of each row; only that `fe*` primitives animate through SMIL is asserted
- R-28: the bad-name and unknown-syntax throws
- R-74: the well-formedness check runs only where `xmllint` is installed
- R-77: the runtime throws for an unknown attribute and a non-motion `animation` entry (only the type errors in `types.check.tsx` are checked)
- R-95: an 8-digit hex where alpha is not allowed
- R-68: `reducedMotion: false` emits no block, and `at` defaults to 85% of the duration
- R-99: the right, bottom and left edge midpoints, `pad`, `union` and `side(edge, t)` (only `center` and `top` are asserted, through a state diagram's bounds)
- X-1: line breaks (the painted text is one line)
- R-133: duplicate ids and an empty group throw; the message texts
- R-140: a back edge in a tall cycle climbs a side channel
- R-143: duplicate ids throw
- R-145: edge order and bounds
- R-146: the throws for empty, duplicate and unknown actors
- R-149: ticks fall on `NICE` steps at least 56 px apart
- R-156: input, output and store edges end on their own outlines
- R-158: rank-0 nodes having no delay and edge draw times, each on its own
- R-164: an empty path and an unknown state throw
- R-165: play times, and `route(a, a)`
- R-166: the playhead and span growth motions
- R-154: a jog becoming one S with straight ends, and a corner being rounded; only that the samples start and end on the route's ends is asserted
- R-171: tabs or newlines in tokens, and non-positive metrics (only the proportional font is asserted)
- R-172: `base16()` with 15 colors throwing, and every role slot but `fn`
- R-176: `at` of the wrong length, and overlapping `at`
- R-184: wrapping at `columns`, the box sitting on `side`, and the leader coordinates (only the measured box width is asserted)
- R-194: `Moving` as a bare number, overlapping sweeps, and the throws for malformed values
- R-221: `--times` with `--count` is rejected; `--columns` alone implies a sheet; frame file names `frame-00-0_000s.png`
- R-224: `svjeez` with no arguments exits 1 with the usage text
- R-231: an unsupported codec throws the Chromium message
- R-236: the returned count; `writeScenes` itself runs only in the packed Astro consumer (`test:package`)
- R-277: blur between linked controls keeps the selection, and blur away deselects
- R-278: Svelte's server render starting no compile (the Svelte consumer checks only the markup)
- R-280: the Svelte `control` snippet
- R-281: the Svelte popover dismissal
- R-284: Svelte, which has no test for a memo'd picture or a hidden-and-shown editor
- R-285: redo with Ctrl/Cmd+Shift+Z
- R-310: the `XDG_CACHE_HOME` and home-folder fallbacks
- R-335: `line()` with fewer than 2 stops throws
- R-336: `bounds` of an empty list, and of a GeoJSON target
- R-340: the ramp-length and step-count errors, the diverging domain errors, and 3-digit hex input
- R-341: the `empty` swatch and the default `every`
- R-342: ragged lists, non-rising times, and the fade-in from `empty`
- R-343: the start shape equals the region outline, and the stagger
- R-345: `max` and `gap`
- R-346: the other option errors, and `back`
- R-347: the coincident-ends error
- R-349: the positive-duration, pivot, borders and object errors
- R-350: `circle` and `terminator`
- R-351: fewer than 2 projections throws
- R-352: the non-polygon error
- R-355: a bad transform and a bad path command
- R-356: bars keyed by size
- R-360: a non-finite matrix, and bad `at`/`over`
- R-362: `span`, `label` and `basis`
- R-363: `step()`, nested `together`, and negative timing
- R-364: `pick` of a crossing outside a segment, and the pick range error
- R-365: `compass: false`, and the parallel, perpendicular and midpoint constructions
- R-366: the polygon, angle, tick and point errors (only `unit: 0` and `circle(a, a)` are asserted)
- R-368: `fade`, `circles` and `fill`
- R-369: note rendering, and `end` for a stack
- R-371: no script in any output, and byte determinism beyond `traffic` and `cartogram`

### Known bugs

Defects found while mapping the code. Each becomes a tracker ticket, and the Q-item that names the behavior is in RATIONALE.md.

#### Timeline and motion

- `packages/svjeez/src/motion.ts:222` `motion(initial)` stores `initial` without `checkValues`, so `motion({ x: NaN })` or `motion({ nope: 1 })` is accepted and fails later (or never).
- `packages/svjeez/src/motion.ts:33` `ease.bezier` accepts NaN and x1/x2 outside [0,1]; CSS discards such a `cubic-bezier`, so the transition would silently lose its ease.
- `packages/svjeez/src/recipes.ts:286` `sampled` drops a channel that is non-finite at t=0 and at every sample without an error (it filters `present` by finiteness); the first frame is then passed to `motion()` unfiltered, so `sampled(() => ({ x: NaN }))` yields `initial: { x: NaN }`.
- `packages/svjeez/src/params.ts:54` `check` does not reject a NaN `value`, `min` or `max` (all comparisons are false).
- `packages/svjeez/src/recipes.ts:126` `wiggle` with `period: 0` throws "to() needs a positive duration, got 0. Use set() for a cut." (a message about the wrong call); it should say `wiggle() needs a positive period`.
- `packages/svjeez/src/ease-at.ts:11` `easeAt(curve, NaN)` returns a tiny non-zero number (clamp passes NaN through `Math.min/max`), not 0 or an error.
- `packages/svjeez/src/keys.ts:66` `blend` (used by `valueAt`) holds colours and so disagrees with CSS during a colour transition (see Q-4).
- `packages/svjeez/src/properties.ts:44` `isProperty` is true for any `--x:y` string; `property()` is the only declaration site, so a hand-typed key throws "was never declared" only at first use, not at the literal.

#### Compile and output

- packages/svjeez/src/render.ts:100 `comment` is written as `<!-- ${comment} -->` unescaped; a comment containing `-->` ends the comment and writes live markup, and `--` makes the document not well-formed.
- packages/svjeez/src/validate.ts:101 id collection `/\bid="([^"]*)"/g` also matches `data-id="…"` (and any `…-id="…"`), so two elements with the same `data-id` make `render` throw `Duplicate id`.
- packages/svjeez/src/icon.tsx:66 the `transform` interpolates `x`, `y` and `scale` without `num`, so `x={0.1+0.2}` writes `translate(0.30000000000000004 1)` and `size={20}` on a 24 grid writes `scale(0.8333333333333334)`; `Picture` rounds the same values.
- packages/svjeez/src/render.ts:61 `reducedMotion: { at: NaN }` passes the clamp (`Math.min(NaN)` is NaN) and fails later with `Expected a finite number, received NaN`, which names no option; `duration` or `width` of `Infinity` pass the positive-number guards.
- packages/svjeez/src/picture.tsx:274 `symbols` keys the shared `<symbol>` by `PictureData` object identity, so the same bytes passed through `picture()` twice embed the data URI twice.
- packages/svjeez/src/validate.ts:23 `filteredAnimation` finds the base class with `/\.([A-Za-z][\w-]*)\{animation-duration/`; authored CSS that precedes the generated rules and has a rule starting `.x{animation-duration` takes the match, so the warning can look for the wrong class.

#### Geometry, fonts, ink and voxels

- `paths.ts:parse` (NUMBER regex, line ~19) and `ink/path.ts:tokens`: compact arc flags (`a5 5 0 1010 0`) are read as one number, so `matchPaths` throws `found 5 numbers after "a"` and `flatten` throws `needs 7 numbers`.
- `font/stroke.ts:decode`: `&#x110000;` (or any code point above U+10FFFF) in SVG font markup throws a raw `RangeError` from `String.fromCodePoint` instead of a named error.
- `spline.ts:locate`: a NaN position makes `cubics[NaN]` undefined and `point`, `tangent` and `angle` throw a `TypeError`.
- `paths.ts:blendPaths`: no check that `b` has as many numbers as `a`; a shorter `b` gives `NaN` and an unrelated `Expected a finite number` error from `num` (read from code).
- `font/subset.ts:kernTable`: `slice(0, 10000)` drops the pairs after the cap with no warning (read from code, not triggered).
- `font/font.ts:Font` constructor: the whole file is base64-encoded before the weight is validated, so a bad weight costs an encode (cosmetic).
- `font/shape.ts:typesetter.glyph`: `char.codePointAt(0)!` is undefined for `""`, so `Font.has("")` indexes the cmap with `undefined` (read from code, not run).

#### Layout and diagrams

- packages/svjeez/src/extras/diagrams/state.ts:178-192 duplicate-id check runs before the node's inner scope is built and `nodes.set` runs after, so `{a: {states: {a: ...}}}` shares one id silently (verified: no throw, the outer `a` overwrites the inner).
- packages/svjeez/src/extras/diagrams/state.ts:406 `walk(["a","zz"])` with an untyped id dereferences `nodes.get(b)!` and throws a TypeError ("undefined is not an object") instead of a named error.
- packages/svjeez/src/layout/layered.ts:863 (and layout/box.ts:20) a zero-node layout gives `Math.min()`/`Math.max()` of nothing: Infinity bounds; `flowchart({nodes: {}, edges: []})` returns NaN bounds (verified).
- packages/svjeez/src/layout/lanes.ts:86 a link whose `from` and `to` lane are the same gives `dir = 0`, so both points have one y and the arrow has zero length.
- packages/svjeez/src/extras/diagrams/state.ts (`home`) a transition from a composite to its own inner state is laid out as a self loop on the composite (verified, 20 samples).
- packages/svjeez/src/layout/lanes.ts:58 and layout/box.ts `union` use spread into `Math.max(...array)`/`Math.min(...array)`, which fails with a RangeError for very large arrays (tens of thousands of boxes).

#### Extras

- `src/extras/field.ts:213-231` with `src/extras/flow.ts:80` — `fieldFlow(lines, { style: "comet" })` throws "flow() needs a loop period past 1.66s … got 1.6582739214908042s." from float rounding: the behind piece's `at + over + lag*tail` equals the period mathematically but exceeds it by ~1e-16. Reproduced on 922 of 2800 synthetic line sets; the test only covers `dot`.
- `src/extras/morph.ts:127-128` — the overlap check `start < at[i-1] + over` throws spuriously on float sums: `morph([a,b,c], { at: [1.1, 1.9], over: 0.8 })` throws although the second transition starts exactly when the first ends.
- `src/extras/reveal.ts:98` — with default paragraphs, trailing blank lines become a final block that draws nothing but consumes a beat and extends `end` (`reveal(code("a\n\n"), { at: 0 })` gives two spans).
- `src/extras/reveal.ts:87` — `blocks: []` returns `end: -Infinity`.
- `src/extras/field.ts:365-367` — `slopeField` has no cap on mark count; a small `step`/`stepY` allocates millions of marks (axes caps ticks at MAX_TICKS, this does not).
- `src/extras/marker.ts:28-43` — `Marker` ignores the first stop's `during` and every stop's `over`; it never fades out (see Q-29).
- `src/extras/calculus.ts:688` — `readout` shows the first string from t=0 and holds the last forever (see Q-30).
- `src/extras/annotations.ts` — `Callout` with `columns <= 0` or empty text builds a degenerate box without a named error (no validation).

#### Frames, CLI, plugins and release

- `packages/svjeez/src/frames.ts:~253` `renderFrames(svg, {times: [], sheet: true})` computes `across = min(4, 0) = 0`, so the sheet size is NaN and the `deviceScaleFactor` is NaN (unverified at runtime: the probe could not import `playwright-core` outside the workspace); without `sheet` it silently returns no frames.
- `packages/vite/src/scene.ts:~63` `getScene(svgWithoutViewBox)` throws `TypeError: Cannot read properties of null` from the non-null assertion on the `viewBox` regex instead of a named error.
- `packages/vite/src/encode.ts:~16` the `quality = 0.82` default never applies (posters always pass 0.8) and differs from the documented 0.8; `open()` launches Chromium without the install guidance `frames.ts` gives.
- `packages/vite/src/assets.ts` / `scene.ts` `assets.files` and `posters.ts` `pending` only grow in a long dev session (every edit registers a new hash; nothing evicts).
- `.github/workflows/ci.yml` no `test:package` step for `packages/icons`.
- `scripts/release.ts:~85` `gh release list --limit 1000` silently truncates; a package whose tag falls outside the newest 1000 releases would be republished to GitHub and fail.
- `packages/svjeez/src/page.ts` `loopLength` returns `longest/1000` silently when no common period is found in 1000 multiples; `count` frame spacing and video length then do not cover a true loop.
- `scripts/package-manifest.ts:~38` only `dependencies` get `workspace:` rewritten; a `workspace:` range in `peerDependencies` or `optionalDependencies` would be published verbatim (no package does that today).
- `packages/svjeez/scripts/node-check.ts` accepts a scene with no animation, while `tests/skill.test.ts` requires `@keyframes`; the two checks of the same examples disagree.

#### Live editor

- packages/live/src/editor.ts:351-357 `select` stores any key as `selected` without checking it is a value; state reports a selection that names nothing until the next `read`.
- packages/live/src/editor.ts:376 a failed compile of stale text sets `error` on the current state; a later success clears it, but for that interval the panel shows an error for an older file.
- packages/live/src/editor.ts:367-374 `seek` does not clamp `at`; a negative `at` while paused gives a negative clock time passed to `restyle`.
- packages/live/src/source.ts:633-641 `write` for `string`/`color` re-quotes without escaping: a choice option containing the quote character, a backslash or a newline writes invalid source.
- packages/live/src/source.ts:617-626 `easeText` throws for an `Ease` that is not named or a bezier; `update` "set" does not catch it, so `send` throws out of the store.
- packages/live/src/editor.ts:295 `measures` rebuilds the older literal with `parse(text)` on every probe result; a parse of a large file per `probed` message (performance only).
- packages/react/test/editor.test.ts:7-8 the screenshot directory is a literal path under a previous session's scratchpad; the test writes PNGs outside the repo and breaks on another machine.
- packages/live/src/client.ts `createCompiler`: a timeout settles every owed job, including a job sent to the stuck worker after the stuck one; documented, but a short job queued behind an endless one fails as well.

#### Charts, code, fonts, icons and Mermaid

- packages/charts/src/series.ts (bars, `.filter((key) => key in values)`) uses `in`, so a category named like an `Object.prototype` member (`constructor`, `toString`) is treated as present and its inherited function becomes a `NaN` bar height; use `Object.hasOwn`.
- packages/charts/src/chart.ts (data check) band `data` keys are never checked against `x.domain` in `chart()`, so a stray key only fails later in a series (and is ignored for fitting nothing). See Q-57.
- packages/charts/src/chart.ts (band `format` and `font`) band tick labels use `xs.format ?? String`, but no label collision/overflow handling exists; long categories overlap silently (design gap, not asserted anywhere).
- packages/code/src/index.ts (expandTabs) counts columns with `out.length` (UTF-16 units), so a line containing an astral character before a tab misaligns by one column against `code()`'s one-column-per-character layout.
- packages/fonts/src/index.ts (slug) `Open Sans` and `Open-Sans`/`Open_Sans` map to one cache file name, so two different family strings can collide in the cache.
- packages/fonts/src/index.ts (bytesOf) a cached file is trusted without validation; a torn file from an older tool or a corrupt TTF fails inside `font()` with no cache-file hint.
- packages/fonts/test/google.test.ts ("a real load…", "an unknown family…") require live network; CI without network fails them.

#### Maps and math

- packages/math/src/construct.ts:536-541 `cross()` checks segment bounds on every crossing, so `pick` cannot choose the in-range crossing of a segment/circle pair (verified: segment (0,0)-(10,0) with circle about (9,0) r 3, `pick: 0` throws about (12,0)).
- packages/math/src/construct.ts:944 `points.filter((_, i) => i >= 0)` is a no-op; `anchors` equals `points`.
- packages/geo/src/morph.ts:~315 `toBars()` with `top: 0` (or a negative `top`) reaches `biggest[0]![1]` on an empty list and throws a TypeError instead of a named error.
- packages/geo/src/index.ts:338-343 `route()` reports "crosses the edge of the map" when the arc is clipped entirely (0 pieces) as well as when it is cut (2+ pieces).
- packages/geo/src/index.ts:~315 `dots(step)` with `step <= 0` or non-finite yields `rows = 0` or Infinity (Array.from length error / hang) with no message.
- packages/math/src/plane.ts:191-195 `lines()` builds `Array.from({ length: floor(hi/step) - ceil(lo/step) + 1 })`; an extent range with `hi < lo` gives a negative length and a raw RangeError.
- packages/math/src/counter.ts:~170 `visibleAtStart` shows the first value from t=0 even when `list[0].at > 0`; docs say a value holds "from `at`" (the number is visible before its first time).

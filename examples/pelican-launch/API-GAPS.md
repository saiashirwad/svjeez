# API gaps found while making the Claude Pelican 1 film

Each entry says what the film needed and what changed in svjeez. The example scenes in this folder use the fixed APIs; there are no raw SVG strings left in `textures.tsx`.

## Fixed in this branch

| # | Gap | Fix |
|---|---|---|
| 1 | No noise or texture paint; paper, plumage and stains were raw `feTurbulence` strings in `picture()` | `noise({ frequency, seed, ramp, octaves?, type?, stitch? })` paint. `frequency` animates (SMIL on `baseFrequency`); ramp stops take tokens and alpha. |
| 2 | No lighting; lace, glaze and paper tooth couldn't read as raised | `emboss({ light?, depth?, radius?, color?, specular? })` effect, lighting the node's own alpha. |
| 3 | `origin` couldn't name the node's own `[0, 0]`; an offset + scale group flew off-screen | `origin: "own"` and `{ own: [x, y] }`. SKILL.md now says `{ frame }` is in the parent's coordinates. |
| 4 | Keys from two `.map()` lists in one parent collided | Lists may reuse keys, React-style. Written keys stay as written; only a real collision gets an internal name, and an ambiguous `part(key)` throws naming the candidates. Across morph states the internal name is chosen over all states at once, so a list's node pairs with itself. |
| 5 | `dash` with `draw` | **My report was wrong:** dashed `draw`/`trim` already worked. The real gap was `dashOffset` with `draw`/`trim`, which now works too. |
| 6 | Rigs solved the pose once per limb | `sampled.all(fn, span, options)` calls `fn` once per time and returns a record of tracks, each simplified on its own. |
| 7 | No "unpainted" value | `none` paint: a node with nothing to paint is dropped at build time, without a warning. |
| 8 | `rect()` is corner-anchored while round builders are centered | `rect(w, h, { anchor: "center" })`, and JSDoc on all three builders says where their origin is. |
| 9 | Texture took a clip group + picture + extra shapes per part | Layered paints: `fill={[paint, { paint: noise(...), blend: "multiply", opacity }]}`. |
| 10 | `alpha(c, 0)` returned transparent black, so a gradient to it greyed through the middle | Fully transparent results keep the color: `alpha("#FFFDF8", 0)` is `#fffdf800`. |
| 11 | `Stops` type wasn't exported | Exported from `svjeez`. |
| 12 | Feather grain couldn't run along a limb, so the neck and arm clipped a rotated noise rect | `noise({ rotate })` turns the noise field about the box center; the shape stays put. |
| 13 | `emboss` lit the whole node, so the cold-press tooth was a second shape | Layer entries take `effects`: `{ paint: noise(...), effects: [emboss()] }`. |
| 14 | Ramp color space was undocumented | The `ramp` JSDoc says stops blend in sRGB, unlike raw `feTurbulence` (linearRGB). |
| 15 | Radial gradients were circles only; vignettes scaled a circle in a group | `radial({ radius: [rx, ry] })` and `radial.across({ shape: "ellipse" })`. |

## Still open (found while building the film's shots)

Bugs, worst first:

- **Source Serif 4 isn't subset.** `<Text font={serif}>Hi</Text>` embeds ~259 KB of font, while JetBrains Mono subsets to ~1.5 KB. Every shot preview with a `Caption` lands at 300–580 KB because of it; the film pays it once.
- **`emboss` goes dark inside a mirrored group.** `<Group scale={[-1, 1]} origin="own" effects={[emboss()]}>` lights the content as if from behind. The lace shot puts the emboss on an unflipped outer group.
- **`blend` on a `Shape` inside a clipped `Group` doesn't blend with what's behind.** `<Group clip={...}><Shape blend="multiply" fill={noise(...)} /></Group>` comes out opaque; the blend has to sit on the clipped group.
- **`motion={{ scale }}` with `origin` drifts.** `<Group origin={[W / 2, H / 2]} motion={{ scale: track(1.02).to(1.05, …), offset: … }}>` moved content ~20 px more than the scale explains, exposing the paper edge.
- **`draw` starting at 0 leaves a dot.** Any stroked shape with `draw={track(0).to(1, …)}` shows a one-pixel dot at t = 0.

Missing API:

- **Animated blur.** `blur(track(3).to(0, …))` is a `moving-filter`, so "drawing comes into focus" means crossfading a blurred and a sharp copy, doubling the pelican's weight.
- **Texture on a rotating shape.** A `noise()` fill inside a rotating group re-renders every frame, so the vase's clay, the sun's surface and the hills keep their texture still while the painted parts turn. A noise paint with `rotate` animatable in the shape's own frame (or a cached texture) would fix it.
- **Pattern along a path.** `stroke={{ color: pattern(...) }}` tiles in straight space; the Greek key band bends each unit onto the arc by hand.
- **Layered paints repeat geometry.** Each layer writes the whole path again instead of a `<use>`; on large `merge(...)` paths that doubles the bytes.
- **Fill rule.** No `<Shape rule="evenodd">`; rings use `subtract(circle(a), circle(b))`.
- **`<Text anchor="baseline-center">`** is rejected (only `baseline-left`, `baseline`, `baseline-right`).
- **`typed()`** takes one style and one line: coloured code needs `<Code typing>`, and streamed multi-line text is one `<Text>` per line.
- **Video can't render `<Shader>`.** Out of scope here (the film is SVG only).

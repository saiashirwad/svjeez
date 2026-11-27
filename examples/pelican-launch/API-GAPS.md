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

## Still open

- **Video can't render `<Shader>`.** Out of scope here (the film is SVG only).

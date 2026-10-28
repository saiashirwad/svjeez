# Equations with @svjeez/math

`@svjeez/math` is a separate package: `npm i -D @svjeez/math`. `tex()` typesets TeX with MathJax while the scene compiles and returns one `<path>` per glyph, in scene pixels. The SVG carries no font and no script.

```tsx
import { tex } from "@svjeez/math";
import { render } from "svjeez";
import { Brace, morph } from "svjeez/extras";
import { css, theme } from "./style";

const at = { x: 40, y: 80, fontSize: 40, theme };
const square = tex(String.raw`(a+b)^2`, at);
const expanded = tex(String.raw`a^2 + \cssId{mid}{2ab} + b^2`, at);
const m = morph([square, expanded, square], { at: [1.5, 4], over: 1 });

<>
  {m.node}
  <Brace target={expanded.get("mid")} side="below" label="cross term" fontSize={18} during={{ at: 2.5, over: 1.5 }} />
</>;
```

- `x` and `y` are the top-left of the formula's box. `anchor: [0.5, 0.5]` puts its center there instead, which suits a label on a side or inside an area. `fontSize` is the pixels in one em, default 32. `theme` paints the formula with its `plain` color, and `color` overrides that. `display: false` sets inline style.
- `.node` draws the formula. `.write({ at, over })` writes it on glyph by glyph, each outline drawing and then filling, and it stays once written. `.bounds`, `.width` and `.height` give its box.
- `.get("mid")` is the box of everything wrapped in `\cssId{mid}{…}`. `.find("2ab")` is the box of consecutive glyphs that spell it, and `.find("2", 2)` takes the second match. Both return a `Rect` for `Brace` (give its label a `fontSize` to match the formula), `Underline`, `Callout`, `Marker`, `Focus` and `Camera`.
- `.words` lists the glyphs and bars in reading order. A glyph has `char`, `size`, `d`, `matrix`, `fill`, `bounds` and the `text`, `x`, `y` and `id` that `morph()` uses.

## Equation transforms

`morph()` takes any `tex()` formulas. A glyph carries over when the next version has the same character at the same size, and moves to its new place. Everything else fades: glyphs only in the old version fade out and glyphs only in the new version fade in. `morph` translates and cannot scale, so a superscript `2` never pairs with a full-size `2`, and a fraction bar pairs only with a bar of the same length.

- Place every version at the same `x` and `y`, so a glyph's move is the move in the algebra.
- To write a formula and then morph it, cut from `write()` to `morph().node` at one instant after the writing ends. Both draw the same glyphs in the same places, so the cut does not show.
- Wrap a part in `\cssId{name}{…}` in both versions to pair it by name, even when its glyphs change. Pieces under an id also give you `get(name)`.
- `gutter` is for `code()`. It is a type error with formulas.
- Bold, italic and upright forms of one letter share a key, so `\mathbf{a}` can pair with `a` and jump in shape. Name both with the same `\cssId` instead.

`\color{red}{x}` paints the part it wraps. Everything else takes the theme.

## Planes and transformations

`plane()` draws a coordinate grid that moves, as in 3Blue1Brown's linear algebra videos. `origin` is where (0, 0) sits in scene pixels, `unit` is pixels per unit, and y points up. `extent` is how far the grid reaches: a number for ±n on both axes, or `{ x: [lo, hi], y: [lo, hi] }`. `step` spaces the lines, default 1.

```tsx
import { plane } from "@svjeez/math";
import { css, enter, render } from "svjeez";

const p = plane({ origin: { x: 160, y: 240 }, unit: 34, extent: 10, theme })
  .apply([[2, -1], [1, 1]], { at: 2, over: 2.5 })
  .reset({ at: 6, over: 1.5 });

render({ ..., css: css`${p.css}` },
  <>
    {p.background}
    <g animation={enter({ at: 0.3, over: 0.8 })}>{p.grid}{p.axes}</g>
    {p.polygon([[0, 0], [1, 0], [1, 1], [0, 1]])}
    {p.basis({ enter: { at: 1, over: 0.5 } })}
  </>);
```

- Steps chain, and each returns a new plane. Draw everything from the last one. `apply(matrix, { at, over, ease })` moves the plane by a matrix written by rows, as on paper: `[[a, b], [c, d]]` sends (x, y) to (ax + by, cx + dy), and a third number in a row translates. Each step applies on top of the steps before it. `reset()` moves every point home. `ease` defaults to `ease.inOut`. Steps must not overlap.
- Pass `p.css` to `render`'s `css`. Without it the matrix steps do not move anything.
- `background` is the grid as it was, and it stays put. `grid` is the moving lines without the axes, and `axes` is the two axes.
- `vector(to, { color, width, label, from, enter })` draws an arrow. Its head stays a proper arrowhead however the plane shears, and its label stays just past the tip, turned off the arrow's line. `label` is TeX source or a `tex()` formula. `enter` grows the shaft over the span, then shows the head and label. `basis()` draws î and ĵ.
- `polygon(points)` fills a shape whose corners move with the plane, so the unit square's area shows the determinant. `span(direction)` is the line through the origin along a vector: an eigenvector's line stays on itself.
- `label(at, content)` centers TeX, a `tex()` formula or a node on a point of the plane and moves it with the point.
- `point(x, y)` is the scene pixels of a point before any step, and `map(x, y)` is where it ends after every step.

When every step is a matrix, the scene carries one CSS transform driven by registered properties. Lines keep their width with `vector-effect: non-scaling-stroke`, and the file stays small. `applyFunction((x, y) => [x2, y2], { at, over })` moves every point p to f(p) along a straight line. A complex map is the same thing: z ↦ z² is `(x, y) => [x * x - y * y, 2 * x * y]`. Once a plane has a function step, every outline is sampled densely enough to stay smooth and morphs through `d`, so the grid costs a few KB per step. Keep its `extent` to the region the scene shows.

## Errors

| Error | Fix |
| --- | --- |
| `tex() could not parse "…": …` | The message after the colon is MathJax's. Fix the TeX. Unknown macros are errors here, not red text. |
| `tex() cannot draw "…" in "…": the MathJax font has no glyph for it.` | The character is outside MathJax's font: accents, emoji, CJK. Use TeX, as in `\'e`, or draw the text with `<text>`. |
| `tex() cannot draw a <svg> element in "…"` | `\overbrace` and `\underbrace` are built from clipped pieces this package cannot place. Draw a `<Brace>` under the part instead. |
| `tex() could not read the box MathJax drew for …` | `\tag` draws a full-width table. Leave the number out and draw it as text. |
| `tex.get() found no part named "…".` | Wrap the part in `\cssId{name}{…}`. |
| `tex.find() found … of "…", not ….` | The text spells nothing, or fewer matches, among consecutive glyphs. Fractions list the numerator, the denominator, then the bar. |
| `tex() needs finite coordinates and anchor and a positive fontSize, got …` | Pass numbers. |
| `tex.write() needs a non-negative span and a positive stroke time, got …` | Pass `over` of 0 or more and `stroke` above 0. |
| `morph() draws a gutter only for code() versions.` | Drop `gutter`. |
| `A plane step starts at …s, before the previous step ends at …s.` | Start each step after the one before it ends. |
| `A plane step needs a non-negative start and a positive length, got …` | Pass `at` of 0 or more and `over` above 0. |
| `plane() needs a finite origin and a positive unit and step, got …` | Pass numbers. |
| `plane.apply() needs finite numbers in its matrix, got …` | Every entry must be a finite number. |
| `plane.applyFunction() sent (…, …) to (…, …), which is not a finite point.` | The function divides by zero or overflows somewhere on the grid. Shrink `extent` to avoid that point, or guard the function. |
| `plane.vector() needs a finite arrow of nonzero length, from … to …` | Give the arrow a tip different from its tail. |
| `plane.span() needs a nonzero direction, got …` | Pass a nonzero vector. |

In Bun, a non-ASCII character in `String.raw` arrives as a `\u{…}` escape. Write such characters in a plain string, or as TeX.

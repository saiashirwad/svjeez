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

## Constructions

`construct()` draws compass-and-straightedge geometry in the order you write it. Build the figure on the builder, then render `g.node`. Every element draws on in turn: compass circles sweep from the point they pass through, lines grow from their first point, points pop and labels fade in.

```tsx
import { construct } from "@svjeez/math";

const g = construct({ theme, at: { x: 200, y: 300 } }); // origin in px, y grows up
const A = g.point(0, 0, "A");
const B = g.point(170, 0, "B");
g.segment(A, B);

const C = g.intersect(g.circle(A, B, { aid: true }), g.circle(B, A, { aid: true }), {
  pick: 0,
  label: "C",
});

g.settle(); // the compass circles fade back to faint
g.polygon([A, B, C]);
g.angle(B, A, C, { label: "60^\\circ" });

<>{g.node}</>;
```

- `construct({ theme, unit, at, fontSize, start, pace, faint })`. `unit` is pixels per unit and `at` is where the origin sits in the scene. Coordinates have y up. `pace` overrides the seconds each kind of element takes.
- `point(x, y, label?)`, `segment(a, b)`, `line(a, b)` (runs past both points, grows outward from `a`), `circle(center, through)` or `circle(center, { radius })`. A circle takes `arc: { from, to }` in degrees to draw only an arc.
- `intersect(a, b)` of two lines gives one point. Of a line and a circle, or two circles, it gives `[p, q]`, and `{ pick: 0 | 1 }` keeps one. A line and a circle give crossings in the order along the line. Two circles give the crossing left of the line from center 1 to center 2 first. Intersections count a segment only between its ends and a `line()` as endless.
- `midpoint`, `parallel(line, p)`, `perpendicular(line, p)`, `perpendicularBisector(a, b)` and `angleBisector(a, b, c)`, the angle at `b`. The two bisectors draw the compass arcs that find them, as aids. `{ compass: false }` draws only the result.
- `polygon(points, { fill, opacity, outline, label })`, `angle(a, b, c, { label, count, mark })` (a square at a right angle, an arc otherwise) and `tick(segment, { count })` for congruence marks.
- Labels are `tex()` formulas. Each sits off its point, away from the lines and circles that meet there, and away from the figure's center when nothing does. Segment and line labels sit beside the middle on the outer side.
- Every element takes `at` and `over`, `color`, and `aid`. Without `at` it starts when the one before it ends. `together(() => { … })` starts what it holds at once. `step(pause?)` waits and returns when the next beat starts, as does reading `g.time`. `g.end` is when the last element finishes, so `duration` can follow it.
- `settle()` fades every aid made so far, to `faint` opacity. Mark compass arcs and helper points with `aid: true`.

Time the text beside the figure from `g.time`, read before the elements it explains. `examples/construct/index.tsx` does so with `tex().write()`.

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
| `intersect() found no crossing of … and …. …` | The circles do not meet or the lines are parallel. Raise a radius, move a center, or change a line. |
| `intersect() crossing (…, …) lies past the end of segment ….` | The crossing is off the segment. Draw it with `g.line()` so it runs on. |
| `intersect() pick is 0 or 1, got ….` | Pass 0 or 1. |
| `circle() needs a positive radius, got ….` | Pass a point other than the center, or `{ radius }` above 0. |
| `A line needs two different points, got … twice.` | Pass two points that are not at the same place. |
| `construct() needs a positive unit and fontSize and a finite origin, got …` | Pass numbers above 0 and a finite `at`. |
| `angle() needs the vertex in the middle and two other points, got …` | Pass `(a, vertex, c)` with distinct points. The same goes for `angleBisector()`. |
| `polygon() needs at least three points, got ….` | Pass three or more corners. |
| `together() cannot nest. Put the elements in one together() block.` | Flatten the blocks. |

In Bun, a non-ASCII character in `String.raw` arrives as a `\u{…}` escape. Write such characters in a plain string, or as TeX.

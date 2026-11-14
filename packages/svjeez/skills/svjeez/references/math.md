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

## Epicycles

`epicycles(outline, { at, over })` draws any closed outline as circles spinning on the tips of circles, with a pen at the last tip and the trace drawn in step with it. It samples the outline by arc length and Fourier-transforms it while the scene compiles.

```tsx
import { epicycles, tex } from "@svjeez/math";

const pi = tex(String.raw`\pi`, { fontSize: 400, theme });
const e = epicycles(pi.words, { at: 0.8, over: 10, size: 360, center: [480, 270], fill: tint(theme, "blue") });

<>{e.node}</>;
```

- The outline is path data, a `tex()` glyph, a list of glyphs or path strings, or a list of `[x, y]` points. Pass the glyph itself, not its `d`: the glyph's `matrix` turns the font's upright path to the screen's. Several outlines, such as a word, join into one loop with straight bridges, and the bridges show in the trace.
- Path data takes `M L H V C S Q T Z`, absolute or relative. Arcs are not read.
- `terms` is the number of circles in the chain, default 80, and the trace uses all of them. `circles` is how many of the largest draw their ring and arm, default 24. The rest are too small to see but still move the pen.
- `center` is where the middle of the outline's box goes, and `size` scales its longer side to that many pixels. `fill` fades in once the pen has closed the outline.
- `fade` is how long the rings take to fade after the pen is done, 0.6 by default. `0` leaves them. The result has `node`, `end` (when the rings have gone) and `d` (the trace as closed path data).
- Each circle is one two-keyframe rotation on a group nested in the last, and the trace is a `draw` track sampled from its own arc length. A 10 second scene with 80 terms is about 90 KB.

`fourier(outline, { samples, terms })` is the series `epicycles()` draws, for drawing it some other way: as a formula, a spectrum, or circles of your own. It takes the same outlines and returns `{ mean, terms, points }`, where each term `{ k, r, phase }` turns `k` times per loop and `terms` runs largest first. The pen at `s` of a loop is `mean` plus the sum of `r·(cos, sin)(2πks + phase)`. `samples` defaults to 1024 and must be even; `terms` defaults to all of them.

## Derivations

`derive(steps, { at })` shows a step-by-step derivation. Every line sits with its `=` on one x, so the equals sign stays put while the sides change.

```tsx
const d = derive(
  [
    String.raw`2x + 4 = 10`,
    { tex: String.raw`x + 2 = 5`, note: String.raw`\div 2 \text{ both sides}` },
    { tex: String.raw`x = 3`, note: String.raw`- 2 \text{ both sides}` },
  ],
  { at: 0.5, every: 2.5, x: 320, y: 120, fontSize: 36, stack: true, theme },
);
```

- By default one line transforms into the next with `morph()`, so glyphs the lines share slide into place and the rest fade. Wrap a part in `\cssId{name}{…}` in both lines to pair it by name. With `stack: true` every line stays and each new one fades in below, `lineHeight` pixels lower.
- `align` is what the lines line up on: `"="`, the first equals sign, or the id of a `\cssId` in each line. `x` is where that point sits.
- A step's `note` is TeX set small beside the line after an arrow, such as `\div 2 \text{ both sides}`. In place it fades with the next change, and in a stack it stays.
- `every` is the time from one change to the next, default 2.5, and `over` is how long a change takes, default 0.9. The result has `node`, `end`, `lines` (every line as a `tex()`, aligned) and `bounds`.

## Counters

`counter(values, { x, y })` is a number that changes over time, typeset with the same glyphs as `tex()`.

```tsx
const r = counter(
  [{ at: 0, value: 1 }, { at: 3, value: 3.14 }],
  { x: 100, y: 80, fontSize: 48, digits: 2, theme },
);
const counting = counter((t) => 144 * Math.min(1, t / 3), { duration: 10, step: 0.05, x: 100, y: 200 });
```

- A list of `{ at, value }` holds each value until the next. A function is read every `step` seconds, 0.1 by default, up to `duration`.
- `digits` is the decimal places. Places stay put at the widest value, right-aligned on the decimal point, with a sign place only if a value is negative.
- Digits cut by default. `roll` seconds makes the old digit lift out as the new one rolls in from below. The changes must be at least `roll` apart.
- Each place holds one glyph per distinct digit it ever shows, toggled by stepped keyframes, so a number that changes every tenth of a second for ten seconds is still a few dozen paths. `width` and `height` give the box.
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
| `epicycles() needs a finite start and a positive duration, got …` | Pass numbers: `over` above 0. |
| `epicycles() needs 1 to … terms, a non-negative number of circles and fade, got …` | Lower `terms`, and pass `circles` and `fade` of 0 or more. |
| `epicycles() cannot read a "…" path command. …` | Arcs are not read. Write the outline with lines and curves, or pass points. |
| `epicycles() needs an outline with at least three points.` / `…with some length.` | The path is empty or a single point. |
| `derive() found no "=" in step …` | Put an equals sign in every step, or pass `align` as the `\cssId` id in each. |
| `derive() needs a step, a positive over that fits in every, …` | Pass at least one step, `over` above 0 and `every` at least `over`. |
| `counter() needs at least one value, each with a finite time and number.` | Pass values with finite `at` and `value`. |
| `counter() of a function needs a positive duration and step, …` | Pass `duration`, and a positive `step`. |
| `counter() needs a whole number of digits, a positive fontSize and a non-negative roll, …` | Pass whole `digits` and `roll` of 0 or more. |
| `counter() changes faster than its roll of … seconds.` | Lower `roll` or space the changes out. |
| `intersect() found no crossing of … and …. …` | The circles do not meet or the lines are parallel. Raise a radius, move a center, or change a line. |
| `intersect() crossing (…, …) lies past the end of segment ….` | The crossing is off the segment. Draw it with `g.line()` so it runs on. |
| `intersect() pick is 0 or 1, got ….` | Pass 0 or 1. |
| `circle() needs a positive radius, got ….` | Pass a point other than the center, or `{ radius }` above 0. |
| `A line needs two different points, got … twice.` | Pass two points that are not at the same place. |
| `construct() needs a positive unit and fontSize and a finite origin, got …` | Pass numbers above 0 and a finite `at`. |
| `angle() needs the vertex in the middle and two other points, got …` | Pass `(a, vertex, c)` with distinct points. The same goes for `angleBisector()`. |
| `polygon() needs at least three points, got ….` | Pass three or more corners. |
| `together() cannot nest. Put the elements in one together() block.` | Flatten the blocks. |
| `A plane step starts at …s, before the previous step ends at …s.` | Start each step after the one before it ends. |
| `A plane step needs a non-negative start and a positive length, got …` | Pass `at` of 0 or more and `over` above 0. |
| `plane() needs a finite origin and a positive unit and step, got …` | Pass numbers. |
| `plane.apply() needs finite numbers in its matrix, got …` | Every entry must be a finite number. |
| `plane.applyFunction() sent (…, …) to (…, …), which is not a finite point.` | The function divides by zero or overflows somewhere on the grid. Shrink `extent` to avoid that point, or guard the function. |
| `plane.vector() needs a finite arrow of nonzero length, from … to …` | Give the arrow a tip different from its tail. |
| `plane.span() needs a nonzero direction, got …` | Pass a nonzero vector. |

In Bun, a non-ASCII character in `String.raw` arrives as a `\u{…}` escape. Write such characters in a plain string, or as TeX.

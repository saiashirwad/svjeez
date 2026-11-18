# Math

`@svjeez/math` (`npm i @svjeez/math@next`) typesets TeX into glyph outlines while the scene builds, and draws plots, constructions and plane transformations as geometry. Every piece is a node or a geometry value, so tracks, `morph`, refs, `trim`, layout and `check` work on it as on anything else.

```tsx
import { Tex } from "@svjeez/math";

const square = String.raw`(\textcolor{a}{a}+\textcolor{b}{b})^2`;
const expanded = String.raw`\textcolor{a}{a^2} + \cssId{cross}{2\textcolor{a}{a}\textcolor{b}{b}} + \textcolor{b}{b^2}`;
const colors = { a: theme.blue, b: theme.magenta };

morph(
  <Tex size={60} at={[48, 280]} fill={theme.text} colors={colors}>{square}</Tex>,
  <Tex size={60} at={[48, 280]} fill={theme.text} colors={colors}>{expanded}</Tex>,
  span(2.2, 1),
);
```

The math example scene in the svjeez repository puts this beside a plot and a brace on the cross term.

## `<Tex>`

- The TeX source is the child, as a string: `{String.raw\`\\frac{a}{b}\`}`. JSX text doesn't keep backslashes or braces, so always wrap it in `{…}`.
- `size` is pixels per em and `fill` paints every glyph; both are required, as on `<Text>`. `display={false}` sets inline style (smaller fractions and limits beside operators).
- `at` and `anchor` place the formula's box: `"top-left"` (default), any place, `[u, v]` fractions, or `"baseline-left"`, `"baseline"`, `"baseline-right"` to sit on a line with `<Text>`.
- Color with `\textcolor{name}{…}` and `colors={{ name: theme.blue }}`, so a formula follows light and dark; `\textcolor{#RRGGBB}{…}` is one color in both. `\color{name}` colors everything after it in its group, as in TeX.
- Each glyph is a `<Shape>` keyed by what it is: `a`, then `a#2` for the second `a`, `+`, `rule` for a fraction bar. `morph()` between two `<Tex>` moves the glyphs both share, and fades the rest in and out.
- `\cssId{name}{…}` makes a part: a `<Group>` keyed `name` around those glyphs. With `ref={eq}` on the `<Tex>`, `eq.part("name")` gives its anchors for `<Align to>`, `<Arrow>` and timelines. A glyph inside a part has another key path than one outside, so it enters rather than moves across a morph.
- `write={span}` draws each glyph's outline in reading order across the span, then fills it.
- `Tex.measure(source, { size, display, anchor })` gives the box, `baseline` and `part(name)` boxes relative to `at`, to size a `brace()` or place a label before the scene lays out.

## Planes

`plane({ x: [min, max], y: [min, max], size: [width, height] })` maps math coordinates into a frame whose top-left is `[0, 0]` and whose y goes up. Put what you draw on it in one `<Group offset={…}>`, so the plane's `[0, 0]` lands there. `<Axes at>` does the same.

| Call | Gives |
| --- | --- |
| `p.point([x, y])` | the pixel point, for `at` and arrows |
| `p.plot(f, { from, to, samples })` | the curve, split where it leaves the y range |
| `p.parametric(f, [t0, t1])`, `p.segment(a, b)`, `p.polygon(points)` | curves and outlines in plane coordinates |
| `p.area(f, { from, to, base })` | the region between `f` and `base` (a number or a function) |
| `p.riemann(f, { from, to, n, rule })` | `{ bars, sum }`: one `{ key, geometry, height }` per bar, keyed by its left edge |
| `p.slope(f, x)`, `p.tangent(f, x, { length })`, `p.secant(f, x, h, { length })` | slopes and lines `length` pixels long through `(x, f(x))` |
| `p.vector(to, { from, width, head })` | an arrow as one filled outline |
| `p.grid(step)`, `p.axes()` | the grid and axis lines |
| `p.transform(map, amount)` | the same plane with every point moved `amount` of the way to `map`, a 2×2 matrix or `([x, y]) => [x, y]` |
| `<Axes plane stroke ticks grid labels>` | axes, ticks, an optional grid and numbers (`labels={{ font, size, fill }}`) |

Every call returns geometry, so the scene styles and moves it:

```tsx
const amount = track(0).to(1, span(2, 2), ease.inOut).rewind(1.5);

<Group offset={[40, 70]} clip={rect(400, 400)}>
  <Shape geometry={amount.map((t) => p.transform([[3, 1], [0, 2]], t).grid(1))} stroke={{ color: theme.border }} />
  <Shape geometry={amount.map((t) => p.transform([[3, 1], [0, 2]], t).vector([1, 0]))} fill={theme.yellow} />
</Group>
```

- A derived geometry must keep its number of points: map a track through `transform()`, `tangent()`, `secant()` or a `plot()` that stays inside the y range. A matrix moves straight lines, so it costs four keys; a function bends lines and costs more.
- Morph Riemann sums with `morph.between` over states that map `bars` to keyed `<Shape>`s: halving `n` keeps every other key, so old bars narrow and new ones enter.
- Clip a transformed grid with `clip={rect(width, height)}` on its group.

## Constructions

Pure functions of points, for compass-and-straightedge figures:

| Call | Gives |
| --- | --- |
| `crossings(circle, circleOrLine)` | where a circle (`{ center, radius }`) meets another or a line `[a, b]`: zero to two points |
| `meet([a, b], [c, d])`, `foot(p, a, b)`, `bisect(from, vertex, to)`, `midpoint`, `extend`, `distance` | points on lines |
| `compass(center, through, { sweep })` | a circle that starts at `through`, so `trim={draw(span)}` swings from it |
| `angle(from, vertex, to, { radius })`, `rightAngle(…, { size })`, `ticks(a, b, { count })` | angle arcs, square corners and equal-length marks |
| `brace(width, { height })` | a curly brace pointing down, `[0, 0]` at its top-left; stroke it |

## Errors

| Message | Fix |
| --- | --- |
| `<Tex> can't read "…": …` | the TeX has a mistake; the message after the colon is MathJax's |
| `<Tex> colors part of "…" with \color{…}, which its colors don't name.` | add that name to `colors`, or use a hex color |
| `<Tex> can't draw "…": a stretched symbol in it is built from pieces it can't cut.` | write it without that stretchy command |
| `<Tex> names two parts "…"` | one `\cssId` per name |
| `Tex.measure() found no part "…"` | wrap the part in `\cssId{name}{…}` |
| `plot() draws nothing: …` | widen the plane's y range or the x span |
| `A plane's transform sent […] to […], which is not a point.` | keep the map finite over the plane |
| `geometry on <Shape> is derived to values of different shapes over time …` | a derived plot left the y range somewhere: widen it |

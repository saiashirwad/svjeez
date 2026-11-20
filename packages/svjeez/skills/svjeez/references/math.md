# Math

`@svjeez/math` (`npm i @svjeez/math@next`) typesets TeX into glyph outlines while the scene builds, and draws plots, constructions and plane transformations as geometry. Every piece is a node or a geometry value, so tracks, `morph`, refs, `draw`, layout and `check` work on it as on anything else.

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

The repository's `examples/math` puts this beside a plot and a brace on the cross term.

## `<Tex>`

- The TeX source is the child, as a string: ``{String.raw`\frac{a}{b}`}``. JSX text doesn't keep backslashes or braces, so always wrap it in `{…}`.
- `size` is pixels per em and `fill` paints every glyph; both are required, as on `<Text>`. `display={false}` sets inline style (smaller fractions and limits beside operators).
- `at` and `anchor` place the formula's box: `"top-left"` (default), any place, `[u, v]` fractions, or `"baseline-left"`, `"baseline"`, `"baseline-right"` to sit on a line with `<Text>`.
- Color with `\textcolor{name}{…}` and `colors={{ name: theme.blue }}`, so a formula follows light and dark; `\textcolor{#RRGGBB}{…}` is one color in both. `\color{name}` colors everything after it in its group, as in TeX.
- Each glyph is a `<Shape>` keyed by what it is: `a`, then `a#2` for the second `a`, `+`, `rule` for a fraction bar. `morph()` between two `<Tex>` moves the glyphs both share, and fades the rest in and out.
- `\cssId{name}{…}` makes a part: a `<Group>` keyed `name` around those glyphs. With `ref={eq}` on the `<Tex>`, `eq.part("name")` gives its anchors for `<Align to>` and `<Arrow>`. A glyph inside a part has another key path than one outside, so it enters rather than moves across a morph.
- `draw` is 0 to 1, a number or a track: each glyph strokes on, then fills, in reading order (each takes 0.6 of the draw, staggered over the rest).
- `Tex.measure(source, { size, display, anchor })` gives the box, `baseline` and `part(name)` boxes relative to `at`, to size a `brace()` or place a label before the scene lays out.

## Planes

`plane({ x: [min, max], y: [min, max], size: [width, height] })` maps math coordinates into a frame whose top-left is `[0, 0]` and whose y goes up. Put what you draw on it in one `<Group offset={…}>`. `<Axes plane stroke>` draws axes and takes `ticks`, `grid` (`StrokeProps | false`) and `labels={{ font, size, fill }}`.

| Call | Gives |
| --- | --- |
| `p.point([x, y])` | the pixel point, for `at` and arrows |
| `p.plot(f, { from, to, samples })` | the curve, split where it leaves the y range |
| `p.parametric(f, [t0, t1])`, `p.segment(a, b)`, `p.polygon(points)` | curves and outlines in plane coordinates |
| `p.area(f, { from, to, base })` | the region between `f` and `base` (a number or a function) |
| `p.riemann(f, { from, to, n, at })` | `{ bars, sum }` (`at` is where in each bar `f` is sampled: 0 the left edge, 0.5 the middle, 1 the right; default 0): one `{ key, geometry, height }` per bar, keyed by its left edge |
| `p.slope(f, x)`, `p.tangent(f, x, { length })`, `p.secant(f, x, h, { length })` | slopes and lines `length` pixels long through `(x, f(x))` |
| `p.vector(to, { from, width, head })` | an arrow as one filled outline |
| `p.grid(step)`, `p.axes()` | the grid and axis lines |
| `p.transform(map, amount)` | the same plane with every point moved `amount` of the way to `map`, a 2×2 matrix or `([x, y]) => [x, y]` |

Every call returns geometry, so the scene styles and moves it:

```tsx
const amount = track(0).to(1, span(2, 2), ease.inOut).rewind(1.5);

<Group offset={[40, 70]} clip={rect(400, 400)}>
  <Shape geometry={amount.map((t) => p.transform([[3, 1], [0, 2]], t).grid(1))} stroke={{ color: theme.border }} />
  <Shape geometry={amount.map((t) => p.transform([[3, 1], [0, 2]], t).vector([1, 0]))} fill={theme.yellow} />
</Group>
```

A derived geometry must keep its number of points: map a track through `transform()`, `tangent()`, `secant()` or a `plot()` that stays inside the y range. A matrix moves straight lines, so it costs four keys; a function bends lines and costs more. Morph Riemann sums with `morph.between` over states that map `bars` to keyed `<Shape>`s. Clip a transformed grid with `clip={rect(width, height)}`.

## Constructions

Pure functions of points, for compass-and-straightedge figures: `crossings(circle, circleOrLine)` (zero to two points; a circle is `{ center, radius }`), `meet([a, b], [c, d])`, `foot(p, a, b)`, `bisect(from, vertex, to)`, `midpoint`, `extend`, `distance`; `compass(center, through, { sweep })`, a circle that starts at `through` so `draw` swings from it; `angle(from, vertex, to, { radius })`, `rightAngle(…, { size })`, `ticks(a, b, { count })`; `brace(width, { height })`, a curly brace pointing down with `[0, 0]` at its top-left, to stroke.

## Errors

`<Tex>` can't read the TeX (the message after the colon is MathJax's), colors part of the source with `\color{…}` that `colors` doesn't name, can't draw a stretched symbol, names two parts alike, or `Tex.measure()` finds no part of that name. `plot()` draws nothing when the y range or x span excludes it; a transform that sends a point somewhere not finite, and a derived plot that leaves the y range somewhere (so its geometry changes shape), also throw.

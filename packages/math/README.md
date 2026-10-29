# @svjeez/math

TeX equations for [svjeez](https://www.npmjs.com/package/svjeez) scenes. `tex()` typesets a formula with MathJax while the scene compiles and gives back one `<path>` per glyph, placed in scene pixels. Because every glyph is its own piece, `morph()` can carry an equation from one form to the next the way Manim does, and the SVG it ends up in is still one file with no JavaScript and no font to load.

<p align="center">
  <a href="https://github.com/saiashirwad/svjeez/tree/main/examples/math"><img src="https://raw.githubusercontent.com/saiashirwad/svjeez/main/examples/dist/math.svg" width="640" alt="(a+b)^2 morphs into a^2+2ab+b^2 with a brace on the cross term, divides by a+b, and generalizes to the binomial theorem." /></a>
  <br /><sub>An equation morphs glyph by glyph into the binomial theorem</sub>
</p>

## Install

```sh
npm i -D @svjeez/math svjeez
```

## Use

```tsx
import { tex } from "@svjeez/math";
import { render } from "svjeez";
import { Brace, morph } from "svjeez/extras";

const at = { x: 40, y: 80, fontSize: 40 };
const square = tex(String.raw`(a+b)^2`, at);
const expanded = tex(String.raw`a^2 + \cssId{mid}{2ab} + b^2`, at);
const m = morph([square, expanded, square], { at: [1.5, 4], over: 1 });

export default () =>
  render(
    { width: 480, height: 200, duration: 6, title: "Binomial square" },
    <>
      {m.node}
      <Brace
        target={expanded.get("mid")}
        side="below"
        label="cross term"
        during={{ at: 2.5, over: 1.5 }}
      />
    </>,
  );
```

`tex(source, options)` takes:

- `x` and `y`, the top-left of the formula's box in px. They default to 0.
- `fontSize`, the pixels in one em. It defaults to 32.
- `theme`, a `Base16` palette whose `plain` color paints the formula. It defaults to `defaultDark`.
- `color`, which replaces the theme's plain color.
- `display`, which sets display style. It defaults to `true`.
- `anchor`, the point of the box that `x` and `y` place, as fractions of its width and height. `[0.5, 0.5]` centers the formula on `x`, `y`. It defaults to `[0, 0]`, the top-left.

The formula it returns has:

- `node`, the formula as one group of glyphs.
- `bounds`, `width` and `height`, the formula's box.
- `words`, every glyph and bar in reading order. Each has `char`, `size`, `d`, `matrix`, `fill`, `bounds` and the `text`, `x`, `y` and `id` that `morph()` pairs by.
- `get(id)`, the box of everything under `\cssId{id}{…}`.
- `find(text, nth)`, the box of the `nth` run of consecutive glyphs that spell `text`, such as `find("2ab")`.
- `draw(glyph, animation)`, one glyph in a group that carries the animation.
- `write({ at, over }, { stroke })`, the formula written on in reading order like Manim's `Write`: each glyph's outline draws, then fills. Glyphs start one after another across `over`, and each takes `stroke` seconds, 0.6 by default.

## How glyphs pair

`morph()` pairs a glyph in one version with the same character at the same size in the next, and moves it. It cannot scale, so a superscript `2` never pairs with a full-size `2`: it fades out while the other fades in. A fraction bar pairs only with a bar of the same length. Glyphs the next version lacks fade out, and new ones fade in. Wrap a part in `\cssId{name}{…}` in both versions to pair it by name whatever it holds.

`\color{red}{x}` paints a part, and the theme paints the rest.

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

`plane({ origin, unit, extent, step, theme })` draws a coordinate grid that moves. Chain `apply(matrix, { at, over, ease })`, `applyFunction(f, { at, over, ease })` and `reset({ at, over })`, then draw from the plane those calls return. Pass `p.css` to `render`'s `css`.

```tsx
const p = plane({ origin: { x: 160, y: 240 }, unit: 34, extent: 10 }).apply(
  [
    [2, -1],
    [1, 1],
  ],
  { at: 2, over: 2.5 },
);

<>
  {p.background}
  {p.grid}
  {p.axes}
  {p.polygon([[0, 0], [1, 0], [1, 1], [0, 1]])}
  {p.basis({ enter: { at: 1, over: 0.5 } })}
</>;
```

- A matrix is written by rows: `[[a, b], [c, d]]` sends (x, y) to (ax + by, cx + dy). A third number in a row translates. Each step applies on top of the ones before it.
- `background` stays put. `grid` and `axes` move.
- `vector(to, { color, width, label, from, enter })` is an arrow whose head stays upright under any shear and whose TeX label rides past its tip. `basis()` draws î and ĵ.
- `polygon(points)`, `span(direction)` and `label(at, content)` move with the plane. An eigenvector's span stays on itself.
- `point(x, y)` and `map(x, y)` give scene pixels before and after every step.

When every step is a matrix, the plane is one CSS transform driven by registered properties, so the file stays small. A function step, such as z ↦ z² written as `(x, y) => [x * x - y * y, 2 * x * y]`, samples every outline and morphs it through `d`.

## Errors

A formula MathJax cannot read throws `tex() could not parse "…": <MathJax's message>`, so a typo fails the build instead of drawing red text. A character the MathJax font lacks, such as `é` or an emoji, throws `tex() cannot draw "…"`. Write accents with TeX, as in `\'e`. `construct()` throws on a crossing that does not exist, such as two circles that miss, and names what to change.

## Notes

MathJax runs once per formula on the build machine. `mathjax-full` is its only dependency, and it loads on Node 20 and later.

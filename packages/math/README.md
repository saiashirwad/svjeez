# @svjeez/math

TeX equations for [svjeez](https://www.npmjs.com/package/svjeez) scenes. `tex()` typesets a formula with MathJax while the scene compiles and gives back one `<path>` per glyph, placed in scene pixels. Because every glyph is its own piece, `morph()` can carry an equation from one form to the next the way Manim does, and the SVG it ends up in is still one file with no JavaScript and no font to load.

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

A formula MathJax cannot read throws `tex() could not parse "…": <MathJax's message>`, so a typo fails the build instead of drawing red text. A character the MathJax font lacks, such as `é` or an emoji, throws `tex() cannot draw "…"`. Write accents with TeX, as in `\'e`. `construct()` throws on a crossing that does not exist, such as two circles that miss, and names what to change.

## Notes

MathJax runs once per formula on the build machine. `mathjax-full` is its only dependency, and it loads on Node 20 and later.

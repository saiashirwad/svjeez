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

A formula MathJax cannot read throws `tex() could not parse "…": <MathJax's message>`, so a typo fails the build instead of drawing red text. A character the MathJax font lacks, such as `é` or an emoji, throws `tex() cannot draw "…"`. Write accents with TeX, as in `\'e`.

## Notes

MathJax runs once per formula on the build machine. `mathjax-full` is its only dependency, and it loads on Node 20 and later.

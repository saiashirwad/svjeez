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

The formula it returns has:

- `node`, the formula as one group of glyphs.
- `bounds`, `width` and `height`, the formula's box.
- `words`, every glyph and bar in reading order. Each has `char`, `size`, `d`, `matrix`, `fill`, `bounds` and the `text`, `x`, `y` and `id` that `morph()` pairs by.
- `get(id)`, the box of everything under `\cssId{id}{…}`.
- `find(text, nth)`, the box of the `nth` run of consecutive glyphs that spell `text`, such as `find("2ab")`.
- `draw(glyph, animation)`, one glyph in a group that carries the animation.

## How glyphs pair

`morph()` pairs a glyph in one version with the same character at the same size in the next, and moves it. It cannot scale, so a superscript `2` never pairs with a full-size `2`: it fades out while the other fades in. A fraction bar pairs only with a bar of the same length. Glyphs the next version lacks fade out, and new ones fade in. Wrap a part in `\cssId{name}{…}` in both versions to pair it by name whatever it holds.

`\color{red}{x}` paints a part, and the theme paints the rest.

## Errors

A formula MathJax cannot read throws `tex() could not parse "…": <MathJax's message>`, so a typo fails the build instead of drawing red text. A character the MathJax font lacks, such as `é` or an emoji, throws `tex() cannot draw "…"`. Write accents with TeX, as in `\'e`.

## Notes

MathJax runs once per formula on the build machine. `mathjax-full` is its only dependency, and it loads on Node 20 and later.

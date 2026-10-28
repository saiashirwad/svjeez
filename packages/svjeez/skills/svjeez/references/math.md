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

- `x` and `y` are the top-left of the formula's box. `fontSize` is the pixels in one em, default 32. `theme` paints the formula with its `plain` color, and `color` overrides that. `display: false` sets inline style.
- `.node` draws the formula. `.bounds`, `.width` and `.height` give its box.
- `.get("mid")` is the box of everything wrapped in `\cssId{mid}{…}`. `.find("2ab")` is the box of consecutive glyphs that spell it, and `.find("2", 2)` takes the second match. Both return a `Rect` for `Brace` (give its label a `fontSize` to match the formula), `Underline`, `Callout`, `Marker`, `Focus` and `Camera`.
- `.words` lists the glyphs and bars in reading order. A glyph has `char`, `size`, `d`, `matrix`, `fill`, `bounds` and the `text`, `x`, `y` and `id` that `morph()` uses.

## Equation transforms

`morph()` takes any `tex()` formulas. A glyph carries over when the next version has the same character at the same size, and moves to its new place. Everything else fades: glyphs only in the old version fade out and glyphs only in the new version fade in. `morph` translates and cannot scale, so a superscript `2` never pairs with a full-size `2`, and a fraction bar pairs only with a bar of the same length.

- Place every version at the same `x` and `y`, so a glyph's move is the move in the algebra.
- Wrap a part in `\cssId{name}{…}` in both versions to pair it by name, even when its glyphs change. Pieces under an id also give you `get(name)`.
- `gutter` is for `code()`. It is a type error with formulas.
- Bold, italic and upright forms of one letter share a key, so `\mathbf{a}` can pair with `a` and jump in shape. Name both with the same `\cssId` instead.

`\color{red}{x}` paints the part it wraps. Everything else takes the theme.

## Errors

| Error | Fix |
| --- | --- |
| `tex() could not parse "…": …` | The message after the colon is MathJax's. Fix the TeX. Unknown macros are errors here, not red text. |
| `tex() cannot draw "…" in "…": the MathJax font has no glyph for it.` | The character is outside MathJax's font: accents, emoji, CJK. Use TeX, as in `\'e`, or draw the text with `<text>`. |
| `tex() cannot draw a <svg> element in "…"` | `\overbrace` and `\underbrace` are built from clipped pieces this package cannot place. Draw a `<Brace>` under the part instead. |
| `tex() could not read the box MathJax drew for …` | `\tag` draws a full-width table. Leave the number out and draw it as text. |
| `tex.get() found no part named "…".` | Wrap the part in `\cssId{name}{…}`. |
| `tex.find() found … of "…", not ….` | The text spells nothing, or fewer matches, among consecutive glyphs. Fractions list the numerator, the denominator, then the bar. |
| `tex() needs finite coordinates and a positive fontSize, got …` | Pass numbers. |
| `morph() draws a gutter only for code() versions.` | Drop `gutter`. |

In Bun, a non-ASCII character in `String.raw` arrives as a `\u{…}` escape. Write such characters in a plain string, or as TeX.

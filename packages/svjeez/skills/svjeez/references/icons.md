# Icons

`@svjeez/icons` (`npm i @svjeez/icons@next`) holds about 8,500 Tabler and Lucide icons as data and an `<Icon>` node that draws one. It needs `svjeez` as a peer. The root exports `Icon` and the `IconData` type; the icons come from `@svjeez/icons/tabler` and `@svjeez/icons/lucide`, imported by name, so unused ones never reach the scene.

```tsx
import { Icon } from "@svjeez/icons";
import { heartFilled, rocket } from "@svjeez/icons/tabler";
import { enter, span, track } from "svjeez";

<Icon icon={rocket} at={[40, 40]} size={48} color={theme.text} draw={(piece) => track(0).to(1, span(0.2, 0.6).shift(piece * 0.1))} />
<Icon icon={heartFilled} size={48} color={theme.red} motion={enter(span(1, 0.5), { from: { scale: 0.3 } })} />
```

## Sets

| Import | Names |
| --- | --- |
| `@svjeez/icons/tabler` | camelCase: `arrowLeft`. Solid versions end in `Filled`: `heartFilled`. |
| `@svjeez/icons/lucide` | camelCase: `arrowLeft`. All outlines. |

A name that is a reserved word or starts with a digit gets an `icon` prefix, as in `iconDelete`. A hyphen between two digits becomes `_`, as in `arrowUp1_0`.

## Props

`<Icon>` takes every node prop (`key ref at anchor offset origin rotate scale opacity motion clip mask effects blend scheme`) and moves as one node.

| Prop | |
| --- | --- |
| `icon` | an `IconData`, `{ grid, kind, paths }`: `kind` is `"outline"` or `"solid"`, and each path is one piece. Yours works too. |
| `color` | required. Strokes an outline icon and fills a solid one: a hex, a token, a gradient or a track. |
| `size` | the side of its grid square in px; the grid (24 for both sets) if left out |
| `stroke` | outline icons only: a partial `StrokeProps` over the default (width 2 in the icon's own grid units, so a 48px icon strokes at 4px) |
| `draw` | outline icons only: a number or track from 0 to 1, or `(piece, pieces) => …` returning one of those, to give each piece its own |

## Placing

An icon's box is what it paints at its `size`, like every node's, so `at` and `anchor` place the drawn glyph, not the grid square around it, and a `<Stack>` or `<Grid>` lays out the size it is drawn at. To place the square instead, give `offset`: where the square's top-left goes, as on a `<Group>`. Glyphs differ in shape: to line icons up, wrap each in a `<Center width height>` of one size, or place each by `offset`.

## Animating

An outline icon has one piece per stroke, so `draw={(piece) => track(0).to(1, span(0.3, 0.7).shift(piece * 0.25))}` strokes the pieces on in order. A solid icon is usually one piece with no outline to draw: bring it in with `motion` (`enter`, a scale track). Repeated still icons are shared by the SVG automatically, so a row of identical icons is cheap; give each its own `at`, `opacity` and `motion`.

## Errors

Each error names the `<Icon>` and its line with a fix: a solid icon has no outline to `draw` or give a `stroke`, a `size` or stroke `width` that isn't positive, or an icon of your own whose paths are empty or aren't path data.

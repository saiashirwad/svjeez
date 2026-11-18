# Icons

`@svjeez/icons` (`npm i @svjeez/icons@next`) holds about 8,500 Tabler and Lucide icons as data and an `<Icon>` node that draws one. It needs `svjeez` as a peer. The root exports `Icon` and the `IconData` type; the icons come from `@svjeez/icons/tabler` and `@svjeez/icons/lucide`, imported by name, so unused ones never reach the scene.

```tsx
import { Icon } from "@svjeez/icons";
import { heartFilled, rocket } from "@svjeez/icons/tabler";
import { draw, enter, span } from "svjeez";

<Icon icon={rocket} at={[40, 40]} size={48} color={theme.text} trim={(piece) => draw(span(0.2, 0.6).shift(piece * 0.1))} />
<Icon icon={heartFilled} size={48} color={theme.red} motion={enter(span(1, 0.5), { from: { scale: 0.3, opacity: 0 } })} />
```

## Sets

| Import | Names |
| --- | --- |
| `@svjeez/icons/tabler` | camelCase: `arrowLeft`. Solid versions end in `Filled`: `heartFilled`. |
| `@svjeez/icons/lucide` | camelCase: `arrowLeft`. All outlines. |

A name that is a reserved word or starts with a digit gets an `icon` prefix, as in `iconDelete`. A hyphen between two digits becomes `_`, as in `arrowUp1_0`.

## Props

`<Icon>` takes every prop a node takes (`key`, `ref`, `at`, `anchor`, `origin`, `rotate`, `scale`, `opacity`, `motion`, `clip`, `mask`, `effects`) and moves as one node.

| Prop | |
| --- | --- |
| `icon` | an `IconData`, `{ grid, kind, paths }`: `kind` is `"stroke"` for an outline or `"fill"` for a solid icon, and each path is one piece. Yours works too. |
| `color` | required. Strokes an outline icon and fills a solid one. A hex, a token, a gradient or a track. |
| `size` | the side of its grid square in px; the grid (24 for both sets) if left out |
| `width` | outline icons only: the stroke width in the icon's own grid units, 2 if left out. It scales with `size`, so a 48px icon strokes at 4px. |
| `trim` | outline icons only: a `draw()` or a track of `[from, to]`, or `(piece, pieces) => track` to give each piece its own |
| `shared` | draw the icon once for every shared `<Icon>` with the same icon, color, width and size, and place it many times |

## Placing

An icon's box is what it paints at its `size`, like every node's, so `at` and `anchor` place the drawn glyph, not the 24-unit square around it, and a `<Stack>` or `<Grid>` lays out the size it is drawn at. Glyphs of different shapes differ in size: to line icons up in a row or a grid, wrap each in a `<Center width={…} height={…}>` of one size.

## Animating

An outline icon has one piece per stroke, so `trim={(piece) => draw(span(0.3, 0.7).shift(piece * 0.25))}` strokes the pieces on in order. A solid icon is usually one piece with no outline to trim: bring it in with `motion`, such as `enter(span, { from: { scale: 0.3, opacity: 0 } })`. A few outline icons hold a solid piece, such as the dots of Lucide's `galaxy`; they stroke like the rest.

## Reusing an icon

Each plain `<Icon>` writes its paths into the SVG. When a scene draws the same icon many times (a row of ratings, a list of bullets), add `shared` to each: the paths are written once and every use costs a placement. A shared icon's `color` must be a hex or a token, and it takes no `trim`, because the one drawing is the same for every use. Move each use with its own `at`, `opacity` and `motion`.

## Errors

The error names the `<Icon>` and its line. They say, for example, that a solid icon has no outline to `trim` or give a `width`, that a shared icon's color changes over time, or that an icon of your own has an empty or unreadable path.

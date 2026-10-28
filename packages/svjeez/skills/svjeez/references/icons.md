# Icons

`<Icon>` draws an icon from path data. `@svjeez/icons` is a separate package with about 8,000 of them: `npm i -D @svjeez/icons`.

```tsx
import { rocket, heartFilled } from "@svjeez/icons/tabler";
import { circle } from "@svjeez/icons/lucide";
import { Icon, draw } from "svjeez";

const drawn = (
  <Icon icon={rocket} x={40} y={40} size={48} stroke="#fff" animation={(_, i) => draw({ at: 0.2 + i * 0.1, over: 0.6 })} />
);
const solid = <Icon icon={heartFilled} x={120} y={40} size={48} fill="#e5432d" alt="Favorite" />;
```

## Sets

| Import | Names |
| --- | --- |
| `@svjeez/icons/tabler` | camelCase: `arrowLeft`. Filled versions end in `Filled`: `heartFilled`. |
| `@svjeez/icons/lucide` | camelCase: `arrowLeft`. All outlines. |

A name that is a reserved word or starts with a digit gets an `icon` prefix, as in `iconDelete`. A hyphen between two digits becomes `_`, as in `arrowUp1_0`. Import the icons you use by name; unused ones never reach the scene.

## Props

- `icon` is `{ grid, kind, paths }`. You can pass your own.
- `x`, `y` is the top-left corner. `size` is the side in px and defaults to the icon's grid, 24 for both sets.
- `stroke` paints an outline icon and `fill` paints a filled one. Both default to `currentColor`, so a `color` on a parent works.
- `strokeWidth` is in grid units and defaults to 2. It scales with `size`, so a 48px icon strokes at 4px. Outline icons only.
- `alt` makes the icon an image for assistive tech. Without it the icon is hidden from it.
- `opacity`, `filter` and `class` go on the group.
- `animation` runs on every path. Pass `(d, index) => stack` to vary it by path.

## Animating

An outline icon has one path per piece, so `draw` with a delay that grows with the index strokes the pieces on in order. `draw` works under the scaled group; it measures along each path, not the screen. A filled icon is usually one path, so pop it in with `motion` on a wrapping `<g>` rather than `draw`. To move the whole icon, animate the wrapper too, and give it `style={{ transformOrigin }}` at the icon's center.

A few outline icons hold a solid piece, such as the dots of Lucide's `galaxy`. They stroke like the rest.

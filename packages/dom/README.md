# @svjeez/dom

Turns real HTML and CSS into svjeez nodes you can animate. Chromium lays the markup out, and `@svjeez/dom` reads every box, border, shadow, text line and inline icon back as SVG. It works the same whatever made the markup: React, Svelte, plain HTML, or a page in a running app.

```tsx
import { Dom, Morph, snapshotter } from "@svjeez/dom";

const shot = await snapshotter({ css: tailwindCss, fonts: [geist] });
const before = await shot.html(renderToStaticMarkup(<Card />));
const after = await shot.html(renderToStaticMarkup(<Card merged />));
await shot.close();

<Dom snapshot={before} parts={{ submit: press }} />          // one state; animate any data-part
<Morph from={before} to={after} at={1} over={0.7} />         // one state turning into the other
```

- Pass the fonts the page uses, so the drawn text matches the layout.
- Each snapshot is taken in the light and the dark scheme, and colors follow the viewer's (`schemes: false` turns this off). The dark pass sets `prefers-color-scheme: dark` and adds `.dark` to `<html>`.
- `Morph` pairs elements by `data-part`, else by tag and classes in sibling order. Paired boxes reshape and recolor, text and icons slide, and the rest fade.
- Not drawn yet: gradients, rotated or scaled elements, `::before` and `::after`, `z-index`.

Needs `playwright-core` and `npx playwright-core install chromium-headless-shell`.

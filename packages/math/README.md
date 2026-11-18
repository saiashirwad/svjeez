# @svjeez/math

Typeset TeX as SVG glyph paths and animate plots, geometric constructions and mathematical transformations.

```sh
npm i -D @svjeez/math svjeez
```

```tsx
import { tex } from "@svjeez/math";
import { render, Brace, morph } from "svjeez";

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
        target={expanded.part("mid").box}
        side="below"
        label="cross term"
        show={{ at: 2.5, over: 1.5 }}
      />
    </>,
  );
```

Use `plane()` to share coordinates between plots, secants, tangents and area fills. `construct()` animates compass-and-straightedge steps. Field helpers draw vectors, streamlines and contours.

<a href="https://github.com/saiashirwad/svjeez/tree/main/examples/math"><img src="https://raw.githubusercontent.com/saiashirwad/svjeez/main/examples/dist/math.svg" width="540" alt="An equation expands and its terms move into place." /></a>

[Fields and contours](https://github.com/saiashirwad/svjeez/blob/main/packages/svjeez/skills/svjeez/references/fields.md)

[API reference](https://github.com/saiashirwad/svjeez/blob/main/packages/svjeez/skills/svjeez/references/math.md)

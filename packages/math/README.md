# @svjeez/math

TeX typeset into glyph outlines, plots on a plane, compass-and-straightedge constructions and plane transformations for svjeez. MathJax runs while the scene builds; the SVG holds only shapes.

```sh
npm i -D @svjeez/math@next svjeez@next
```

```tsx
import { Axes, Tex, plane } from "@svjeez/math";
import { Group, Shape, morph, scene, span } from "svjeez";

const graph = plane({ x: [-4, 2], y: [0, 9], size: [440, 340] });

export default scene({ size: [960, 540], duration: 6, title: "(a + b)²" }, () => (
  <Group>
    {morph(
      <Tex size={60} at={[48, 280]} fill="#161A21">{"(a+b)^2"}</Tex>,
      <Tex size={60} at={[48, 280]} fill="#161A21">{"a^2+2ab+b^2"}</Tex>,
      span(2, 1),
    )}
    <Group at={[462, 84]}>
      <Axes plane={graph} stroke={{ color: "#6E6E73" }} />
      <Shape geometry={graph.plot((a) => (a + 1) ** 2)} stroke={{ color: "#0A6CFF", width: 2.5 }} draw={track(0).to(1, span(0.5, 1.5))} />
    </Group>
  </Group>
));
```

Each glyph is a keyed `<Shape>`, so `morph()` moves the ones two formulas share, and `\cssId{name}{…}` makes a part a ref's `part("name")` can reach.

[API reference](https://github.com/saiashirwad/svjeez/blob/next/packages/svjeez/skills/svjeez/references/math.md)
